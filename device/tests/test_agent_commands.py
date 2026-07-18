import asyncio
import json

from device.agent import Settings, handle_command


class FakeConnection:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def send(self, raw: str) -> None:
        self.messages.append(json.loads(raw))


class FakeHardware:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict, str]] = []

    def capabilities_payload(self) -> dict:
        return {"camera": {"available": True}}

    def players_status(self) -> dict[str, bool]:
        return {"artifact_active": False, "audio_active": False}

    async def execute(self, name: str, arguments: dict, command_id: str) -> dict:
        self.calls.append((name, arguments, command_id))
        return {"ok": True, "mode": arguments.get("mode", "unknown")}


def test_handle_command_dispatches_hardware_and_returns_duration() -> None:
    connection = FakeConnection()
    hardware = FakeHardware()
    settings = Settings.from_env()

    asyncio.run(
        handle_command(
            connection,
            settings,
            {
                "command_id": "command-1",
                "name": "set_display_mode",
                "arguments": {"mode": "presentation"},
            },
            hardware=hardware,
        )
    )

    result = connection.messages[0]["payload"]
    assert result["ok"] is True
    assert result["duration_ms"] >= 0
    assert result["mode"] == "presentation"
    assert hardware.calls == [
        ("set_display_mode", {"mode": "presentation"}, "command-1")
    ]


def test_handle_command_replays_duplicate_without_hardware_call() -> None:
    connection = FakeConnection()
    hardware = FakeHardware()
    cache: dict[str, dict] = {}
    settings = Settings.from_env()
    payload = {
        "command_id": "command-duplicate",
        "name": "set_display_mode",
        "arguments": {"mode": "on"},
    }

    asyncio.run(handle_command(connection, settings, payload, hardware=hardware, result_cache=cache))
    asyncio.run(handle_command(connection, settings, payload, hardware=hardware, result_cache=cache))

    assert len(hardware.calls) == 1
    assert connection.messages[0]["payload"] == connection.messages[1]["payload"]


def test_handle_command_rejects_unknown_command_without_hardware_call() -> None:
    connection = FakeConnection()
    hardware = FakeHardware()
    settings = Settings.from_env()

    asyncio.run(
        handle_command(
            connection,
            settings,
            {"command_id": "command-invalid", "name": "run_shell", "arguments": {}},
            hardware=hardware,
        )
    )

    result = connection.messages[0]["payload"]
    assert result["ok"] is False
    assert result["error"] == "unsupported_command"
    assert hardware.calls == []
