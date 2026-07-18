from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from .process import ProcessExecutionError, ProcessResult, ProcessRunner


class CameraProcessRunner(Protocol):
    async def run(self, argv: list[str], timeout_seconds: float) -> ProcessResult: ...


@dataclass(frozen=True)
class CameraConfig:
    device: str = "/dev/video0"
    width: int = 1920
    height: int = 1080
    fps: int = 30
    warmup_frames: int = 120
    media_root: Path = Path("/home/orangepi/.local/share/mambo/media")
    timeout_seconds: float = 30.0


class CameraAdapter:
    def __init__(
        self,
        config: CameraConfig,
        *,
        runner: CameraProcessRunner | None = None,
    ) -> None:
        self.config = config
        self.runner = runner or ProcessRunner()

    async def capture(self, command_id: str) -> dict[str, object]:
        snapshots = self.config.media_root / "snapshots"
        snapshots.mkdir(parents=True, exist_ok=True)
        safe_id = re.sub(r"[^A-Za-z0-9_-]", "-", command_id).strip("-") or "snapshot"
        temporary = snapshots / f"{safe_id}.tmp.jpg"
        final = snapshots / f"{safe_id}.jpg"
        argv = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "v4l2",
            "-input_format",
            "mjpeg",
            "-video_size",
            f"{self.config.width}x{self.config.height}",
            "-framerate",
            str(self.config.fps),
            "-i",
            self.config.device,
            "-vf",
            rf"select=gte(n\,{self.config.warmup_frames})",
            "-frames:v",
            "1",
            "-q:v",
            "2",
            "-y",
            str(temporary),
        ]
        try:
            await self.runner.run(argv, self.config.timeout_seconds)
            if not temporary.is_file() or temporary.stat().st_size < 4:
                raise ProcessExecutionError("camera returned no JPEG", code="capture_failed")
            if temporary.read_bytes()[:2] != b"\xff\xd8":
                raise ProcessExecutionError("camera returned an invalid JPEG", code="capture_failed")
            temporary.replace(final)
            return {
                "path": str(final),
                "content_type": "image/jpeg",
                "width": self.config.width,
                "height": self.config.height,
                "size_bytes": final.stat().st_size,
                "captured_at": datetime.now(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
            }
        except ProcessExecutionError as exc:
            if exc.code in {"command_timeout", "tool_unavailable"}:
                raise
            raise ProcessExecutionError("camera capture failed", code="capture_failed") from exc
        except OSError as exc:
            raise ProcessExecutionError("camera capture failed", code="capture_failed") from exc
        finally:
            temporary.unlink(missing_ok=True)
