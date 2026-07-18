import asyncio
from pathlib import Path

from device.hardware.media import ArtifactPlayer, AudioPlayer
from device.hardware.process import OwnedProcess, ProcessResult


class FakeOwned:
    def __init__(self) -> None:
        self.stopped = False

    async def stop(self) -> None:
        self.stopped = True


class FakeRunner:
    def __init__(self) -> None:
        self.calls: list[tuple[list[str], dict[str, str] | None]] = []
        self.processes: list[FakeOwned] = []

    async def start_owned(
        self, argv: list[str], *, env: dict[str, str] | None = None
    ) -> FakeOwned:
        self.calls.append((argv, env))
        process = FakeOwned()
        self.processes.append(process)
        return process


def test_artifact_player_replaces_previous_owned_process(tmp_path: Path) -> None:
    image = tmp_path / "image.jpg"
    image.write_bytes(b"image")
    runner = FakeRunner()
    player = ArtifactPlayer(
        media_root=tmp_path,
        allowed_hosts=set(),
        display_name=":0",
        xauthority_path="/home/orangepi/.Xauthority",
        runner=runner,
    )

    first = asyncio.run(player.show(str(image), "image"))
    second = asyncio.run(player.show(str(image), "image"))

    assert first["active"] is True
    assert second["media_type"] == "image"
    assert runner.processes[0].stopped is True
    assert runner.calls[1][0] == [
        "mpv",
        "--fullscreen",
        "--no-terminal",
        "--image-display-duration=inf",
        str(image.resolve()),
    ]
    assert runner.calls[1][1]["DISPLAY"] == ":0"
    assert runner.calls[1][1]["XAUTHORITY"] == "/home/orangepi/.Xauthority"


def test_audio_player_uses_no_video_and_safe_volume(tmp_path: Path) -> None:
    audio = tmp_path / "audio.mp3"
    audio.write_bytes(b"audio")
    runner = FakeRunner()
    player = AudioPlayer(
        media_root=tmp_path,
        allowed_hosts=set(),
        display_name=":0",
        xauthority_path="/home/orangepi/.Xauthority",
        runner=runner,
    )

    result = asyncio.run(player.play(str(audio), 80))

    assert result["active"] is True
    assert runner.calls[0][0] == [
        "mpv",
        "--no-video",
        "--no-terminal",
        "--volume=80",
        str(audio.resolve()),
    ]
