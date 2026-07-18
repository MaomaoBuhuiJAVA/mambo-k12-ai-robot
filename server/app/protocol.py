from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DeviceMessage(BaseModel):
    version: Literal[1] = 1
    message_id: str = Field(min_length=8, max_length=128)
    type: Literal["hello", "heartbeat", "status", "command_result"]
    device_id: str
    timestamp: datetime
    payload: dict[str, Any] = Field(default_factory=dict)


class ServerMessage(BaseModel):
    version: Literal[1] = 1
    message_id: str = Field(default_factory=lambda: str(uuid4()))
    type: Literal["welcome", "heartbeat_ack", "command"]
    timestamp: datetime = Field(default_factory=utc_now)
    payload: dict[str, Any] = Field(default_factory=dict)


class CommandRequest(BaseModel):
    name: Literal[
        "ping",
        "get_status",
        "capture_snapshot",
        "show_artifact",
        "stop_artifact",
        "play_audio",
        "stop_audio",
        "set_display_mode",
    ]
    arguments: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_arguments(self) -> "CommandRequest":
        argument_models: dict[str, type[BaseModel]] = {
            "ping": EmptyArguments,
            "get_status": EmptyArguments,
            "capture_snapshot": EmptyArguments,
            "stop_artifact": EmptyArguments,
            "stop_audio": EmptyArguments,
            "show_artifact": ShowArtifactArguments,
            "play_audio": PlayAudioArguments,
            "set_display_mode": DisplayModeArguments,
        }
        model = argument_models[self.name].model_validate(self.arguments)
        self.arguments = model.model_dump(exclude_none=True)
        return self


class EmptyArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ShowArtifactArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1, max_length=2048)
    media_type: Literal["image", "video"]

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        from urllib.parse import urlparse

        parsed = urlparse(value)
        if parsed.scheme not in {"", "http", "https"}:
            raise ValueError("source scheme is not allowed")
        if parsed.username or parsed.password:
            raise ValueError("source credentials are not allowed")
        return value


class PlayAudioArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1, max_length=2048)
    volume: int = Field(default=100, ge=0, le=100)

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        from urllib.parse import urlparse

        parsed = urlparse(value)
        if parsed.scheme not in {"", "http", "https"}:
            raise ValueError("source scheme is not allowed")
        if parsed.username or parsed.password:
            raise ValueError("source credentials are not allowed")
        return value


class DisplayModeArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["on", "presentation", "off"]


class CommandRecord(BaseModel):
    command_id: str
    device_id: str
    name: str
    arguments: dict[str, Any]
    state: Literal["sent", "completed", "failed", "timed_out"]
    created_at: datetime
    expires_at: datetime
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None
