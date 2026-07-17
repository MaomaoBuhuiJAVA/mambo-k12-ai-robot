from __future__ import annotations

import pytest
from pydantic import ValidationError

from server.app import protocol
from server.app.protocol import DeviceMessage


def message(message_type: str, payload: dict) -> dict:
    return {
        "version": 1,
        "message_id": f"bounded-{message_type}-123456",
        "type": message_type,
        "device_id": "test-device-01",
        "timestamp": "2026-07-17T10:00:00Z",
        "payload": payload,
    }


@pytest.mark.parametrize(
    ("message_type", "payload"),
    [
        (
            "hello",
            {
                "agent_version": "0.1.0",
                "platform": "Linux-aarch64",
                "capabilities": ["get_status", "ping"],
            },
        ),
        ("heartbeat", {}),
        ("status", {"cpu_load_1m": 0.25, "temperature_c": 42.0}),
        (
            "command_result",
            {
                "command_id": "77f0f95a-03e6-4ef9-976b-0dad9ef929b0",
                "ok": True,
                "status": {"cpu_load_1m": 0.25},
            },
        ),
    ],
)
def test_current_device_agent_payloads_remain_valid(
    message_type: str, payload: dict
) -> None:
    parsed = DeviceMessage.model_validate(message(message_type, payload))
    assert parsed.payload == payload


@pytest.mark.parametrize(
    ("message_type", "payload"),
    [
        (
            "hello",
            {
                "agent_version": "0.1.0",
                "platform": "Linux-aarch64",
                "capabilities": [f"capability-{index}" for index in range(33)],
            },
        ),
        (
            "hello",
            {
                "agent_version": "0.1.0",
                "platform": "Linux-aarch64",
                "capabilities": ["x" * 65],
            },
        ),
        (
            "hello",
            {
                "agent_version": "0.1.0",
                "platform": "Linux-aarch64",
                "capabilities": [{}],
            },
        ),
        ("status", {f"metric-{index}": index for index in range(65)}),
        ("status", {"diagnostic": "x" * 17_000}),
        (
            "command_result",
            {"command_id": "x" * 65, "ok": True},
        ),
    ],
)
def test_device_payload_bounds_reject_untrusted_growth(
    message_type: str, payload: dict
) -> None:
    with pytest.raises(ValidationError):
        DeviceMessage.model_validate(message(message_type, payload))


def test_recent_message_id_window_is_bounded() -> None:
    window_type = getattr(protocol, "RecentMessageIds", None)
    assert window_type is not None, "protocol must provide a bounded deduplication window"
    recent = window_type(capacity=2)

    assert recent.remember("message-1") is False
    assert recent.remember("message-2") is False
    assert recent.remember("message-2") is True
    assert recent.remember("message-3") is False
    assert len(recent) == 2
    assert recent.remember("message-1") is False


def test_device_message_rejects_unknown_envelope_fields() -> None:
    raw = message("heartbeat", {})
    raw["unexpected"] = "x" * 1_000

    with pytest.raises(ValidationError):
        DeviceMessage.model_validate(raw)
