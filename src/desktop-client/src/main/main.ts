/**
 * main.ts
 * -------
 * Electron 主进程入口：
 *  1. 创建 BrowserWindow
 *  2. 自动启动 nanobot gateway（NanobotProcess）
 *  3. nanobot 就绪后建立 WebSocket 桥接（NanobotBridge）
 */

import { app, BrowserWindow, shell, ipcMain } from 'electron';
import * as path from 'path';
import { NanobotBridge } from './nanobot-bridge';
import { NanobotProcess } from './nanobot-process';
import { registerFeishuSetupIpc } from './feishu-setup';
import { registerFeishuAutoCreateIpc } from './feishu-auto-create';

let mainWindow: BrowserWindow | null = null;
let bridge:     NanobotBridge  | null = null;
let nanobotProc: NanobotProcess | null = null;
let ipcRegistered = false;

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
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    bootNanobot(mainWindow);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // 只注册一次全局 IPC 监听，避免重复注册
  if (!ipcRegistered) {
    ipcRegistered = true;

    // 注册飞书配置 IPC 处理器
    registerFeishuSetupIpc(mainWindow);
    // 注册飞书一键创建 IPC 处理器
    registerFeishuAutoCreateIpc(mainWindow);

    // 「设置飞书」菜单/按钮点击 → 打开配置弹窗
    ipcMain.on('feishu:open-setup', () => openFeishuSetupWindow());

    // 配置保存后重启 nanobot gateway
    ipcMain.on('nanobot:restart', () => {
      console.log('[main] 收到重启请求，重新启动 nanobot gateway...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        bootNanobot(mainWindow);
      }
    });
  }
}

// ── 飞书配置弹窗 ───────────────────────────────────────────────────────
let setupWin: BrowserWindow | null = null;

function openFeishuSetupWindow(): void {
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.focus();
    return;
  }
  setupWin = new BrowserWindow({
    width:  600,
    height: 720,
    title:  '飞书机器人配置',
    parent: mainWindow ?? undefined,
    modal:  false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload:          path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });
  setupWin.loadFile(path.join(__dirname, '../renderer/feishu-setup.html'));
  setupWin.on('closed', () => { setupWin = null; });
}

// ── nanobot 启动流程 ──────────────────────────────────────────────────
//  1. NanobotProcess 启动子进程，等待端口就绪
//  2. 端口就绪后 NanobotBridge 建立 WebSocket 连接

async function bootNanobot(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) {
    console.warn('[main] 跳过 nanobot 启动：窗口已销毁');
    return;
  }
  // 如果已有进程实例先清理
  nanobotProc?.kill();

  nanobotProc = new NanobotProcess(win);

  try {
    // 启动并等待 nanobot 端口就绪（最多 30 s）
    await nanobotProc.start();
  } catch (err) {
    console.error('[main] nanobot 启动失败:', err);
    win.webContents.send('nanobot:proc-status', {
      phase: 'error',
      message: 'nanobot 启动失败，请检查环境或配置',
    });
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
