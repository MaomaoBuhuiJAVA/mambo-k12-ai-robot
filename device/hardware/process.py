from __future__ import annotations

import asyncio
import os
import signal
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


class ProcessExecutionError(RuntimeError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ProcessResult:
    returncode: int
    stdout: str
    stderr: str


class OwnedProcess:
    def __init__(self, process: asyncio.subprocess.Process) -> None:
        self.process = process

    @property
    def active(self) -> bool:
        return self.process.returncode is None

    async def stop(self, grace_seconds: float = 1.0) -> None:
        if self.process.returncode is not None:
            return
        _signal_process(self.process, force=False)
        try:
            wait = getattr(self.process, "wait", None)
            if wait is None:
                return
            await asyncio.wait_for(wait(), timeout=grace_seconds)
        except asyncio.TimeoutError:
            _signal_process(self.process, force=True)
            await self.process.wait()


def _signal_process(process: Any, *, force: bool) -> None:
    method = process.kill if force else process.terminate
    pid = getattr(process, "pid", None)
    if hasattr(os, "killpg") and pid is not None:
        try:
            os.killpg(pid, signal.SIGKILL if force else signal.SIGTERM)
            return
        except (OSError, ProcessLookupError):
            pass
    method()


class ProcessRunner:
    async def run(
        self,
        argv: list[str],
        timeout_seconds: float,
        *,
        env: dict[str, str] | None = None,
    ) -> ProcessResult:
        if not argv or any(not isinstance(item, str) or not item for item in argv):
            raise ProcessExecutionError("invalid process arguments", code="invalid_arguments")
        try:
            process = await asyncio.create_subprocess_exec(
                *argv,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                start_new_session=True,
            )
        except FileNotFoundError as exc:
            raise ProcessExecutionError("required tool is unavailable", code="tool_unavailable") from exc
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=timeout_seconds
            )
        except asyncio.TimeoutError as exc:
            _signal_process(process, force=True)
            wait = getattr(process, "wait", None)
            if wait is not None:
                await wait()
            raise ProcessExecutionError("process exceeded its timeout", code="command_timeout") from exc
        result = ProcessResult(
            returncode=process.returncode or 0,
            stdout=stdout.decode("utf-8", errors="replace")[:4096],
            stderr=stderr.decode("utf-8", errors="replace")[:4096],
        )
        if result.returncode != 0:
            raise ProcessExecutionError(
                "process exited unsuccessfully", code="process_failed"
            )
        return result

    async def start_owned(
        self, argv: list[str], *, env: dict[str, str] | None = None
    ) -> OwnedProcess:
        if not argv or any(not isinstance(item, str) or not item for item in argv):
            raise ProcessExecutionError("invalid process arguments", code="invalid_arguments")
        try:
            process = await asyncio.create_subprocess_exec(
                *argv,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                start_new_session=True,
            )
        except FileNotFoundError as exc:
            raise ProcessExecutionError("required tool is unavailable", code="tool_unavailable") from exc
        return OwnedProcess(process)


def _reject_source(message: str) -> None:
    raise ProcessExecutionError(message, code="source_not_allowed")


def resolve_managed_source(
    source: str, media_root: Path, allowed_hosts: set[str]
) -> str:
    if not isinstance(source, str) or not source or len(source) > 2048:
        _reject_source("source must be a non-empty string")
    if any(ord(char) < 32 for char in source):
        _reject_source("source contains control characters")

    looks_like_windows_path = len(source) >= 2 and source[1] == ":" and source[0].isalpha()
    parsed = urlparse("") if looks_like_windows_path else urlparse(source)
    if parsed.scheme:
        if parsed.scheme not in {"http", "https"}:
            _reject_source("source scheme is not allowed")
        if not parsed.hostname or parsed.username or parsed.password:
            _reject_source("source URL is invalid")
        hosts = {host.lower() for host in allowed_hosts}
        if parsed.hostname.lower() not in hosts:
            _reject_source("source host is not allowed")
        return source

    root = media_root.expanduser().resolve(strict=False)
    candidate = Path(source).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve(strict=False)
    try:
        resolved.relative_to(root)
    except ValueError:
        _reject_source("source is outside the managed media directory")
    return str(resolved)
