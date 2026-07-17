from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


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
    name: Literal["ping", "get_status"]
    arguments: dict[str, Any] = Field(default_factory=dict)


class CommandRecord(BaseModel):
    command_id: str
    device_id: str
    name: str
    arguments: dict[str, Any]
    state: Literal["sent", "completed", "failed"]
    created_at: datetime
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None

