/**
 * ipc/handler.ts
 * --------------
 * 注册所有 Agent 相关的 Electron IPC 处理器。
 *
 * IPC 频道：
 *  渲染 → 主进程:  'nanobot:send'       payload: { content: string; id?: string }
 *  主进程 → 渲染:  'nanobot:message'    payload: MessagePayload
 *  主进程 → 渲染:  'nanobot:status'     payload: { connected: boolean }
 *  主进程 → 渲染:  'nanobot:proc-status' payload: { phase, message? }
 */

import { BrowserWindow, ipcMain } from 'electron';
import { v4 as uuid } from 'uuid';
import { AgentLoop } from '../agent/loop';
import type { InboundMessage } from '../bus/events';

export interface MessagePayload {
  type: 'message' | 'error';
  role?: 'assistant';
  sessionId?: string;
  content: string;
  partial: boolean;
  done: boolean;
}

export function registerAgentIpc(
  win: BrowserWindow,
  agent: AgentLoop,
  sessionId: string,
): void {
  ipcMain.on('nanobot:send', (_event, payload: { content: string; id?: string }) => {
    const { content, id } = payload;
    if (!content?.trim()) return;

    const msgId = id ?? uuid();

    const msg: InboundMessage = {
      channel: 'desktop',
      senderId: 'desktop-user',
      chatId: sessionId,
      content,
      timestamp: new Date(),
      metadata: { clientMsgId: msgId },
    };

    // 异步处理，不阻塞 IPC
    handleMessage(win, agent, msg, sessionId).catch(err => {
      console.error('[IPC] Error handling message:', err);
      sendMessage(win, {
        type: 'error',
        content: '处理消息时出错，请稍后重试。',
        partial: false,
        done: true,
      });
    });
  });

  // 通知渲染进程 Agent 已就绪
  sendStatus(win, true);
  sendProcStatus(win, 'ready', 'Agent 已就绪');
}

async function handleMessage(
  win: BrowserWindow,
  agent: AgentLoop,
  msg: InboundMessage,
  sessionId: string,
): Promise<void> {
  // 发送进度回调（工具提示用 partial=true）
  const onProgress = (content: string, isToolHint?: boolean) => {
    if (isToolHint) {
      sendMessage(win, {
        type: 'message',
        role: 'assistant',
        sessionId,
        content: `[工具调用] ${content}`,
        partial: true,
        done: false,
      });
    } else {
      sendMessage(win, {
        type: 'message',
        role: 'assistant',
        sessionId,
        content,
        partial: true,
        done: false,
      });
    }
  };

  try {
    const response = await agent.process(msg, onProgress);

    sendMessage(win, {
      type: 'message',
      role: 'assistant',
      sessionId,
      content: response.content,
      partial: false,
      done: true,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    sendMessage(win, {
      type: 'error',
      content: `错误：${errMsg}`,
      partial: false,
      done: true,
    });
  }
}

function sendMessage(win: BrowserWindow, payload: MessagePayload): void {
  if (!win.isDestroyed()) {
    win.webContents.send('nanobot:message', payload);
  }
}

function sendStatus(win: BrowserWindow, connected: boolean): void {
  if (!win.isDestroyed()) {
    win.webContents.send('nanobot:status', { connected });
  }
}

function sendProcStatus(win: BrowserWindow, phase: string, message?: string): void {
  if (!win.isDestroyed()) {
    win.webContents.send('nanobot:proc-status', { phase, message });
  }
}
