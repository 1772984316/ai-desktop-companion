# 模块 B：后端核心

> 负责人：成员 B  
> 技术栈：Python, nanobot, WebSocket, 打包

---

## 模块概述

负责 nanobot 与桌面客户端的集成：
- DesktopChannel 实现（WebSocket 服务端）
- 消息协议设计
- Python 环境打包
- 安装程序制作

---

## Sprint 1 任务（第1-4周）

### B1: DesktopChannel 基础实现

**时间**：第1周（16小时）

**任务清单**：

```
- [ ] 分析 nanobot channels 结构
- [ ] 创建 DesktopChannel 类
- [ ] 实现 WebSocket 服务端
- [ ] 客户端连接管理
- [ ] 基础消息收发
- [ ] 注册到 ChannelManager
```

**文件结构**：

```
nanobot/
├── channels/
│   ├── desktop.py           # DesktopChannel 主类
│   └── desktop/
│       ├── __init__.py
│       └── protocol.py       # 消息协议
```

**代码骨架**：

```python
# nanobot/channels/desktop.py

from nanobot.channels.base import BaseChannel
from nanobot.bus.events import InboundMessage, OutboundMessage
import websockets
from websockets.server import serve

class DesktopChannel(BaseChannel):
    name = "desktop"
    
    def __init__(self, config: DesktopChannelConfig, bus: MessageBus):
        super().__init__(config, bus)
        self.port = config.port
        self._server = None
        self._clients: dict[str, websockets.WebSocketServerProtocol] = {}
    
    async def start(self) -> None:
        """启动 WebSocket 服务器"""
        self._server = await serve(
            self._handle_client,
            "localhost",
            self.port
        )
    
    async def stop(self) -> None:
        """停止服务"""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
    
    async def send(self, msg: OutboundMessage) -> None:
        """发送消息给客户端"""
        # TODO: 实现
    
    async def _handle_client(self, ws):
        """处理客户端连接"""
        # TODO: 实现
```

**验收标准**：

```gherkin
Feature: DesktopChannel Basic

  Scenario: Start server
    Given DesktopChannel is configured
    When start() is called
    Then WebSocket server should listen on port 18790

  Scenario: Accept connection
    Given server is running
    When client connects to ws://localhost:18790
    Then connection should be accepted
    And client should be registered

  Scenario: Receive message
    Given client is connected
    When client sends {"type":"text","content":"hello"}
    Then InboundMessage should be published to bus

  Scenario: Send message
    Given client is connected
    When OutboundMessage is published to bus
    Then message should be sent to client
```

**AI 提示词（示例参考）**：

```
请在 nanobot 中实现 DesktopChannel，用于与 Electron 客户端通信。

## 背景

nanobot 是一个 AI Agent 框架，已有多个 channel 实现：
- TelegramChannel (nanobot/channels/telegram.py)
- DiscordChannel (nanobot/channels/discord.py)

## 需要创建的文件

1. nanobot/channels/desktop.py - DesktopChannel 主类
2. nanobot/channels/desktop/__init__.py
3. nanobot/channels/desktop/protocol.py - 消息协议

## DesktopChannel 设计

class DesktopChannel(BaseChannel):
    name = "desktop"
    
    async def start(self):
        # 启动 WebSocket 服务器（端口 18790）
    
    async def stop(self):
        # 停止服务
    
    async def send(self, msg: OutboundMessage):
        # 发送消息给特定客户端
    
    async def _handle_client(self, ws):
        # 处理客户端连接
        # 接收消息 -> _handle_message() -> 发布到 MessageBus
    
    async def _broadcast(self, msg):
        # 广播消息给所有客户端

## 配置

在 nanobot/config/schema.py 添加：

@dataclass
class DesktopChannelConfig:
    enabled: bool = False
    port: int = 18790
    host: str = "localhost"
    allow_from: list[str] = field(default_factory=lambda: ["*"])

## 消息协议

客户端 -> 服务端：
{
  "type": "text|voice|screenshot|system",
  "content": "...",
  "metadata": {...}
}

服务端 -> 客户端：
{
  "type": "message|progress|action|audio|error",
  "content": "...",
  "metadata": {...}
}

## 参考

请参考 nanobot/channels/telegram.py 的实现模式。

请生成完整代码。
```

---

### B2: 消息协议完善

**时间**：第2周（12小时）

```
- [ ] 完善消息类型定义
- [ ] 实现消息序列化
- [ ] 实现消息解析
- [ ] 流式消息支持
- [ ] 错误消息处理
```

---

### B3: Python 环境准备

**时间**：第3周（12小时）

```
- [ ] 下载 Python embed 包
- [ ] 安装 nanobot 依赖
- [ ] 精简不必要的包
- [ ] 创建依赖清单
- [ ] 编写安装脚本
```

---

### B4: nanobot 配置扩展

**时间**：第4周（8小时）

```
- [ ] 添加 DesktopChannelConfig
- [ ] 添加 VtuberExtensionConfig
- [ ] 更新默认配置模板
- [ ] 配置验证
```

---

## Sprint 2 任务（第5-8周）

### B5: 安装程序框架

**时间**：第5-6周（20小时）

```
- [ ] 配置 electron-builder
- [ ] 整合 Python 资源
- [ ] 创建启动脚本
- [ ] 测试打包产物
```

---

### B6: Inno Setup 脚本

**时间**：第7周（16小时）

```
- [ ] 编写 Inno Setup 脚本
- [ ] 配置安装向导
- [ ] 创建卸载程序
- [ ] 首次运行配置
```

---

### B7: 文档编写

**时间**：第8周（12小时）

```
- [ ] 安装文档
- [ ] 配置文档
- [ ] 故障排除指南
```

---

## Sprint 3 任务（第9-10周）

### B8: 最终打包

**时间**：第9-10周（16小时）

```
- [ ] 完整打包测试
- [ ] 体积优化
- [ ] 签名（可选）
- [ ] 发布准备
```

---

## 技术参考

### nanobot Channel 基类

```python
class BaseChannel(ABC):
    name: str
    
    @abstractmethod
    async def start(self) -> None: ...
    
    @abstractmethod
    async def stop(self) -> None: ...
    
    @abstractmethod
    async def send(self, msg: OutboundMessage) -> None: ...
    
    async def _handle_message(
        self, 
        sender_id: str,
        chat_id: str,
        content: str,
        media: list[str] | None = None,
        metadata: dict | None = None,
    ) -> None:
        msg = InboundMessage(
            channel=self.name,
            sender_id=sender_id,
            chat_id=chat_id,
            content=content,
            media=media or [],
            metadata=metadata or {},
        )
        await self.bus.publish_inbound(msg)
```

### WebSocket 服务器

```python
import websockets
from websockets.server import serve

async def start_server():
    async with serve(handle_client, "localhost", 18790):
        await asyncio.Future()  # 永久运行
```

### Python 嵌入式包

```javascript
// scripts/build-python.js

const PYTHON_VERSION = '3.11.9';
const PYTHON_EMBED_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;

async function downloadPythonEmbed() {
  // 下载并解压到 resources/python/
}
```

### electron-builder 配置

```json
{
  "build": {
    "extraResources": [
      {
        "from": "resources/python",
        "to": "python"
      },
      {
        "from": "resources/nanobot",
        "to": "nanobot"
      }
    ]
  }
}
```
