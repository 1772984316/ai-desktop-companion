/**
 * feishu-auto-create.ts
 * ─────────────────────
 * 在 Electron 内嵌浏览器里自动完成飞书机器人创建流程：
 *
 *   用户扫码登录
 *     → 自动创建企业自建应用（填写名称/描述）
 *     → 开启机器人能力
 *     → 添加事件订阅（im.message.receive_v1）
 *     → 申请消息权限
 *     → 创建版本并发布
 *     → 提取 App ID + App Secret
 *     → 写入 nanobot config.json
 *     → 关闭内嵌浏览器，通知主窗口
 *
 * 技术说明：
 *   - 使用 Electron BrowserWindow（无需 Playwright）
 *   - 通过 webContents.executeJavaScript 注入操作脚本
 *   - 通过 will-navigate / did-stop-loading 监听页面跳转
 *   - 用户只需扫一次二维码，后续全自动
 */

import { BrowserWindow, session, ipcMain } from 'electron';
import * as path from 'path';
import * as fs   from 'fs';
import * as os   from 'os';

// ── 常量 ───────────────────────────────────────────────────────────────────

const OPEN_PLATFORM_URL = 'https://open.feishu.cn/app';

/** 向主窗口推送的进度事件频道 */
export const FEISHU_CREATE_PROGRESS_CHANNEL = 'feishu:create-progress';

export interface CreateProgress {
  step: number;        // 0-8
  total: number;       // 8
  label: string;       // 当前步骤说明
  status: 'running' | 'done' | 'error';
  appId?: string;
  appSecret?: string;
  error?: string;
}

// ── 自动化步骤脚本（注入到飞书开放平台页面） ─────────────────────────────

/**
 * 等待某个 CSS selector 或文字出现，最多等 timeoutMs。
 * 返回 Element 或 null。
 * 注意：这段代码以字符串形式注入到飞书页面执行。
 */
const WAIT_SCRIPT = `
window.__nb_wait = function(selector, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const el = typeof selector === 'string'
        ? document.querySelector(selector)
        : selector();
      if (el) return resolve(el);
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeoutMs);
  });
};

window.__nb_click = async function(selector, timeoutMs = 15000) {
  const el = await window.__nb_wait(selector, timeoutMs);
  el.click();
  return true;
};

window.__nb_findByText = function(tag, text) {
  return Array.from(document.querySelectorAll(tag))
    .find(el => el.textContent && el.textContent.trim().includes(text)) || null;
};

window.__nb_waitText = function(tag, text, timeoutMs = 15000) {
  return window.__nb_wait(() => window.__nb_findByText(tag, text), timeoutMs);
};

window.__nb_input = async function(selector, value, timeoutMs = 10000) {
  const el = await window.__nb_wait(selector, timeoutMs);
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
};

'helpers_loaded';
`;

// ── 各步骤脚本 ──────────────────────────────────────────────────────────────

