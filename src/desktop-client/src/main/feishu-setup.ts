/**
 * feishu-setup.ts
 * ───────────────
 * Electron 主进程：飞书机器人凭证验证 + 配置写入
 *
 * 【修复】所有逻辑在 Node.js 内直接实现，不再依赖 Python HTTP 向导服务。
 *
 * IPC 频道（渲染 → 主进程）：
 *  'feishu:validate'    payload: { appId, appSecret }
 *  'feishu:apply'       payload: { appId, appSecret, encryptKey?, verificationToken?, allowFrom? }
 *  'feishu:get-steps'   无 payload
 *  'feishu:open-platform'
 *  'feishu:open-setup'
 */

import { ipcMain, BrowserWindow, shell } from 'electron';
import * as https from 'https';
import * as fs   from 'fs';
import * as os   from 'os';
import * as path from 'path';

// ── 飞书 API 端点 ──────────────────────────────────────────────────────────
const FEISHU_TOKEN_URL   = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
const FEISHU_BOT_INFO_URL = 'https://open.feishu.cn/open-apis/bot/v3/info';

// ── 内部 HTTPS 请求工具 ────────────────────────────────────────────────────

function httpsPost(url: string, body: object, token = ''): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const headers: Record<string, string> = {
      'Content-Type':   'application/json',
      'Content-Length': String(Buffer.byteLength(data)),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`Invalid JSON: ${raw.slice(0, 200)}`)); }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(url: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`Invalid JSON: ${raw.slice(0, 200)}`)); }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ── 核心：验证飞书凭证 ────────────────────────────────────────────────────

async function validateFeishuCredentials(appId: string, appSecret: string): Promise<{
  ok: boolean; token?: string; botName?: string; botAvatar?: string;
  error?: string; warnings: string[];
}> {
  const warnings: string[] = [];

  // Step 1: 获取 tenant_access_token
  let tokenResp: any;
  try {
    tokenResp = await httpsPost(FEISHU_TOKEN_URL, { app_id: appId, app_secret: appSecret });
  } catch (e: any) {
    return { ok: false, error: `网络请求失败：${e.message}`, warnings };
  }

  if (tokenResp.code !== 0) {
    const code = tokenResp.code;
    let msg = '';
    if (code === 10003) msg = 'App ID 不存在或 App Secret 错误，请重新检查。';
    else if (code === 10014) msg = 'App Secret 无效。';
    else msg = `获取令牌失败（code=${code}）: ${tokenResp.msg || ''}`;
    return { ok: false, error: msg, warnings };
  }

  const token: string = tokenResp.tenant_access_token || '';
  if (!token) return { ok: false, error: '未收到 tenant_access_token，请重试。', warnings };

  // Step 2: 验证机器人能力
  let botName = '';
  let botAvatar = '';
  try {
    const botResp = await httpsGet(FEISHU_BOT_INFO_URL, token);
    if (botResp.code === 0) {
      botName   = botResp.bot?.app_name || '';
      botAvatar = botResp.bot?.avatar_url || '';
    } else if (botResp.code === 230001) {
      warnings.push('⚠️  机器人能力未开启！请在飞书开放平台 → 能力 → 机器人 → 开启，重新发布后再使用。');
    } else {
      warnings.push(`⚠️  获取机器人信息失败（code=${botResp.code}）。凭证有效，但请确认机器人能力已开启。`);
    }
  } catch {
    warnings.push('⚠️  无法验证机器人能力，请确认飞书开放平台配置正确。');
  }

  warnings.push(
    'ℹ️  请在飞书开放平台确认：\n' +
    '   · 事件订阅 → im.message.receive_v1 已添加\n' +
    '   · 权限：im:message 和 im:message:send_as_bot 已申请\n' +
    '   · 应用已发布上线'
  );

  return { ok: true, token, botName, botAvatar, warnings };
}

// ── 核心：写入 nanobot config.json ────────────────────────────────────────

function applyFeishuConfig(opts: {
  appId: string; appSecret: string;
  encryptKey?: string; verificationToken?: string; allowFrom?: string[];
}): string {
  const configPath = path.join(os.homedir(), '.nanobot', 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`nanobot 配置文件不存在：${configPath}，请先运行 nanobot onboard`);
  }

  const raw    = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  if (!config.channels)        config.channels = {};
  if (!config.channels.feishu) config.channels.feishu = {};

  const feishu = config.channels.feishu;
  feishu.enabled           = true;
  feishu.appId             = opts.appId;
  feishu.appSecret         = opts.appSecret;
  feishu.encryptKey        = opts.encryptKey        ?? feishu.encryptKey        ?? '';
  feishu.verificationToken = opts.verificationToken ?? feishu.verificationToken ?? '';
  feishu.allowFrom         = opts.allowFrom         ?? feishu.allowFrom         ?? ['*'];
  if (!feishu.allowFrom || feishu.allowFrom.length === 0) feishu.allowFrom = ['*'];

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log('[FeishuSetup] config written to', configPath);
  return configPath;
}

// ── IPC 注册 ───────────────────────────────────────────────────────────────

export function registerFeishuSetupIpc(_win: BrowserWindow): void {

  /** 验证凭证（直接调飞书 API，无需 Python 服务） */
  ipcMain.handle('feishu:validate', async (_event, payload: { appId: string; appSecret: string }) => {
    try {
      const r = await validateFeishuCredentials(payload.appId, payload.appSecret);
      return {
        ok:        r.ok,
        botName:   r.botName   ?? '',
        botAvatar: r.botAvatar ?? '',
        error:     r.error     ?? '',
        warnings:  r.warnings,
      };
    } catch (err: any) {
      return { ok: false, error: `验证异常：${err.message}`, warnings: [] };
    }
  });

  /** 写入配置（直接读写 ~/.nanobot/config.json） */
  ipcMain.handle('feishu:apply', async (_event, payload: {
    appId: string; appSecret: string;
    encryptKey?: string; verificationToken?: string; allowFrom?: string[];
  }) => {
    try {
      const configPath = applyFeishuConfig(payload);
      return { ok: true, configPath };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  /** 获取手动步骤说明 */
  ipcMain.handle('feishu:get-steps', () => ({
    url: 'https://open.feishu.cn/app',
    steps: [
      '1. 访问飞书开放平台，创建企业自建应用',
      '2. 能力 → 机器人 → 开启机器人能力',
      '3. 事件订阅 → 添加事件：im.message.receive_v1',
      '4. 权限管理 → 申请：im:message、im:message:send_as_bot',
      '5. 版本管理 & 发布 → 发布应用',
      '6. 凭证与基础信息 → 复制 App ID 和 App Secret',
    ],
  }));

  /** 打开飞书开放平台（系统浏览器） */
  ipcMain.on('feishu:open-platform', () => {
    shell.openExternal('https://open.feishu.cn/app');
  });
}
