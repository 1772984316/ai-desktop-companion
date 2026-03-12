/**
 * nanobot-bridge.ts
 * -----------------
 * Electron 主进程模块：连接本机 nanobot WebSocket 服务端 (ws://localhost:18790)
 *
 * 职责：
 *  - 维护 WebSocket 连接（自动重连 + 心跳）
 *  - 接收 nanobot 回复，通过 IPC 推送给渲染进程
 *  - 接收渲染进程的发送请求，转发给 nanobot
 *
 * IPC 频道：
 *  渲染 → 主进程:  'nanobot:send'     payload: IpcSendPayload
 *  主进程 → 渲染:  'nanobot:message'  payload: IpcMessagePayload
 *  主进程 → 渲染:  'nanobot:status'   payload: IpcStatusPayload
 */

import { BrowserWindow, ipcMain } from 'electron';
import WebSocket from 'ws';
import { v4 as uuid } from 'uuid';
import type {
  IncomingFrame,
  OutgoingFrame,
  IpcSendPayload,
  IpcMessagePayload,
  IpcStatusPayload,
} from '../types/nanobot';

// ── 默认配置 ──────────────────────────────────────────────────────────
const DEFAULT_URL          = 'ws://localhost:18790';
const RECONNECT_DELAY_MS   = 3_000;   // 断线后 3 s 重连
const PING_INTERVAL_MS     = 25_000;  // 25 s 心跳

export interface BridgeOptions {
  /** 目标渲染窗口 */
  win: BrowserWindow;
  /** nanobot WebSocket 地址，默认 ws://localhost:18790 */
  url?: string;
  /** 可选共享 token，与 config.json desktop.token 保持一致 */
  token?: string;
}

export class NanobotBridge {
  private readonly win: BrowserWindow;
  private readonly url: string;
  private readonly token: string;

  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor({ win, url = DEFAULT_URL, token = '' }: BridgeOptions) {
    this.win   = win;
    this.url   = url;
    this.token = token;

    // 监听渲染进程的发送事件
    ipcMain.on('nanobot:send', (_event, payload: IpcSendPayload) => {
      this.sendToNanobot(payload);
    });
  }

  // ── 公共 API ────────────────────────────────────────────────────────

  /** 启动连接（在 BrowserWindow ready-to-show 之后调用）。 */
  connect(): void {
    this.stopped = false;
    this.doConnect();
  }

  /** 关闭连接并停止重连（在 app before-quit 中调用）。 */
  disconnect(): void {
    this.stopped = true;
    this.clearTimers();
    this.ws?.terminate();
    this.ws = null;
  }

  // ── 内部：连接逻辑 ───────────────────────────────────────────────────

  private doConnect(): void {
    if (this.stopped) return;

    console.log(`[NanobotBridge] Connecting to ${this.url} …`);
    this.pushStatus(false);

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on('open', () => {
      console.log('[NanobotBridge] Connection opened');
      // 若配置了 token，先发认证帧
      if (this.token) {
        this.sendFrame({ type: 'auth', token: this.token });
      }
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const frame: IncomingFrame = JSON.parse(data.toString('utf8'));
        this.handleFrame(frame);
      } catch (err) {
        console.error('[NanobotBridge] JSON parse error:', err);
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      console.warn(`[NanobotBridge] Disconnected (code=${code}, reason=${reason.toString()})`);
      this.clearTimers();
      this.pushStatus(false);
      this.sessionId = null;
      this.ws = null;
      if (!this.stopped) {
        this.reconnTimer = setTimeout(() => this.doConnect(), RECONNECT_DELAY_MS);
      }
    });

    ws.on('error', (err: Error) => {
      // 'close' 事件紧随其后，在那里统一处理重连
      console.error('[NanobotBridge] WS error:', err.message);
    });
  }

  // ── 内部：帧分发 ─────────────────────────────────────────────────────

  private handleFrame(frame: IncomingFrame): void {
    switch (frame.type) {
      case 'connected':
        this.sessionId = frame.sessionId;
        console.log(`[NanobotBridge] Session ID: ${this.sessionId}`);
        this.pushStatus(true);
        this.startPing();
        break;

      case 'message':
        this.pushToRenderer('nanobot:message', frame);
        break;

      case 'error':
        console.error('[NanobotBridge] nanobot error:', frame.message);
        this.pushToRenderer('nanobot:message', {
          type: 'error',
          message: frame.message,
        });
        break;

      case 'pong':
        // 心跳回应，忽略
        break;

      default:
        console.log('[NanobotBridge] Unknown frame:', frame);
    }
  }

  // ── 内部：向 nanobot 发消息 ──────────────────────────────────────────

  private sendToNanobot(payload: IpcSendPayload): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[NanobotBridge] Not connected — message dropped');
      this.pushToRenderer('nanobot:message', {
        type: 'error',
        message: '未连接到 nanobot，请稍后重试',
      });
      return;
    }

    const frame: OutgoingFrame = {
      type:     'message',
      id:       payload.id ?? uuid(),
      senderId: 'desktop-user',
      content:  payload.content,
    };
    this.sendFrame(frame);
  }

  private sendFrame(frame: OutgoingFrame): void {
    this.ws?.send(JSON.stringify(frame));
  }

  // ── 工具方法 ─────────────────────────────────────────────────────────

  private pushToRenderer(channel: string, payload: IpcMessagePayload | IpcStatusPayload): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send(channel, payload);
    }
  }

  private pushStatus(connected: boolean): void {
    this.pushToRenderer('nanobot:status', { connected } satisfies IpcStatusPayload);
  }

  private startPing(): void {
    this.clearTimers();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendFrame({ type: 'ping' });
      }
    }, PING_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.pingTimer)  { clearInterval(this.pingTimer);  this.pingTimer  = null; }
    if (this.reconnTimer){ clearTimeout(this.reconnTimer); this.reconnTimer = null; }
  }
}
