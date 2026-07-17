from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fastapi import WebSocket

from .protocol import CommandRecord, ServerMessage, utc_now


@dataclass
class DeviceConnection:
    websocket: WebSocket
    connected_at: datetime = field(default_factory=utc_now)
    last_seen: datetime = field(default_factory=utc_now)
    hello: dict[str, Any] = field(default_factory=dict)
    latest_status: dict[str, Any] = field(default_factory=dict)


class DeviceManager:
    def __init__(self) -> None:
        self._connections: dict[str, DeviceConnection] = {}
        self._lock = asyncio.Lock()

    async def connect(self, device_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            previous = self._connections.get(device_id)
            self._connections[device_id] = DeviceConnection(websocket=websocket)
        if previous is not None:
            await previous.websocket.close(code=4009, reason="replaced_by_new_connection")

    async def disconnect(self, device_id: str, websocket: WebSocket) -> bool:
        async with self._lock:
            current = self._connections.get(device_id)
            if current is not None and current.websocket is websocket:
                self._connections.pop(device_id, None)
                return True
        return False

    async def update_seen(
        self,
        device_id: str,
        *,
        hello: dict[str, Any] | None = None,
        status: dict[str, Any] | None = None,
    ) -> None:
        async with self._lock:
            connection = self._connections.get(device_id)
            if connection is None:
                return
            connection.last_seen = utc_now()
            if hello is not None:
                connection.hello = hello
            if status is not None:
                connection.latest_status = status

    async def send(self, device_id: str, message: ServerMessage) -> None:
        async with self._lock:
            connection = self._connections.get(device_id)
        if connection is None:
            raise KeyError(device_id)
        await connection.websocket.send_json(message.model_dump(mode="json"))

    async def list_devices(self) -> list[dict[str, Any]]:
        async with self._lock:
            return [
                {
                    "device_id": device_id,
                    "online": True,
                    "connected_at": connection.connected_at,
                    "last_seen": connection.last_seen,
                    "hello": connection.hello,
                    "latest_status": connection.latest_status,
                }
                for device_id, connection in sorted(self._connections.items())
            ]

    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        async with self._lock:
            connection = self._connections.get(device_id)
            if connection is None:
                return None
            return {
                "device_id": device_id,
                "online": True,
                "connected_at": connection.connected_at,
                "last_seen": connection.last_seen,
                "hello": connection.hello,
                "latest_status": connection.latest_status,
            }

    async def issue_command(self, record: CommandRecord) -> None:
        await self.send(
            record.device_id,
            ServerMessage(
                type="command",
                payload={
                    "command_id": record.command_id,
                    "name": record.name,
                    "arguments": record.arguments,
                },
            ),
        )


manager = DeviceManager()
