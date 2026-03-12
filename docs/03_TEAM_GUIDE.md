# 团队分工指南

> 4人团队 · 12周开发周期 · AI Coding
>
> 里程碑口径以 `plans/INDEX.md` 为准。

---

## 团队成员

| 成员 | 角色 | 主要职责 | 技术栈 |
|------|------|----------|--------|
| **A** | 客户端开发 | Electron 桌面应用、UI、Live2D、AudioWorklet | TypeScript, Electron, Pixi.js |
| **B** | 后端核心 | Node.js Agent Core、S2S Client、Bypass Logic | TypeScript, Node.js |
| **C** | AI能力 | S2S 协议封装、ASR/TTS/VAD 服务集成 | TypeScript, Buffer, Audio |
| **D** | 业务功能 | 桌面工具、记忆系统、订阅支付 | TypeScript, SQLite |

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

#### 任务 A2：IPC 通信与音频管线
**时间**：第2周（16小时）

**任务描述**：
实现 Electron Main 与 Renderer 之间的 IPC 通信，以及基于 AudioWorklet 的全双工音频流处理。

**具体工作**：
1. 定义 IPC 消息类型 (S2S/Text/Action)
2. 实现 AudioWorklet (播放流式 PCM 16k)
3. 实现 AudioProcessor (采集 16k PCM + VAD 门限)
4. 实现全双工音频流 (Renderer <-> Main)

**验收标准**：
- [ ] 录音采集正常 (16k PCM)
- [ ] VAD 门限生效
- [ ] 流式播放无卡顿
- [ ] IPC 双向通信正常

