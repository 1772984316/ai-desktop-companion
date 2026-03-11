# 模块 A：客户端开发

> 负责人：成员 A  
> 技术栈：TypeScript, Electron, Pixi.js

---

## 模块概述

负责 Electron 桌面客户端的完整开发，包括：
- 窗口管理（置顶、穿透、拖拽）
- 通信层（WebSocket）
- UI 界面（对话、设置）
- Live2D 渲染
- 打包配置

---

## Sprint 1 任务（第1-4周）

### A1: Electron 项目搭建

**时间**：第1周（20小时）

**任务清单**：

```
- [ ] 创建 Electron 项目结构
- [ ] 配置 TypeScript + electron-builder
- [ ] 实现无边框透明窗口
- [ ] 实现窗口拖拽功能
- [ ] 实现置顶切换
- [ ] 实现鼠标穿透切换
- [ ] 实现系统托盘
- [ ] 实现窗口位置记忆
- [ ] 基础 CSS 样式
```

**文件结构**：

```
desktop-companion/
├── electron/
│   ├── src/
│   │   ├── main.ts           # 主进程
│   │   ├── preload.ts        # 预加载脚本
│   │   └── utils/
│   │       ├── window.ts     # 窗口管理
│   │       └── tray.ts       # 托盘管理
│   ├── renderer/
│   │   ├── index.html
│   │   ├── app.ts
│   │   └── styles.css
│   ├── package.json
│   └── tsconfig.json
```

**验收标准**：
```gherkin
Feature: Electron Window Management

  Scenario: Window display
    Given the app is launched
    When the window appears
    Then it should be frameless
    And it should have transparent background

  Scenario: Window dragging
    Given the window is visible
    When user drags the window
    Then the window should move with the cursor

  Scenario: Always on top
    Given the window is visible
    When user toggles "always on top"
    Then the window should stay above other windows

  Scenario: Click through
    Given the window is visible
    When user enables "click through"
    Then mouse clicks should pass through to apps below
```

**AI 提示词**：

```
请帮我创建一个 Electron 桌面应用项目，用于 AI 虚拟桌宠。

## 项目结构

desktop-companion/
├── electron/
│   ├── src/
│   │   ├── main.ts           # 主进程入口
│   │   ├── preload.ts        # 预加载脚本
│   │   └── utils/
│   │       ├── window.ts     # 窗口管理工具
│   │       └── tray.ts       # 系统托盘
│   ├── renderer/
│   │   ├── index.html        # 主页面
│   │   ├── app.ts            # 渲染进程入口
│   │   └── styles.css        # 样式
│   ├── package.json
│   └── tsconfig.json

## 功能要求

1. 窗口特性：
   - 无边框 (frame: false)
   - 透明背景 (transparent: true)
   - 可拖拽移动
   - 可切换置顶 (alwaysOnTop)
   - 可切换鼠标穿透 (setIgnoreMouseEvents)
   - 窗口大小: 400x600
   - 启动时居中显示

2. 系统托盘：
   - 显示图标
   - 右键菜单：显示/隐藏、置顶切换、穿透切换、退出
   - 双击显示窗口

3. 位置记忆：
   - 关闭前保存窗口位置到 localStorage
   - 启动时恢复位置

4. IPC 通信：
   - toggleAlwaysOnTop
   - toggleClickThrough
   - getWindowState
   - setWindowState

## 技术要求

- Electron 28+
- TypeScript
- 使用 electron-builder 配置
- 代码有完整类型定义

请生成所有文件的完整代码。
```

---

### A2: WebSocket 通信层

**时间**：第2周（16小时）

**任务清单**：

```
- [ ] 创建 WebSocketService 类
- [ ] 实现消息发送
- [ ] 实现消息接收与分发
- [ ] 实现心跳保活
- [ ] 实现断线重连（指数退避）
- [ ] 实现连接状态管理
- [ ] 实现离线消息队列
- [ ] 添加类型定义
```

**文件结构**：

```
renderer/
├── services/
│   ├── websocket.ts     # WebSocket 服务
│   └── messageQueue.ts  # 离线消息队列
├── types/
│   └── messages.ts      # 消息类型定义
```

**消息协议**：

