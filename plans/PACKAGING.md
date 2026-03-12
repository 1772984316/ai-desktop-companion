# 打包与发布

> 负责人：成员 B（主）+ 全员协作
> 时间：第9-12周

---

## 打包目标

将以下组件打包为单一安装程序：

```
DesktopCompanion-Setup.exe
├── Electron 主进程 (Node.js)
├── Renderer 资源 (UI + Live2D)
├── 本地 AI 模型 (可选/按需下载)
└── 配置文件
```

---

## 第9-10周：打包准备

### electron-builder 配置

```json
// electron/package.json

{
  "build": {
    "appId": "com.desktop-companion.app",
    "productName": "Desktop Companion",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "../resources/models",
        "to": "models",
        "filter": ["**/*"] 
      },
      {
        "from": "../resources/config",
        "to": "config"
      }
    ],
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "build/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

---

### 原生模块处理 (Native Modules)

由于使用了 `whisper-node` (C++) 和 `sqlite3` 等原生模块，需要确保在打包时正确编译。

**electron-rebuild 脚本**：

```javascript
// scripts/rebuild.js
const { execSync } = require('child_process');
const electronVersion = require('electron/package.json').version;

console.log(`Rebuilding native modules for Electron ${electronVersion}...`);

execSync(`electron-rebuild -f -w whisper-node,sqlite3 -v ${electronVersion}`, {
  stdio: 'inherit'
});
```

---

## 第11-12周：最终发布

### 发布检查清单

```
功能检查：
- [ ] 安装程序可正常安装
- [ ] 首次启动正常 (无 Python 依赖错误)
- [ ] S2S 语音对话正常 (WebSocket 连接)
- [ ] 本地兼容模式正常 (Whisper/Edge-TTS)
- [ ] 卸载可完整清理

性能检查：
- [ ] 启动时间 < 3s
- [ ] 内存占用 < 400MB
- [ ] S2S 延迟 < 1s

安全检查：
- [ ] 敏感配置 (API Key) 加密存储
- [ ] 审计日志完整

兼容性检查：
- [ ] Windows 10/11 兼容
- [ ] 多显示器支持
- [ ] 高 DPI 支持
```

---

### 发布流程

```
1. 编译 TypeScript
   npm run build:ts

2. 重建原生模块
   npm run rebuild

3. 构建 Electron 应用
   npm run build:electron

4. 创建安装程序
   npm run build:installer

5. 测试安装程序
   - 全新安装测试
   - 升级安装测试
   - 卸载测试

6. 上传发布
   - GitHub Releases
   - 官网下载页
```

---

### 体积优化 (预期)

| 组件 | 原始大小 (Python版) | 优化后 (Node.js版) |
|------|----------|--------|
| 运行时环境 | ~100MB (Python) | ~0MB (内置 Node) |
| 业务代码 | ~80MB | ~20MB |
| Electron | ~150MB | ~150MB |
| 模型资源 | ~50MB | ~20MB (按需) |
| **总计** | ~380MB | **~190MB** |

---

### 自动更新 (Auto Update)

配置 `electron-updater` 实现静默更新：

```typescript
// src/main/updater.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    message: '新版本已下载，重启生效？',
    buttons: ['重启', '稍后']
  }).then((res) => {
    if (res.response === 0) autoUpdater.quitAndInstall();
  });
});
```
