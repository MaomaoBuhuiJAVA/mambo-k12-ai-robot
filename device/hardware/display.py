from __future__ import annotations

from typing import Protocol

from .process import ProcessExecutionError, ProcessResult, ProcessRunner


class DisplayProcessRunner(Protocol):
    async def run(
        self,
        argv: list[str],
        timeout_seconds: float,
        *,
        env: dict[str, str] | None = None,
    ) -> ProcessResult: ...


class DisplayAdapter:
    def __init__(
        self,
        *,
        display_name: str,
        xauthority_path: str,
        runner: DisplayProcessRunner | None = None,
        timeout_seconds: float = 5.0,
    ) -> None:
        self.display_name = display_name
        self.xauthority_path = xauthority_path
        self.runner = runner or ProcessRunner()
        self.timeout_seconds = timeout_seconds

    def _env(self) -> dict[str, str]:
        env = {"DISPLAY": self.display_name}
        if self.xauthority_path:
            env["XAUTHORITY"] = self.xauthority_path
        return env

    async def _run(self, argv: list[str]) -> None:
        try:
            await self.runner.run(argv, self.timeout_seconds, env=self._env())
        except ProcessExecutionError as exc:
            if exc.code in {"command_timeout", "tool_unavailable"}:
                raise
            raise ProcessExecutionError("display control failed", code="display_failed") from exc

    async def set_mode(self, mode: str) -> dict[str, object]:
        if mode not in {"on", "presentation", "off"}:
            raise ProcessExecutionError("display mode is invalid", code="invalid_arguments")
        if mode == "on":
            await self._run(["xset", "dpms", "force", "on"])
        elif mode == "presentation":
            await self._run(["xset", "dpms", "force", "on"])
            await self._run(["xset", "s", "off", "-dpms"])
        else:
            await self._run(["xset", "dpms", "force", "off"])
        return {"mode": mode}
