# AI 桌面互动伴侣 - 文档中心

> 基于 nanobot 融合架构 · 4人团队 · AI Coding

---

## 文档导航

| 文档 | 说明 | 必读程度 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 产品需求说明 | ⭐⭐⭐ 全员必读 |
| [02_ARCHITECTURE.md](./02_ARCHITECTURE.md) | 技术架构设计 | ⭐⭐⭐ 全员必读 |
| [03_TEAM_GUIDE.md](./03_TEAM_GUIDE.md) | 团队分工指南 | ⭐⭐⭐ 全员必读 |

---

## 项目概述

### 产品定位
AI 桌面虚拟伴侣，常驻桌面、可视化互动、具备主动性和养成体系。

### 技术方案
```
Electron 客户端  ←WebSocket→  nanobot 主服务  ←→  ASR/TTS/Live2D
```

### 核心能力
- **对话能力**：nanobot AgentLoop（复用）
- **记忆系统**：nanobot MemoryStore（复用）
- **主动触发**：nanobot Heartbeat（复用）
- **工具执行**：nanobot Tools（复用+扩展）
- **视听能力**：VtuberExtension（新增）
- **桌面通道**：DesktopChannel（新增）

---

## nanobot 复用清单

| 能力 | nanobot 模块 | 状态 |
|------|--------------|------|
| Agent 循环 | `agent/loop.py` | ✅ 直接复用 |
| 会话管理 | `session/manager.py` | ✅ 直接复用 |
| 记忆存储 | `agent/memory.py` | ✅ 直接复用 |
| 上下文构建 | `agent/context.py` | ✅ 直接复用 |
| 工具注册 | `agent/tools/registry.py` | ✅ 直接复用 |
| 技能加载 | `agent/skills.py` | ✅ 直接复用 |
| 心跳触发 | `heartbeat/service.py` | ✅ 直接复用 |
| 通道基类 | `channels/base.py` | ✅ 扩展实现 |
| 消息总线 | `bus/queue.py` | ✅ 直接复用 |

---

## 开发周期

| 阶段 | 周数 | 目标 |
|------|------|------|
| Sprint 1 | 1-3周 | 基础架构可用 |
| Sprint 2 | 4-6周 | 功能完善 |
| Sprint 3 | 7-9周 | 商业化闭环 |
| Sprint 4 | 10-12周 | 打包发布 |

---

## 文档更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-03-11 | v2.0 | 重构文档，基于 nanobot 融合方案 |