```typescript
// 发送消息类型
type ClientMessage =
  | { type: 'text'; content: string; metadata?: object }
  | { type: 'voice'; audio: string; format: string }
  | { type: 'screenshot'; image: string; query: string }
  | { type: 'system'; event: string; data: object };

// 接收消息类型
type ServerMessage =
  | { type: 'message'; content: string; is_final: boolean }
  | { type: 'progress'; content: string }
  | { type: 'action'; action: Live2DAction }
  | { type: 'audio'; audio: string; text: string }
  | { type: 'error'; code: string; message: string };
```

**验收标准**：

```gherkin
Feature: WebSocket Communication

  Scenario: Connect to server
    Given the app is launched
    When WebSocket service starts
    Then it should connect to ws://localhost:18790
    And connection state should be "connected"

  Scenario: Send text message
    Given WebSocket is connected
    When user sends "你好"
    Then a message should be sent to server
    And the message type should be "text"

  Scenario: Receive response
    Given WebSocket is connected
    And a message was sent
    When server sends response
    Then the response should be displayed
    And if is_final is true, show complete message

  Scenario: Auto reconnect
    Given WebSocket is connected
    When connection is lost
    Then it should retry connecting
    And retry interval should increase (1s, 2s, 4s, ...)
    And max retry interval should be 30s
```

**AI 提示词**：

```
请实现 Electron 与 nanobot 后端的 WebSocket 通信模块。

## 文件结构

renderer/
├── services/
│   ├── websocket.ts     # WebSocket 服务类
│   └── messageQueue.ts  # 离线消息队列
├── types/
│   └── messages.ts      # 消息类型定义

## 功能要求

1. WebSocketService 类：
   - 连接到 ws://localhost:18790
   - 发送/接收消息
   - 心跳保活（每30秒发送 ping）
   - 断线自动重连（指数退避：1s, 2s, 4s...最大30s）
   - 连接状态事件（connecting, connected, disconnected, error）
   - 消息分发（事件订阅模式）

2. MessageQueue 类：
   - 离线时缓存消息
   - 连接恢复后批量发送
   - 最大缓存100条

3. 消息类型：
   - ClientMessage: text | voice | screenshot | system
   - ServerMessage: message | progress | action | audio | error

## 类型定义

interface WebSocketService {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: ClientMessage): void;
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  state: ConnectionState;
}

## 要求

- 完整的 TypeScript 类型
- 错误处理
- 使用 EventTarget 或类似模式

请生成完整代码。
```

---

### A3: UI 界面开发

**时间**：第3周（16小时）

**任务清单**：

```
- [ ] 对话消息列表组件
- [ ] 消息输入框组件
- [ ] 语音按钮组件
- [ ] 状态指示器组件
- [ ] 设置面板组件
- [ ] 关系值显示组件
- [ ] CSS 主题系统
```

---

### A4: Live2D 集成

**时间**：第4周（20小时）

**任务清单**：

```
- [ ] 安装 Pixi.js + Live2D SDK
- [ ] 创建 Live2D 渲染容器
- [ ] 实现模型加载
- [ ] 实现动作指令接收
- [ ] 实现表情切换
- [ ] 实现口型同步
- [ ] 资源管理
```

---

## Sprint 2 任务（第5-8周）

### A5: 多角色支持

**时间**：第5周（16小时）

```
- [ ] 角色配置系统
- [ ] 角色切换 UI
- [ ] 角色数据隔离
```

### A6: 性能优化

**时间**：第6周（12小时）

```
- [ ] 渲染性能优化
- [ ] 内存管理
- [ ] 懒加载
```

### A7: 主题系统

**时间**：第7周（12小时）

```
- [ ] 主题配置
- [ ] 皮肤系统
- [ ] 主题切换
```

### A8: 订阅页面

**时间**：第8周（12小时）

```
- [ ] 订阅页 UI
- [ ] 支付流程 UI
- [ ] 权益展示
```

---

## Sprint 3 任务（第9-10周）

### A9: 订阅集成

**时间**：第9周（12小时）

### A10: 最终优化

**时间**：第10周（12小时）

---

## 技术参考

### Electron 窗口配置

```typescript
const mainWindow = new BrowserWindow({
  width: 400,
  height: 600,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  resizable: false,
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
  }
});
```

### 鼠标穿透

```typescript
// 开启穿透
mainWindow.setIgnoreMouseEvents(true, { forward: true });

// 关闭穿透
mainWindow.setIgnoreMouseEvents(false);
```

### 拖拽实现

```typescript
// renderer 进程
document.body.style.webkitAppRegion = 'drag';

// 排除输入框等交互元素
input.style.webkitAppRegion = 'no-drag';
```
