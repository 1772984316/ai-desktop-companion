/**
 * nanobot.d.ts
 * 所有 nanobot ↔ Electron WebSocket 通信的类型定义
 */

// ─────────────────────────────────────────────
// Electron → nanobot  (发送帧)
// ─────────────────────────────────────────────

/** 用户发出的聊天消息 */
export interface SendFrame {
  type: 'message';
  id?: string;          // 客户端自生成的消息 ID（可选，用于回调追踪）
  senderId?: string;    // 用户标识，默认 'desktop-user'
  content: string;      // 消息文本
}

/** 心跳探针 */
export interface PingFrame {
  type: 'ping';
}

/** 可选：连接时携带 token 进行认证 */
export interface AuthFrame {
  type: 'auth';
  token: string;
}

/**
 * 会话恢复帧 — 连接建立后立即发送，
 * 让 nanobot 使用持久化的 sessionId 恢复历史对话。
 */
export interface InitFrame {
  type: 'init';
  sessionId: string;   // 存储在本地的持久化 UUID
}

export type OutgoingFrame = SendFrame | PingFrame | AuthFrame | InitFrame;

// ─────────────────────────────────────────────
// nanobot → Electron  (接收帧)
// ─────────────────────────────────────────────

/** 握手成功，服务端返回 sessionId */
export interface ConnectedFrame {
  type: 'connected';
  sessionId: string;
}

/**
 * 助手回复帧
 *  - partial=true  → 流式中间块，content 追加到气泡
 *  - partial=false → 最终回复（done=true）
 */
export interface MessageFrame {
  type: 'message';
  role: 'assistant';
  sessionId: string;
  content: string;
  partial: boolean;
  done: boolean;
  metadata?: Record<string, unknown>;
}

/** 心跳回应 */
export interface PongFrame {
  type: 'pong';
}

/** 服务端错误通知 */
export interface ErrorFrame {
  type: 'error';
  message: string;
}

export type IncomingFrame = ConnectedFrame | MessageFrame | PongFrame | ErrorFrame;

// ─────────────────────────────────────────────
// IPC 频道（主进程 ↔ 渲染进程）
// ─────────────────────────────────────────────

/** 渲染进程 → 主进程：发送消息 */
export interface IpcSendPayload {
  content: string;
  id?: string;
}

/** 主进程 → 渲染进程：nanobot 回复 */
export type IpcMessagePayload = MessageFrame | ErrorFrame;

/** 主进程 → 渲染进程：连接状态 */
export interface IpcStatusPayload {
  connected: boolean;
}

// ─────────────────────────────────────────────
// contextBridge 暴露的 API 类型（渲染进程使用）
// ─────────────────────────────────────────────

export interface NanobotAPI {
  /** 向 nanobot 发送聊天消息 */
  send(content: string, id?: string): void;
  /** 监听 nanobot 回复，返回取消订阅函数 */
  onMessage(callback: (msg: IpcMessagePayload) => void): () => void;
  /** 监听 WebSocket 连接状态变化，返回取消订阅函数 */
  onStatus(callback: (status: IpcStatusPayload) => void): () => void;
  /** 监听 nanobot 子进程状态（starting/ready/error/stopped） */
  onProcStatus(callback: (status: { phase: string; message?: string }) => void): () => void;
}

// 扩展全局 window（渲染进程使用）
declare global {
  interface Window {
    nanobotAPI: NanobotAPI;
  }
}
