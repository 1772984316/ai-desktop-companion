# AI 桌面互动伴侣 - 文档中心

> 基于 Electron + Node.js (TypeScript) 全栈架构 · 4人团队 · AI Coding

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
Electron 客户端 (IPC)  ←→  Node.js 主服务 (Agent Core)  ←→  Doubao S2S / 本地模型
```

### 核心能力
- **对话能力**：Doubao S2S (主力) + Node.js Agent (兼容)
- **记忆系统**：本地 SQLite/JSON 存储
- **主动触发**：Heartbeat Service (Node.js)
- **工具执行**：Node.js Tool Registry
- **视听能力**：S2S 流式交互 + 本地 ASR/TTS/Live2D
- **桌面通道**：Electron IPC + AudioWorklet

---

## 代码参考 (Reference Only)

本项目核心逻辑已迁移至 TypeScript (Node.js)，以下 `nanobot` (Python) 模块仅作为逻辑实现的**参考代码**：

| 能力 | 参考模块 | 迁移状态 |
|------|----------|----------|
| Agent 循环 | `agent/loop.py` | 🔄 TS 重写中 |
| 会话管理 | `session/manager.py` | 🔄 TS 重写中 |
| 记忆存储 | `agent/memory.py` | 🔄 TS 重写中 |
| 上下文构建 | `agent/context.py` | 🔄 TS 重写中 |
| 工具注册 | `agent/tools/registry.py` | 🔄 TS 重写中 |
| 心跳触发 | `heartbeat/service.py` | 🔄 TS 重写中 |

---

## 开发周期

| 阶段 | 周数 | 目标 |
|------|------|------|
| Sprint 1 | 1-4周 | 基础架构可用 |
| Sprint 2 | 5-8周 | 功能完善 |
| Sprint 3 | 9-10周 | 商业化闭环 |
| Sprint 4 | 11-12周 | 打包发布 |

---

## 文档更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-03-12 | v3.0 | 架构重构：全栈迁移至 Node.js，引入 Doubao S2S 端到端模型 |
