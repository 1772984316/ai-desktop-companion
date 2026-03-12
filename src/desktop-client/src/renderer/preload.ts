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

// ── 飞书配置 API ───────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('feishuAPI', {
  /** 验证飞书凭证（调用 nanobot Python 向导服务） */
  validate(payload: { appId: string; appSecret: string }) {
    return ipcRenderer.invoke('feishu:validate', payload);
  },
  /** 将凭证写入 nanobot config.json */
  apply(payload: {
    appId: string;
    appSecret: string;
    encryptKey?: string;
    verificationToken?: string;
    allowFrom?: string[];
  }) {
    return ipcRenderer.invoke('feishu:apply', payload);
  },
  /** 获取手动操作步骤 */
  getSteps() {
    return ipcRenderer.invoke('feishu:get-steps');
  },
  /** 打开飞书开放平台（系统浏览器） */
  openPlatform() {
    ipcRenderer.send('feishu:open-platform');
  },
  /** 打开飞书配置弹窗 */
  openSetup() {
    ipcRenderer.send('feishu:open-setup');
  },
  /** 配置保存后通知主进程重启 nanobot gateway */
  notifyRestart() {
    ipcRenderer.send('nanobot:restart');
  },
  /** 启动一键自动创建流程 */
  autoCreate(opts?: { appName?: string; appDesc?: string }) {
    ipcRenderer.send('feishu:auto-create', opts);
  },
  /** 取消一键创建 */
  cancelAutoCreate() {
    ipcRenderer.send('feishu:auto-create-cancel');
  },
  /** 监听自动创建进度 */
  onCreateProgress(callback: (progress: any) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('feishu:create-progress', handler);
    return () => ipcRenderer.removeListener('feishu:create-progress', handler);
  },
});
