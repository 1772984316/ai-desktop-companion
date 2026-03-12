# 团队工作文档

> 每日 AI 上下文 · 开发进度 · 工作总结

## 目录结构

```
team/
├── README.md              # 本文件
├── PROMPT_TEMPLATE.md     # 上下文文档生成 Prompt 模板
├── cai/                   # Cai 的文档
├── cao/                   # Cao 的文档
├── zhao/                  # Zhao 的文档
└── liu/                   # Liu 的文档
```

## 使用方法

### 每日工作流程

1. **开始工作前**：阅读自己的上下文文档，恢复工作状态
2. **开发过程中**：记录关键决策、代码变更、遇到的问题
3. **结束工作时**：使用 Prompt 模板生成上下文文档

### 生成上下文文档

在 AI 对话结束时，使用以下 Prompt：

```
请使用 team/PROMPT_TEMPLATE.md 中的模板，基于本次对话生成项目上下文文档。
```

### 文件命名规范

```
{username}/
├── context_2026-03-11.md      # 当天上下文
├── context_2026-03-12.md
├── progress.md                 # 总体进度（持续更新）
└── notes/                      # 其他笔记
    ├── task_xxx.md
    └── idea_xxx.md
```

---

## 成员分工

| 成员 | 角色 | 主要职责 | 技术要求 |
|------|------|----------|----------|
| **Cai** | AI 核心 (C) | S2S协议/音频服务/VAD | Node.js/Buffer/Audio |
| **Cao** | 后端 (B) | Agent Core/Bypass/IPC | Node.js/TS |
| **Zhao** | 客户端 (A) | Electron/UI/Live2D | Electron/Pixi.js |
| **Liu** | 业务功能 (D) | 记忆/工具/订阅 | TS/SQLite |

---

## 每日总结模板

在每天工作结束时，更新 `progress.md`：

```markdown
# 工作进度 - {username}

## 2026-03-11

### 完成事项
- [ ] 任务1
- [ ] 任务2

### 进行中
- 任务3 (50%)

### 遇到问题
- 问题1：描述...

### 明日计划
- 任务4
- 任务5

### AI 上下文
- 上下文文档：[context_2026-03-11.md](./context_2026-03-11.md)
```
