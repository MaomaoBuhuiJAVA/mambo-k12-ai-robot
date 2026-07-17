from __future__ import annotations

import json
import math
from collections import deque
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


MAX_DEVICE_PAYLOAD_BYTES = 16 * 1024
MAX_PAYLOAD_COLLECTION_ITEMS = 64
MAX_PAYLOAD_DEPTH = 4
MAX_PAYLOAD_KEY_LENGTH = 64
MAX_PAYLOAD_STRING_LENGTH = 2_048
MAX_CAPABILITIES = 32
MAX_CAPABILITY_LENGTH = 64
RECENT_MESSAGE_ID_CAPACITY = 256


class RecentMessageIds:
    """A fixed-size replay window owned by one WebSocket connection."""

    def __init__(self, capacity: int = RECENT_MESSAGE_ID_CAPACITY) -> None:
        if capacity < 1:
            raise ValueError("capacity must be positive")
        self._capacity = capacity
        self._queue: deque[str] = deque()
        self._known: set[str] = set()

    def remember(self, message_id: str) -> bool:
        if message_id in self._known:
            return True
        if len(self._queue) == self._capacity:
            self._known.remove(self._queue.popleft())
        self._queue.append(message_id)
        self._known.add(message_id)
        return False

    def __len__(self) -> int:
        return len(self._queue)


def _validate_json_value(value: Any, *, depth: int = 0) -> None:
    if depth > MAX_PAYLOAD_DEPTH:
        raise ValueError("payload nesting is too deep")
    if value is None or isinstance(value, bool) or isinstance(value, int):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("payload numbers must be finite")
        return
    if isinstance(value, str):
        if len(value) > MAX_PAYLOAD_STRING_LENGTH:
            raise ValueError("payload string is too long")
        return
    if isinstance(value, list):
        if len(value) > MAX_PAYLOAD_COLLECTION_ITEMS:
            raise ValueError("payload list has too many items")
        for item in value:
            _validate_json_value(item, depth=depth + 1)
        return
    if isinstance(value, dict):
        if len(value) > MAX_PAYLOAD_COLLECTION_ITEMS:
            raise ValueError("payload object has too many fields")
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError("payload keys must be strings")
            if len(key) > MAX_PAYLOAD_KEY_LENGTH or any(
                ord(char) < 32 for char in key
            ):
                raise ValueError("payload key is invalid")
            _validate_json_value(item, depth=depth + 1)
        return
    raise ValueError("payload values must be JSON-compatible")


def _validate_hello_payload(payload: dict[str, Any]) -> None:
    agent_version = payload.get("agent_version")
    platform = payload.get("platform")
    capabilities = payload.get("capabilities")
    if not isinstance(agent_version, str) or not 1 <= len(agent_version) <= 32:
        raise ValueError("invalid agent_version")
    if not isinstance(platform, str) or not 1 <= len(platform) <= 255:
        raise ValueError("invalid platform")
    if not isinstance(capabilities, list) or len(capabilities) > MAX_CAPABILITIES:
        raise ValueError("invalid capabilities")
    for capability in capabilities:
        if not isinstance(capability, str) or not (
            1 <= len(capability) <= MAX_CAPABILITY_LENGTH
        ):
            raise ValueError("invalid capability")
        if any(
            not (char.isascii() and (char.isalnum() or char in "._:-"))
            for char in capability
        ):
            raise ValueError("invalid capability")
    if len(set(capabilities)) != len(capabilities):
        raise ValueError("capabilities must be unique")


def _validate_command_result_payload(payload: dict[str, Any]) -> None:
    command_id = payload.get("command_id")
    if not isinstance(command_id, str) or not 8 <= len(command_id) <= 64:
        raise ValueError("invalid command_id")
    if not isinstance(payload.get("ok"), bool):
        raise ValueError("invalid command result")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DeviceMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    message_id: str = Field(
        min_length=8,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    type: Literal["hello", "heartbeat", "status", "command_result"]
    device_id: str = Field(
        min_length=3,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$",
    )
    timestamp: datetime
    payload: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_payload_bounds(self) -> "DeviceMessage":
        _validate_json_value(self.payload)
        encoded = json.dumps(
            self.payload,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        ).encode("utf-8")
        if len(encoded) > MAX_DEVICE_PAYLOAD_BYTES:
            raise ValueError("payload is too large")
        if self.type == "hello":
            _validate_hello_payload(self.payload)
        elif self.type == "heartbeat" and self.payload:
            raise ValueError("heartbeat payload must be empty")
        elif self.type == "command_result":
            _validate_command_result_payload(self.payload)
        return self


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

