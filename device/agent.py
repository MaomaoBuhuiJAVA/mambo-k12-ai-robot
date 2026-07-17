from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import shutil
import socket
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from websockets.asyncio.client import ClientConnection, connect


AGENT_VERSION = "0.1.0"
ALLOWED_COMMANDS = {"ping", "get_status"}


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class Settings:
    device_id: str
    device_auth_token: str
    server_ws_url: str
    heartbeat_interval_seconds: int
    status_interval_seconds: int

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            device_id=os.getenv("DEVICE_ID", socket.gethostname()),
            device_auth_token=os.getenv(
                "DEVICE_AUTH_TOKEN", "dev-device-token-change-me"
            ),
            server_ws_url=os.getenv(
                "SERVER_WS_URL", "ws://127.0.0.1:8000/ws/v1/devices"
            ).rstrip("/"),
            heartbeat_interval_seconds=max(
                2, int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "5"))
            ),
            status_interval_seconds=max(
                5, int(os.getenv("STATUS_INTERVAL_SECONDS", "10"))
            ),
        )


def read_first_float(paths: list[Path], divisor: float = 1.0) -> float | None:
    for path in paths:
        try:
            raw = path.read_text().strip().split()[0]
            return round(float(raw) / divisor, 2)
        except (OSError, ValueError):
            continue
    return None


def read_meminfo() -> dict[str, int]:
    values: dict[str, int] = {}
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, raw = line.split(":", 1)
            values[key] = int(raw.strip().split()[0]) * 1024
    except (OSError, ValueError):
        pass
    return values


def collect_status() -> dict[str, Any]:
    memory = read_meminfo()
    disk = shutil.disk_usage("/")
    try:
        load_1m, load_5m, load_15m = os.getloadavg()
    except (AttributeError, OSError):
        load_1m = load_5m = load_15m = 0.0

    uptime = read_first_float([Path("/proc/uptime")])
    temperature = read_first_float(
        sorted(Path("/sys/class/thermal").glob("thermal_zone*/temp")), divisor=1000
    )
    return {
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "uptime_seconds": uptime,
        "cpu_load_1m": round(load_1m, 2),
        "cpu_load_5m": round(load_5m, 2),
        "cpu_load_15m": round(load_15m, 2),
        "memory_total_bytes": memory.get("MemTotal"),
        "memory_available_bytes": memory.get("MemAvailable"),
        "disk_total_bytes": disk.total,
        "disk_free_bytes": disk.free,
        "temperature_c": temperature,
    }


def envelope(settings: Settings, message_type: str, payload: dict[str, Any]) -> str:
    return json.dumps(
        {
            "version": 1,
            "message_id": str(uuid4()),
            "type": message_type,
            "device_id": settings.device_id,
            "timestamp": utc_timestamp(),
            "payload": payload,
        },
        ensure_ascii=False,
    )


async def send_status(connection: ClientConnection, settings: Settings) -> None:
    await connection.send(envelope(settings, "status", collect_status()))


async def heartbeat_loop(connection: ClientConnection, settings: Settings) -> None:
    next_status = 0.0
    loop = asyncio.get_running_loop()
    while True:
        await connection.send(envelope(settings, "heartbeat", {}))
        now = loop.time()
        if now >= next_status:
            await send_status(connection, settings)
            next_status = now + settings.status_interval_seconds
        await asyncio.sleep(settings.heartbeat_interval_seconds)


async def handle_command(
    connection: ClientConnection, settings: Settings, payload: dict[str, Any]
) -> None:
    command_id = str(payload.get("command_id", ""))
    name = str(payload.get("name", ""))
    if name not in ALLOWED_COMMANDS:
        result = {
            "command_id": command_id,
            "ok": False,
            "error": "unsupported_command",
        }
    elif name == "ping":
        result = {"command_id": command_id, "ok": True, "pong": utc_timestamp()}
    else:
        status = collect_status()
        await send_status(connection, settings)
        result = {"command_id": command_id, "ok": True, "status": status}
    await connection.send(envelope(settings, "command_result", result))


async def receiver_loop(connection: ClientConnection, settings: Settings) -> None:
    async for raw in connection:
        message = json.loads(raw)
        message_type = message.get("type")
        if message_type == "welcome":
            logging.info("registered as %s", settings.device_id)
        elif message_type == "heartbeat_ack":
            logging.debug("heartbeat acknowledged")
        elif message_type == "command":
            await handle_command(connection, settings, message.get("payload", {}))


async def run_connection(settings: Settings) -> None:
    uri = f"{settings.server_ws_url}/{settings.device_id}"
    async with connect(
        uri,
        additional_headers={
            "Authorization": f"Bearer {settings.device_auth_token}"
        },
        open_timeout=10,
        close_timeout=5,
        ping_interval=20,
        ping_timeout=20,
        max_size=1_048_576,
    ) as connection:
        await connection.send(
            envelope(
                settings,
                "hello",
                {
                    "agent_version": AGENT_VERSION,
                    "platform": platform.platform(),
                    "capabilities": sorted(ALLOWED_COMMANDS),
                },
            )
        )
        heartbeat_task = asyncio.create_task(heartbeat_loop(connection, settings))
        receiver_task = asyncio.create_task(receiver_loop(connection, settings))
        done, pending = await asyncio.wait(
            {heartbeat_task, receiver_task}, return_when=asyncio.FIRST_EXCEPTION
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        for task in done:
            task.result()


async def run_forever(settings: Settings) -> None:
    delay = 1
    while True:
        try:
            logging.info("connecting to %s", settings.server_ws_url)
            await run_connection(settings)
            delay = 1
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logging.warning("connection failed: %s; retrying in %ss", exc, delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    settings = Settings.from_env()
    try:
        asyncio.run(run_forever(settings))
    except KeyboardInterrupt:
        logging.info("device agent stopped")


if __name__ == "__main__":
    main()
