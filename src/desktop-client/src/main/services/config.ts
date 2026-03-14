/**
 * services/config.ts
 * ------------------
 * 加载应用配置，优先从 userData/config.json 读取，回退到环境变量。
 * 首次启动时自动生成带注释的模板配置文件。
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { AppConfig } from '../agent/types';

// ── 模板配置（含国内常用 API 示例）──────────────────────────────────────────
//
// 说明：JSON 不支持注释，此处用 _comment 字段做说明，加载时会被忽略。
//
const CONFIG_TEMPLATE = {
  _readme: "修改 agent 下的 apiKey / baseUrl / model，然后重启应用。",

  _providers: {
    _note: "以下是国内常用 API 配置示例，取消注释并填入你的 Key 即可",
    deepseek: {
      apiKey: "sk-xxxxxxxxxxxx",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
    },
    zhipu: {
      apiKey: "xxxxxxxxxxxx.xxxxxxxxxxxx",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      model: "glm-4-flash",
    },
    qwen: {
      apiKey: "sk-xxxxxxxxxxxx",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
    },
    doubao: {
      apiKey: "xxxxxxxxxxxx",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      model: "ep-xxxxxxxxxxxx",
    },
    moonshot: {
      apiKey: "sk-xxxxxxxxxxxx",
      baseUrl: "https://api.moonshot.cn/v1",
      model: "moonshot-v1-8k",
    },
    openai: {
      apiKey: "sk-xxxxxxxxxxxx",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    },
  },

  agent: {
    apiKey: "",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    maxIterations: 40,
  },

  heartbeat: {
    enabled: false,
    intervalSeconds: 1800,
  },

  tools: {
    whitelist: {
      apps: [
        { "_example": "填写你想让 AI 能打开的应用" },
      ],
      domains: [
        "github.com",
        "baidu.com",
      ],
      paths: [],
    },
  },
};

const DEFAULT_CONFIG: AppConfig = {
  agent: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxIterations: 40,
  },
  heartbeat: {
    enabled: false,
    intervalSeconds: 1800,
  },
  tools: {
    whitelist: {
      apps: [],
      domains: [],
      paths: [],
    },
  },
};

let _cached: AppConfig | null = null;
let _configPath = '';

export function getConfigPath(): string {
  if (!_configPath) {
    _configPath = path.join(app.getPath('userData'), 'config.json');
  }
  return _configPath;
}

export function loadConfig(): AppConfig {
  if (_cached) return _cached;

  const configPath = getConfigPath();

  // 首次启动：生成模板配置文件
  if (!fs.existsSync(configPath)) {
    try {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(CONFIG_TEMPLATE, null, 2), 'utf-8');
      console.log(`[Config] 已生成配置模板：${configPath}`);
    } catch (err) {
      console.warn('[Config] 无法写入模板配置：', err);
    }
  }

  let fileConfig: Record<string, unknown> = {};
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.warn('[Config] 解析 config.json 失败，使用默认配置：', err);
  }

  const fileAgent = (fileConfig.agent ?? {}) as Partial<AppConfig['agent']>;

  // 优先级：环境变量 > config.json > 默认值
  const apiKey  = process.env.OPENAI_API_KEY ?? fileAgent.apiKey  ?? DEFAULT_CONFIG.agent.apiKey;
  const baseUrl = process.env.OPENAI_BASE_URL ?? fileAgent.baseUrl ?? DEFAULT_CONFIG.agent.baseUrl;
  const model   = fileAgent.model   ?? DEFAULT_CONFIG.agent.model;

  const fileHeartbeat = ((fileConfig.heartbeat ?? {}) as Partial<NonNullable<AppConfig['heartbeat']>>);
  const fileTools     = ((fileConfig.tools     ?? {}) as Partial<NonNullable<AppConfig['tools']>>);
  const fileWhitelist = ((fileTools?.whitelist  ?? {}) as Partial<NonNullable<NonNullable<AppConfig['tools']>['whitelist']>>);

  const defaultHeartbeat = DEFAULT_CONFIG.heartbeat!;
  const defaultWhitelist = DEFAULT_CONFIG.tools!.whitelist!;

  _cached = {
    agent: {
      apiKey,
      baseUrl,
      model,
      maxIterations: fileAgent.maxIterations ?? DEFAULT_CONFIG.agent.maxIterations,
    },
    heartbeat: {
      enabled:         fileHeartbeat?.enabled         ?? defaultHeartbeat.enabled,
      intervalSeconds: fileHeartbeat?.intervalSeconds ?? defaultHeartbeat.intervalSeconds,
    },
    tools: {
      whitelist: {
        apps:    Array.isArray(fileWhitelist?.apps)    ? (fileWhitelist.apps as unknown[]).filter((a) => typeof a === 'object' && a !== null && !('_example' in (a as object))) as { name: string; path: string }[] : [],
        domains: Array.isArray(fileWhitelist?.domains) ? fileWhitelist.domains as string[] : defaultWhitelist.domains,
        paths:   Array.isArray(fileWhitelist?.paths)   ? fileWhitelist.paths as string[]   : [],
      },
    },
  };

  console.log(`[Config] 加载完成：model=${_cached.agent.model}, baseUrl=${_cached.agent.baseUrl}`);
  return _cached;
}

/** 重新加载配置（用于运行时重启 Agent） */
export function invalidateConfig(): void {
  _cached = null;
}

export function getWorkspaceDir(): string {
  const dir = path.join(app.getPath('userData'), 'workspace');
  fs.mkdirSync(dir, { recursive: true });
  initWorkspaceTemplates(dir);
  return dir;
}

/**
 * 首次运行时将内置模板文件复制到用户 workspace 目录。
 * 已存在的文件不会被覆盖（用户自定义内容保留）。
 */
function initWorkspaceTemplates(workspaceDir: string): void {
  // 模板目录位于 app 资源目录或开发时的项目目录
  const templateDir = app.isPackaged
    ? path.join(process.resourcesPath, 'workspace-templates')
    : path.join(app.getAppPath(), 'workspace-templates');

  if (!fs.existsSync(templateDir)) {
    console.warn('[Config] workspace-templates 目录不存在，跳过初始化');
    return;
  }

  copyDirIfNotExists(templateDir, workspaceDir);
}

function copyDirIfNotExists(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirIfNotExists(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[Config] 初始化模板文件：${destPath}`);
    }
  }
}
