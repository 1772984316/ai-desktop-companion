# 打包与发布

> 负责人：成员 B（主）+ 全员协作  
> 时间：第9-12周

---

## 打包目标

将以下组件打包为单一安装程序：

```
DesktopCompanion-Setup.exe
├── Electron 应用
├── Python 运行时
├── nanobot 服务
├── 配置文件
└── Live2D 模型资源
```

---

## 第9-10周：打包准备

### 环境准备

**Python 嵌入式包**：

```
resources/
└── python/
    ├── python311.dll
    ├── python.exe
    ├── python311.zip
    ├── Lib/
    │   └── site-packages/
    │       ├── nanobot/
    │       ├── websockets/
    │       ├── loguru/
    │       └── ...
    └── python311._pth
```

**下载脚本**：

```javascript
// scripts/build-python.js

const https = require('https');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { execSync } = require('child_process');

const PYTHON_VERSION = '3.11.9';
const PYTHON_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;

async function buildPython() {
  // 1. 下载 Python embed
  console.log('Downloading Python embed...');
  // ...
  
  // 2. 安装依赖
  console.log('Installing dependencies...');
  execSync(`"${pythonExe}" -m pip install nanobot-ai --target "${sitePackages}"`);
  
  // 3. 精简
  console.log('Pruning...');
  // 移除 tests, docs, *.pyi 等
}

buildPython();
```

---

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
    "extraResources": [
      {
        "from": "../resources/python",
        "to": "python"
      },
      {
        "from": "../resources/nanobot",
        "to": "nanobot"
      },
      {
        "from": "../resources/models",
        "to": "models"
      }
    ],
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "build/icon.ico"
    }
  }
}
```

---

### Inno Setup 脚本

```iss
; installer/setup.iss

#define MyAppName "Desktop Companion"
#define MyAppVersion "1.0.0"

[Setup]
AppId={{8A9B7C6D-5E4F-3A2B-1C0D-9E8F7A6B5C4D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\{#MyAppName}
OutputDir=release
OutputBaseFilename=DesktopCompanion-Setup
Compression=lzma2/ultra64
SolidCompression=yes

[Files]
Source: "electron\release\win-unpacked\*"; DestDir: "{app}"; Flags: recursesubdirs
Source: "resources\python\*"; DestDir: "{app}\resources\python"; Flags: recursesubdirs
Source: "resources\nanobot\*"; DestDir: "{app}\resources\nanobot"; Flags: recursesubdirs
Source: "resources\config\*"; DestDir: "{app}\resources\config"; Flags: recursesubdirs
Source: "launcher\launch.bat"; DestDir: "{app}"

[Icons]
Name: "{commondesktop}\Desktop Companion"; Filename: "{app}\launch.bat"

[Run]
Filename: "{app}\launch.bat"; Description: "启动应用"; Flags: postinstall
```

---

## 第11-12周：最终发布

### 发布检查清单

```
功能检查：
- [ ] 安装程序可正常安装
- [ ] 首次启动正常
- [ ] 语音对话正常
- [ ] 主动触发正常
- [ ] 订阅流程正常
- [ ] 卸载可完整清理

性能检查：
- [ ] 启动时间 < 10s
- [ ] 内存占用 < 800MB
- [ ] 语音延迟 < 3s

安全检查：
- [ ] 白名单机制有效
- [ ] 敏感数据加密
- [ ] 审计日志完整

兼容性检查：
- [ ] Windows 10/11 兼容
- [ ] 多显示器支持
- [ ] 高 DPI 支持
```

---

### 发布流程

```
1. 构建 Python 环境
   npm run build:python

2. 构建 Electron 应用
   npm run build:electron

3. 创建安装程序
   npm run build:installer

4. 测试安装程序
   - 全新安装测试
   - 升级安装测试
   - 卸载测试

5. 上传发布
   - GitHub Releases
   - 官网下载页
```

---

### 体积优化

| 组件 | 原始大小 | 优化后 |
|------|----------|--------|
| Python embed | ~12MB | ~12MB |
| nanobot + deps | ~80MB | ~35MB |
| Electron | ~150MB | ~80MB |
| 模型资源 | ~50MB | ~20MB |
| **总计** | ~292MB | **~147MB** |

优化措施：
1. 移除 tests、docs、examples
2. 移除 *.pyi 类型文件
3. 移除不必要的 locale
4. 模型按需下载

---

### 启动脚本

```batch
@echo off
REM launcher/launch.bat

setlocal

REM 设置路径
set APP_DIR=%~dp0
set PYTHON_DIR=%APP_DIR%resources\python
set NANOBOT_DIR=%APP_DIR%resources\nanobot
set CONFIG_DIR=%APPDATA%\DesktopCompanion

REM 首次运行检查
if not exist "%CONFIG_DIR%\config.json" (
    mkdir "%CONFIG_DIR%"
    copy "%APP_DIR%resources\config\default.json" "%CONFIG_DIR%\config.json"
)

REM 启动 nanobot
start /b "" "%PYTHON_DIR%\python.exe" -m nanobot gateway --config "%CONFIG_DIR%\config.json"

REM 等待启动
timeout /t 3 /nobreak >nul

REM 启动 Electron
start "" "%APP_DIR%DesktopCompanion.exe"

endlocal
```
