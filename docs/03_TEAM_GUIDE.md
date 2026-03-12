# 团队分工指南

> 4人团队 · 12周开发周期 · AI Coding
>
> 里程碑口径以 `plans/INDEX.md` 为准。

---

## 团队成员

| 成员 | 角色 | 主要职责 | 技术栈 |
|------|------|----------|--------|
| **A** | 客户端开发 | Electron 桌面应用、UI、Live2D | TypeScript, Electron |
| **B** | 后端核心 | nanobot 集成、DesktopChannel、打包 | Python, WebSocket |
| **C** | AI能力 | ASR/TTS/Live2D、情绪映射 | Python, 音频 |
| **D** | 业务功能 | 桌面工具、订阅、埋点 | Python, DB |

---

## 开发周期总览

```
Week 1   Week 2   Week 3   Week 4   Week 5   Week 6   Week 7   Week 8   Week 9   Week 10  Week 11  Week 12
├─────基础架构─────┤├─────功能完善─────┤├─────商业化─────┤├─────发布─────┤
   Sprint 1 (4周)       Sprint 2 (4周)       Sprint 3 (2周)   Sprint 4 (2周)
```

---

## Sprint 1：基础架构（第1-4周）

### 成员 A：客户端开发

#### 任务 A1：Electron 项目搭建
**时间**：第1周（20小时）

**任务描述**：
搭建 Electron 项目基础结构，实现桌宠窗口。

**具体工作**：
1. 创建 Electron 项目结构
2. 实现无边框透明窗口
3. 实现窗口拖拽、置顶、穿透切换
4. 实现系统托盘
5. 实现窗口位置记忆

**验收标准**：
- [ ] 窗口可正常显示
- [ ] 可拖拽移动
- [ ] 置顶/穿透可切换
- [ ] 重启后位置恢复

**AI 提示词（示例参考）**：
```
请帮我创建一个 Electron 桌面应用项目：

1. 项目结构：
   - electron/
     - src/main.ts (主进程)
     - src/preload.ts
     - src/utils/
     - renderer/
       - index.html
       - styles.css
       - app.ts
     - package.json
     - tsconfig.json

2. 主进程要求：
   - 无边框透明窗口
   - 支持拖拽移动
   - 支持置顶切换
   - 支持鼠标穿透切换
   - 系统托盘图标
   - 窗口位置记忆（保存到 localStorage）

3. 配置：
   - TypeScript + electron-builder
   - 窗口大小：400x600
   - 背景透明

请生成完整的项目代码。
```

---

#### 任务 A2：WebSocket 连接与消息处理
**时间**：第2周（16小时）

**任务描述**：
实现 Electron 与 nanobot 的 WebSocket 通信。

**具体工作**：
1. WebSocket 客户端封装
2. 消息发送/接收
3. 连接状态管理
4. 断线重连机制
5. 消息队列（离线缓存）

**验收标准**：
- [ ] 可连接到 nanobot
- [ ] 消息双向收发正常
- [ ] 断线可自动重连
- [ ] 离线消息可缓存

**AI 提示词（示例参考）**：
```
请帮我实现 Electron 与 nanobot 的 WebSocket 通信模块：

1. 创建 WebSocketService 类：
   - 连接到 ws://localhost:18790
   - 消息发送/接收
   - 心跳保活
   - 断线自动重连（指数退避）
   - 连接状态事件

2. 消息类型：
   - 发送：{ type: "text", content: "..." }
   - 接收：{ type: "message", content: "..." }
   - 接收：{ type: "progress", content: "..." }
   - 接收：{ type: "action", action: {...} }
   - 接收：{ type: "audio", audio: "base64..." }

3. 要求：
   - 使用 TypeScript
   - 提供类型定义
   - 支持事件订阅模式

请生成完整的代码。
```

---

#### 任务 A3：UI 界面开发
**时间**：第3周（16小时）

**任务描述**：
开发桌宠的 UI 界面，包括对话面板、状态显示、设置面板。

**具体工作**：
1. 对话界面（消息列表 + 输入框）
2. 状态显示（连接状态、思考中提示）
3. 设置面板（API Key、语音设置）
4. 关系值/亲密度显示
5. 主题/皮肤基础

**验收标准**：
- [ ] 对话界面正常
- [ ] 消息可滚动查看
- [ ] 输入可发送
- [ ] 设置可保存

---

#### 任务 A4：Live2D 集成
**时间**：第4周（20小时）

**任务描述**：
集成 Live2D 模型渲染，实现角色动画。

**具体工作**：
1. 集成 Pixi.js + Live2D SDK
2. 加载 Live2D 模型
3. 接收动作指令并执行
4. 模型资源配置
5. 基础表情/动作

**验收标准**：
- [ ] Live2D 模型正常显示
- [ ] 可执行动作指令
- [ ] 表情可切换

---

### 成员 B：后端核心

