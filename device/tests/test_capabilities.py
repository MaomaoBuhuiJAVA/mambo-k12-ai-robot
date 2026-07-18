from pathlib import Path

from device.hardware.capabilities import detect_capabilities


def test_detect_capabilities_reports_devices_and_tools() -> None:
    existing = {"/dev/video0", "/dev/vipcore", "/home/orangepi/.Xauthority"}
    tools = {"ffmpeg", "mpv", "xset"}

    capabilities = detect_capabilities(
        camera_device="/dev/video0",
        display_name=":0",
        xauthority_path="/home/orangepi/.Xauthority",
        path_exists=lambda path: path.as_posix() in existing,
        tool_lookup=lambda name: f"/usr/bin/{name}" if name in tools else None,
    )

    assert capabilities["camera"] == {"available": True, "device": "/dev/video0"}
    assert capabilities["display"] == {
        "available": True,
        "name": ":0",
        "xauthority": "/home/orangepi/.Xauthority",
    }
    assert capabilities["npu"] == {"available": True, "device": "/dev/vipcore"}
    assert capabilities["tools"] == {"ffmpeg": True, "mpv": True, "xset": True}


def test_detect_capabilities_does_not_report_missing_hardware() -> None:
    capabilities = detect_capabilities(
        camera_device="/dev/video0",
        display_name="",
        xauthority_path="",
        path_exists=lambda _: False,
        tool_lookup=lambda _: None,
    )

    assert capabilities["camera"]["available"] is False
    assert capabilities["display"]["available"] is False
    assert capabilities["audio_playback"]["available"] is False
    assert capabilities["audio_capture"]["available"] is False
    assert capabilities["npu"]["available"] is False
