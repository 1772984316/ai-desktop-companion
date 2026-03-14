/**
 * main.ts
 * -------
 * Electron 主进程入口。
 *
 * 架构（全 TypeScript，无 Python 依赖）：
 *  1. 创建 BrowserWindow
 *  2. 加载配置（userData/config.json 或环境变量）
 *  3. 初始化 LLMService + ToolRegistry + AgentLoop
 *  4. 注册 IPC 处理器，直接在 Main Process 内处理对话
 *  5. 可选：启动 HeartbeatService
 */

import { app, BrowserWindow, shell, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';

import { loadConfig, getWorkspaceDir } from './services/config';
import { LLMService } from './services/llm';
import { ToolRegistry } from './tools/registry';
import { createDesktopTools } from './tools/desktop';
import { AgentLoop } from './agent/loop';
import { HeartbeatService } from './heartbeat/service';
import { registerAgentIpc } from './ipc/handler';
import { registerFeishuSetupIpc } from './feishu-setup';
import { registerFeishuAutoCreateIpc } from './feishu-auto-create';
import type { InboundMessage } from './bus/events';

let mainWindow: BrowserWindow | null = null;
let agentLoop: AgentLoop | null = null;
let heartbeat: HeartbeatService | null = null;
let ipcRegistered = false;

// ── 持久化 sessionId（跨重启恢复对话历史）──────────────────────────────────

function loadOrCreateSessionId(): string {
  const filePath = path.join(app.getPath('userData'), 'session.json');
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (typeof data.sessionId === 'string' && data.sessionId) return data.sessionId;
    }
    const id = uuid();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ sessionId: id }, null, 2));
    return id;
  } catch {
    return uuid();
  }
}

// ── 初始化 Agent ─────────────────────────────────────────────────────────────

function initAgent(win: BrowserWindow): void {
  const config = loadConfig();
  const workspaceDir = getWorkspaceDir();
  const sessionId = loadOrCreateSessionId();

  if (!config.agent.apiKey) {
    const configPath = require('./services/config').getConfigPath();
    console.warn(`[main] 未配置 API Key，请编辑配置文件：${configPath}`);
    win.webContents.send('nanobot:proc-status', {
      phase: 'error',
      message: `请填写 API Key\n配置文件：${configPath}`,
    });
    win.webContents.send('nanobot:status', { connected: false });
    // 打开配置文件所在目录，方便用户直接编辑
    const { shell } = require('electron');
    const path_ = require('path');
    shell.openPath(path_.dirname(configPath));
    return;
  }

  // LLM 服务
  const llm = new LLMService({
    apiKey: config.agent.apiKey,
    baseUrl: config.agent.baseUrl,
    model: config.agent.model,
  });

  // 工具注册表
  const toolRegistry = new ToolRegistry();
  for (const tool of createDesktopTools(config.tools?.whitelist)) {
    toolRegistry.register(tool);
  }

  // Agent 核心循环
  agentLoop = new AgentLoop(
    llm,
    toolRegistry,
    workspaceDir,
    config.agent.maxIterations ?? 40,
  );

  // 注册 IPC 处理器（只注册一次）
  if (!ipcRegistered) {
    ipcRegistered = true;
    registerAgentIpc(win, agentLoop, sessionId);
    registerFeishuSetupIpc(win);
    registerFeishuAutoCreateIpc(win);

    ipcMain.on('feishu:open-setup', () => openFeishuSetupWindow());

    // 配置更新后重新初始化 Agent（重置缓存）
    ipcMain.on('nanobot:restart', () => {
      console.log('[main] 收到重启请求，重新初始化 Agent...');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./services/config').invalidateConfig?.();
      if (mainWindow && !mainWindow.isDestroyed()) initAgent(mainWindow);
    });
  }

  // Heartbeat 服务（可选）
  heartbeat?.stop();
  if (config.heartbeat?.enabled) {
    heartbeat = new HeartbeatService(
      workspaceDir,
      llm,
      config.agent.model,
      async (tasks) => {
        const msg: InboundMessage = {
          channel: 'system',
          senderId: 'heartbeat',
          chatId: sessionId,
          content: tasks,
          timestamp: new Date(),
        };
        const response = await agentLoop!.process(msg);
        return response.content;
      },
      async (response) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('nanobot:message', {
            type: 'message',
            role: 'assistant',
            sessionId,
            content: `[定时提醒] ${response}`,
            partial: false,
            done: true,
          });
        }
      },
      config.heartbeat.intervalSeconds,
      true,
    );
    heartbeat.start();
  }

  console.log(`[main] Agent 初始化完成，sessionId=${sessionId}, model=${config.agent.model}`);
}

// ── 主窗口 ───────────────────────────────────────────────────────────────────

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
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/chat.html'));

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    initAgent(mainWindow);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── 飞书配置弹窗 ─────────────────────────────────────────────────────────────

let setupWin: BrowserWindow | null = null;

function openFeishuSetupWindow(): void {
  if (setupWin && !setupWin.isDestroyed()) { setupWin.focus(); return; }
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

// ── 生命周期 ─────────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  heartbeat?.stop();
});
