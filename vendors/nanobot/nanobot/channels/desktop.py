"""Desktop channel — WebSocket server for Electron / local desktop app integration.

Architecture
------------
nanobot acts as the **WebSocket server** (ws://127.0.0.1:<port>).
The Electron app connects as a WebSocket client.

Each connection gets a unique ``conn_id`` that is used as the ``chat_id`` so
outbound messages are routed back to the correct browser window / session.

Protocol (JSON)
---------------
Electron → nanobot::

    {
        "type": "message",          // or "ping"
        "id": "<uuid>",             // client-generated message ID (optional)
        "senderId": "user",         // arbitrary user identifier (optional)
        "content": "Hello world"    // the text to send to the agent
    }

nanobot → Electron::

    // Connected handshake
    {"type": "connected", "sessionId": "<conn_id>"}

    // Streaming progress chunk  (partial=true)
    {"type": "message", "role": "assistant", "sessionId": "...",
     "content": "Hello", "partial": true, "done": false}

    // Final response  (partial=false, done=true)
    {"type": "message", "role": "assistant", "sessionId": "...",
     "content": "Hello world!", "partial": false, "done": true}

    // Pong
    {"type": "pong"}

    // Error
    {"type": "error", "message": "..."}
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from loguru import logger

from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.config.schema import DesktopConfig


class DesktopChannel(BaseChannel):
    """Local WebSocket server channel for Electron desktop integration."""

    name = "desktop"
    display_name = "Desktop"

    def __init__(self, config: DesktopConfig, bus: MessageBus):
        super().__init__(config, bus)
        self.config: DesktopConfig = config
        # conn_id → websocket
        self._connections: dict[str, Any] = {}
        self._server: Any = None
        self._stop_event: asyncio.Event = asyncio.Event()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the WebSocket server and block until stop() is called."""
        import websockets

        self._running = True
        self._stop_event.clear()

        host = self.config.host
        port = self.config.port

        logger.info("Desktop channel: starting WebSocket server on ws://{}:{}", host, port)

        try:
            async with websockets.serve(self._handle_connection, host, port) as server:
                self._server = server
                logger.info(
                    "Desktop channel: ready — waiting for Electron client on ws://{}:{}",
                    host,
                    port,
                )
                # Block here until stop() sets the event
                await self._stop_event.wait()
        except OSError as e:
            logger.error("Desktop channel: failed to bind on {}:{} — {}", host, port, e)
        finally:
            self._running = False
            logger.info("Desktop channel: server stopped")

    async def stop(self) -> None:
        """Signal the server to shut down."""
        self._running = False
        self._stop_event.set()
        # Close all live connections gracefully
        for conn_id, ws in list(self._connections.items()):
            try:
                await ws.close(code=1001, reason="Server shutting down")
            except Exception:
                pass
        self._connections.clear()

    # ------------------------------------------------------------------
    # Connection handler (called per client)
    # ------------------------------------------------------------------

    async def _handle_connection(self, ws: Any) -> None:
        """Handle a single Electron client connection."""
        # conn_id is used for WebSocket routing (unique per physical connection)
        conn_id = uuid.uuid4().hex[:12]
        # session_key is used for nanobot session history (persistent across reconnects)
        session_key = conn_id
        remote = getattr(ws, "remote_address", "unknown")
        logger.info("Desktop: new connection [{}] from {}", conn_id, remote)

        # Authenticate with static token if configured
        if self.config.token:
            try:
                raw_auth = await asyncio.wait_for(ws.recv(), timeout=10)
                auth = json.loads(raw_auth)
                if auth.get("token") != self.config.token:
                    await ws.send(json.dumps({"type": "error", "message": "unauthorized"}))
                    await ws.close(code=4001, reason="Unauthorized")
                    logger.warning("Desktop: rejected connection [{}] — bad token", conn_id)
                    return
            except (asyncio.TimeoutError, json.JSONDecodeError):
                await ws.close(code=4001, reason="Auth timeout")
                return

        # Accept optional init frame from Electron to restore a persistent session.
        # Electron sends: {"type": "init", "sessionId": "<stored-uuid>"}
        # We use a short timeout so clients that don't send init still work fine.
        try:
            raw_init = await asyncio.wait_for(ws.recv(), timeout=2.0)
            init_data = json.loads(raw_init)
            if init_data.get("type") == "init" and init_data.get("sessionId"):
                session_key = str(init_data["sessionId"])
                logger.info(
                    "Desktop [{}]: restored persistent session [{}]",
                    conn_id, session_key,
                )
            else:
                # Not an init frame — process it as a normal message later
                # Store it to re-dispatch after handshake
                self._pending: dict[str, str] = getattr(self, "_pending", {})
                self._pending[conn_id] = raw_init
        except (asyncio.TimeoutError, json.JSONDecodeError, KeyError):
            pass  # No init frame — use generated conn_id as session_key

        self._connections[conn_id] = ws
        # Map conn_id → session_key so _dispatch_message can find it
        if not hasattr(self, "_session_map"):
            self._session_map: dict[str, str] = {}
        self._session_map[conn_id] = session_key

        # Send handshake — tell Electron which session it is on
        await ws.send(json.dumps({
            "type": "connected",
            "sessionId": session_key,   # Electron should persist this
            "connId": conn_id,
        }))

        # Re-dispatch any message that arrived before the init handshake
        pending_map = getattr(self, "_pending", {})
        if conn_id in pending_map:
            pending_raw = pending_map.pop(conn_id)
            try:
                await self._dispatch_message(conn_id, pending_raw)
            except Exception as e:
                logger.error("Desktop [{}]: error processing pending message: {}", conn_id, e)

        try:
            async for raw in ws:
                try:
                    await self._dispatch_message(conn_id, raw)
                except Exception as e:
                    logger.error("Desktop [{}]: error processing message: {}", conn_id, e)
        except Exception as e:
            logger.debug("Desktop [{}]: connection closed: {}", conn_id, e)
        finally:
            self._connections.pop(conn_id, None)
            self._session_map.pop(conn_id, None)
            logger.info("Desktop: connection [{}] disconnected", conn_id)

    # ------------------------------------------------------------------
    # Inbound routing
    # ------------------------------------------------------------------

    async def _dispatch_message(self, conn_id: str, raw: str | bytes) -> None:
        """Parse and forward a raw WebSocket message from Electron."""
        try:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            data: dict = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            logger.warning("Desktop [{}]: received non-JSON data, ignoring", conn_id)
            return

        msg_type = data.get("type", "message")

        # ---- ping/pong keepalive ----
        if msg_type == "ping":
            ws = self._connections.get(conn_id)
            if ws:
                await ws.send(json.dumps({"type": "pong"}))
            return

        # ---- normal chat message ----
        content = (data.get("content") or "").strip()
        if not content:
            return

        sender_id = str(data.get("senderId") or conn_id)
        # Use persistent session_key for nanobot session history;
        # fall back to conn_id if mapping is missing (should not happen).
        session_key = getattr(self, "_session_map", {}).get(conn_id, conn_id)

        await self._handle_message(
            sender_id=sender_id,
            chat_id=conn_id,           # routing key: must match conn_id for send()
            content=content,
            metadata={
                "from": "desktop",
                "clientMsgId": data.get("id", ""),
                "session_key": session_key,   # passed to session manager
            },
        )

    # ------------------------------------------------------------------
    # Outbound
    # ------------------------------------------------------------------

    async def send(self, msg: OutboundMessage) -> None:
        """Send a (potentially streaming) response back to the Electron client."""
        ws = self._connections.get(msg.chat_id)
        if ws is None:
            # Session might have disconnected
            logger.debug("Desktop: no active connection for session [{}]", msg.chat_id)
            return

        is_progress = bool(msg.metadata.get("_progress", False))

        payload = {
            "type": "message",
            "role": "assistant",
            "sessionId": msg.chat_id,
            "content": msg.content,
            "partial": is_progress,      # True → streaming chunk, False → final
            "done": not is_progress,     # Mirrors `partial` for convenience
        }

        # Forward any non-internal metadata fields to Electron
        public_meta = {k: v for k, v in msg.metadata.items() if not k.startswith("_")}
        if public_meta:
            payload["metadata"] = public_meta

        try:
            await ws.send(json.dumps(payload, ensure_ascii=False))
        except Exception as e:
            logger.error("Desktop [{}]: failed to send — {}", msg.chat_id, e)
            self._connections.pop(msg.chat_id, None)
