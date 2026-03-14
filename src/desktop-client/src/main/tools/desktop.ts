/**
 * tools/desktop.ts
 * ----------------
 * 桌面工具集：打开应用/URL/文件、截图、通知、系统信息。
 * 带白名单安全校验。
 */

import { shell, Notification, screen, app } from 'electron';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { Tool } from './registry';
import type { WhitelistConfig } from '../agent/types';

// ── 工具基类 ────────────────────────────────────────────────────────────────

abstract class DesktopTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: Tool['parameters'];
  abstract execute(args: Record<string, unknown>): Promise<string>;

  protected str(args: Record<string, unknown>, key: string): string {
    return String(args[key] ?? '');
  }
}

// ── open_app ────────────────────────────────────────────────────────────────

export class OpenAppTool extends DesktopTool {
  readonly name = 'open_app';
  readonly description = '打开桌面应用程序（仅限白名单内的应用）';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: '应用名称（需在白名单中）' },
    },
    required: ['name'],
  };

  constructor(private whitelist: WhitelistConfig['apps'] = []) {
    super();
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const name = this.str(args, 'name');
    const entry = this.whitelist.find(a =>
      a.name.toLowerCase() === name.toLowerCase()
    );

    if (!entry) {
      return `拒绝：应用"${name}"不在白名单中。允许的应用：${this.whitelist.map(a => a.name).join(', ') || '（空）'}`;
    }

    try {
      await shell.openPath(entry.path);
      return `已启动应用：${entry.name}`;
    } catch (err) {
      return `启动失败：${(err as Error).message}`;
    }
  }
}

// ── open_url ────────────────────────────────────────────────────────────────

export class OpenUrlTool extends DesktopTool {
  readonly name = 'open_url';
  readonly description = '在默认浏览器中打开网址（仅限白名单域名）';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: '要打开的完整 URL' },
    },
    required: ['url'],
  };

  constructor(private allowedDomains: string[] = []) {
    super();
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const url = this.str(args, 'url');
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return `无效的 URL：${url}`;
    }

    const allowed = this.allowedDomains.length === 0 ||
      this.allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));

    if (!allowed) {
      return `拒绝：域名"${hostname}"不在白名单中。允许的域名：${this.allowedDomains.join(', ') || '（空）'}`;
    }

    await shell.openExternal(url);
    return `已在浏览器中打开：${url}`;
  }
}

// ── open_file ────────────────────────────────────────────────────────────────

export class OpenFileTool extends DesktopTool {
  readonly name = 'open_file';
  readonly description = '用默认程序打开文件';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '文件的绝对路径' },
    },
    required: ['path'],
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = this.str(args, 'path');
    if (!fs.existsSync(filePath)) {
      return `文件不存在：${filePath}`;
    }
    const err = await shell.openPath(filePath);
    return err ? `打开失败：${err}` : `已打开文件：${filePath}`;
  }
}

// ── open_folder ──────────────────────────────────────────────────────────────

export class OpenFolderTool extends DesktopTool {
  readonly name = 'open_folder';
  readonly description = '在文件管理器中打开文件夹';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '文件夹的绝对路径' },
    },
    required: ['path'],
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const folderPath = this.str(args, 'path');
    if (!fs.existsSync(folderPath)) {
      return `文件夹不存在：${folderPath}`;
    }
    shell.openPath(folderPath);
    return `已打开文件夹：${folderPath}`;
  }
}

// ── take_screenshot ──────────────────────────────────────────────────────────

export class TakeScreenshotTool extends DesktopTool {
  readonly name = 'take_screenshot';
  readonly description = '截取当前屏幕并保存到用户数据目录，返回文件路径';
  readonly parameters = {
    type: 'object' as const,
    properties: {},
  };

  async execute(_args: Record<string, unknown>): Promise<string> {
    try {
      const { desktopCapturer } = await import('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      if (!sources.length) return '截图失败：未找到屏幕源';

      const thumbnail = sources[0].thumbnail;
      const png = thumbnail.toPNG();

      const screenshotDir = path.join(app.getPath('userData'), 'screenshots');
      fs.mkdirSync(screenshotDir, { recursive: true });

      const filename = `screenshot_${Date.now()}.png`;
      const filePath = path.join(screenshotDir, filename);
      fs.writeFileSync(filePath, png);

      return `截图已保存：${filePath}`;
    } catch (err) {
      return `截图失败：${(err as Error).message}`;
    }
  }
}

// ── send_notification ────────────────────────────────────────────────────────

export class SendNotificationTool extends DesktopTool {
  readonly name = 'send_notification';
  readonly description = '发送系统桌面通知';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: '通知标题' },
      body:  { type: 'string', description: '通知内容' },
    },
    required: ['title', 'body'],
  };

  async execute(args: Record<string, unknown>): Promise<string> {
    const title = this.str(args, 'title');
    const body  = this.str(args, 'body');

    if (!Notification.isSupported()) {
      return '当前系统不支持桌面通知';
    }

    new Notification({ title, body }).show();
    return `已发送通知："${title}"`;
  }
}

// ── get_system_info ──────────────────────────────────────────────────────────

export class GetSystemInfoTool extends DesktopTool {
  readonly name = 'get_system_info';
  readonly description = '获取当前系统的基本信息（只读）';
  readonly parameters = {
    type: 'object' as const,
    properties: {},
  };

  async execute(_args: Record<string, unknown>): Promise<string> {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    const info = {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      username: os.userInfo().username,
      homeDir: os.homedir(),
      cpus: os.cpus().length,
      totalMemoryGB: (os.totalmem() / (1024 ** 3)).toFixed(1),
      freeMemoryGB:  (os.freemem()  / (1024 ** 3)).toFixed(1),
      uptime: Math.floor(os.uptime() / 60) + ' minutes',
      nodeVersion: process.version,
      screens: displays.length,
      primaryResolution: `${primaryDisplay.size.width}x${primaryDisplay.size.height}`,
    };

    return JSON.stringify(info, null, 2);
  }
}

// ── 工厂函数 ─────────────────────────────────────────────────────────────────

export function createDesktopTools(whitelist?: WhitelistConfig): Tool[] {
  return [
    new OpenAppTool(whitelist?.apps ?? []),
    new OpenUrlTool(whitelist?.domains ?? []),
    new OpenFileTool(),
    new OpenFolderTool(),
    new TakeScreenshotTool(),
    new SendNotificationTool(),
    new GetSystemInfoTool(),
  ];
}