#### 任务 B1：DesktopChannel 基础实现
**时间**：第1周（16小时）

**任务描述**：
在 nanobot 中实现 DesktopChannel，作为 Electron 的通信桥梁。

**具体工作**：
1. 创建 DesktopChannel 类（继承 BaseChannel）
2. 实现 WebSocket 服务端
3. 客户端连接管理
4. 消息收发循环
5. 基础权限校验

**代码位置**：
- `nanobot/channels/desktop.py`
- `nanobot/channels/desktop/__init__.py`

**验收标准**：
- [ ] 服务可启动
- [ ] 客户端可连接
- [ ] 消息双向收发

**AI 提示词（示例参考）**：
```
请在 nanobot 中实现 DesktopChannel：

1. 参考 nanobot/channels/telegram.py 和 nanobot/channels/base.py

2. 创建文件：
   nanobot/channels/desktop.py

3. 类设计：
   class DesktopChannel(BaseChannel):
       name = "desktop"
       
       async def start(self):
           # 启动 WebSocket 服务器
           # 端口: 18790
       
       async def stop(self):
           # 停止服务
       
       async def send(self, msg: OutboundMessage):
           # 发送消息给客户端
       
       async def _handle_client(self, websocket):
           # 处理客户端连接
           # 接收消息 -> _handle_message()

4. 使用 websockets 库

5. 配置：
   在 nanobot/config/schema.py 添加 DesktopChannelConfig

请生成完整的 Python 代码。
```

---

#### 任务 B2：消息协议实现
**时间**：第2周（12小时）

**任务描述**：
定义完整的消息协议，实现序列化/反序列化。

**具体工作**：
1. 定义消息类型枚举
2. 实现消息序列化器
3. 实现消息解析器
4. 流式消息支持
5. 错误处理

**代码位置**：
- `nanobot/channels/desktop/protocol.py`
- `nanobot/channels/desktop/serializer.py`

---

#### 任务 B3：nanobot 配置扩展
**时间**：第2周（8小时）

**任务描述**：
扩展 nanobot 配置以支持 DesktopChannel。

**具体工作**：
1. 添加 DesktopChannelConfig
2. 添加 VtuberExtensionConfig
3. 配置验证
4. 默认配置模板

**代码位置**：
- `nanobot/config/schema.py`

---

#### 任务 B4：Python 环境嵌入
**时间**：第3周（12小时）

**任务描述**：
准备 Python 嵌入式环境，用于打包。

**具体工作**：
1. 下载 Python embed 包
2. 安装 nanobot 依赖
3. 精简不必要的包
4. 创建安装脚本

---

#### 任务 B5：Electron 打包配置
**时间**：第4周（12小时）

**任务描述**：
配置 electron-builder 打包，整合 Python 环境。

**具体工作**：
1. 配置 electron-builder
2. 整合 Python 资源
3. ASAR 打包配置
4. 构建脚本

---

### 成员 C：AI 能力

#### 任务 C1：ASR Provider 实现
**时间**：第1周（16小时）

**任务描述**：
实现语音识别（ASR）模块。

**具体工作**：
1. 创建 ASR Provider 接口
2. 实现 Whisper ASR
3. 实现音频格式转换
4. 错误处理
5. 性能优化

**代码位置**：
- `nanobot/extensions/vtuber/asr.py`

**AI 提示词（示例参考）**：
```
请实现 ASR Provider：

1. 创建 nanobot/extensions/vtuber/asr.py

2. 接口设计：
   class ASRProvider(ABC):
       async def transcribe(self, audio_data: bytes) -> str:
           """语音转文字"""

3. 实现 WhisperASRProvider：
   - 使用 openai-whisper 或 faster-whisper
   - 支持多语言（默认中文）
   - 返回识别文本

4. 要求：
   - 异步实现
   - 错误处理
   - 支持配置模型大小

请生成完整的 Python 代码。
```

---

#### 任务 C2：TTS Provider 实现
**时间**：第2周（12小时）

**任务描述**：
实现语音合成（TTS）模块。

**具体工作**：
1. 创建 TTS Provider 接口
2. 实现 Edge TTS
3. 音频格式处理
4. 缓存机制

**代码位置**：
- `nanobot/extensions/vtuber/tts.py`

---

#### 任务 C3：Live2D 动作映射
**时间**：第3周（16小时）

**任务描述**：
实现情绪识别到 Live2D 动作的映射。

**具体工作**：
1. 情绪识别（关键词匹配）
2. 情绪-动作映射表
3. Live2D 指令生成
4. 可配置映射

**代码位置**：
- `nanobot/extensions/vtuber/emotion.py`
- `nanobot/extensions/vtuber/live2d.py`

---

#### 任务 C4：VtuberExtension 整合
**时间**：第4周（12小时）

**任务描述**：
整合 ASR/TTS/Live2D 为统一扩展。

