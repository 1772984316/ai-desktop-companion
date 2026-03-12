# 模块 B：Node.js 后端与服务编排

> 负责人：成员 B
> 技术栈：TypeScript, Node.js (Electron Main), IPC

---

## 模块概述

负责 Electron 主进程中的后端逻辑与 AI 服务编排：
- Agent Core (基于 TS 重写的轻量级 Loop)
- IPC 通信管理
- ASR/VAD/TTS 服务集成 (Node.js binding)
- 记忆与会话管理 (Local JSON/SQLite)

---

## Sprint 1 任务（第1-4周）

### B1: Agent Core 基础框架

**时间**：第1周（20小时）

**任务清单**：

```
- [ ] 定义 Agent 核心接口 (Input/Output/State)
- [ ] 实现基础 Agent Loop (接收 -> 思考 -> 行动)
- [ ] 集成 OpenAI/Claude SDK
- [ ] 实现 System Prompt 构建器
- [ ] 实现基础 Memory Store (JSON 文件读写)
```

**文件结构**：

```
src/main/
├── agent/
│   ├── loop.ts          # 核心循环
│   ├── context.ts       # 上下文构建
│   └── types.ts         # 类型定义
├── memory/
│   └── store.ts         # 记忆存储
└── services/
    └── llm.ts           # LLM 客户端封装
```

### B2: IPC 通信层

**时间**：第2周（12小时）

**任务清单**：

```
- [ ] 设计 IPC 消息协议 (Types)
- [ ] 实现 Main Process IPC Handler
- [ ] 实现流式数据传输 (用于 TTS/ASR 音频流)
- [ ] 错误处理与状态同步
```

### B3: Node.js AI 服务集成 (Hybrid Mode)

**时间**：第3周（20小时）

**任务清单**：

```
- [ ] 集成 Doubao Realtime API (S2S WebSocket 客户端)
- [ ] 实现 BypassAgent (旁路意图识别)
- [ ] 集成 whisper-node (兼容模式 ASR)
- [ ] 集成 @ricky0123/vad-node (通用 VAD)
- [ ] 集成 edge-tts (兼容模式 TTS)
```

**关键实现 (DoubaoClient)**：

```typescript
// src/main/services/doubao.ts
class DoubaoRealtimeClient extends EventEmitter {
  connect() {
    this.ws = new WebSocket('wss://openspeech.bytedance.com/...');
    this.ws.on('message', (data) => {
      // 解析二进制帧 -> 触发 'audio' 或 'text' 事件
      // 文本事件 -> 发送给 BypassAgent
    });
  }
}
```

### B4: 服务编排与调试
**时间**：第4周（12小时）

```
- [ ] 联调：S2S Mode (Renderer -> Doubao -> Renderer)
- [ ] 联调：Bypass Tool Execution (Doubao -> BypassAgent -> Tool)
- [ ] 性能基准测试 (Benchmark)
  - [ ] 采集 S2S 首字延迟 (P99 < 1s)
  - [ ] 采集 内存/CPU 占用曲线
  - [ ] 采集 启动时间 (Cold Start)
- [ ] 日志系统实现 (Structured Logger)
```

---

## Sprint 2 任务（第5-8周）

### B5: 复杂工具链实现

**时间**：第5-6周（20小时）

```
- [ ] 实现 ToolRegistry (装饰器模式)
- [ ] 移植 Desktop Tools (open_app, screenshot 等)
- [ ] 实现安全白名单机制
```

### B6: 长期记忆增强

**时间**：第7周（16小时）

```
- [ ] 引入 Vector Store (可选，如 local vector db)
- [ ] 实现记忆压缩与归档逻辑
- [ ] 实现用户偏好学习
```

---

## 技术参考

### Agent Loop (TS 示例)

```typescript
export class AgentLoop {
  async run(input: AgentInput): Promise<void> {
    // 1. Build Context
    const context = await this.contextBuilder.build(input);
    
    // 2. LLM Inference
    const response = await this.llm.chat(context);
    
    // 3. Tool Execution or Reply
    if (response.tool_calls) {
      // ... execute tools
    } else {
      // ... send reply via IPC
      this.ipc.send('agent:response', response.content);
    }
  }
}
```

### IPC Handler

```typescript
ipcMain.handle('audio:stream', async (event, buffer) => {
  // Process audio buffer with VAD/ASR
  const text = await this.audioService.transcribe(buffer);
  return text;
});
```
