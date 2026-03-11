# 工作进度 - Cai

> 角色：AI 核心 (C) | ASR + TTS + LLM + 情绪映射

## 当前 Sprint：Sprint 1（第1-4周）

### 2026-03-11

#### 完成事项
- [x] 项目初始化

#### 进行中
- ASR/TTS 方案调研 (0%)

#### 明日计划
- 评估 Whisper 本地部署方案
- 测试 Edge-TTS 效果
- 研究 LLM 接口对接

#### AI 上下文
- 待生成

---

## 任务清单

### Sprint 1 任务
- [ ] C1: ASR 方案选型与集成（第1-2周）
- [ ] C2: TTS 方案选型与集成（第2-3周）
- [ ] C3: VAD 语音检测（第3周）
- [ ] C4: 情绪映射与 Live2D 动作联动（第4周）

### Sprint 2 任务
- [ ] C5: 音质优化、延迟优化
- [ ] C6: 多语言支持

### 相关文档
- [开发计划](../plans/MODULE_C_AI.md)
- [技术架构](../docs/02_ARCHITECTURE.md)

---

## 技术选型参考

| 能力 | 候选方案 | 说明 |
|------|----------|------|
| ASR | Whisper (本地/云端) | 语音识别 |
| TTS | Edge-TTS / Azure TTS | 语音合成 |
| VAD | Silero VAD | 语音活动检测 |
| LLM | OpenAI / Claude / 本地模型 | 对话生成 |
