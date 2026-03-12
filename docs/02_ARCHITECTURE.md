# 技术架构设计

> AI 桌面互动伴侣 · v2.0 · 2026-03-11

---

## 1. 架构总览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron 桌面客户端                          │
├─────────────────────────────────────────────────────────────────┤
│  桌宠窗口  │  语音采集  │  音频播放  │  Live2D渲染  │  UI面板    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Electron IPC (Main <-> Renderer)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Electron Main Process (Node.js)               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │     IPC     │  │  AgentLoop  │  │ Heartbeat   │  (TS重写)    │
│  │   Handler   │  │   (Core)    │  │  Service    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ MemoryStore │  │ ToolsMgr    │  │ SessionMgr  │  (TS重写)    │
│  │ (File/DB)   │  │ (Node.js)   │  │ (Local)     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               AI Services (Hybrid Mode)                 │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────┐              │    │
│  │  │ whisper │  │ edge-tts│  │ Live2D Logic│              │    │
│  │  │ -node   │  │ (npm)   │  │ (TS Port)   │              │    │
│  │  └─────────┘  └─────────┘  └─────────────┘              │    │
│  │  ┌───────────────────────┐  ┌─────────────┐              │    │
│  │  │ DoubaoRealtimeClient  │  │ BypassAgent │              │    │
│  │  │ (S2S API)             │  │ (Observer)  │              │    │
│  │  └───────────────────────┘  └─────────────┘              │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / Native Calls
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         外部服务                                 │
├─────────────────────────────────────────────────────────────────┤
│  LLM API (OpenAI/Claude)  │  ASR (Whisper)  │  TTS (Edge)       │
│  Vision API (可选)        │  VAD (可选)     │                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 客户端 | Electron + TypeScript | 桌面应用框架 |
| 通信 | Electron IPC | 进程间通信 |
| 后端 | Node.js (Electron Main) | Agent 核心 (TS重写) |
| S2S | Doubao Realtime API | 端到端语音 (WebSocket) |
| ASR | whisper-node | 兼容模式语音识别 |
| TTS | edge-tts | 兼容模式语音合成 |
| Live2D | Pixi.js + Live2D SDK | 角色渲染 + AudioWorklet |
| 打包 | electron-builder | 标准打包 |

---

## 2. 后端核心 (Node.js/TS)

### 2.1 核心模块 (TS 重写)

| 模块 | 路径 | 功能 |
|------|------|------|
| AgentLoop | `src/main/agent/loop.ts` | 核心循环：接收IPC -> 思考 -> 工具/回复 |
| BypassAgent | `src/main/agent/bypass.ts` | 旁路监听：S2S对话 -> 意图识别 -> 工具执行 |
| RealtimeClient | `src/main/services/doubao.ts` | 豆包 S2S 客户端 (WebSocket) |
| MemoryStore | `src/main/memory/store.ts` | 长期记忆 (基于 JSON/SQLite) |
| ContextBuilder | `src/main/agent/context.ts` | Prompt 组装 |
| ToolRegistry | `src/main/tools/registry.ts` | 工具管理 |
| IPC Handler | `src/main/ipc/handler.ts` | 处理渲染进程消息 |

### 2.2 AI 服务集成 (双模式)

| 模块 | 库/API | 说明 |
|------|----|------|
| **S2S Service** | `Doubao Realtime API` | **核心模式**：端到端语音对话 (<1s延迟) |
| ASR Service | `whisper-node` | 兼容模式：本地语音转文字 |
| VAD Service | `@ricky0123/vad-node` | 通用：静音检测 (减少上传流量) |
| TTS Service | `edge-tts` | 兼容模式：语音合成 |
| Vision Service | `screenshot-desktop` | 屏幕捕获 |

---

## 3. DesktopChannel 设计 (已废弃)

> 原 nanobot 的 DesktopChannel (Python) 方案已废弃，直接使用 Electron IPC 通信。

### 3.1 IPC 消息定义 (TypeScript)

```typescript
// src/shared/types/ipc.ts

export type ClientMessage = 
  | { type: 'text'; content: string }
  | { type: 'audio'; buffer: ArrayBuffer } // 16k PCM
  | { type: 'action'; name: string };

export type ServerMessage =
  | { type: 'text'; content: string; isFinal: boolean }
  | { type: 'audio'; buffer: ArrayBuffer }
  | { type: 'cmd'; action: string };
```

---

## 4. AI Service 设计 (Node.js)

### 4.1 S2S 客户端 (DoubaoRealtimeClient)

```typescript
// src/main/services/doubao/client.ts

export class DoubaoRealtimeClient extends EventEmitter {
  private ws: WebSocket;
  
  constructor(config: DoubaoConfig) {
    super();
    // ...
  }
  
  public sendAudio(chunk: Buffer) {
    // 封包为二进制帧发送
  }
  
  private handleMessage(data: Buffer) {
    // 拆包 -> emit 'audio' | 'text'
  }
}
```

### 4.2 旁路监听 (BypassAgent)