**AI 提示词（示例参考）**：
```
请帮我实现 Electron 与 Main Process 的 IPC 通信模块，以及 AudioWorklet 音频管线：

1. 创建 AudioService 类 (Renderer)：
   - 加载 AudioWorkletProcessor
   - 实现 16k PCM 麦克风采集
   - 实现 PCM 流式播放
   - 实现 VAD 门限检测 (前端简单版)

2. 定义 IPC 消息协议 (Types)：
   - 双向流：`audio:stream` (ArrayBuffer)
   - 文本消息：`agent:text`
   - 系统动作：`tool:action`

3. 要求：
   - 使用 TypeScript
   - 提供 AudioWorkletProcessor 代码 (pcm-player.js)
   - 处理 Electron 进程安全 (ContextBridge)

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

### 成员 B：后端核心 (Node.js)

#### 任务 B1：Agent Core 基础框架
**时间**：第1周（20小时）

**任务描述**：
使用 TypeScript 重写轻量级 Agent Loop，作为系统的决策中枢。

**具体工作**：
1. 定义 Agent 接口 (Input/Output/State)
2. 实现基础 Loop (接收 -> 思考 -> 行动)
3. 集成 LLM SDK (OpenAI/Doubao)
4. 实现 System Prompt 构建器

**代码位置**：
- `src/main/agent/loop.ts`
- `src/main/agent/context.ts`

---

#### 任务 B2：Bypass Agent (旁路监听)
**时间**：第2周（16小时）

**任务描述**：
实现 S2S 模式下的旁路意图识别模块。

**具体工作**：
1. 监听 S2S 文本流 (User & AI)
2. 触发意图识别 (LLM Call)
3. 提取工具调用指令
4. 异步执行工具

**代码位置**：
- `src/main/agent/bypass.ts`

---

#### 任务 B3：nanobot 配置移植
**时间**：第2周（8小时）

**任务描述**：
将原 nanobot 配置结构移植到 Node.js，支持新架构配置。

**具体工作**：
1. 定义 Config 接口 (TS)
2. 实现配置加载器 (dotenv + json)
3. 配置验证 (Zod)
4. 默认配置模板

**代码位置**：
- `src/main/config/index.ts`
- `src/main/config/schema.ts`

---

#### 任务 B4：Electron 构建配置
**时间**：第3周（12小时）

**任务描述**：
配置 electron-builder，处理原生模块编译。

**具体工作**：
1. 配置 electron-builder
2. 配置 electron-rebuild (Native Modules)
3. 资源文件拷贝规则
4. 构建脚本编写

**代码位置**：
- `electron-builder.json`
- `scripts/rebuild.js`

---

#### 任务 B5：CI/CD 基础
**时间**：第4周（12小时）

**任务描述**：
搭建基础的 CI/CD 流程，自动构建 Release。

**具体工作**：
1. GitHub Actions 配置
2. 自动测试运行
3. 自动构建 Release
4. 自动生成 Changelog

**代码位置**：
- `.github/workflows/build.yml`

---

### 成员 C：AI 能力 (Node.js)

#### 任务 C1：S2S 协议封装
**时间**：第1周（20小时）

**任务描述**：
实现豆包 Realtime API 的 WebSocket 客户端，处理二进制协议。

**具体工作**：
1. 实现握手与鉴权
2. 实现二进制帧封包/拆包
3. 实现流式音频发送 (Chunking)
4. 实现流式接收缓冲

**代码位置**：
- `src/main/services/doubao/client.ts`
- `src/main/services/doubao/protocol.ts`

---

#### 任务 C2：兼容模式服务集成
**时间**：第2周（16小时）

**任务描述**：
集成本地 ASR/TTS/VAD 库，作为 S2S 的降级方案。

**具体工作**：
1. 集成 `whisper-node`
2. 集成 `edge-tts`
3. 集成 `@ricky0123/vad-node`
4. 封装统一 AudioService 接口

**代码位置**：
- `src/main/services/audio/asr.ts`
- `src/main/services/audio/tts.ts`

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
- `src/main/services/live2d/emotion.ts`
- `src/main/services/live2d/controller.ts`

---

#### 任务 C4：AI Service 统一封装
**时间**：第4周（12小时）

**任务描述**：
整合 S2S/ASR/TTS/Live2D 为统一的 AI 服务层。

**具体工作**：
1. 定义 AI Service 接口
2. 实现 Hybrid Mode 切换逻辑
3. 统一错误处理
4. 状态同步 (Thinking/Speaking)

**代码位置**：
- `src/main/services/ai/index.ts`

---

### 成员 D：业务功能 (Node.js)

#### 任务 D1：桌面工具集
**时间**：第1周（16小时）

**任务描述**：
移植并实现 TS 版的桌面操作工具，包含白名单机制。

**具体工作**：
1. 实现 Tool 接口
2. 实现 `open_app` / `open_url`
3. 实现 `AppWhitelist` (JSON 配置)
4. 实现操作审计日志

**代码位置**：
- `src/main/tools/desktop.ts`
- `src/main/tools/whitelist.ts`

---

#### 任务 D2：记忆系统
**时间**：第2周（16小时）

**任务描述**：
实现基于 JSON/SQLite 的记忆存储与检索。

**具体工作**：
1. 设计记忆数据结构 (Short/Long Term)
2. 实现记忆写入 (Bypass 触发)
3. 实现记忆检索 (Context 注入)
4. 每日摘要任务

**代码位置**：
- `src/main/memory/store.ts`
- `src/main/memory/manager.ts`

---

#### 任务 D3：Heartbeat 移植
**时间**：第3周（8小时）

**任务描述**：
移植 Heartbeat 逻辑到 Node.js，实现主动触发。

**具体工作**：
1. 移植 Cron 调度逻辑 (node-schedule)
2. 移植规则匹配逻辑
3. 实现主动消息推送
4. 编写 HEARTBEAT.md 配置

**代码位置**：
- `src/main/agent/heartbeat.ts`
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
ai-desktop-companion/
├── electron/             # A 负责区域 (UI/Renderer)
│   └── src/renderer/
├── src/                  # B/C/D 负责区域 (Main Process)
│   ├── main/
│   │   ├── agent/        # B (Core)
│   │   ├── services/     # C (AI)
│   │   ├── tools/        # D (Tools)
│   │   ├── memory/       # D (Memory)
│   │   └── config/       # B (Config)
│   └── ipc/              # B (IPC)
├── vendors/
│   ├── nanobot-main/             # 参考代码 (Python)
│   └── Open-LLM-VTuber/
│       └── Open-LLM-VTuber-main/ # 参考代码 (Live2D)
└── package.json
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
3. 发送给 AI
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