**具体工作**：
1. 创建 VtuberExtension 类
2. 订阅 MessageBus 事件
3. 处理语音输入流程
4. 处理语音输出流程
5. 与 DesktopChannel 协作

**代码位置**：
- `nanobot/extensions/vtuber/__init__.py`

---

### 成员 D：业务功能

#### 任务 D1：应用启动工具
**时间**：第1周（12小时）

**任务描述**：
实现 open_app 和 open_url 工具，带白名单安全策略。

**具体工作**：
1. 创建 AppWhitelist 类
2. 实现 open_app 工具
3. 实现 open_url 工具
4. 审计日志
5. 配置文件

**代码位置**：
- `nanobot/agent/tools/desktop.py`
- `config/app_whitelist.json`

**AI 提示词（示例参考）**：
```
请实现桌面应用启动工具：

1. 创建 nanobot/agent/tools/desktop.py

2. 实现 OpenAppTool：
   @property
   def name(self) -> str:
       return "open_app"
   
   async def execute(self, app_name: str, args: list = None) -> str:
       # 检查白名单
       # 找到应用路径
       # 启动应用

3. 实现 AppWhitelist 类：
   - 从 config/app_whitelist.json 加载
   - 支持通配符路径
   - 别名匹配

4. 安全要求：
   - 非白名单应用拒绝
   - 操作记录日志

请生成完整的 Python 代码和配置示例。
```

---

#### 任务 D2：系统操作工具
**时间**：第2周（12小时）

**任务描述**：
实现截图、通知、系统信息等工具。

**具体工作**：
1. 截图工具（委托给 Electron）
2. 通知工具
3. 系统信息工具
4. 工具注册

**代码位置**：
- `nanobot/agent/tools/system.py`

---

#### 任务 D3：Heartbeat 配置
**时间**：第3周（8小时）

**任务描述**：
配置 nanobot Heartbeat 实现主动触发。

**具体工作**：
1. 编写 HEARTBEAT.md
2. 配置触发规则
3. 测试触发效果

**代码位置**：
- `workspace/HEARTBEAT.md`

---

#### 任务 D4：订阅权益
**时间**：第4周（16小时）

**任务描述**：
实现订阅权益管理和支付回调。

**具体工作**：
1. 权益数据模型
2. 订单管理
3. 支付回调处理
4. 权益校验

---

#### 任务 D5：埋点系统
**时间**：第5-6周（20小时）

**任务描述**：
实现事件采集和分析。

**具体工作**：
1. 事件采集器
2. 事件存储
3. 指标计算
4. 简单看板

---

## Sprint 2：功能完善（第5-8周）

| 成员 | 任务 | 时间 |
|------|------|------|
| A | 优化 UI、多角色支持 | 20h |
| B | 安装程序制作、测试 | 20h |
| C | 性能优化、缓存 | 16h |
| D | 埋点完善、数据分析 | 16h |

---

## Sprint 3：商业化（第9-10周）

| 成员 | 任务 | 时间 |
|------|------|------|
| A | 订阅页面、支付 UI | 16h |
| B | 部署脚本、文档 | 12h |
| C | 音质优化 | 8h |
| D | A/B 实验、指标 | 16h |

---

## Sprint 4：发布（第11-12周）

| 成员 | 任务 | 时间 |
|------|------|------|
| 全员 | 集成测试 | 20h/人 |
| 全员 | Bug 修复 | 16h/人 |
| 全员 | 文档完善 | 8h/人 |

---

## 协作规范

### 代码仓库
```
E:\Mural\
├── desktop-companion/          # A 负责区域
│   ├── electron/
│   └── installer/
│
└── nanobot-main/
    └── nanobot/
        ├── channels/desktop/     # B 负责区域
        ├── extensions/vtuber/    # C 负责区域
        └── agent/tools/          # D 负责区域
```

### 每日站会
- 时间：每天 10:00
- 时长：15 分钟
- 内容：昨天完成 / 今天计划 / 阻塞问题

### Code Review
- A ↔ B 互审
- C ↔ D 互审
- 每个 PR 必须有一人 Approve

### 分支策略
```
main (稳定)
  └── dev (开发)
        ├── feature/A-xxx
        ├── feature/B-xxx
        ├── feature/C-xxx
        └── feature/D-xxx
```

---

## AI Coding 工作流

### 标准流程
```
1. 阅读任务卡片
2. 复制 AI 提示词
3. 发送给 AI（Claude/GPT-4/etc.）
4. AI 生成代码
5. 验证代码（运行测试）
6. 调整/修复
7. 提交 PR
```

### AI 提示词模板（示例参考）
```
我正在开发 [项目名称]，需要实现 [任务名称]。

## 背景
[简要描述项目背景]

## 需求
[详细描述需要实现的功能]

## 技术要求
- 语言/框架：[...]
- 参考文件：[...]
- 代码风格：[...]

## 验收标准
- [ ] [...]

请生成完整的代码实现。
```
