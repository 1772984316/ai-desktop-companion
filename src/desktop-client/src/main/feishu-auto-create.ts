/**
 * feishu-auto-create.ts
 * ─────────────────────
 * 在 Electron 内嵌浏览器里自动完成飞书机器人创建流程（个人用户优化版）：
 *
 *   用户扫码登录
 *     → 自动创建企业自建应用（填写名称/描述）
 *     → 从 URL 提取 appId（最可靠方式）
 *     → 直接 loadURL 导航到各功能页（跳过侧边栏点击）
 *     → 开启机器人能力
 *     → 添加事件订阅（im.message.receive_v1）
 *     → 搜索并申请消息权限
 *     → 创建版本并申请发布
 *     → 提取 App ID + App Secret
 *     → 写入 nanobot config.json
 *     → 关闭内嵌浏览器，通知主窗口
 *
 * 改进点（v2）：
 *   1. 创建成功后从 window.location.href 提取 appId，之后用 loadURL 直接导航
 *   2. 权限申请改为搜索式（不再依赖行文本匹配）
 *   3. App Secret 提取加 React nativeInputValueSetter hack
 *   4. 统一使用 __nb_waitText 超时等待，避免 setTimeout 硬等
 *   5. 每步失败提供降级提示，不中断整体流程
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
  step:      number;
  total:     number;
  label:     string;
  status:    'running' | 'done' | 'error' | 'warn';
  appId?:    string;
  appSecret?: string;
  error?:    string;
}

// ── 辅助函数注入脚本 ───────────────────────────────────────────────────────

const WAIT_SCRIPT = `
window.__nb_wait = function(selector, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const el = typeof selector === 'string'
        ? document.querySelector(selector)
        : selector();
      if (el) { resolve(el); return true; }
      return false;
    };
    if (check()) return;
    const obs = new MutationObserver(() => { if (check()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      reject(new Error('Timeout waiting for: ' + (typeof selector === 'string' ? selector : 'fn')));
    }, timeoutMs);
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

window.__nb_waitText = function(tag, text, timeoutMs = 20000) {
  return window.__nb_wait(() => window.__nb_findByText(tag, text), timeoutMs);
};

/* React 兼容的 input 填值：绕过 React controlled-input 检查 */
window.__nb_setInput = function(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

/* textarea 同理 */
window.__nb_setTextarea = function(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

'helpers_loaded';
`;

// ── 各步骤脚本 ──────────────────────────────────────────────────────────────

/**
 * 扫描已有应用列表，自动推算下一个可用名称：
 *   - 没有 nanobot 应用 → "nanobot助手"
 *   - 已有 "nanobot助手" → "nanobot2号助手"
 *   - 已有 "nanobot2号助手" → "nanobot3号助手"，以此类推
 */
const STEP_DETECT_NEXT_APP_NAME = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 800));
    const pageText = document.body.innerText || '';

    const BASE = 'nanobot助手';
    const hasBase = pageText.includes(BASE);

    // 收集所有已有编号
    let maxNum = 1;
    const re = /nanobot(\\d+)号助手/g;
    let m;
    while ((m = re.exec(pageText)) !== null) {
      maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }

    if (!hasBase) {
      return { ok: true, appName: BASE, appDesc: 'nanobot机器人' };
    }
    const nextNum = maxNum + 1;
    return {
      ok: true,
      appName: 'nanobot' + nextNum + '号助手',
      appDesc: 'nanobot机器人（第' + nextNum + '个）',
    };
  } catch(e) {
    return { ok: true, appName: 'nanobot助手', appDesc: 'nanobot机器人' };
  }
})()
`;

/** 等待登录成功（检测「创建企业自建应用」或已有应用列表） */
const STEP_CHECK_LOGIN = `
(async () => {
  try {
    await window.__nb_wait(
      () => window.__nb_findByText('button,span,div,a', '创建企业自建应用')
         || window.__nb_findByText('button,span,div,a', '创建应用')
         || document.querySelector('[class*="create-app"],[class*="createApp"]'),
      60000
    );
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: '登录等待超时：' + e.message };
  }
})()
`;

/** 点击「创建企业自建应用」（自包含，不依赖 window.__nb_*，含重试） */
const STEP_CLICK_CREATE = `
(async () => {
  try {
    /* 查找策略：优先找 button 元素本身（保证事件冒泡正确触发） */
    const findCreateBtn = () => {
      /* 1. button 文字精确匹配 */
      const byText = Array.from(document.querySelectorAll('button'))
        .find(b => b.offsetParent !== null && (b.textContent || '').trim().includes('创建企业自建应用'));
      if (byText) return byText;
      /* 2. a / div 等包含该文字 */
      return Array.from(document.querySelectorAll('a,[role="button"],[class*="create-app"],[class*="createApp"]'))
        .find(el => el.offsetParent !== null && (el.textContent || '').trim().includes('创建企业自建应用'));
    };

    let btn = null;
    /* 等待按钮可点（最多 5s，每 200ms 轮询） */
    for (let i = 0; i < 25; i++) {
      btn = findCreateBtn();
      if (btn) break;
      await new Promise(r => setTimeout(r, 200));
    }
    if (!btn) {
      const visible = Array.from(document.querySelectorAll('button'))
        .filter(b => b.offsetParent).map(b => b.textContent?.trim()).filter(Boolean).join(' | ');
      return { ok: false, msg: '未找到「创建企业自建应用」按钮。当前可见按钮：' + visible };
    }

    /* 点击按钮，触发 click 事件并派发 MouseEvent（更接近真实点击） */
    btn.focus();
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
    btn.click();

    /* 验证弹窗是否打开（等「取消」按钮出现，最多 3s） */
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 200));
      const cancelVisible = Array.from(document.querySelectorAll('button'))
        .find(b => (b.textContent || '').trim() === '取消' && b.offsetParent !== null);
      if (cancelVisible) return { ok: true, confirmed: true };
    }

    /* 弹窗未出现，再试一次 */
    btn.click();
    return { ok: true, confirmed: false };
  } catch(e) {
    return { ok: false, msg: String(e) };
  }
})()
`;

/**
 * 填写应用名称 & 描述，然后点击确认。
 * 定位策略：等待「取消」按钮出现（弹窗独有），从它向上找到弹窗容器。
 */
const makeStepFillForm = (appName: string, desc: string) => `
(async () => {
  try {
    /* ── 内联 React 兼容 setter ───────────────────────────────────── */
    const setVal = (el, val) => {
      try {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (s) s.call(el, val); else el.value = val;
      } catch(_) { el.value = val; }
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const setTA = (el, val) => {
      try {
        const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (s) s.call(el, val); else el.value = val;
      } catch(_) { el.value = val; }
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    /* ── Step 1：等「取消」按钮出现（弹窗独有，最多等 12s） ────── */
    let cancelBtn = null;
    for (let i = 0; i < 60; i++) {
      cancelBtn = Array.from(document.querySelectorAll('button'))
        .find(b => (b.textContent || '').trim() === '取消' && b.offsetParent !== null);
      if (cancelBtn) break;
      await new Promise(r => setTimeout(r, 200));
    }
    if (!cancelBtn) return { ok: false, msg: '12s 内未检测到对话框（取消按钮未出现）' };

    /* ── Step 2：从「取消」按钮向上找到含 input 的弹窗容器 ─────── */
    let dialogBox = cancelBtn.parentElement;
    for (let depth = 0; depth < 12; depth++) {
      if (!dialogBox) break;
      if (dialogBox.querySelector('input') || dialogBox.querySelector('textarea')) break;
      dialogBox = dialogBox.parentElement;
    }
    if (!dialogBox) dialogBox = document.body;

    /* ── Step 3：在弹窗内找名称 input ───────────────────────────── */
    const nameInput = Array.from(dialogBox.querySelectorAll('input')).find(el => {
      if (!el.offsetParent || el.disabled || el.readOnly) return false;
      const t = (el.type || 'text').toLowerCase();
      return !['hidden','checkbox','radio','file','button','submit','reset'].includes(t);
    });
    if (!nameInput) return { ok: false, msg: '弹窗内未找到 input，弹窗HTML: ' + dialogBox.innerHTML.slice(0,300) };

    /* ── Step 4：填写名称 ────────────────────────────────────────── */
    nameInput.click();
    nameInput.focus();
    setVal(nameInput, ${JSON.stringify(appName)});
    await new Promise(r => setTimeout(r, 500));

    /* ── Step 5：填写描述 textarea ───────────────────────────────── */
    const ta = Array.from(dialogBox.querySelectorAll('textarea'))
      .find(el => el.offsetParent !== null && !el.disabled && !el.readOnly);
    if (ta) {
      ta.click();
      ta.focus();
      setTA(ta, ${JSON.stringify(desc)});
      await new Promise(r => setTimeout(r, 400));
    }

    await new Promise(r => setTimeout(r, 400));

    /* ── Step 6：点击「创建」按钮（精确匹配文字） ──────────────── */
    const createBtn = Array.from(dialogBox.querySelectorAll('button'))
      .find(b => {
        const t = (b.textContent || '').trim();
        return (t === '创建' || t === '确认' || t === 'Create' || t === 'Confirm') && !b.disabled && b.offsetParent;
      });
    if (!createBtn) {
      const found = Array.from(dialogBox.querySelectorAll('button')).map(b => '"' + (b.textContent || '').trim() + '"').join(', ');
      return { ok: false, msg: '未找到创建按钮，弹窗内所有按钮: ' + found };
    }
    createBtn.click();
    return { ok: true, filledName: nameInput.value };
  } catch(e) {
    return { ok: false, msg: String(e) };
  }
})()
`;

/**
 * 从当前 URL 或页面内容提取 appId（cli_xxx 格式）。
 * 这是创建成功后最可靠的提取方式。
 */
const STEP_GET_APP_ID_FROM_URL = `
(async () => {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    // 优先从 URL 提取（最可靠）
    const urlMatch = window.location.href.match(/\\/app\\/(cli_[A-Za-z0-9_-]+)/);
    if (urlMatch) return { ok: true, appId: urlMatch[1], src: 'url' };
    // fallback: 从页面文本提取
    const textMatch = document.body.innerText.match(/cli_[A-Za-z0-9_-]{10,}/);
    if (textMatch) return { ok: true, appId: textMatch[0], src: 'text' };
    await new Promise(r => setTimeout(r, 400));
  }
  return { ok: false, msg: '无法提取 appId，当前 URL: ' + window.location.href };
})()
`;

/** 开启机器人能力（已导航到对应页面后执行） */
const STEP_ENABLE_BOT = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 1500));

    // 查找「机器人」Tab / 链接
    const botTab = window.__nb_findByText('a,li,span,div', '机器人')
                || window.__nb_findByText('a,li,span,div', 'Bot');
    if (botTab) {
      botTab.click();
      await new Promise(r => setTimeout(r, 1500));
    }

    // 查找未开启的开关（多种选择器）
    const toggle =
         document.querySelector('.arco-switch:not(.arco-switch-checked)')
      || document.querySelector('[class*="switch"]:not([class*="checked"]):not([class*="disabled"])')
      || document.querySelector('input[type="checkbox"]:not(:checked)');

    if (toggle) {
      toggle.click();
      await new Promise(r => setTimeout(r, 800));
      return { ok: true };
    }

    // 已开启
    const alreadyOn = document.querySelector('.arco-switch-checked,[class*="switch-checked"]')
                   || window.__nb_findByText('span,div', '已开启')
                   || window.__nb_findByText('span,div', 'Enabled');
    if (alreadyOn) return { ok: true, msg: '机器人能力已开启' };

    return { ok: false, msg: '未找到机器人能力开关，可能需要手动开启' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** 添加事件订阅 im.message.receive_v1（已导航到事件订阅页面后执行） */
const STEP_ADD_EVENT = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 1500));

    // 已添加则跳过
    if (document.body.innerText.includes('im.message.receive_v1')) {
      return { ok: true, msg: '事件已存在' };
    }

    // 点击「添加事件」
    const addBtn = window.__nb_findByText('button,span,a', '添加事件')
                || window.__nb_findByText('button,span,a', 'Add Event')
                || document.querySelector('[class*="add-event"],[class*="addEvent"]');
    if (!addBtn) return { ok: false, msg: '未找到「添加事件」按钮' };
    addBtn.click();
    await new Promise(r => setTimeout(r, 1200));

    // 搜索框输入
    const searchInput = document.querySelector(
      'input[placeholder*="搜索"],input[placeholder*="Search"],input[placeholder*="search"],' +
      '[class*="search"] input,[class*="Search"] input'
    );
    if (searchInput) {
      searchInput.focus();
      window.__nb_setInput(searchInput, 'im.message.receive_v1');
      await new Promise(r => setTimeout(r, 1200));
    }

    // 点击搜索结果
    const resultItem = window.__nb_findByText('div,td,span,li,tr', 'im.message.receive_v1');
    if (!resultItem) return { ok: false, msg: '未找到事件 im.message.receive_v1' };
    resultItem.click();
    await new Promise(r => setTimeout(r, 500));

    // 确认
    const confirm = window.__nb_findByText('button', '确认')
                 || window.__nb_findByText('button', 'Confirm')
                 || window.__nb_findByText('button', 'OK');
    if (confirm) confirm.click();
    await new Promise(r => setTimeout(r, 500));

    return { ok: true };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/**
 * 搜索并申请指定权限（已导航到权限管理页面后执行）。
 * 飞书权限页有搜索框，每个权限单独搜索+申请，比行匹配可靠得多。
 */
