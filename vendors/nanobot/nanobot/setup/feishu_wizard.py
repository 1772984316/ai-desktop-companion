"""
飞书机器人一键配置向导
======================
职责：
  1. 通过飞书 API 验证 App ID / App Secret 是否有效
  2. 检测应用是否已启用机器人能力 & 订阅消息事件
  3. 自动将凭证写入 ~/.nanobot/config.json
  4. 提供交互式 CLI 引导（供 `nanobot setup feishu` 命令调用）
  5. 提供 HTTP API（供 Electron IPC 调用）

飞书开放平台手动操作入口：
  https://open.feishu.cn/app
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# 常量
# ─────────────────────────────────────────────────────────────────────────────

FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
FEISHU_BOT_INFO_URL = "https://open.feishu.cn/open-apis/bot/v3/info"

# 飞书开放平台操作指引（一键配置无法替代的手动步骤）
MANUAL_STEPS = """
╔══════════════════════════════════════════════════════════════╗
║          飞书机器人创建 — 必须手动完成的 6 步              ║
╠══════════════════════════════════════════════════════════════╣
║ 1. 访问 https://open.feishu.cn/app                          ║
║    → 点击「创建企业自建应用」                                ║
║                                                              ║
║ 2. 应用 → 「能力」→「机器人」→ 开启机器人能力               ║
║                                                              ║
║ 3. 「事件订阅」→「添加事件」                                 ║
║    → 搜索并添加：im.message.receive_v1                      ║
║                                                              ║
║ 4. 「权限管理」→ 申请以下权限：                              ║
║    · im:message（读取消息）                                  ║
║    · im:message:send_as_bot（发送消息）                      ║
║                                                              ║
║ 5. 「版本管理 & 发布」→ 发布应用（需管理员审批）            ║
║                                                              ║
║ 6. 「凭证与基础信息」页面 → 复制 App ID 和 App Secret        ║
╚══════════════════════════════════════════════════════════════╝
"""


# ─────────────────────────────────────────────────────────────────────────────
# 数据类
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FeishuCheckResult:
    ok: bool
    token: str = ""
    bot_name: str = ""
    bot_avatar: str = ""
    error: str = ""
    warnings: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# 核心验证逻辑
# ─────────────────────────────────────────────────────────────────────────────

def _post_json(url: str, body: dict, token: str = "") -> dict:
    """发送 POST 请求，返回 JSON 响应。"""
    data = json.dumps(body).encode("utf-8")
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        try:
            return json.loads(body_bytes.decode("utf-8"))
        except Exception:
            return {"code": e.code, "msg": str(e)}
    except Exception as e:
        return {"code": -1, "msg": str(e)}


def _get_json(url: str, token: str) -> dict:
    """发送 GET 请求，返回 JSON 响应。"""
    headers = {"Authorization": f"Bearer {token}"}
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"code": -1, "msg": str(e)}


def validate_feishu_credentials(app_id: str, app_secret: str) -> FeishuCheckResult:
    """
    验证飞书凭证有效性，并检测机器人能力是否正常。

    Returns:
        FeishuCheckResult 包含验证状态、机器人信息和警告。
    """
    result = FeishuCheckResult(ok=False)

    # ── Step 1: 获取 tenant_access_token ──────────────────────────────────
    resp = _post_json(FEISHU_TOKEN_URL, {
        "app_id": app_id,
        "app_secret": app_secret,
    })

    code = resp.get("code", -1)
    if code != 0:
        msg = resp.get("msg", "unknown error")
        if code == 10003:
            result.error = "App ID 或 App Secret 错误，请检查凭证是否正确。"
        elif code == 10014:
            result.error = "App Secret 无效。"
        else:
            result.error = f"获取访问令牌失败（code={code}）: {msg}"
        return result

    token = resp.get("tenant_access_token", "")
    if not token:
        result.error = "未收到 tenant_access_token，请重试。"
        return result

    result.token = token

    # ── Step 2: 获取机器人信息（验证机器人能力是否开启）──────────────────
    bot_resp = _get_json(FEISHU_BOT_INFO_URL, token)
    bot_code = bot_resp.get("code", -1)

    if bot_code == 0:
        bot = bot_resp.get("bot", {})
        result.bot_name = bot.get("app_name", "")
        result.bot_avatar = bot.get("avatar_url", "")
        result.ok = True
    elif bot_code == 230001:
        # 机器人能力未开启
        result.ok = True   # 凭证有效，但有警告
        result.warnings.append(
            "⚠️  机器人能力未开启！\n"
            "   请前往飞书开放平台 → 能力 → 机器人 → 开启机器人能力，然后重新发布应用。"
        )
    else:
        result.ok = True   # 凭证有效，其他错误视为警告
        result.warnings.append(
            f"⚠️  获取机器人信息失败（code={bot_code}）: {bot_resp.get('msg', '')}。\n"
            "   凭证有效，但请确认机器人能力和事件订阅已配置。"
        )

    # ── Step 3: 提示未能自动检测的配置项 ─────────────────────────────────
    result.warnings.append(
        "ℹ️  以下配置需在飞书开放平台手动确认：\n"
        "   · 事件订阅 → im.message.receive_v1 已添加\n"
        "   · 权限：im:message 和 im:message:send_as_bot 已申请\n"
        "   · 应用已发布上线（版本管理 & 发布）"
    )

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 配置写入
# ─────────────────────────────────────────────────────────────────────────────

def apply_feishu_config(
    app_id: str,
    app_secret: str,
    encrypt_key: str = "",
    verification_token: str = "",
    allow_from: list[str] | None = None,
    config_path: str | None = None,
) -> str:
    """
    将飞书凭证写入 nanobot 配置文件。

    Returns:
        写入的配置文件路径。
    """
    from nanobot.config.loader import load_config, save_config, get_config_path
    from pathlib import Path

    path = Path(config_path) if config_path else get_config_path()
    config = load_config(path)

    config.channels.feishu.enabled = True
    config.channels.feishu.app_id = app_id
    config.channels.feishu.app_secret = app_secret
    config.channels.feishu.encrypt_key = encrypt_key
    config.channels.feishu.verification_token = verification_token
    if allow_from is not None:
        config.channels.feishu.allow_from = allow_from
    elif not config.channels.feishu.allow_from:
        # 默认允许所有人（企业内部应用通常安全）
        config.channels.feishu.allow_from = ["*"]

    save_config(config, path)
    return str(path)


# ─────────────────────────────────────────────────────────────────────────────
# 轻量 HTTP API（供 Electron IPC → subprocess 调用）
# ─────────────────────────────────────────────────────────────────────────────

def run_http_server(port: int = 19001) -> None:
    """
    启动一个最小化 HTTP 服务，供 Electron 通过 HTTP 调用验证和配置飞书。

    端点：
      POST /feishu/validate   body: {appId, appSecret}
      POST /feishu/apply      body: {appId, appSecret, encryptKey?, verificationToken?, allowFrom?}
      GET  /feishu/steps      返回手动步骤说明
    """
    import http.server
    import threading

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args: Any) -> None:
            pass  # 静默日志

        def _read_body(self) -> dict:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                return json.loads(raw.decode("utf-8"))
            except Exception:
                return {}

        def _respond(self, data: dict, status: int = 200) -> None:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self) -> None:  # noqa: N802
            body = self._read_body()
            if self.path == "/feishu/validate":
                r = validate_feishu_credentials(
                    body.get("appId", ""),
                    body.get("appSecret", ""),
                )
                self._respond({
                    "ok": r.ok,
                    "botName": r.bot_name,
                    "botAvatar": r.bot_avatar,
                    "error": r.error,
                    "warnings": r.warnings,
                })
            elif self.path == "/feishu/apply":
                try:
                    path = apply_feishu_config(
                        app_id=body.get("appId", ""),
                        app_secret=body.get("appSecret", ""),
                        encrypt_key=body.get("encryptKey", ""),
                        verification_token=body.get("verificationToken", ""),
                        allow_from=body.get("allowFrom"),
                    )
                    self._respond({"ok": True, "configPath": path})
                except Exception as e:
                    self._respond({"ok": False, "error": str(e)}, 500)
            else:
                self._respond({"error": "not found"}, 404)

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/feishu/steps":
                self._respond({"steps": MANUAL_STEPS, "url": "https://open.feishu.cn/app"})
            else:
                self._respond({"error": "not found"}, 404)

    server = http.server.HTTPServer(("127.0.0.1", port), Handler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server


# ─────────────────────────────────────────────────────────────────────────────
# 交互式 CLI 向导（供 `nanobot setup feishu` 调用）
# ─────────────────────────────────────────────────────────────────────────────

def run_cli_wizard() -> None:
    """交互式命令行引导，帮助用户一步步完成飞书机器人配置。"""
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm

    console = Console()
    console.print(Panel(MANUAL_STEPS, title="[bold yellow]飞书机器人配置向导[/bold yellow]", expand=False))

    if not Confirm.ask("\n已完成以上步骤，现在输入凭证？"):
        console.print("[yellow]已取消。请完成飞书开放平台配置后重新运行此命令。[/yellow]")
        return

    app_id     = Prompt.ask("请输入 [bold cyan]App ID[/bold cyan]").strip()
    app_secret = Prompt.ask("请输入 [bold cyan]App Secret[/bold cyan]", password=True).strip()

    console.print("\n[dim]正在验证凭证...[/dim]")
    result = validate_feishu_credentials(app_id, app_secret)

    if not result.ok:
        console.print(f"\n[bold red]❌ 验证失败：{result.error}[/bold red]")
        return

    bot_label = f" (机器人名称: [bold]{result.bot_name}[/bold])" if result.bot_name else ""
    console.print(f"\n[bold green]✅ 凭证验证通过{bot_label}[/bold green]")

    for w in result.warnings:
        console.print(f"\n{w}")

    # 可选高级配置
    encrypt_key         = Prompt.ask("Encrypt Key（可选，直接回车跳过）", default="").strip()
    verification_token  = Prompt.ask("Verification Token（可选，直接回车跳过）", default="").strip()

    allow_input = Prompt.ask(
        "限制允许的用户 open_id（多个用逗号分隔，直接回车允许所有人）",
        default="",
    ).strip()
    allow_from = [x.strip() for x in allow_input.split(",") if x.strip()] or ["*"]

    config_path = apply_feishu_config(
        app_id=app_id,
        app_secret=app_secret,
        encrypt_key=encrypt_key,
        verification_token=verification_token,
        allow_from=allow_from,
    )

    console.print(f"\n[bold green]✅ 配置已写入：{config_path}[/bold green]")
    console.print("\n[cyan]运行以下命令启动飞书机器人：[/cyan]")
    console.print("  [bold]nanobot gateway[/bold]\n")