```typescript
// src/main/agent/bypass.ts

export class BypassAgent {
  constructor(private llm: LLMService, private tools: ToolRegistry) {}
  
  public async onUserText(text: string) {
    // 1. 意图识别
    const intent = await this.llm.classify(text);
    
    // 2. 如果是工具调用
    if (intent.type === 'tool_use') {
      const result = await this.tools.execute(intent.toolName, intent.args);
      // 3. 记录审计日志
    }
    
    // 4. 更新短期记忆
    this.memory.add(text);
  }
}
```

---

## 5. 桌面工具设计

### 5.1 工具清单

| 工具 | 功能 | 安全策略 |
|------|------|----------|
| `open_app` | 打开应用 | 白名单 + 二次确认（支持会话记住） |
| `open_url` | 打开网址 | 域名白名单 + 二次确认（支持会话记住） |
| `open_file` | 打开文件 | 白名单路径 + 二次确认（支持会话记住） |
| `open_folder` | 打开文件夹 | 白名单路径 + 二次确认（支持会话记住） |
| `take_screenshot` | 截图 | 仅用户主动触发 |
| `send_notification` | 发送通知 | 无限制 |
| `get_system_info` | 获取系统信息 | 只读 |

### 5.2 白名单配置

```json
{
  "apps": [
    {"name": "Spotify", "path": "C:/Program Files/Spotify/Spotify.exe"}
  ],
  "domains": ["github.com", "google.com"],
  "paths": ["C:/Users/*/Documents", "C:/Users/*/Downloads"],
  "default_action": "reject"
}
```

### 5.3 交互与审计（补充）
- **二次确认**：`open_app` / `open_url` / `open_file` / `open_folder` 默认需用户确认，可勾选“本次会话记住”。
- **审计日志**：所有 Do 操作记录 `time/user/action/target/result`，支持一键清空。

---

## 6. 数据流

### 6.1 语音对话流程

```
用户语音
    ↓
Electron Renderer (采集 + VAD)
    ↓
IPC (Main Process)
    ↓
ASR Service (whisper-node)
    ↓
Agent Core (LLM推理)
    ↓
TTS Service (edge-tts)
    ↓
Live2D Logic (LipSync + Motion)
    ↓
Electron Renderer (播放 + 渲染)
```

### 6.2 主动触发流程

```
Heartbeat Service (Main Process)
    ↓
触发规则匹配
    ↓
Agent Core 生成消息
    ↓
IPC 推送
    ↓
Electron Renderer 显示
```

---

## 7. 配置结构

```json
{
  "providers": {
    "openai": {"apiKey": "${OPENAI_API_KEY}"}
  },
  "agent": {
    "model": "gpt-4o",
    "systemPrompt": "prompts/system.md"
  },
  "services": {
    "asr": {"model": "base", "language": "zh"},
    "tts": {"voice": "zh-CN-XiaoxiaoNeural"},
    "vad": {"threshold": 0.5}
  },
  "tools": {
    "whitelist": "config/whitelist.json"
  }
}
```

> 说明：`tools.restrictToWorkspace` 建议保持为 `true`，用于限制工具访问范围，避免越权文件/命令操作。

---

## 8. 部署结构

### 8.1 安装包结构

```
DesktopCompanion-Setup.exe
├── Electron 主进程 (Node.js)
├── Renderer 资源 (UI + Live2D)
├── 本地 AI 模型 (可选/按需下载)
└── 配置文件
```

### 8.2 运行时目录

```
%APPDATA%/DesktopCompanion/
├── config.json           # 用户配置
├── workspace/            # 用户数据
│   ├── memory/           # 记忆存储 (SQLite)
│   ├── sessions/         # 会话历史
│   ├── logs/             # 运行日志
│   └── audit/            # 审计日志
└── resources/            # 动态资源
```

---

## 9. 性能指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 冷启动 | < 10s | 从点击到可用 |
| 常驻内存 | < 1GB | 稳定运行时 (PyTorch依赖) |
| 文本首字 | < 1.5s | 从发送到首token |
| 语音端到端 | < 3s | 从说完到开始播放 |
| 安装包 | < 800MB | 含本地模型与运行时 |

---

## 10. 文件位置

### 10.1 Electron Main Process

| 文件 | 职责 |
|------|------|
| `src/main/index.ts` | 应用入口 |
| `src/main/ipc/index.ts` | IPC 路由 |
| `src/main/services/agent.ts` | Agent 核心逻辑 |
| `src/main/services/audio.ts` | 音频处理 (ASR/TTS) |
| `src/main/services/vision.ts` | 视觉处理 |

## 11. Vendor 参考说明

本项目核心代码已迁移至 Node.js，`vendors/` 目录下的代码仅作为逻辑参考：

### 11.1 `vendors/nanobot-main` (Python)
- **仅作参考**：协议设计、工具接口定义、Heartbeat 逻辑结构。
- **不可运行**：本项目不包含 Python 运行时，无法直接执行此目录下的代码。

### 11.2 `vendors/Open-LLM-VTuber-main`
- **仅作参考**：Live2D 模型加载逻辑、口型同步算法 (LipSync)。
- **迁移目标**：需将其中的 Python/JS 逻辑移植到 `src/main/services/live2d` (Node.js)。
