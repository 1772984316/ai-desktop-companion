/**
 * nanobot-process.ts
 * ------------------
 * 管理 nanobot gateway 子进程的生命周期。
 *
 * 功能：
 *  - 自动寻找 conda project 环境中的 nanobot 可执行文件
 *  - 启动 `nanobot gateway`，等待 WebSocket 端口就绪
 *  - 应用退出时干净地终止子进程
 *
 * IPC 频道（主进程 → 渲染进程）：
 *  'nanobot:proc-status'  payload: { phase: 'starting'|'ready'|'error'|'stopped', message?: string }
 */

import { BrowserWindow } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';

// ── 配置常量 ─────────────────────────────────────────────────────────────
const NANOBOT_WS_PORT    = 18790;
const STARTUP_TIMEOUT_MS = 30_000;   // 最多等 30 s 等 nanobot 就绪
const CHECK_INTERVAL_MS  = 500;      // 每 500 ms 探测一次端口

export type ProcPhase = 'starting' | 'ready' | 'error' | 'stopped';

export interface ProcStatus {
  phase: ProcPhase;
  message?: string;
}

/**
 * 寻找 nanobot 可执行文件路径。
 * 优先查找 conda project 环境；其次 PATH。
 */
function findNanobotExecutable(): string {
  // Windows conda 环境常见路径
  const candidates: string[] = [
    path.join('E:\\anaconda\\envs\\project\\Scripts\\nanobot.exe'),
    path.join(process.env.CONDA_PREFIX || '', 'Scripts', 'nanobot.exe'),
    path.join(process.env.CONDA_PREFIX || '', 'bin', 'nanobot'),
    'nanobot',   // 回退：直接用 PATH 中的 nanobot
  ];

  for (const p of candidates) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* ignore */ }
  }
  return 'nanobot';   // 最终回退
}

/**
 * 探测本地 TCP 端口是否已开放（nanobot WebSocket 就绪）。
 */
function checkPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const onError = () => { sock.destroy(); resolve(false); };
    sock.setTimeout(300);
    sock.on('error', onError);
    sock.on('timeout', onError);
    sock.connect(port, '127.0.0.1', () => {
      sock.destroy();
      resolve(true);
    });
  });
}

/**
 * 轮询端口，直到就绪或超时。
 * @returns true = 就绪，false = 超时
 */
async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkPortOpen(port)) return true;
    await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
  }
  return false;
}

// ── NanobotProcess 类 ────────────────────────────────────────────────────

export class NanobotProcess {
  private win: BrowserWindow;
  private proc: ChildProcess | null = null;
  private stopped = false;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  // ── 公共 API ──────────────────────────────────────────────────────────

  /**
   * 启动 nanobot gateway，等待 WebSocket 端口就绪后 resolve。
   * 若端口已被占用（说明外部已启动），直接 resolve。
   */
  async start(): Promise<void> {
    this.stopped = false;

    // 如果端口已经开放，无需再启动（用户手动开了 gateway）
    if (await checkPortOpen(NANOBOT_WS_PORT)) {
      console.log('[NanobotProcess] Port already open, skipping launch');
      this.pushStatus({ phase: 'ready', message: 'nanobot 已就绪（外部进程）' });
      return;
    }

    this.pushStatus({ phase: 'starting', message: '正在启动 nanobot…' });

    const exe = findNanobotExecutable();
    console.log(`[NanobotProcess] Launching: ${exe} gateway`);

    // 同步继承父进程环境，确保 conda 激活状态正确
    this.proc = spawn(exe, ['gateway'], {
      env:   { ...process.env, PYTHONNOUSERSITE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    // 把子进程日志转发到 Electron 控制台
    this.proc.stdout?.on('data', (d: Buffer) =>
      console.log('[nanobot]', d.toString().trim()));
    this.proc.stderr?.on('data', (d: Buffer) =>
      console.error('[nanobot]', d.toString().trim()));

    this.proc.on('exit', (code, sig) => {
      if (!this.stopped) {
        console.warn(`[NanobotProcess] Exited unexpectedly (code=${code}, sig=${sig})`);
        this.pushStatus({ phase: 'error', message: `nanobot 意外退出 (code=${code})` });
      }
      this.proc = null;
    });

    // 等待端口就绪
    const ready = await waitForPort(NANOBOT_WS_PORT, STARTUP_TIMEOUT_MS);
    if (ready) {
      console.log('[NanobotProcess] Ready on port', NANOBOT_WS_PORT);
      this.pushStatus({ phase: 'ready', message: 'nanobot 已就绪' });
    } else {
      console.error('[NanobotProcess] Startup timeout');
      this.pushStatus({ phase: 'error', message: 'nanobot 启动超时，请检查配置' });
      this.kill();
    }
  }

  /** 终止 nanobot gateway 子进程。 */
  kill(): void {
    this.stopped = true;
    if (this.proc) {
      console.log('[NanobotProcess] Killing nanobot process…');
      this.proc.kill('SIGTERM');
      // Windows 上 SIGTERM 可能无效，强制 kill
      setTimeout(() => { this.proc?.kill('SIGKILL'); }, 2_000);
      this.proc = null;
    }
    this.pushStatus({ phase: 'stopped' });
  }

  get isRunning(): boolean {
    return this.proc !== null && !this.stopped;
  }

  // ── 工具方法 ─────────────────────────────────────────────────────────

  private pushStatus(status: ProcStatus): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('nanobot:proc-status', status);
    }
  }
}
