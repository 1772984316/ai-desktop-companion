# AI Desktop Companion — 桌面 AI 助手

基于 Electron + TypeScript 构建的 AI 桌面伴侣，Agent 逻辑完全运行在本地 Electron Main Process 中，**无需 Python 环境**，开箱即用。

---

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 18 或以上
- 任意 OpenAI-compatible API 的 Key（支持 OpenAI、Moonshot、DeepSeek、智谱、通义千问等）

### 1. 克隆并安装依赖

```bash
git clone <仓库地址>
cd src/desktop-client
npm ci
```

### 2. 配置 API Key

首次启动后，应用会自动在以下路径生成配置模板：

- **Windows**：`%APPDATA%\desktop-client\config.json`
- **macOS**：`~/Library/Application Support/desktop-client/config.json`
- **Linux**：`~/.config/desktop-client/config.json`

编辑该文件，在 `agent` 节点填入你的 API Key：

```json
{
  "agent": {
    "apiKey": "sk-你的密钥",
    "baseUrl": "https://api.moonshot.cn/v1",
    "model": "moonshot-v1-8k"
  }
}
```

**常用国内 API：**

| 服务 | baseUrl | model |
|------|---------|-------|
| Moonshot (Kimi) | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 豆包 | `https://ark.cn-beijing.volces.com/api/v3` | `ep-xxx` |

也可以直接设置环境变量（优先级高于配置文件）：

```bash
set OPENAI_API_KEY=sk-你的密钥
set OPENAI_BASE_URL=https://api.moonshot.cn/v1
```

### 3. 启动

```bash
npm start
```

启动后界面状态显示"已连接"即可开始对话。

---

## 自定义 Agent 行为

首次启动时，应用会自动将以下模板文件复制到用户 workspace 目录，**已存在的文件不会被覆盖**：

| 文件 | 用途 |
|------|------|
| `AGENTS.md` | Agent 行为规范与指令 |
| `SOUL.md` | 角色人格设定 |
| `USER.md` | 用户偏好描述（姓名、语言、技术背景等）|
| `TOOLS.md` | 工具使用说明补充 |
| `HEARTBEAT.md` | 定时任务描述（心跳服务读取）|
| `memory/MEMORY.md` | 长期记忆（Agent 自动读写）|

直接编辑这些文件即可修改 AI 行为，**无需重启**，下一条消息生效。

---

## 桌面工具能力

Agent 可以执行以下桌面操作：

| 工具 | 功能 | 安全策略 |
|------|------|---------|
| `open_app` | 打开应用程序 | 白名单（config.json 配置）|
| `open_url` | 在浏览器打开网址 | 域名白名单 |
| `open_file` | 用默认程序打开文件 | 路径存在性校验 |
| `open_folder` | 在文件管理器打开文件夹 | 路径存在性校验 |
| `take_screenshot` | 截图保存到本地 | 仅用户主动触发 |
| `send_notification` | 发送系统通知 | 无限制 |
| `get_system_info` | 获取系统信息 | 只读 |

在 `config.json` 的 `tools.whitelist` 中配置允许的应用和域名。

---

## 目录结构

```
src/desktop-client/
├── src/
│   ├── main/
│   │   ├── main.ts              # Electron 主进程入口
│   │   ├── agent/               # Agent 核心
│   │   │   ├── loop.ts          # 主循环（推理 + 工具执行）
│   │   │   ├── context.ts       # System Prompt 构建
│   │   │   └── types.ts         # 类型定义
│   │   ├── services/
│   │   │   ├── llm.ts           # LLM 客户端（OpenAI SDK）
│   │   │   └── config.ts        # 配置加载
│   │   ├── tools/
│   │   │   ├── registry.ts      # 工具注册表
│   │   │   └── desktop.ts       # 桌面工具集
│   │   ├── session/             # 对话历史（JSONL 持久化）
│   │   ├── memory/              # 长期记忆（MEMORY.md）
│   │   ├── heartbeat/           # 定时心跳服务
│   │   └── ipc/                 # Electron IPC 处理器
│   ├── renderer/                # 渲染进程（Chat UI）
│   └── types/                   # IPC 协议类型
├── workspace-templates/         # Agent 初始配置模板（随仓库分发）
├── package.json
└── tsconfig.json
```

---

## 开发

```bash
npm run dev     # 监听模式（热重载）
npm run build   # 编译 TypeScript
npm run dist    # 打包为安装程序
```
