/**
 * types/agent.ts
 * 所有 Agent ↔ Electron IPC 通信的类型定义（纯 TypeScript，无 WebSocket）。
 */

// ── IPC 频道（主进程 ↔ 渲染进程）───────────────────────────────────────────

/** 渲染进程 → 主进程：发送消息 */
export interface IpcSendPayload {
  content: string;
  id?: string;
}

/** 主进程 → 渲染进程：Agent 回复 */
export interface IpcMessagePayload {
  type: 'message' | 'error';
  role?: 'assistant';
  sessionId?: string;
  content: string;
  partial: boolean;
  done: boolean;
  metadata?: Record<string, unknown>;
}

/** 主进程 → 渲染进程：连接状态 */
export interface IpcStatusPayload {
  connected: boolean;
}

/** 主进程 → 渲染进程：Agent 进程状态 */
export interface ProcStatus {
  phase: 'starting' | 'ready' | 'error' | 'stopped';
  message?: string;
}

// ── contextBridge 暴露的 API 类型（渲染进程使用）──────────────────────────

export interface NanobotAPI {
  send(content: string, id?: string): void;
  onMessage(callback: (msg: IpcMessagePayload) => void): () => void;
  onStatus(callback: (status: IpcStatusPayload) => void): () => void;
  onProcStatus(callback: (status: ProcStatus) => void): () => void;
}

// 扩展全局 window（渲染进程使用）
declare global {
  interface Window {
    nanobotAPI: NanobotAPI;
  }
}
