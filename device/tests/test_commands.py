import pytest

from device.commands import CommandValidationError, validate_command


def test_validate_command_accepts_hardware_commands() -> None:
    assert validate_command("capture_snapshot", {}) == {}
    assert validate_command(
        "show_artifact",
        {"source": "https://media.example.test/image.jpg", "media_type": "image"},
    ) == {
        "source": "https://media.example.test/image.jpg",
        "media_type": "image",
    }
    assert validate_command(
        "play_audio",
        {"source": "https://media.example.test/audio.mp3", "volume": 80},
    ) == {"source": "https://media.example.test/audio.mp3", "volume": 80}
    assert validate_command("set_display_mode", {"mode": "presentation"}) == {
        "mode": "presentation"
    }
    assert validate_command("move_mouse", {"x": 0.25, "y": 0.5}) == {
        "x": 0.25,
        "y": 0.5,
    }
    assert validate_command("click_mouse", {}) == {}


def test_validate_command_rejects_unknown_command() -> None:
    with pytest.raises(CommandValidationError) as exc_info:
        validate_command("run_shell", {})
    assert exc_info.value.code == "unsupported_command"


def test_validate_command_rejects_extra_fields_and_invalid_values() -> None:
    with pytest.raises(CommandValidationError) as exc_info:
        validate_command(
            "set_display_mode", {"mode": "presentation", "extra": True}
        )
    assert exc_info.value.code == "invalid_arguments"

    with pytest.raises(CommandValidationError) as exc_info:
        validate_command(
            "show_artifact",
            {"source": "https://media.example.test/image.jpg", "media_type": "pdf"},
        )
    assert exc_info.value.code == "invalid_arguments"

    with pytest.raises(CommandValidationError) as exc_info:
        validate_command(
            "play_audio",
            {"source": "https://media.example.test/audio.mp3", "volume": 101},
        )
    assert exc_info.value.code == "invalid_arguments"

    with pytest.raises(CommandValidationError) as exc_info:
        validate_command("move_mouse", {"x": 1.1, "y": 0.5})
    assert exc_info.value.code == "invalid_arguments"

    with pytest.raises(CommandValidationError) as exc_info:
        validate_command("click_mouse", {"button": "right"})
    assert exc_info.value.code == "invalid_arguments"
