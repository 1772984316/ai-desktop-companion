# AI 桌面互动伴侣

> 基于 nanobot 融合架构 · C端桌面产品 · 二次元虚拟人物

## 项目概述

AI 桌面虚拟伴侣，常驻桌面、可视化互动、具备主动性和养成体系。

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
├── vendors/                       # 依赖项目（git submodule）
│   ├── open-llm-vtuber/          # VTuber 基础框架
│   └── nanobot/                  # Agent 核心
│
└── src/                           # 新开发代码
    ├── desktop-client/           # Electron 桌面客户端
    └── vtuber-extension/         # VtuberExtension 扩展
```

## 核心能力

| 能力 | 来源 | 说明 |
|------|------|------|
| 对话能力 | nanobot AgentLoop | 复用 |
| 记忆系统 | nanobot MemoryStore | 复用 |
| 主动触发 | nanobot Heartbeat | 复用 |
| 工具执行 | nanobot Tools | 复用+扩展 |
| 视听能力 | VtuberExtension | **新增** |
| 桌面通道 | DesktopChannel | **新增** |

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron 桌面客户端                          │
│     桌宠窗口  │  语音采集  │  音频播放  │  Live2D渲染  │  UI面板   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ WebSocket (ws://localhost:18790)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     nanobot gateway（主服务）                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │DesktopChannel│  │ AgentLoop  │  │ Heartbeat   │  ← nanobot   │
│  │   (新增)    │  │   (复用)   │  │   (复用)    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              VtuberExtension（新增）                     │    │
│  │      ASR服务  │  TTS服务  │  Live2D控制                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

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

## 依赖项目

| 项目 | 作用 | GitHub |
|------|------|--------|
| Open-LLM-VTuber | VTuber 基础框架（ASR/TTS/Live2D） | [t41372/Open-LLM-VTuber](https://github.com/t41372/Open-LLM-VTuber) |
| nanobot | Agent 核心（AgentLoop/Memory/Tools） | [nicepkg/nanobot](https://github.com/nicepkg/nanobot) |

## 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-03-11 | v2.0 | 重构文档，基于 nanobot 融合方案 |