const makeStepApplyPermission = (perm: string) => `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 800));

    // 检查是否已申请
    if (document.body.innerText.includes(${JSON.stringify(perm)})) {
      const existRow = window.__nb_findByText('tr,li,[class*="row"]', ${JSON.stringify(perm)});
      if (existRow) {
        const alreadyApplied = existRow.textContent?.includes('已申请')
                            || existRow.textContent?.includes('已开通')
                            || existRow.textContent?.includes('Granted');
        if (alreadyApplied) return { ok: true, msg: '权限已申请：' + ${JSON.stringify(perm)} };
      }
    }

    // 搜索权限
    const searchInput = document.querySelector(
      'input[placeholder*="搜索"],input[placeholder*="Search"],input[placeholder*="权限"],' +
      '[class*="search"] input'
    );
    if (searchInput) {
      searchInput.focus();
      window.__nb_setInput(searchInput, ${JSON.stringify(perm)});
      await new Promise(r => setTimeout(r, 1000));
    }

    // 在结果中找到该权限行，点击「申请」「开通」「添加」
    await new Promise(r => setTimeout(r, 500));
    const rows = Array.from(document.querySelectorAll('tr,li,[class*="permission-item"],[class*="scope-item"]'));
    for (const row of rows) {
      if (!row.textContent?.includes(${JSON.stringify(perm)})) continue;
      const btn = Array.from(row.querySelectorAll('button,span[role="button"],a'))
        .find(el => {
          const t = el.textContent?.trim() || '';
          return t === '申请' || t === '开通' || t === '添加' || t === 'Apply' || t === 'Add';
        });
      if (btn && !btn.disabled) {
        btn.click();
        await new Promise(r => setTimeout(r, 600));
        // 确认弹窗
        const confirm = window.__nb_findByText('button', '确认') || window.__nb_findByText('button', 'Confirm');
        if (confirm) { confirm.click(); await new Promise(r => setTimeout(r, 400)); }
        return { ok: true };
      }
    }

    // 如果权限已存在于列表但状态未知，认为 ok
    const existOnPage = window.__nb_findByText('td,span,div', ${JSON.stringify(perm)});
    if (existOnPage) return { ok: true, msg: '权限已在列表中：' + ${JSON.stringify(perm)} };

    return { ok: false, msg: '未找到权限行：' + ${JSON.stringify(perm)} };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
})()
`;

