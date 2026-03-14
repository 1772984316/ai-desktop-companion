# 依赖项目结构

> 本文档记录 vendors/ 下依赖项目的目录结构

---

## 1. nanobot

Agent 核心，提供对话循环、记忆、工具执行等能力。

```
nanobot-main/
├── nanobot/                      # 核心代码
│   ├── __init__.py
│   ├── __main__.py              # 入口
│   │
│   ├── agent/                   # Agent 核心（复用）
│   │   ├── __init__.py
│   │   ├── loop.py              # AgentLoop - 消息处理循环
│   │   ├── context.py           # ContextBuilder - 上下文构建
│   │   ├── memory.py            # MemoryStore - 记忆存储
│   │   ├── skills.py            # SkillsLoader - 技能加载
│   │   ├── subagent.py          # SubAgent - 子代理
│   │   └── tools/               # 工具注册与执行
│   │
│   ├── channels/                # 通道（扩展 DesktopChannel）
│   │   └── base.py              # BaseChannel 基类
│   │
│   ├── session/                 # 会话管理（复用）
│   │   └── manager.py           # SessionManager
│   │
│   ├── heartbeat/               # 主动触发（复用）
│   │   └── service.py           # HeartbeatService
│   │
│   ├── bus/                     # 消息总线（复用）
│   │   └── queue.py             # MessageBus
│   │
│   ├── providers/               # LLM 提供者
│   ├── config/                  # 配置
│   ├── cli/                     # 命令行
│   ├── cron/                    # 定时任务
│   ├── skills/                  # 内置技能
│   ├── templates/               # 模板
│   └── utils/                   # 工具函数
│
├── bridge/                      # 桥接服务
├── case/                        # 测试用例
├── tests/                       # 单元测试
├── pyproject.toml               # Python 项目配置
├── README.md                    # 项目说明
└── docker-compose.yml           # Docker 配置
```

### 复用清单

| 模块 | 路径 | 功能 |
|------|------|------|
| AgentLoop | `agent/loop.py` | 消息处理、LLM调用、工具执行循环 |
| SessionManager | `session/manager.py` | 会话创建、历史管理 |
| MemoryStore | `agent/memory.py` | 长期记忆存储与检索 |
| ContextBuilder | `agent/context.py` | 系统提示词、上下文构建 |
| ToolRegistry | `agent/tools/` | 工具注册与执行 |
| SkillsLoader | `agent/skills.py` | 技能加载 |
| Heartbeat | `heartbeat/service.py` | 主动触发心跳 |
| MessageBus | `bus/queue.py` | 消息总线 |
| BaseChannel | `channels/base.py` | 通道基类（扩展 DesktopChannel） |

---

## 2. Open-LLM-VTuber

VTuber 基础框架，提供 ASR/TTS/Live2D/WebSocket 能力。

```
Open-LLM-VTuber-main/
├── src/
│   └── open_llm_vtuber/         # 核心代码
│       ├── server.py            # FastAPI 服务器
│       ├── routes.py            # HTTP 路由
│       ├── websocket_handler.py # WebSocket 处理
│       ├── service_context.py   # 服务上下文
│       │
│       ├── agent/               # Agent 实现（参考）
│       ├── asr/                 # ASR 语音识别
│       ├── tts/                 # TTS 语音合成
│       ├── vad/                 # VAD 语音活动检测
│       │
│       ├── live2d_model.py      # Live2D 模型管理
│       ├── live/                # 直播相关
│       │
│       ├── conversations/       # 对话管理
│       ├── chat_history_manager.py
│       ├── chat_group.py
│       │
│       ├── config_manager/      # 配置管理
│       ├── translate/           # 翻译
│       ├── mcpp/                # MCP 协议
│       └── utils/               # 工具函数
│
├── frontend/                    # Web 前端
├── characters/                  # 角色配置
├── live2d-models/              # Live2D 模型
├── prompts/                     # 提示词
├── avatars/                     # 头像
├── backgrounds/                 # 背景
│
├── conf.yaml                    # 主配置文件
├── run_server.py               # 启动脚本
├── requirements.txt            # Python 依赖
└── pyproject.toml              # 项目配置
```

### 参考模块

| 模块 | 路径 | 功能 |
|------|------|------|
| WebSocket | `websocket_handler.py` | WebSocket 连接处理 |
| ASR | `asr/` | 语音识别实现 |
| TTS | `tts/` | 语音合成实现 |
| VAD | `vad/` | 语音活动检测 |
| Live2D | `live2d_model.py` | Live2D 模型控制 |
| 配置 | `conf.yaml` | 配置示例 |

---

## 3. 新增代码（src/）

我们需要新增的代码：

```
src/
├── desktop-client/              # Electron 桌面客户端
│   ├── electron/
│   │   ├── src/
│   │   │   ├── main.ts          # 主进程
│   │   │   ├── preload.ts       # 预加载脚本
│   │   │   └── utils/           # 工具函数
│   │   └── renderer/            # 渲染进程
│   │       ├── index.html
│   │       ├── app.ts
│   │       └── styles.css
│   ├── package.json
│   └── tsconfig.json
│
└── vtuber-extension/            # VtuberExtension 扩展
    ├── nanobot_ext/
    │   ├── channels/
    │   │   └── desktop.py       # DesktopChannel
    │   ├── extension/
    │   │   └── vtuber.py        # VtuberExtension
    │   └── tools/
    │       ├── open_app.py      # 打开应用
    │       ├── open_url.py      # 打开网址
    │       └── system.py        # 系统操作
    └── pyproject.toml
```

---

## 4. 初始化 submodule

```bash
cd ai-desktop-companion

# 添加 nanobot
git submodule add https://github.com/HKUDS/nanobot.git

# 添加 Open-LLM-VTuber
git submodule add https://github.com/Open-LLM-VTuber/Open-LLM-VTuber.git

# 克隆时自动拉取 submodule
git clone --recursive <repo-url>
```
