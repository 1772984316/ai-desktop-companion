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
  ProcStatus,
} from '../types/agent';

const api: NanobotAPI = {
  send(content: string, id?: string): void {
    const payload: IpcSendPayload = { content, id };
    ipcRenderer.send('nanobot:send', payload);
  },

  onMessage(callback: (msg: IpcMessagePayload) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: IpcMessagePayload) =>
      callback(payload);
    ipcRenderer.on('nanobot:message', handler);
    return () => ipcRenderer.removeListener('nanobot:message', handler);
  },

  onStatus(callback: (status: IpcStatusPayload) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: IpcStatusPayload) =>
      callback(payload);
    ipcRenderer.on('nanobot:status', handler);
    return () => ipcRenderer.removeListener('nanobot:status', handler);
  },

  onProcStatus(callback: (status: ProcStatus) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: ProcStatus) =>
      callback(payload);
    ipcRenderer.on('nanobot:proc-status', handler);
    return () => ipcRenderer.removeListener('nanobot:proc-status', handler);
  },
};

contextBridge.exposeInMainWorld('nanobotAPI', api);

// ── 飞书配置 API ───────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('feishuAPI', {
  validate(payload: { appId: string; appSecret: string }) {
    return ipcRenderer.invoke('feishu:validate', payload);
  },
  apply(payload: {
    appId: string;
    appSecret: string;
    encryptKey?: string;
    verificationToken?: string;
    allowFrom?: string[];
  }) {
    return ipcRenderer.invoke('feishu:apply', payload);
  },
  getSteps() {
    return ipcRenderer.invoke('feishu:get-steps');
  },
  openPlatform() {
    ipcRenderer.send('feishu:open-platform');
  },
  openSetup() {
    ipcRenderer.send('feishu:open-setup');
  },
  notifyRestart() {
    ipcRenderer.send('nanobot:restart');
  },
  autoCreate(opts?: { appName?: string; appDesc?: string }) {
    ipcRenderer.send('feishu:auto-create', opts);
  },
  cancelAutoCreate() {
    ipcRenderer.send('feishu:auto-create-cancel');
  },
  onCreateProgress(callback: (progress: unknown) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on('feishu:create-progress', handler);
    return () => ipcRenderer.removeListener('feishu:create-progress', handler);
  },
});