/** 创建版本并申请发布（已导航到发布页面后执行） */
const STEP_PUBLISH = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 1500));

    // 点击「创建版本」
    const createVer = window.__nb_findByText('button,span,a', '创建版本')
                   || window.__nb_findByText('button,span,a', 'Create Version')
                   || window.__nb_findByText('button,span,a', 'New Version');
    if (createVer) {
      createVer.click();
      await new Promise(r => setTimeout(r, 1200));

      // 版本号输入框
      const verInput = document.querySelector('input[placeholder*="版本"],input[placeholder*="version"]');
      if (verInput) {
        window.__nb_setInput(verInput, '1.0.0');
        await new Promise(r => setTimeout(r, 300));
      }

      // 版本说明（选填）
      const noteInput = document.querySelector('textarea');
      if (noteInput) {
        window.__nb_setTextarea(noteInput, 'nanobot 初始版本');
        await new Promise(r => setTimeout(r, 200));
      }

      const confirmBtn = window.__nb_findByText('button', '确认') || window.__nb_findByText('button', 'Confirm');
      if (confirmBtn) confirmBtn.click();
      await new Promise(r => setTimeout(r, 1200));
    }

    // 点击「申请发布」
    const pubBtn = window.__nb_findByText('button,span,a', '申请发布')
                || window.__nb_findByText('button,span,a', '发布应用')
                || window.__nb_findByText('button,span,a', 'Submit for Release')
                || window.__nb_findByText('button,span,a', 'Release');
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

