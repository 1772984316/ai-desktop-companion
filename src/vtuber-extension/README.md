# VtuberExtension 扩展

> nanobot 扩展模块 · DesktopChannel · 桌面工具

## 技术栈

- **Python 3.10+** - 运行时
- **nanobot** - Agent 核心（复用）
- **WebSocket** - 客户端通信
- **Open-LLM-VTuber** - ASR/TTS 参考

## 核心模块

| 模块 | 说明 |
|------|------|
| DesktopChannel | Electron 客户端通信通道 |
| VtuberExtension | ASR/TTS/Live2D 封装 |
| DesktopTools | 桌面操作工具 |

## 开发计划

详见 [plans/MODULE_B_BACKEND.md](../plans/MODULE_B_BACKEND.md)

## 目录结构（待创建）

```
vtuber-extension/
├── nanobot_ext/
│   ├── __init__.py
│   │
│   ├── channels/
│   │   ├── __init__.py
│   │   └── desktop.py       # DesktopChannel 实现
│   │
│   ├── extension/
│   │   ├── __init__.py
│   │   ├── vtuber.py        # VtuberExtension
│   │   ├── asr.py           # ASR 封装
│   │   ├── tts.py           # TTS 封装
│   │   └── live2d.py        # Live2D 控制
│   │
│   └── tools/
│       ├── __init__.py
│       ├── open_app.py      # 打开应用
│       ├── open_url.py      # 打开网址
│       ├── open_file.py     # 打开文件
│       └── system.py        # 系统操作
│
├── tests/
├── pyproject.toml
└── README.md
```

## 依赖

```toml
[project]
dependencies = [
    "nanobot>=0.1.0",
    "websockets>=12.0",
    "edge-tts>=6.1.0",
]
```
