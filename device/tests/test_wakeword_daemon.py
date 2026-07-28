from __future__ import annotations

import importlib.util
from pathlib import Path
import sys


DAEMON_PATH = Path(__file__).parents[2] / "deploy" / "wakeword-daemon.py"
SERVICE_PATH = Path(__file__).parents[2] / "deploy" / "mambo-wakeword.service"
KEYWORDS_PATH = Path(__file__).parents[2] / "deploy" / "wakeword-keywords.txt"


def test_wakeword_daemon_is_packaged_with_the_robot_deployment() -> None:
    assert DAEMON_PATH.is_file()


def test_wakeword_service_uses_the_project_hello_xingbao_keyword_file() -> None:
    assert KEYWORDS_PATH.read_text(encoding="utf-8").strip()
    service = SERVICE_PATH.read_text(encoding="utf-8")

    assert "--keywords-file /opt/mambo-k12-ai-robot/deploy/wakeword-keywords.txt" in service


def load_daemon():
    spec = importlib.util.spec_from_file_location("wakeword_daemon", DAEMON_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_wakeword_daemon_only_signals_after_a_keyword_detection_line() -> None:
    daemon = load_daemon()
    is_keyword_detection = getattr(daemon, "is_keyword_detection", lambda _line: False)

    assert is_keyword_detection("Detected keyword: 你好星宝")
    assert is_keyword_detection("detected keyword: 星宝")
    assert not is_keyword_detection("processing audio frames")
    assert not is_keyword_detection("keyword score below threshold")


def test_wakeword_daemon_recognizes_sherpa_json_keyword_output() -> None:
    daemon = load_daemon()
    is_keyword_detection = getattr(daemon, "is_keyword_detection", lambda _line: False)

    assert is_keyword_detection('0:{"start_time":0.00,"keyword":"你好星宝","tokens":["n","ǐ"]}')
    assert is_keyword_detection('3:{"start_time":1.00,"keyword":"星宝","tokens":["x","īng","b","ǎo"]}')
    assert not is_keyword_detection('0:{"start_time":0.00,"tokens":["x","īng"]}')


def test_wakeword_daemon_recognizes_the_first_line_of_wrapped_sherpa_json_output() -> None:
    daemon = load_daemon()
    is_keyword_detection = getattr(daemon, "is_keyword_detection", lambda _line: False)

    assert is_keyword_detection('0:{"start_time":0.00, "keyword": "你好星宝", "timestamps": [0.04, 0.08,')


def test_wakeword_daemon_uses_one_cpu_thread_and_the_chinese_keyword_model() -> None:
    daemon = load_daemon()
    config_type = getattr(daemon, "WakeWordConfig", None)
    command_builder = getattr(daemon, "build_spotter_command", None)

    assert config_type is not None
    assert command_builder is not None
    command = command_builder(config_type())

    assert "--model-type=zipformer2" in command
    assert "--num-threads=1" in command
    assert command[-1] == "plughw:2,0"


def test_wakeword_daemon_can_override_the_model_vendor_keywords_with_the_robot_keywords() -> None:
    daemon = load_daemon()
    config_type = getattr(daemon, "WakeWordConfig", None)
    command_builder = getattr(daemon, "build_spotter_command", None)

    assert config_type is not None
    assert command_builder is not None
    config = config_type(keywords_path=Path("/tmp/mambo-keywords.txt"))

    assert config.keywords_file == Path("/tmp/mambo-keywords.txt")
    assert f"--keywords-file={config.keywords_file}" in command_builder(config)


def test_wakeword_daemon_requires_recording_and_the_expected_device_before_ready() -> None:
    daemon = load_daemon()
    is_listener_ready = getattr(daemon, "is_listener_ready", None)

    assert callable(is_listener_ready)
    output = [
        "Current sample rate: 16000",
        "Recording started!",
        "Use recording device: plughw:2,0",
    ]

    assert is_listener_ready(output, "plughw:2,0")
    assert not is_listener_ready(output[:-1], "plughw:2,0")
    assert not is_listener_ready(output, "plughw:9,9")


def test_wakeword_daemon_exposes_distinct_ready_and_unavailable_status_routes() -> None:
    daemon = load_daemon()
    config_type = getattr(daemon, "WakeWordConfig", None)

    assert config_type is not None
    config = config_type()
    assert config.heartbeat_url == "http://127.0.0.1:3010/_mambo/wake/heartbeat"
    assert config.unavailable_url == "http://127.0.0.1:3010/_mambo/wake/unavailable"


def test_wakeword_daemon_waits_for_a_claimed_browser_session_to_release() -> None:
    daemon = load_daemon()
    config_type = getattr(daemon, "WakeWordConfig", None)
    wait_for_release = getattr(daemon, "wait_for_browser_capture_release", None)

    assert config_type is not None
    assert callable(wait_for_release)
    states = iter(["awaiting_claim", "capturing", "idle"])
    sleeps: list[float] = []

    wait_for_release(
        config_type(handoff_poll_seconds=0.2),
        should_stop=lambda: False,
        sleep=sleeps.append,
        read_state=lambda _config: next(states),
    )

    assert sleeps == [0.2, 0.2]
