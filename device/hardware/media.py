from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Protocol

from .process import (
    OwnedProcess,
    ProcessExecutionError,
    ProcessRunner,
    resolve_managed_source,
)


class OwnedProcessRunner(Protocol):
    async def start_owned(
        self, argv: list[str], *, env: dict[str, str] | None = None
    ) -> OwnedProcess: ...


def _display_environment(display_name: str, xauthority_path: str) -> dict[str, str]:
    environment = os.environ.copy()
    environment["DISPLAY"] = display_name
    if xauthority_path:
        environment["XAUTHORITY"] = xauthority_path
    return environment


class ArtifactPlayer:
    def __init__(
        self,
        *,
        media_root: Path,
        allowed_hosts: set[str],
        display_name: str,
        xauthority_path: str,
        runner: OwnedProcessRunner | None = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        self.media_root = media_root
        self.allowed_hosts = allowed_hosts
        self.display_name = display_name
        self.xauthority_path = xauthority_path
        self.runner = runner or ProcessRunner()
        self.timeout_seconds = timeout_seconds
        self._process: Any | None = None
        self._source: str | None = None
        self._media_type: str | None = None

    async def show(self, source: str, media_type: str) -> dict[str, object]:
        if media_type not in {"image", "video"}:
            raise ProcessExecutionError("media type is invalid", code="invalid_arguments")
        resolved = resolve_managed_source(source, self.media_root, self.allowed_hosts)
        await self.stop()
        if media_type == "image":
            argv = [
                "mpv",
                "--fullscreen",
                "--no-terminal",
                "--image-display-duration=inf",
                resolved,
            ]
        else:
            argv = ["mpv", "--fullscreen", "--no-terminal", "--keep-open=no", resolved]
        try:
            self._process = await self.runner.start_owned(
                argv,
                env=_display_environment(self.display_name, self.xauthority_path),
            )
        except ProcessExecutionError as exc:
            if exc.code in {"command_timeout", "tool_unavailable"}:
                raise
            raise ProcessExecutionError("artifact playback failed", code="playback_failed") from exc
        self._source = resolved
        self._media_type = media_type
        return {"active": True, "source": resolved, "media_type": media_type}

    async def stop(self) -> dict[str, object]:
        if self._process is not None:
            await self._process.stop()
        self._process = None
        self._source = None
        self._media_type = None
        return {"active": False}


class AudioPlayer:
    def __init__(
        self,
        *,
        media_root: Path,
        allowed_hosts: set[str],
        display_name: str,
        xauthority_path: str,
        runner: OwnedProcessRunner | None = None,
    ) -> None:
        self.media_root = media_root
        self.allowed_hosts = allowed_hosts
        self.display_name = display_name
        self.xauthority_path = xauthority_path
        self.runner = runner or ProcessRunner()
        self._process: Any | None = None

    async def play(self, source: str, volume: int = 100) -> dict[str, object]:
        if not isinstance(volume, int) or isinstance(volume, bool) or not 0 <= volume <= 100:
            raise ProcessExecutionError("volume is invalid", code="invalid_arguments")
        resolved = resolve_managed_source(source, self.media_root, self.allowed_hosts)
        await self.stop()
        argv = ["mpv", "--no-video", "--no-terminal", f"--volume={volume}", resolved]
        try:
            self._process = await self.runner.start_owned(
                argv,
                env=_display_environment(self.display_name, self.xauthority_path),
            )
        except ProcessExecutionError as exc:
            if exc.code in {"command_timeout", "tool_unavailable"}:
                raise
            raise ProcessExecutionError("audio playback failed", code="playback_failed") from exc
        return {"active": True, "source": resolved, "volume": volume}

    async def stop(self) -> dict[str, object]:
        if self._process is not None:
            await self._process.stop()
        self._process = None
        return {"active": False}
