from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import shutil
import socket
import time
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from websockets.asyncio.client import ClientConnection, connect

from .commands import ALLOWED_COMMANDS, CommandValidationError, validate_command
from .hardware.camera import CameraAdapter, CameraConfig
from .hardware.capabilities import detect_capabilities
from .hardware.display import DisplayAdapter
from .hardware.media import ArtifactPlayer, AudioPlayer
from .hardware.process import ProcessExecutionError, ProcessRunner


AGENT_VERSION = "0.2.0"
MAX_CACHED_RESULTS = 128


def utc_timestamp() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class Settings:
    device_id: str
    device_auth_token: str
    server_ws_url: str
    heartbeat_interval_seconds: int
    status_interval_seconds: int
    media_root: Path
    camera_device: str
    camera_width: int
    camera_height: int
    camera_fps: int
    camera_warmup_frames: int
    display_name: str
    xauthority_path: str
    media_allowed_hosts: frozenset[str]
    command_timeout_seconds: float

    @classmethod
    def from_env(cls) -> "Settings":
        hosts = frozenset(
            host.strip().lower()
            for host in os.getenv("MEDIA_ALLOWED_HOSTS", "").split(",")
            if host.strip()
        )
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
            media_root=Path(
                os.getenv(
                    "MEDIA_ROOT", "/home/orangepi/.local/share/mambo/media"
                )
            ).expanduser(),
            camera_device=os.getenv("CAMERA_DEVICE", "/dev/video0"),
            camera_width=max(1, int(os.getenv("CAMERA_WIDTH", "1920"))),
            camera_height=max(1, int(os.getenv("CAMERA_HEIGHT", "1080"))),
            camera_fps=max(1, int(os.getenv("CAMERA_FPS", "30"))),
            camera_warmup_frames=max(
                1, int(os.getenv("CAMERA_WARMUP_FRAMES", "120"))
            ),
            display_name=os.getenv("DISPLAY_NAME", ":0"),
            xauthority_path=os.getenv(
                "XAUTHORITY_PATH", "/home/orangepi/.Xauthority"
            ),
            media_allowed_hosts=hosts,
            command_timeout_seconds=max(
                1.0, float(os.getenv("COMMAND_TIMEOUT_SECONDS", "30"))
            ),
        )


def read_first_float(paths: list[Path], divisor: float = 1.0) -> float | None:
    for path in paths:
        try:
            raw = path.read_text().strip().split()[0]
            return round(float(raw) / divisor, 2)
        except (OSError, ValueError, IndexError):
            continue
    return None


