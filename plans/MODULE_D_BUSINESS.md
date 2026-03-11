# 模块 D：业务功能

> 负责人：成员 D  
> 技术栈：Python, SQLite, 数据分析

---

## 模块概述

负责业务功能实现：
- 桌面工具（应用启动、截图等）
- 订阅与权益
- 埋点与分析
- 主动触发配置

---

## Sprint 1 任务（第1-4周）

### D1: 应用启动工具

**时间**：第1周（12小时）

**任务清单**：

```
- [ ] 创建 open_app 工具
- [ ] 创建 open_url 工具
- [ ] 实现白名单机制
- [ ] 审计日志
```

**文件结构**：

```
nanobot/agent/tools/
├── desktop.py      # 桌面工具

config/
├── app_whitelist.json    # 应用白名单
└── url_whitelist.json    # URL 白名单
```

**代码骨架**：

```python
# nanobot/agent/tools/desktop.py

from nanobot.agent.tools.base import Tool
from typing import Any
import subprocess
import platform
import json
from pathlib import Path

class AppWhitelist:
    def __init__(self, config_path: str = "config/app_whitelist.json"):
        self._apps: dict[str, dict] = {}
        self._load(config_path)
    
    def _load(self, path: str):
        with open(path, "r", encoding="utf-8") as f:
            config = json.load(f)
            for app in config.get("apps", []):
                for alias in app.get("aliases", [app["name"]]):
                    self._apps[alias.lower()] = app
    
    def is_allowed(self, app_name: str) -> bool:
        return app_name.lower() in self._apps
    
    def get_path(self, app_name: str) -> str | None:
        app = self._apps.get(app_name.lower())
        return app.get("paths", [None])[0] if app else None

class OpenAppTool(Tool):
    _whitelist: AppWhitelist | None = None
    
    @property
    def name(self) -> str:
        return "open_app"
    
    @property
    def description(self) -> str:
        return "打开桌面应用程序。仅支持白名单内的应用。"
    
    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "app_name": {"type": "string", "description": "应用名称"}
            },
            "required": ["app_name"]
        }
    
    async def execute(self, app_name: str) -> str:
        whitelist = self._get_whitelist()
        
        if not whitelist.is_allowed(app_name):
            return f"错误：'{app_name}' 不在白名单内"
        
        path = whitelist.get_path(app_name)
        if not path:
            return f"错误：找不到 '{app_name}' 的路径"
        
        subprocess.Popen([path], shell=True)
        return f"已打开 {app_name}"
```

**AI 提示词**：

```
请实现桌面应用启动工具，带白名单安全策略。

## 文件结构

nanobot/agent/tools/
├── desktop.py      # 桌面工具

config/
├── app_whitelist.json
└── url_whitelist.json

## 功能要求

1. OpenAppTool：
   - 继承 nanobot.agent.tools.base.Tool
   - name = "open_app"
   - 检查白名单，拒绝非白名单应用
   - Windows 平台使用 subprocess.Popen
   - 记录审计日志

2. OpenUrlTool：
   - name = "open_url"
   - 检查域名白名单
   - 使用 webbrowser 模块

3. 白名单配置示例：
{
  "apps": [
    {
      "name": "Spotify",
      "paths": ["C:/Program Files/Spotify/Spotify.exe"],
      "aliases": ["spotify", "音乐"]
    }
  ],
  "domains": ["github.com", "stackoverflow.com"]
}

4. 安全要求：
   - 非白名单操作返回错误
   - 所有操作记录日志

请生成完整代码和配置示例。
```

---

### D2: 系统操作工具

**时间**：第2周（12小时）

```
- [ ] 截图工具（委托 Electron）
- [ ] 通知工具
- [ ] 系统信息工具
- [ ] 工具注册
```

---

### D3: 主动触发配置

**时间**：第3周（8小时）

```
- [ ] 编写 HEARTBEAT.md
- [ ] 配置触发规则
- [ ] 测试触发效果
```

---

### D4: 订阅基础

**时间**：第4周（16小时）

```
- [ ] 权益数据模型
- [ ] 订单管理
- [ ] 权益校验接口
```

---

## Sprint 2 任务（第5-8周）

### D5: 埋点系统

**时间**：第5-6周（20小时）

```
- [ ] 事件采集器
- [ ] 事件存储
- [ ] 指标计算
- [ ] 简单看板
```

### D6: 订阅完善

**时间**：第7-8周（16小时）

```
- [ ] 支付回调处理
- [ ] 权益生效
- [ ] 降级策略
```

---

## Sprint 3 任务（第9-10周）

### D7: A/B 实验

**时间**：第9周（12小时）

```
- [ ] 实验框架
- [ ] 分流逻辑
- [ ] 实验分析
```

### D8: 数据分析

**时间**：第10周（12小时）

```
- [ ] 指标看板
- [ ] 留存分析
- [ ] 转化漏斗
```

---

## 技术参考

### Tool 基类

```python
from nanobot.agent.tools.base import Tool

class MyTool(Tool):
    @property
    def name(self) -> str:
        return "my_tool"
    
    @property
    def description(self) -> str:
        return "工具描述"
    
    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "param1": {"type": "string"}
            },
            "required": ["param1"]
        }
    
    async def execute(self, **kwargs) -> str:
        return "执行结果"
```

### 白名单配置

```json
{
  "apps": [
    {
      "name": "Spotify",
      "paths": ["C:/Program Files/Spotify/Spotify.exe"],
      "aliases": ["spotify", "音乐", "播放器"]
    },
    {
      "name": "VSCode",
      "paths": ["C:/Users/*/AppData/Local/Programs/Microsoft VS Code/Code.exe"],
      "aliases": ["vscode", "代码编辑器"]
    }
  ],
  "domains": [
    "github.com",
    "stackoverflow.com",
    "google.com"
  ]
}
```

### Heartbeat 配置

```markdown
# workspace/HEARTBEAT.md

## Periodic Tasks

- [ ] 每整点提醒用户休息一下
- [ ] 检测到用户空闲15分钟后，主动问候
- [ ] 每天早上9点问候"早安"
```

### 埋点事件

```python
class AnalyticsEvent:
    event_name: str
    user_id: str
    timestamp: datetime
    properties: dict

# 核心事件
EVENTS = [
    "app_launch",
    "user_interaction_start",
    "ai_response_complete",
    "proactive_trigger_sent",
    "subscription_page_view",
    "subscription_purchase_success",
]
```
