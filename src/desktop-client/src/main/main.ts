/**
 * main.ts
 * -------
 * Electron 主进程入口：
 *  1. 创建 BrowserWindow
 *  2. 自动启动 nanobot gateway（NanobotProcess）
 *  3. nanobot 就绪后建立 WebSocket 桥接（NanobotBridge）
 */

import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { NanobotBridge } from './nanobot-bridge';
import { NanobotProcess } from './nanobot-process';

let mainWindow: BrowserWindow | null = null;
let bridge:     NanobotBridge  | null = null;
let nanobotProc: NanobotProcess | null = null;

// ── 创建主窗口 ─────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width:     900,
    height:    680,
    minWidth:  520,
    minHeight: 400,
    frame:     true,
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload:          path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,   // 配合 contextBridge 安全隔离
      nodeIntegration:  false,
      sandbox:          false,  // preload 需要 ipcRenderer
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/chat.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
    bootNanobot(mainWindow!);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── nanobot 启动流程 ──────────────────────────────────────────────────
//  1. NanobotProcess 启动子进程，等待端口就绪
//  2. 端口就绪后 NanobotBridge 建立 WebSocket 连接

async function bootNanobot(win: BrowserWindow): Promise<void> {
  // 如果已有进程实例先清理
  nanobotProc?.kill();

  nanobotProc = new NanobotProcess(win);

  try {
    // 启动并等待 nanobot 端口就绪（最多 30 s）
    await nanobotProc.start();
  } catch (err) {
    console.error('[main] nanobot 启动失败:', err);
    return;
  }

  // nanobot 就绪 → 建立 WebSocket 桥接
  bridge?.disconnect();
  bridge = new NanobotBridge({
    win,
    url:   'ws://localhost:18790',
    token: '',   // 若 config.json desktop.token 有值，在此填写相同值
  });
  bridge.connect();
}

// ── 生命周期 ──────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  bridge?.disconnect();
  nanobotProc?.kill();
});
