/**
 * preload.ts
 * ----------
 * Electron 预加载脚本：通过 contextBridge 将主进程 IPC 安全暴露给渲染进程。
 * 渲染进程通过 window.nanobotAPI 访问所有功能，无需接触 Node.js。
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  NanobotAPI,
  IpcSendPayload,
  IpcMessagePayload,
  IpcStatusPayload,
} from '../types/nanobot';
import type { ProcStatus } from '../main/nanobot-process';

const api: NanobotAPI = {
  /** 向 nanobot 发送聊天消息 */
  send(content: string, id?: string): void {
    const payload: IpcSendPayload = { content, id };
    ipcRenderer.send('nanobot:send', payload);
  },

  /** 监听 nanobot 回复（流式 + 完整），返回取消订阅函数 */
  onMessage(callback: (msg: IpcMessagePayload) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: IpcMessagePayload) =>
      callback(payload);
    ipcRenderer.on('nanobot:message', handler);
    return () => ipcRenderer.removeListener('nanobot:message', handler);
  },

  /** 监听 WebSocket 连接状态，返回取消订阅函数 */
  onStatus(callback: (status: IpcStatusPayload) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: IpcStatusPayload) =>
      callback(payload);
    ipcRenderer.on('nanobot:status', handler);
    return () => ipcRenderer.removeListener('nanobot:status', handler);
  },

  /** 监听 nanobot 子进程状态（starting / ready / error / stopped） */
  onProcStatus(callback: (status: ProcStatus) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: ProcStatus) =>
      callback(payload);
    ipcRenderer.on('nanobot:proc-status', handler);
    return () => ipcRenderer.removeListener('nanobot:proc-status', handler);
  },
};

contextBridge.exposeInMainWorld('nanobotAPI', api);