/** 提取 App ID 和 App Secret（已导航到凭证页面后执行） */
const STEP_EXTRACT_CREDENTIALS = `
(async () => {
  try {
    await new Promise(r => setTimeout(r, 1500));

    // App ID：优先从 URL 提取
    let appId = '';
    const urlMatch = window.location.href.match(/\\/app\\/(cli_[A-Za-z0-9_-]+)/);
    if (urlMatch) appId = urlMatch[1];
    if (!appId) {
      const m = document.body.innerText.match(/cli_[A-Za-z0-9_-]{10,}/);
      if (m) appId = m[0];
    }

    // App Secret：点击「查看」显示明文
    let appSecret = '';

    // 找到 App Secret 所在区域
    const secretLabel = window.__nb_findByText('span,td,th,div,label', 'App Secret');
    if (secretLabel) {
      const container = secretLabel.closest('tr,[class*="row"],[class*="item"],[class*="field"]')
                     || secretLabel.parentElement?.parentElement;
      if (container) {
        // 点击「查看」按钮
        const viewBtn = container.querySelector('button,[class*="btn"],[role="button"]');
        if (viewBtn && (viewBtn.textContent?.includes('查看') || viewBtn.textContent?.includes('View'))) {
          viewBtn.click();
          await new Promise(r => setTimeout(r, 1000));
        }
        // 再次尝试（如果有多个「查看」，点最后一个）
        const allViewBtns = Array.from(document.querySelectorAll('button,[role="button"]'))
          .filter(el => el.textContent?.trim() === '查看' || el.textContent?.trim() === 'View');
        if (allViewBtns.length > 0) {
          allViewBtns[allViewBtns.length - 1].click();
          await new Promise(r => setTimeout(r, 1000));
        }
        // 读值：input > code > span (无星号)
        const inp = container.querySelector('input');
        if (inp && inp.value && inp.value.length >= 20 && !inp.value.includes('*')) {
          appSecret = inp.value.trim();
        }
        if (!appSecret) {
          const codeEl = container.querySelector('code,[class*="value"],[class*="secret"],[class*="text"]');
          if (codeEl && codeEl.textContent && !codeEl.textContent.includes('*') && codeEl.textContent.length >= 20) {
            appSecret = codeEl.textContent.trim();
          }
        }
      }
    }

    // fallback：页面内找 32~64 位纯字母数字（不是 cli_ 开头）
    if (!appSecret) {
      const allInputs = document.querySelectorAll('input[type="text"],input:not([type])');
      for (const inp of allInputs) {
        const v = inp.value.trim();
        if (/^[A-Za-z0-9]{24,}$/.test(v) && !v.startsWith('cli_')) {
          appSecret = v;
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
  private win:        BrowserWindow;
  private browserWin: BrowserWindow | null = null;
  private appName:    string;
  private appDesc:    string;
  /** true = 启动时自动检测已有应用列表并推算编号；false = 直接使用传入值 */
  private autoName:   boolean;

  constructor(
    mainWin:  BrowserWindow,
    appName   = '',
    appDesc   = '',
    autoName  = true,
  ) {
    this.win      = mainWin;
    this.appName  = appName;
    this.appDesc  = appDesc;
    this.autoName = autoName;
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

  // ── 导航到指定 URL 并等待加载 ─────────────────────────────────────────

  private async navTo(url: string): Promise<void> {
    if (!this.browserWin || this.browserWin.isDestroyed()) return;
    await this.browserWin.loadURL(url);
    await this.waitLoad();
    await this.exec(WAIT_SCRIPT);
  }

  // ── 等待页面稳定 ──────────────────────────────────────────────────────

  private waitLoad(): Promise<void> {
    return new Promise(resolve => {
      if (!this.browserWin || this.browserWin.isDestroyed()) return resolve();
      const handler = () => resolve();
      this.browserWin.webContents.once('did-stop-loading', handler);
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

    const ses = session.fromPartition('persist:feishu-creator');

    this.browserWin = new BrowserWindow({
      width:  1100,
      height: 780,
      title:  '飞书机器人一键创建 — 请扫码登录',
      parent: this.win,
      modal:  false,
      webPreferences: {
        session:          ses,
        contextIsolation: false,
        nodeIntegration:  false,
      },
    });

    this.browserWin.on('closed', () => { this.browserWin = null; });

    await this.navTo(OPEN_PLATFORM_URL);
    this.push(0, '请在弹出窗口扫码登录飞书', 'running');

    // ── 等待登录 ──────────────────────────────────────────────────────────
    const loginResult = await this.exec(STEP_CHECK_LOGIN);
    if (!loginResult?.ok) {
      this.push(0, '登录超时，请重试', 'error', { error: '未检测到登录成功' });
      return;
    }
    await this.exec(WAIT_SCRIPT);

    // ── 自动推算应用名称 ───────────────────────────────────────────────
    if (this.autoName || !this.appName) {
      const detected = await this.exec(STEP_DETECT_NEXT_APP_NAME);
      if (detected?.ok) {
        if (!this.appName) this.appName = detected.appName;
        if (!this.appDesc) this.appDesc = detected.appDesc;
      } else {
        if (!this.appName) this.appName = 'nanobot助手';
        if (!this.appDesc) this.appDesc = 'nanobot机器人';
      }
      this.push(0, `将创建应用：${this.appName}`, 'running');
    }

    try {
      // ── Step 1: 点击「创建企业自建应用」 ────────────────────────────
      this.push(1, '正在创建应用…', 'running');
      let r = await this.exec(STEP_CLICK_CREATE);
      if (!r?.ok) throw new Error(r?.msg || '点击创建失败');

      // ── Step 2: 填写表单并确认 ───────────────────────────────────────
      this.push(2, '正在填写应用信息…', 'running');
      r = await this.exec(makeStepFillForm(this.appName, this.appDesc));
      if (!r?.ok) throw new Error(r?.msg || '填写表单失败');

      // 等待页面跳转到应用详情页
      await this.waitLoad();
      await this.exec(WAIT_SCRIPT);

      // ── 关键：从 URL 提取 appId ──────────────────────────────────────
      r = await this.exec(STEP_GET_APP_ID_FROM_URL);
      if (!r?.ok || !r.appId) throw new Error(r?.msg || '无法获取 App ID，创建可能未成功');
      const appId: string = r.appId;
      this.push(2, `应用已创建（${appId}）`, 'running');

      // 后续步骤全部用 loadURL 直接导航，不依赖侧边栏点击
      const base = `https://open.feishu.cn/app/${appId}`;

      // ── Step 3: 开启机器人能力 ─────────────────────────────────────
      this.push(3, '正在开启机器人能力…', 'running');
      await this.navTo(`${base}/ability/bot`);
      r = await this.exec(STEP_ENABLE_BOT);
      if (!r?.ok) {
        // 某些账号侧边栏路由不同，尝试 /capabilities
        await this.navTo(`${base}/capabilities`);
        r = await this.exec(STEP_ENABLE_BOT);
      }
      if (!r?.ok) this.push(3, `⚠️ 机器人能力开启可能未成功：${r?.msg}`, 'warn');

      // ── Step 4: 添加事件订阅 ───────────────────────────────────────
      this.push(4, '正在订阅消息事件…', 'running');
      await this.navTo(`${base}/event`);
      r = await this.exec(STEP_ADD_EVENT);
      if (!r?.ok) {
        await this.navTo(`${base}/eventSubscription`);
        r = await this.exec(STEP_ADD_EVENT);
      }
      if (!r?.ok) this.push(4, `⚠️ 事件订阅可能未成功：${r?.msg}`, 'warn');

      // ── Step 5: 申请权限 ───────────────────────────────────────────
      this.push(5, '正在申请消息权限…', 'running');
      await this.navTo(`${base}/permission`);
      const perms = ['im:message', 'im:message:send_as_bot'];
      let permOk = 0;
      for (const perm of perms) {
        const pr = await this.exec(makeStepApplyPermission(perm));
        if (pr?.ok) permOk++;
        else console.warn(`[FeishuAutoCreate] perm ${perm}:`, pr?.msg);
        await new Promise(res => setTimeout(res, 500));
      }
      if (permOk === 0) this.push(5, '⚠️ 权限申请可能未成功，请手动检查', 'warn');

      // ── Step 6: 申请发布 ───────────────────────────────────────────
      this.push(6, '正在提交发布申请…', 'running');
      await this.navTo(`${base}/release`);
      r = await this.exec(STEP_PUBLISH);
      if (!r?.ok) this.push(6, `⚠️ 发布申请可能未成功：${r?.msg}`, 'warn');

      // ── Step 7: 提取凭证 ───────────────────────────────────────────
      this.push(7, '正在提取凭证…', 'running');
      await this.navTo(`${base}/credentials`);
      r = await this.exec(STEP_EXTRACT_CREDENTIALS);

      if (!r?.ok || !r.appId) {
        // 浏览器保持打开，让用户手动复制
        this.push(7,
          '⚠️ 未能自动提取 App Secret（可能需要手机验证）。请在弹出窗口手动复制 App ID 和 App Secret，然后点击「手动填入」。',
          'error',
          { error: r?.msg, appId },
        );
        return;
      }

      const { appId: extractedId, appSecret } = r as { appId: string; appSecret: string };

      // ── Step 8: 写入 nanobot 配置 ──────────────────────────────────
      this.push(8, '正在写入 nanobot 配置…', 'running');
      this.applyConfig(extractedId, appSecret);

      const secretHint = appSecret
        ? '凭证已自动写入，重启 nanobot 即可使用。'
        : '⚠️ App Secret 未能自动提取，请手动填入。App ID 已写入。';

      this.push(8,
        `✅ 飞书机器人创建完成！${secretHint}` +
        (r?.msg ? '' : '\n📌 应用已提交发布，个人账号通常无需审批，企业账号需等管理员审批。'),
        'done',
        { appId: extractedId, appSecret },
      );

      setTimeout(() => this.browserWin?.close(), 3000);

    } catch (err: any) {
      console.error('[FeishuAutoCreate] error:', err);
      this.push(0, `❌ 自动创建失败：${err.message}`, 'error', { error: err.message });
    }
  }

  // ── 写入 nanobot config.json ──────────────────────────────────────────

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
    if (appSecret) feishu.appSecret = appSecret;
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

  ipcMain.on('feishu:auto-create', (_event, opts?: { appName?: string; appDesc?: string; autoName?: boolean }) => {
    // autoName 默认 true：自动检测已有应用编号，推算下一个名称
    creator = new FeishuAutoCreator(mainWin, opts?.appName ?? '', opts?.appDesc ?? '', opts?.autoName ?? true);
    creator.start().catch(err => console.error('[ipc feishu:auto-create]', err));
  });

  ipcMain.on('feishu:auto-create-cancel', () => {
    creator?.close();
    creator = null;
  });
}
