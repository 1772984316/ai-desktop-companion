# Electron 桌面客户端

> 桌面常驻虚拟人物 · 语音交互 · Live2D 渲染

## 技术栈

- **Electron** - 桌面应用框架
- **TypeScript** - 类型安全
- **Pixi.js** - Live2D 渲染
- **WebSocket** - 与后端通信

## 核心功能

| 功能 | 说明 |
|------|------|
| 桌宠窗口 | 无边框透明窗口，可拖拽 |
| 置顶/穿透 | 窗口层级控制 |
| 系统托盘 | 后台常驻 |
| 语音采集 | 麦克风输入 |
| 音频播放 | TTS 输出播放 |
| Live2D | 角色渲染 + 动作 |

## 开发计划

详见 [plans/MODULE_A_CLIENT.md](../plans/MODULE_A_CLIENT.md)

## 目录结构（待创建）

```
desktop-client/
├── electron/
│   ├── src/
│   │   ├── main.ts          # 主进程
│   │   ├── preload.ts       # 预加载脚本
│   │   └── utils/
│   │       ├── window.ts    # 窗口管理
│   │       ├── tray.ts      # 托盘管理
│   │       └── websocket.ts # WebSocket 客户端
│   └── renderer/
│       ├── index.html
│       ├── app.ts
│       ├── live2d/          # Live2D 相关
│       └── styles.css
├── package.json
├── tsconfig.json
└── electron-builder.json    # 打包配置
```
