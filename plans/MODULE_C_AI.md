# 模块 C：AI 服务实现 (Node.js)

> 负责人：成员 C
> 技术栈：TypeScript, whisper-node, edge-tts, Live2D Logic

---

## 模块概述

负责 Electron 主进程中的 AI 能力实现：
- S2S Client (Doubao Realtime Protocol)
- ASR Service (whisper-node)
- VAD Service (@ricky0123/vad-node)
- TTS Service (edge-tts)
- Live2D 逻辑控制 (TS Port)

---

## Sprint 1 任务（第1-4周）

### C1: S2S 协议封装

**时间**：第1周（20小时）

**任务清单**：

```
- [ ] 实现 Doubao Realtime WebSocket 协议 (Handshake/Audio/Text)
- [ ] 实现二进制帧封包与拆包 (Buffer操作)
- [ ] 实现流式音频发送 (PCM 16k Chunking)
- [ ] 实现流式音频接收与缓冲
```

**文件结构**：

```
src/main/services/
├── doubao/
│   ├── client.ts        # S2S 客户端
│   ├── protocol.ts      # 协议定义
│   └── types.ts         # 类型定义
├── audio/
│   ├── converter.ts     # 音频格式转换
```

### C2: 音频管线与 VAD

**时间**：第2周（16小时）

**任务清单**：

```
- [ ] 集成 @ricky0123/vad-node
- [ ] 实现流式音频检测
- [ ] 调整 VAD 阈值与参数
```

### C3: 兼容模式服务 (ASR/TTS)

**时间**：第3周（12小时）

**任务清单**：

```
- [ ] 集成 whisper-node (Local ASR)
- [ ] 集成 edge-tts (Local TTS)
- [ ] 实现模式切换逻辑 (S2S <-> Local)
```

### C4: Live2D 逻辑控制

**时间**：第4周（16小时）

**任务清单**：

```
- [ ] 移植 Open-LLM-VTuber 的 LipSync 算法 (TS 实现)
- [ ] 实现 Audio -> Viseme 映射
- [ ] 实现情绪关键词匹配
- [ ] 生成 Live2D 动作指令
```

---

## Sprint 2 任务（第5-8周）

### C5: 性能与体验优化

**时间**：第5-6周（16小时）

```
- [ ] ASR 并发控制
- [ ] TTS 预加载机制
- [ ] 优化 LipSync 延迟
```

### C8: 视觉感知 (Node.js)

**时间**：第8周（16小时）

```
- [ ] 集成 screenshot-desktop
- [ ] 封装 Vision LLM 调用接口
- [ ] 实现截图压缩与上传
```

---

## 技术参考

### Whisper Node 使用

```typescript
import { whisper } from 'whisper-node';

const transcript = await whisper(filePath, {
  modelName: "base",
  language: "zh"
});
```

### Edge TTS (Node)

```typescript
import { EdgeTTS } from 'edge-tts';

const tts = new EdgeTTS();
await tts.ttsPromise("你好", "zh-CN-XiaoxiaoNeural");
```

### LipSync 算法 (TS)

```typescript
// 计算 RMS 音量并映射到 MouthOpen
function calculateMouthOpen(audioBuffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    sum += audioBuffer[i] * audioBuffer[i];
  }
  const rms = Math.sqrt(sum / audioBuffer.length);
  return Math.min(1.0, rms * 5.0); // 放大系数
}
```
