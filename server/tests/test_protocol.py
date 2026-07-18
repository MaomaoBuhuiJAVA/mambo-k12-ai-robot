import pytest
from pydantic import ValidationError

from server.app.protocol import CommandRequest


def test_command_request_accepts_hardware_commands() -> None:
    request = CommandRequest(
        name="play_audio",
        arguments={"source": "https://media.example.test/a.mp3", "volume": 80},
    )

    assert request.name == "play_audio"
    assert request.arguments["volume"] == 80

    pointer = CommandRequest(name="move_mouse", arguments={"x": 0.25, "y": 0.5})
    assert pointer.arguments == {"x": 0.25, "y": 0.5}
    assert CommandRequest(name="click_mouse", arguments={}).arguments == {}


def test_command_request_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        CommandRequest(
            name="set_display_mode",
            arguments={"mode": "presentation", "extra": True},
        )


def test_command_request_rejects_invalid_volume_and_source() -> None:
    with pytest.raises(ValidationError):
        CommandRequest(
            name="play_audio",
            arguments={"source": "ftp://media.example.test/a.mp3", "volume": 101},
        )

    with pytest.raises(ValidationError):
        CommandRequest(name="move_mouse", arguments={"x": 2, "y": 0.5})
