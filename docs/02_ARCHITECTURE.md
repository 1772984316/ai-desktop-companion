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
                            │ WebSocket (ws://localhost:18790)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     nanobot gateway（主服务）                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │DesktopChannel│  │ AgentLoop  │  │ Heartbeat   │  ← nanobot   │
│  │   (新增)    │  │   (复用)   │  │   (复用)    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │MemoryStore │  │ ToolRegistry│  │SessionMgr  │  ← nanobot   │
│  │   (复用)   │  │  (复用+扩展)│  │   (复用)    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              VtuberExtension（新增）                     │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────┐              │    │
│  │  │ ASR服务 │  │ TTS服务 │  │ Live2D控制 │              │    │
│  │  └─────────┘  └─────────┘  └─────────────┘              │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
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
| 通信 | WebSocket | 实时双向通信 |
| 主服务 | nanobot (Python) | Agent 核心 |
| Agent | AgentLoop + Tools | 复用 nanobot |
| ASR | Whisper / 云服务 | 语音识别 |
| TTS | Edge-TTS / 云服务 | 语音合成 |
| Live2D | Pixi.js + Live2D SDK | 角色渲染 |
| 打包 | electron-builder + Inno Setup | 安装程序 |

---

## 2. nanobot 能力复用

### 2.1 直接复用（无需修改）

| 模块 | 路径 | 功能 |
|------|------|------|
| AgentLoop | `nanobot/agent/loop.py` | 消息处理、LLM调用、工具执行循环 |
| SessionManager | `nanobot/session/manager.py` | 会话创建、历史管理 |
| MemoryStore | `nanobot/agent/memory.py` | 长期记忆存储与检索 |
| ContextBuilder | `nanobot/agent/context.py` | 系统提示词、上下文构建 |
| ToolRegistry | `nanobot/agent/tools/registry.py` | 工具注册与执行 |
| SkillsLoader | `nanobot/agent/skills.py` | 技能加载 |
| Heartbeat | `nanobot/heartbeat/service.py` | 主动触发心跳 |
| MessageBus | `nanobot/bus/queue.py` | 消息总线 |

### 2.2 扩展实现

| 模块 | 基类 | 新实现 | 功能 |
|------|------|--------|------|
| DesktopChannel | `BaseChannel` | 新增 | Electron 客户端通信 |
| DesktopTools | `Tool` | 新增 | 桌面操作工具 |
| VtuberExtension | - | 新增 | ASR/TTS/Live2D 封装 |
| ScreenPerception | - | 新增 | 截图解析 + 视觉模型接入 |

---

## 3. DesktopChannel 设计

### 3.1 类结构

```python
# nanobot/channels/desktop.py

from nanobot.channels.base import BaseChannel
from nanobot.bus.events import InboundMessage, OutboundMessage

class DesktopChannel(BaseChannel):
    """Electron 桌面客户端通道"""
    
    name = "desktop"
    
    async def start(self) -> None:
        """启动 WebSocket 服务器"""
        
    async def stop(self) -> None:
        """停止服务"""
        
    async def send(self, msg: OutboundMessage) -> None:
        """发送消息到客户端"""
```

### 3.2 WebSocket 消息协议

#### 客户端 → 服务端

```json
{
  "type": "text|voice|screenshot|system",
  "content": "用户消息",
  "audio": "base64...",
  "image": "base64...",
  "metadata": {
    "conversation_id": "uuid",
    "request_id": "uuid",
    "timestamp": 1710000000
  }
}
```

#### 服务端 → 客户端

```json
{
  "type": "message|progress|audio|action|tool_request",
  "content": "AI响应",
  "audio": "base64...",
  "action": {"type": "motion", "name": "wave"},
  "metadata": {
    "request_id": "uuid",
    "is_final": true,
    "sequence": 3
  }
}
```

#### 协议一致性约束（补充）
- **request_id 必填**：用于流式响应拼接与断线恢复。
- **sequence 递增**：保证流式消息顺序可重建。
- **conversation_id 贯通**：打通记忆与埋点的链路归因。

---

## 4. VtuberExtension 设计

### 4.1 架构

```python
# nanobot/extensions/vtuber/__init__.py

class VtuberExtension:
    """视听能力扩展"""
    
    def __init__(self, bus: MessageBus, config: dict):
        self.asr = create_asr_provider(config["asr"])
        self.tts = create_tts_provider(config["tts"])
        self.live2d = Live2DController(config["live2d"])
    
    async def on_inbound(self, msg: InboundMessage):
        """处理入站消息：语音→文本"""
        if msg.metadata.get("needs_asr"):
            text = await self.asr.transcribe(msg.metadata["audio_data"])
            # 重新发送文本消息
    
    async def on_outbound(self, msg: OutboundMessage):
        """处理出站消息：文本→语音+动作"""
        if msg.content:
            audio = await self.tts.synthesize(msg.content)
            action = self.live2d.get_action(msg.content)
            # 发送音频和动作
```

### 4.2 ASR/TTS 接口

```python
class ASRProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio: bytes) -> str: ...

class TTSProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str) -> bytes: ...
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
Electron (采集 + base64)
    ↓
DesktopChannel (WebSocket)
    ↓
VtuberExtension (ASR → 文本)
    ↓
AgentLoop (LLM推理)
    ↓
VtuberExtension (TTS → 音频 + Live2D动作)
    ↓
DesktopChannel
    ↓
Electron (播放 + 渲染动作)
```

### 6.2 主动触发流程

```
Heartbeat 定时检查
    ↓
触发规则匹配
    ↓
策略判定（频控/静默/场景）
    ↓
生成主动消息
    ↓
DesktopChannel 推送
    ↓
Electron 显示
```

---

## 7. 配置结构

```json
{
  "providers": {
    "openai": {"apiKey": "${OPENAI_API_KEY}"}
  },
  "agents": {
    "defaults": {
      "model": "gpt-4o",
      "workspace": "${USER_DATA}/workspace"
    }
  },
  "channels": {
    "desktop": {
      "enabled": true,
      "port": 18790,
      "host": "localhost"
    }
  },
  "extensions": {
    "vtuber": {
      "asr": {"provider": "whisper", "model": "base"},
      "tts": {"provider": "edge", "voice": "zh-CN-XiaoxiaoNeural"},
      "live2d": {"model": "shizuku"}
    }
  },
  "tools": {
    "whitelist": "config/whitelist.json",
    "restrictToWorkspace": true
  }
}
```

> 说明：`tools.restrictToWorkspace` 建议保持为 `true`，用于限制工具访问范围，避免越权文件/命令操作。

---

## 8. 部署结构

### 8.1 安装包结构

```
DesktopCompanion-Setup.exe
├── resources/
│   ├── app.asar          # Electron 应用
│   ├── python/           # Python 嵌入式环境
│   ├── nanobot/          # nanobot 源码
│   ├── extensions/       # 扩展模块
│   └── config/           # 配置文件
├── launcher.exe          # 启动器
└── install.bat           # 安装脚本
```

### 8.2 运行时目录

```
%APPDATA%/DesktopCompanion/
├── config.json           # 用户配置
├── workspace/            # nanobot 工作区
│   ├── memory/          # 记忆存储
│   ├── sessions/        # 会话数据
│   └── skills/          # 用户技能
└── logs/                # 日志
```

---

## 9. 性能指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 冷启动 | < 8s | 从点击到可用 |
| 常驻内存 | < 800MB | 稳定运行时 |
| 文本首字 | < 1.5s | 从发送到首token |
| 语音端到端 | < 3s | 从说完到开始播放 |
| 安装包 | < 200MB | 不含本地模型 |

---

## 10. 文件位置

### 10.1 新增文件

| 文件 | 职责 |
|------|------|
| `nanobot/channels/desktop.py` | DesktopChannel |
| `nanobot/channels/desktop/protocol.py` | 消息协议 |
| `nanobot/extensions/vtuber/__init__.py` | VtuberExtension |
| `nanobot/extensions/vtuber/asr.py` | ASR Provider |
| `nanobot/extensions/vtuber/tts.py` | TTS Provider |
| `nanobot/extensions/vtuber/live2d.py` | Live2D Controller |
| `nanobot/extensions/vtuber/emotion.py` | 情绪识别 |
| `nanobot/agent/tools/desktop.py` | 桌面工具 |
| `config/whitelist.json` | 白名单配置 |

### 10.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `nanobot/config/schema.py` | 添加 DesktopChannelConfig |
| `nanobot/channels/__init__.py` | 注册 DesktopChannel |
| `nanobot/agent/tools/__init__.py` | 注册桌面工具 |
