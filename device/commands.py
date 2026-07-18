from __future__ import annotations

from typing import Any
from urllib.parse import urlparse


ALLOWED_COMMANDS = {
    "ping",
    "get_status",
    "capture_snapshot",
    "show_artifact",
    "stop_artifact",
    "play_audio",
    "stop_audio",
    "set_display_mode",
}


class CommandValidationError(ValueError):
    def __init__(self, message: str, *, code: str = "invalid_arguments") -> None:
        super().__init__(message)
        self.code = code


def _require_empty(arguments: dict[str, Any]) -> dict[str, Any]:
    if arguments:
        raise CommandValidationError("arguments must be empty")
    return {}


def _require_source(arguments: dict[str, Any], *, media_type: bool) -> dict[str, Any]:
    required = {"source", "media_type"} if media_type else {"source", "volume"}
    optional = set() if media_type else {"volume"}
    if set(arguments) - required - optional:
        raise CommandValidationError("unexpected command argument")
    source = arguments.get("source")
    if not isinstance(source, str) or not source or len(source) > 2048:
        raise CommandValidationError("source must be a non-empty string")
    parsed = urlparse(source)
    if parsed.scheme not in {"", "http", "https"}:
        raise CommandValidationError("source scheme is not allowed")
    if parsed.username or parsed.password:
        raise CommandValidationError("source credentials are not allowed")
    if media_type:
        value = arguments.get("media_type")
        if value not in {"image", "video"}:
            raise CommandValidationError("media_type must be image or video")
        return {"source": source, "media_type": value}
    volume = arguments.get("volume", 100)
    if not isinstance(volume, int) or isinstance(volume, bool) or not 0 <= volume <= 100:
        raise CommandValidationError("volume must be an integer from 0 to 100")
    return {"source": source, "volume": volume}


def validate_command(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name not in ALLOWED_COMMANDS:
        raise CommandValidationError("command is not allowed", code="unsupported_command")
    if not isinstance(arguments, dict):
        raise CommandValidationError("arguments must be an object")
    if name in {"ping", "get_status", "capture_snapshot", "stop_artifact", "stop_audio"}:
        return _require_empty(arguments)
    if name == "show_artifact":
        return _require_source(arguments, media_type=True)
    if name == "play_audio":
        return _require_source(arguments, media_type=False)
    if name == "set_display_mode":
        if set(arguments) != {"mode"} or arguments.get("mode") not in {"on", "presentation", "off"}:
            raise CommandValidationError("mode must be on, presentation, or off")
        return {"mode": arguments["mode"]}
    raise CommandValidationError("command is not implemented", code="unsupported_command")
