import asyncio
from pathlib import Path

import pytest

from device.hardware.process import (
    ProcessRunner,
    ProcessExecutionError,
    resolve_managed_source,
)


def test_resolve_managed_source_allows_media_root_and_configured_host(
    tmp_path: Path,
) -> None:
    media_root = tmp_path / "media"
    media_root.mkdir()
    local_file = media_root / "picture.jpg"
    local_file.write_bytes(b"jpeg")

    assert resolve_managed_source(str(local_file), media_root, {"media.example.test"}) == str(
        local_file.resolve()
    )
    assert (
        resolve_managed_source(
            "https://media.example.test/picture.jpg", media_root, {"media.example.test"}
        )
        == "https://media.example.test/picture.jpg"
    )


def test_resolve_managed_source_rejects_escape_credentials_and_unapproved_hosts(
    tmp_path: Path,
) -> None:
    media_root = tmp_path / "media"
    media_root.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("secret", encoding="utf-8")
    (media_root / "escape").symlink_to(outside)

    for source in (
        str(outside),
        str(media_root / "escape"),
        "ftp://media.example.test/file.mp3",
        "https://user:pass@media.example.test/file.mp3",
        "https://other.example.test/file.mp3",
    ):
        with pytest.raises(ProcessExecutionError) as exc_info:
            resolve_managed_source(source, media_root, {"media.example.test"})
        assert exc_info.value.code == "source_not_allowed"


def test_process_runner_uses_exec_without_shell(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, object] = {}

    class FakeProcess:
        returncode = 0

        async def communicate(self) -> tuple[bytes, bytes]:
            return b"ok", b""

    async def fake_create(*argv: str, **kwargs: object) -> FakeProcess:
        calls["argv"] = argv
        calls["kwargs"] = kwargs
        return FakeProcess()

    monkeypatch.setattr(
        "device.hardware.process.asyncio.create_subprocess_exec", fake_create
    )
    result = asyncio.run(ProcessRunner().run(["ffmpeg", "-i", "camera"], 2))

    assert result.stdout == "ok"
    assert calls["argv"] == ("ffmpeg", "-i", "camera")
    assert calls["kwargs"].get("shell", False) is False


def test_process_runner_maps_timeout_to_stable_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeProcess:
        returncode = 0

        async def communicate(self) -> tuple[bytes, bytes]:
            await asyncio.sleep(1)
            return b"", b""

        def kill(self) -> None:
            pass

    async def fake_create(*_: str, **__: object) -> FakeProcess:
        return FakeProcess()

    monkeypatch.setattr(
        "device.hardware.process.asyncio.create_subprocess_exec", fake_create
    )
    with pytest.raises(ProcessExecutionError) as exc_info:
        asyncio.run(ProcessRunner().run(["slow"], 0.01))
    assert exc_info.value.code == "command_timeout"