def read_meminfo() -> dict[str, int]:
    values: dict[str, int] = {}
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, raw = line.split(":", 1)
            values[key] = int(raw.strip().split()[0]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return values


class HardwareController:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.settings.media_root.mkdir(parents=True, exist_ok=True)
        runner = ProcessRunner()
        self._capabilities = detect_capabilities(
            camera_device=settings.camera_device,
            display_name=settings.display_name,
            xauthority_path=settings.xauthority_path,
        )
        camera_config = CameraConfig(
            device=settings.camera_device,
            width=settings.camera_width,
            height=settings.camera_height,
            fps=settings.camera_fps,
            warmup_frames=settings.camera_warmup_frames,
            media_root=settings.media_root,
            timeout_seconds=settings.command_timeout_seconds,
        )
        self.camera = CameraAdapter(camera_config, runner=runner)
        self.artifact = ArtifactPlayer(
            media_root=settings.media_root,
            allowed_hosts=set(settings.media_allowed_hosts),
            display_name=settings.display_name,
            xauthority_path=settings.xauthority_path,
            runner=runner,
            timeout_seconds=settings.command_timeout_seconds,
        )
        self.audio = AudioPlayer(
            media_root=settings.media_root,
            allowed_hosts=set(settings.media_allowed_hosts),
            display_name=settings.display_name,
            xauthority_path=settings.xauthority_path,
            runner=runner,
        )
        self.display = DisplayAdapter(
            display_name=settings.display_name,
            xauthority_path=settings.xauthority_path,
            runner=runner,
        )

    def capabilities_payload(self) -> dict[str, object]:
        return self._capabilities

    def players_status(self) -> dict[str, bool]:
        return {
            "artifact_active": self.artifact._process is not None,
            "audio_active": self.audio._process is not None,
        }

    async def execute(
        self, name: str, arguments: dict[str, Any], command_id: str
    ) -> dict[str, object]:
        if name == "capture_snapshot":
            return {"snapshot": await self.camera.capture(command_id)}
        if name == "show_artifact":
            return await self.artifact.show(
                str(arguments["source"]), str(arguments["media_type"])
            )
        if name == "stop_artifact":
            return await self.artifact.stop()
        if name == "play_audio":
            return await self.audio.play(
                str(arguments["source"]), int(arguments["volume"])
            )
        if name == "stop_audio":
            return await self.audio.stop()
        if name == "set_display_mode":
            return await self.display.set_mode(str(arguments["mode"]))
        raise ProcessExecutionError("command is not a hardware action", code="unsupported_command")

    async def close(self) -> None:
        await self.artifact.stop()
        await self.audio.stop()


def collect_status(hardware: HardwareController | None = None) -> dict[str, Any]:
    memory = read_meminfo()
    disk = shutil.disk_usage("/")
    try:
        load_1m, load_5m, load_15m = os.getloadavg()
    except (AttributeError, OSError):
        load_1m = load_5m = load_15m = 0.0

    status: dict[str, Any] = {
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "uptime_seconds": read_first_float([Path("/proc/uptime")]),
        "cpu_load_1m": round(load_1m, 2),
        "cpu_load_5m": round(load_5m, 2),
        "cpu_load_15m": round(load_15m, 2),
        "memory_total_bytes": memory.get("MemTotal"),
        "memory_available_bytes": memory.get("MemAvailable"),
        "disk_total_bytes": disk.total,
        "disk_free_bytes": disk.free,
        "temperature_c": read_first_float(
            sorted(Path("/sys/class/thermal").glob("thermal_zone*/temp")), divisor=1000
        ),
    }
    if hardware is not None:
        status["hardware"] = {
            "camera_available": bool(hardware.capabilities_payload()["camera"]["available"]),
            "display_available": bool(hardware.capabilities_payload()["display"]["available"]),
        }
        status["players"] = hardware.players_status()
    return status


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


async def send_status(
    connection: ClientConnection,
    settings: Settings,
    hardware: HardwareController | None = None,
) -> None:
    await connection.send(envelope(settings, "status", collect_status(hardware)))


async def heartbeat_loop(
    connection: ClientConnection,
    settings: Settings,
    hardware: HardwareController | None = None,
) -> None:
    next_status = 0.0
    loop = asyncio.get_running_loop()
    while True:
        await connection.send(envelope(settings, "heartbeat", {}))
        now = loop.time()
        if now >= next_status:
            await send_status(connection, settings, hardware)
            next_status = now + settings.status_interval_seconds
        await asyncio.sleep(settings.heartbeat_interval_seconds)


def _cache_result(
    result_cache: OrderedDict[str, dict[str, Any]],
    command_id: str,
    result: dict[str, Any],
) -> None:
    if not command_id:
        return
    result_cache[command_id] = result
    while len(result_cache) > MAX_CACHED_RESULTS:
        result_cache.popitem(last=False)


async def handle_command(
    connection: ClientConnection,
    settings: Settings,
    payload: dict[str, Any],
    *,
    hardware: HardwareController | Any | None = None,
    result_cache: OrderedDict[str, dict[str, Any]] | dict[str, dict[str, Any]] | None = None,
) -> None:
    command_id = str(payload.get("command_id", ""))
    if result_cache is None:
        result_cache = OrderedDict()
    cached = result_cache.get(command_id) if command_id else None
    if cached is not None:
        await connection.send(envelope(settings, "command_result", cached))
        return

    name = str(payload.get("name", ""))
    arguments = payload.get("arguments", {})
    started = time.monotonic()
    result: dict[str, Any] = {"command_id": command_id, "ok": True}
    try:
        arguments = validate_command(name, arguments)
        if name == "ping":
            result["pong"] = utc_timestamp()
        elif name == "get_status":
            status = collect_status(hardware)
            await send_status(connection, settings, hardware)
            result["status"] = status
        elif hardware is None:
            raise ProcessExecutionError("hardware controller is unavailable", code="device_unavailable")
        else:
            result.update(await hardware.execute(name, arguments, command_id))
    except CommandValidationError as exc:
        result = {"command_id": command_id, "ok": False, "error": exc.code}
    except ProcessExecutionError as exc:
        result = {"command_id": command_id, "ok": False, "error": exc.code}
    except Exception:
        logging.exception("device command failed: %s", name)
        result = {"command_id": command_id, "ok": False, "error": "internal_error"}
    result["duration_ms"] = round((time.monotonic() - started) * 1000, 2)
    if isinstance(result_cache, OrderedDict):
        _cache_result(result_cache, command_id, result)
    elif command_id:
        result_cache[command_id] = result
    await connection.send(envelope(settings, "command_result", result))


async def receiver_loop(
    connection: ClientConnection,
    settings: Settings,
    hardware: HardwareController,
    result_cache: OrderedDict[str, dict[str, Any]],
) -> None:
    async for raw in connection:
        message = json.loads(raw)
        message_type = message.get("type")
        if message_type == "welcome":
            logging.info("registered as %s", settings.device_id)
        elif message_type == "heartbeat_ack":
            logging.debug("heartbeat acknowledged")
        elif message_type == "command":
            await handle_command(
                connection,
                settings,
                message.get("payload", {}),
                hardware=hardware,
                result_cache=result_cache,
            )


async def run_connection(settings: Settings, hardware: HardwareController) -> None:
    uri = f"{settings.server_ws_url}/{settings.device_id}"
    async with connect(
        uri,
        additional_headers={"Authorization": f"Bearer {settings.device_auth_token}"},
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
                    "hardware": hardware.capabilities_payload(),
                },
            )
        )
        result_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()
        heartbeat_task = asyncio.create_task(heartbeat_loop(connection, settings, hardware))
        receiver_task = asyncio.create_task(
            receiver_loop(connection, settings, hardware, result_cache)
        )
        done, pending = await asyncio.wait(
            {heartbeat_task, receiver_task}, return_when=asyncio.FIRST_EXCEPTION
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        for task in done:
            task.result()


async def run_forever(settings: Settings) -> None:
    hardware = HardwareController(settings)
    delay = 1
    try:
        while True:
            try:
                logging.info("connecting to %s", settings.server_ws_url)
                await run_connection(settings, hardware)
                delay = 1
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logging.warning("connection failed: %s; retrying in %ss", exc, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)
    finally:
        await hardware.close()


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
