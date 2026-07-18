import asyncio
from pathlib import Path

import pytest

from device.hardware.camera import CameraAdapter, CameraConfig
from device.hardware.process import ProcessExecutionError, ProcessResult


class FakeRunner:
    def __init__(self, *, fail: ProcessExecutionError | None = None) -> None:
        self.argv: list[str] | None = None
        self.fail = fail

    async def run(self, argv: list[str], timeout_seconds: float) -> ProcessResult:
        self.argv = argv
        if self.fail is not None:
            raise self.fail
        Path(argv[-1]).write_bytes(b"\xff\xd8\xff\xd9")
        return ProcessResult(returncode=0, stdout="", stderr="")


def test_capture_warms_camera_and_atomically_returns_jpeg(tmp_path: Path) -> None:
    runner = FakeRunner()
    adapter = CameraAdapter(
        CameraConfig(
            device="/dev/video0",
            width=1920,
            height=1080,
            fps=30,
            warmup_frames=120,
            media_root=tmp_path,
        ),
        runner=runner,
    )

    result = asyncio.run(adapter.capture("capture-123"))

    assert runner.argv is not None
    assert runner.argv[:8] == [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "v4l2",
        "-input_format",
        "mjpeg",
    ]
    assert "select=gte(n\\,120)" in runner.argv
    assert result["content_type"] == "image/jpeg"
    assert result["width"] == 1920
    assert result["height"] == 1080
    assert Path(result["path"]).is_file()
    assert runner.argv[-1].endswith(".tmp.jpg")
    assert not list(tmp_path.rglob("*.tmp.jpg"))


def test_capture_failure_removes_temporary_file(tmp_path: Path) -> None:
    runner = FakeRunner(
        fail=ProcessExecutionError("failed", code="process_failed")
    )
    adapter = CameraAdapter(
        CameraConfig(media_root=tmp_path),
        runner=runner,
    )

    with pytest.raises(ProcessExecutionError) as exc_info:
        asyncio.run(adapter.capture("capture-failed"))

    assert exc_info.value.code == "capture_failed"
    assert not list((tmp_path / "snapshots").rglob("*.tmp.jpg"))