/** Step 1: 检测是否已登录（能看到「创建企业自建应用」按钮） */
const STEP_CHECK_LOGIN = `
(async () => {
  try {
    await window.__nb_waitText('button,span,div', '创建企业自建应用', 20000);
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** Step 2: 点击「创建企业自建应用」 */
const STEP_CLICK_CREATE = `
(async () => {
  try {
    const btn = window.__nb_findByText('button,span', '创建企业自建应用');
    if (!btn) return { ok: false, msg: '未找到「创建企业自建应用」按钮' };
    btn.click();
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** Step 3: 填写应用名称 & 描述，然后提交 */
const makeStepFillForm = (appName: string, desc: string) => `
(async () => {
  try {
    // 等待弹窗出现
    await window.__nb_wait('input[placeholder*="应用名"], input[placeholder*="名称"], .lark-input input', 10000);
    // 填写应用名
    const nameInputs = document.querySelectorAll('input');
    let filled = false;
    for (const inp of nameInputs) {
      const ph = (inp.placeholder || '').toLowerCase();
      const label = (inp.closest('label,div')?.textContent || '').toLowerCase();
      if (ph.includes('名称') || ph.includes('name') || label.includes('应用名称')) {
        inp.focus();
        inp.value = ${JSON.stringify(appName)};
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        filled = true;
        break;
      }
    }
    if (!filled) {
      // fallback: 找第一个可见空输入框
      const visibleInputs = Array.from(document.querySelectorAll('input[type="text"],input:not([type])'))
        .filter(el => el.offsetParent !== null && !el.disabled);
      if (visibleInputs.length > 0) {
        visibleInputs[0].focus();
        visibleInputs[0].value = ${JSON.stringify(appName)};
        visibleInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    // 填写描述（如有）
    const textareas = document.querySelectorAll('textarea');
    if (textareas.length > 0) {
      textareas[0].focus();
      textareas[0].value = ${JSON.stringify(desc)};
      textareas[0].dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise(r => setTimeout(r, 500));
    // 点击确认/创建按钮
    const confirmBtn = window.__nb_findByText('button', '确认') 
                    || window.__nb_findByText('button', '创建')
                    || window.__nb_findByText('button', 'Confirm')
                    || window.__nb_findByText('button', 'Create');
    if (confirmBtn) { confirmBtn.click(); return { ok: true }; }
    return { ok: false, msg: '未找到确认按钮' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** Step 4: 进入「能力」→ 开启机器人 */
const STEP_ENABLE_BOT = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 2000));
    // 点击侧边栏「能力」
    const capTab = window.__nb_findByText('a,span,li,div', '能力') 
                || window.__nb_findByText('a,span,li,div', 'Capabilities');
    if (capTab) { capTab.click(); await new Promise(r => setTimeout(r, 1500)); }
    // 点击「机器人」
    const botItem = window.__nb_findByText('a,span,li,div,td', '机器人')
                 || window.__nb_findByText('a,span,li,div,td', 'Bot');
    if (botItem) { botItem.click(); await new Promise(r => setTimeout(r, 1500)); }
    // 找并点击启用开关
    const toggle = document.querySelector('input[type="checkbox"]:not(:checked), .arco-switch:not(.arco-switch-checked), .lark-switch');
    if (toggle) {
      toggle.click();
      await new Promise(r => setTimeout(r, 800));
      return { ok: true };
    }
    // 也可能已经开启了
    const enabled = window.__nb_findByText('span,div,p', '已开启') || window.__nb_findByText('span', 'Enabled');
    if (enabled) return { ok: true, msg: '机器人能力已开启' };
    return { ok: false, msg: '未找到机器人能力开关' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** Step 5: 添加事件订阅 im.message.receive_v1 */
const STEP_ADD_EVENT = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 1500));
    // 点击「事件订阅」
    const eventTab = window.__nb_findByText('a,span,li,div', '事件订阅')
                  || window.__nb_findByText('a,span,li,div', 'Event Subscriptions');
    if (eventTab) { eventTab.click(); await new Promise(r => setTimeout(r, 1500)); }
    // 点击「添加事件」
    const addBtn = window.__nb_findByText('button,span', '添加事件')
                || window.__nb_findByText('button,span', 'Add Event');
    if (addBtn) {
      addBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      // 搜索框输入 im.message.receive_v1
      const searchInput = document.querySelector('input[placeholder*="搜索"], input[placeholder*="search"], input[placeholder*="Search"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.value = 'im.message.receive_v1';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 1000));
      }
      // 点击结果
      const resultItem = window.__nb_findByText('div,td,span,li', 'im.message.receive_v1');
      if (resultItem) {
        resultItem.click();
        await new Promise(r => setTimeout(r, 500));
        // 点击确认
        const confirm = window.__nb_findByText('button', '确认') || window.__nb_findByText('button', 'Confirm');
        if (confirm) confirm.click();
        return { ok: true };
      }
      return { ok: false, msg: '未找到 im.message.receive_v1 事件' };
    }
    return { ok: false, msg: '未找到「添加事件」按钮' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** Step 6: 申请消息权限 */
const STEP_APPLY_PERMISSIONS = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 1500));
    // 点击「权限管理」
    const permTab = window.__nb_findByText('a,span,li,div', '权限管理')
                 || window.__nb_findByText('a,span,li,div', 'Scopes')
                 || window.__nb_findByText('a,span,li,div', 'Permissions');
    if (permTab) { permTab.click(); await new Promise(r => setTimeout(r, 1500)); }
    
    const permsToAdd = ['im:message', 'im:message:send_as_bot'];
    for (const perm of permsToAdd) {
      const permRow = window.__nb_findByText('div,td,tr,span', perm);
      if (!permRow) continue;
      // 找申请按钮（在同一行）
      const row = permRow.closest('tr,li,.permission-row') || permRow.parentElement;
      if (row) {
        const applyBtn = row.querySelector('button') 
                      || window.__nb_findByText('button', '申请');
        if (applyBtn && !applyBtn.disabled) applyBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }
    }
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** Step 7: 创建版本并申请发布 */
const STEP_PUBLISH = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 1500));
    // 点击「版本管理 & 发布」
    const versionTab = window.__nb_findByText('a,span,li,div', '版本管理')
                    || window.__nb_findByText('a,span,li,div', 'App Release');
    if (versionTab) { versionTab.click(); await new Promise(r => setTimeout(r, 1500)); }
    // 点击「创建版本」
    const createVer = window.__nb_findByText('button,span', '创建版本')
                   || window.__nb_findByText('button,span', 'Create Version');
    if (createVer) {
      createVer.click();
      await new Promise(r => setTimeout(r, 1000));
      // 填写版本号（如有输入框）
      const verInput = document.querySelector('input[placeholder*="版本"]');
      if (verInput) {
        verInput.value = '1.0.0';
        verInput.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
      }
      const confirmBtn = window.__nb_findByText('button', '确认') || window.__nb_findByText('button', 'Confirm');
      if (confirmBtn) confirmBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }
    // 点击「申请发布」
    const pubBtn = window.__nb_findByText('button,span', '申请发布')
                || window.__nb_findByText('button,span', 'Submit for Release');
    if (pubBtn) {
      pubBtn.click();
      await new Promise(r => setTimeout(r, 800));
      const confirmPub = window.__nb_findByText('button', '确认') || window.__nb_findByText('button', 'Confirm');
      if (confirmPub) confirmPub.click();
    }
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** Step 8: 提取 App ID 和 App Secret */
const STEP_EXTRACT_CREDENTIALS = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 1500));
    // 导航到「凭证与基础信息」
    const credTab = window.__nb_findByText('a,span,li,div', '凭证与基础信息')
                 || window.__nb_findByText('a,span,li,div', '凭证')
                 || window.__nb_findByText('a,span,li,div', 'Credentials');
    if (credTab) { credTab.click(); await new Promise(r => setTimeout(r, 1500)); }
    
    // 提取 App ID
    let appId = '';
    const appIdLabel = window.__nb_findByText('span,div,td,label', 'App ID');
    if (appIdLabel) {
      const parent = appIdLabel.closest('tr,div.credential-row,.row') || appIdLabel.parentElement;
      if (parent) {
        const codeEl = parent.querySelector('code,input,.copy-text,.credential-value') 
                    || parent.nextElementSibling;
        appId = (codeEl?.textContent || codeEl?.value || '').trim();
      }
    }
    // fallback: 匹配 cli_xxx 格式
    if (!appId) {
      const matches = document.body.innerText.match(/cli_[a-zA-Z0-9]{16,}/);
      if (matches) appId = matches[0];
    }
    
    // 提取 App Secret（需要点击「查看」按钮）
    let appSecret = '';
    const showBtn = window.__nb_findByText('button,span', '查看') 
                 || window.__nb_findByText('button,span', 'View')
                 || document.querySelector('[data-key="app_secret"] button');
    if (showBtn) {
      showBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }
    const secretLabel = window.__nb_findByText('span,div,td,label', 'App Secret');
    if (secretLabel) {
      const parent = secretLabel.closest('tr,div.credential-row,.row') || secretLabel.parentElement;
      if (parent) {
        const codeEl = parent.querySelector('code,input,.copy-text,.credential-value')
                    || parent.nextElementSibling;
        appSecret = (codeEl?.textContent || codeEl?.value || '').trim();
      }
    }
    if (!appSecret) {
      // fallback: 查找疑似 secret 的字段（32位字母数字）
      const inputs = document.querySelectorAll('input[type="text"],input:not([type])');
      for (const inp of inputs) {
        if (/^[A-Za-z0-9]{32,}$/.test(inp.value.trim())) {
          appSecret = inp.value.trim();
          break;
        }
      }
    }
    
    if (!appId) return { ok: false, msg: '未能提取 App ID，请手动复制' };
    return { ok: true, appId, appSecret };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

// ── 主类 ───────────────────────────────────────────────────────────────────

export class FeishuAutoCreator {
  private win: BrowserWindow;                 // 主窗口（接收进度推送）
  private browserWin: BrowserWindow | null = null;
  private appName: string;
  private appDesc: string;

  constructor(mainWin: BrowserWindow, appName = 'nanobot 助手', appDesc = 'AI 个人助手 by nanobot') {
    this.win  = mainWin;
    this.appName = appName;
    this.appDesc = appDesc;
  }

  // ── 推送进度 ──────────────────────────────────────────────────────────

  private push(step: number, label: string, status: CreateProgress['status'], extra?: Partial<CreateProgress>): void {
    if (!this.win.isDestroyed()) {
      const payload: CreateProgress = { step, total: 8, label, status, ...extra };
      this.win.webContents.send(FEISHU_CREATE_PROGRESS_CHANNEL, payload);
    }
  }

  // ── 在飞书页面执行 JS ─────────────────────────────────────────────────

  private async exec(script: string): Promise<any> {
    if (!this.browserWin || this.browserWin.isDestroyed()) return { ok: false, msg: 'browser closed' };
    try {
      return await this.browserWin.webContents.executeJavaScript(script, true);
    } catch (e: any) {
      return { ok: false, msg: String(e.message) };
    }
  }

  // ── 等待页面稳定 ──────────────────────────────────────────────────────

  private waitLoad(): Promise<void> {
    return new Promise(resolve => {
      if (!this.browserWin || this.browserWin.isDestroyed()) return resolve();
      const handler = () => resolve();
      this.browserWin.webContents.once('did-stop-loading', handler);
      // 保底超时
      setTimeout(() => {
        this.browserWin?.webContents.removeListener('did-stop-loading', handler as any);
        resolve();
      }, 8000);
    });
  }

  // ── 主流程 ────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.browserWin && !this.browserWin.isDestroyed()) {
      this.browserWin.focus();
      return;
    }

    this.push(0, '正在打开飞书开放平台…', 'running');

    // 使用独立 session，避免污染主应用 cookies
    const ses = session.fromPartition('persist:feishu-creator');

    this.browserWin = new BrowserWindow({
      width:  1100,
      height: 780,
      title:  '飞书机器人一键创建 — 请扫码登录',
      parent: this.win,
      modal:  false,
      webPreferences: {
        session: ses,
        contextIsolation: false,    // 需要 false 才能注入辅助函数
        nodeIntegration: false,
      },
    });

    this.browserWin.on('closed', () => { this.browserWin = null; });

    // 加载飞书开放平台
    await this.browserWin.loadURL(OPEN_PLATFORM_URL);
    await this.waitLoad();
    await this.exec(WAIT_SCRIPT);     // 注入辅助函数

    this.push(0, '请在弹出窗口扫码登录飞书', 'running');

    // 等待用户登录（检测到「创建企业自建应用」按钮出现）
    const loginResult = await this.exec(STEP_CHECK_LOGIN);
    if (!loginResult?.ok) {
      this.push(0, '登录超时，请重试', 'error', { error: '未检测到登录成功' });
      return;
    }

    // 注入辅助函数（页面可能已刷新）
    await this.exec(WAIT_SCRIPT);

    try {
      // ── Step 1: 点击「创建企业自建应用」 ────────────────────────────
      this.push(1, '正在创建应用…', 'running');
      let r = await this.exec(STEP_CLICK_CREATE);
      if (!r?.ok) throw new Error(r?.msg || '点击创建失败');
      await new Promise(res => setTimeout(res, 1500));

      // ── Step 2: 填写表单 ─────────────────────────────────────────────
      this.push(2, '正在填写应用信息…', 'running');
      r = await this.exec(makeStepFillForm(this.appName, this.appDesc));
      if (!r?.ok) throw new Error(r?.msg || '填写表单失败');
      await this.waitLoad();
      await this.exec(WAIT_SCRIPT);    // 页面跳转后重新注入

      // ── Step 3: 开启机器人能力 ─────────────────────────────────────
      this.push(3, '正在开启机器人能力…', 'running');
      r = await this.exec(STEP_ENABLE_BOT);
      if (!r?.ok) console.warn('[FeishuAutoCreate] step3 warn:', r?.msg);

      // ── Step 4: 添加事件订阅 ───────────────────────────────────────
      this.push(4, '正在订阅消息事件…', 'running');
      r = await this.exec(STEP_ADD_EVENT);
      if (!r?.ok) console.warn('[FeishuAutoCreate] step4 warn:', r?.msg);

      // ── Step 5: 申请权限 ───────────────────────────────────────────
      this.push(5, '正在申请消息权限…', 'running');
      r = await this.exec(STEP_APPLY_PERMISSIONS);
      if (!r?.ok) console.warn('[FeishuAutoCreate] step5 warn:', r?.msg);

      // ── Step 6: 发布应用 ───────────────────────────────────────────
      this.push(6, '正在提交发布申请…', 'running');
      r = await this.exec(STEP_PUBLISH);
      if (!r?.ok) console.warn('[FeishuAutoCreate] step6 warn:', r?.msg);

      // ── Step 7: 提取凭证 ───────────────────────────────────────────
      this.push(7, '正在提取凭证…', 'running');
      r = await this.exec(STEP_EXTRACT_CREDENTIALS);

      if (!r?.ok || !r.appId) {
        // 凭证提取失败：保持浏览器打开，用户手动复制
        this.push(7,
          '⚠️ 未能自动提取凭证，请在下方浏览器手动复制 App ID 和 App Secret，然后点击「手动填入」',
          'error',
          { error: r?.msg },
        );
        return;
      }

      const { appId, appSecret } = r as { appId: string; appSecret: string };

      // ── Step 8: 写入 nanobot 配置 ──────────────────────────────────
      this.push(8, '正在写入 nanobot 配置…', 'running');
      this.applyConfig(appId, appSecret);
      this.push(8, '✅ 飞书机器人创建成功！重启 nanobot 即可使用。', 'done', { appId, appSecret });

      // 延迟关闭浏览器窗口
      setTimeout(() => this.browserWin?.close(), 2000);

    } catch (err: any) {
      console.error('[FeishuAutoCreate] error:', err);
      this.push(0, `❌ 自动创建失败：${err.message}`, 'error', { error: err.message });
    }
  }

  // ── 写入 nanobot config.json（直接读写，无需 Python 服务） ────────────

  private applyConfig(appId: string, appSecret: string): void {
    const configPath = path.join(os.homedir(), '.nanobot', 'config.json');
    if (!fs.existsSync(configPath)) {
      console.warn('[FeishuAutoCreate] config.json not found at', configPath);
      return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.channels)        config.channels = {};
    if (!config.channels.feishu) config.channels.feishu = {};
    const feishu = config.channels.feishu;
    feishu.enabled   = true;
    feishu.appId     = appId;
    feishu.appSecret = appSecret;
    if (!feishu.allowFrom || feishu.allowFrom.length === 0) feishu.allowFrom = ['*'];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[FeishuAutoCreate] config written to', configPath);
  }

  // ── 关闭浏览器 ────────────────────────────────────────────────────────

  public close(): void {
    this.browserWin?.close();
    this.browserWin = null;
  }
}

// ── IPC 注册 ───────────────────────────────────────────────────────────────

export function registerFeishuAutoCreateIpc(mainWin: BrowserWindow): void {
  let creator: FeishuAutoCreator | null = null;

  ipcMain.on('feishu:auto-create', (_event, opts?: { appName?: string; appDesc?: string }) => {
    creator = new FeishuAutoCreator(mainWin, opts?.appName, opts?.appDesc);
    creator.start().catch(err => console.error('[ipc feishu:auto-create]', err));
  });

  ipcMain.on('feishu:auto-create-cancel', () => {
    creator?.close();
    creator = null;
  });
}
