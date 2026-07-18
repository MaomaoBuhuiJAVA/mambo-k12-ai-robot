from device.agent import collect_status, detect_capabilities


def test_collect_status_has_required_fields() -> None:
    status = collect_status()
    assert status["hostname"]
    assert status["python_version"]
    assert status["disk_total_bytes"] > 0
    assert status["disk_free_bytes"] > 0
    assert status["cpu_load_1m"] >= 0


def test_detect_capabilities_reports_only_present_device_nodes(tmp_path) -> None:
    (tmp_path / "video0").touch()
    (tmp_path / "snd").mkdir()
    (tmp_path / "snd" / "pcmC0D0c").touch()
    (tmp_path / "snd" / "pcmC0D0p").touch()
    (tmp_path / "dri").mkdir()
    (tmp_path / "vipcore").touch()
    (tmp_path / "fb0").touch()

    assert detect_capabilities(tmp_path) == [
        "audio",
        "camera",
        "display",
        "get_status",
        "microphone",
        "npu",
        "ping",
        "speaker",
    ]


def test_detect_capabilities_keeps_only_safe_commands_without_hardware(tmp_path) -> None:
    assert detect_capabilities(tmp_path) == ["get_status", "ping"]

