# AI 桌面互动伴侣

> Electron + Node.js 全栈架构 · C端桌面产品 · 二次元虚拟人物

## 项目概述

AI 桌面虚拟伴侣，常驻桌面、可视化互动、具备主动性和养成体系。

**核心架构决策**：nanobot 核心能力使用 **TypeScript 重写**，不依赖 Python 运行时。

## 目录结构

```
ai-desktop-companion/
├── README.md                     # 项目入口（本文件）
├── 需求.md                        # 产品需求汇总
│
├── docs/                          # 核心文档
│   ├── 00_INDEX.md               # 文档索引
│   ├── 01_PRD.md                 # 产品需求
│   ├── 02_ARCHITECTURE.md        # 技术架构
│   └── 03_TEAM_GUIDE.md          # 团队分工指南
│
├── plans/                         # 开发计划
│   ├── INDEX.md                  # 计划索引
│   ├── MODULE_A_CLIENT.md        # A: 客户端开发
│   ├── MODULE_B_BACKEND.md       # B: 后端核心
│   ├── MODULE_C_AI.md            # C: AI能力
│   ├── MODULE_D_BUSINESS.md      # D: 业务功能
│   └── PACKAGING.md              # 打包与发布
│
├── vendors/                       # 参考代码（仅作逻辑参考，不运行）
│   ├── open-llm-vtuber/          # Live2D 逻辑参考
│   └── nanobot/                  # Agent 逻辑参考
│
└── src/                           # 新开发代码
    └── desktop-client/           # Electron 桌面客户端
        └── src/
            ├── main/             # 主进程（Agent Core / Services）
            ├── renderer/         # 渲染进程（UI / Live2D）
            └── shared/           # 共享类型
```

## 核心能力

| 能力 | 来源 | 说明 |
|------|------|------|
| 对话能力 | TS AgentLoop | **重写** |
| 记忆系统 | TS MemoryStore | **重写** |
| 主动触发 | TS Heartbeat | **重写** |
| 工具执行 | TS ToolRegistry | **重写** |
| ASR | whisper-node | npm 包 |
| TTS | edge-tts | npm 包 |
| Live2D | Pixi.js + Live2D SDK | 前端渲染 |
| S2S | Doubao Realtime API | 端到端语音 |

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron 桌面客户端                          │
│     桌宠窗口  │  语音采集  │  音频播放  │  Live2D渲染  │  UI面板   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Electron IPC (Main <-> Renderer)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Electron Main Process (Node.js)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │     IPC     │  │  AgentLoop  │  │ Heartbeat   │  (TS重写)    │
│  │   Handler   │  │   (Core)    │  │  Service    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ MemoryStore │  │ ToolRegistry│  │ DoubaoClient│  (TS重写)    │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         外部服务                                 │
│  LLM API (OpenAI/Claude)  │  Doubao S2S  │  ASR/TTS (本地)      │
└─────────────────────────────────────────────────────────────────┘
```

## vendors 目录说明

`vendors/` 下的代码**仅作逻辑参考**，不会在运行时使用：
- `vendors/nanobot/` — Agent/Session/Memory 的 Python 实现，用于参考 TS 重写
- `vendors/open-llm-vtuber/` — Live2D 渲染逻辑参考

## 快速开始

1. 阅读 [docs/00_INDEX.md](./docs/00_INDEX.md) 了解项目全貌
2. 阅读 [docs/01_PRD.md](./docs/01_PRD.md) 了解产品需求
3. 阅读 [plans/INDEX.md](./plans/INDEX.md) 了解开发计划

## 开发周期

| 阶段 | 周数 | 目标 |
|------|------|------|
| Sprint 1 | 1-4周 | 基础架构可用 |
| Sprint 2 | 5-8周 | 功能完善 |
| Sprint 3 | 9-10周 | 商业化闭环 |
| Sprint 4 | 11-12周 | 打包发布 |

## 参考项目（vendors/ 目录）

| 项目 | 作用 | 说明 |
|------|------|------|
| nanobot | Agent 核心逻辑参考 | Python 实现，TS 重写时参考 |
| Open-LLM-VTuber | Live2D 渲染逻辑参考 | Python/JS 实现，迁移时参考 |

## 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-03-14 | v3.0 | 确认架构：TS 重写 nanobot 核心能力，不依赖 Python |
| 2026-03-11 | v2.0 | 重构文档，基于 nanobot 融合方案 |
