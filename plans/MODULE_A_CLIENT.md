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

**AI 提示词（示例参考）**：

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

### A2: IPC 通信与音频管线

**时间**：第2周（16小时）

**任务清单**：

```
- [ ] 定义 IPC 消息类型 (S2S/Text/Action)
- [ ] 实现 AudioWorklet (播放流式 PCM 16k)
- [ ] 实现 AudioProcessor (采集 16k PCM + VAD 门限)
- [ ] 实现全双工音频流 (Renderer <-> Main)
```

**关键技术 (AudioWorklet)**：

```javascript
// renderer/public/pcm-player.js
class PCMPlayerProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    // 从 RingBuffer 读取 PCM 数据并写入 output
    // 实现平滑播放，避免爆音
  }
}
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
