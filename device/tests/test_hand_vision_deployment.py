from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).parents[2]
INSTALLER = ROOT / "deploy" / "install-mambo-hand-vision.sh"
SERVICE = ROOT / "deploy" / "mambo-hand-vision.service"
REQUIREMENTS = ROOT / "deploy" / "requirements-hand-vision.txt"


def test_hand_vision_has_an_isolated_no_sudo_installer() -> None:
    assert INSTALLER.is_file()
    source = INSTALLER.read_text(encoding="utf-8")

    assert "MAMBO_HAND_HOME" in source
    assert 'pip install "matplotlib' in source
    assert "--no-deps" in source
    assert "systemctl --user enable --now mambo-hand-vision.service" in source
    assert "sudo" not in source


def test_hand_vision_service_limits_resources_and_runs_the_local_daemon() -> None:
    assert SERVICE.is_file()
    source = SERVICE.read_text(encoding="utf-8")

    assert "mambo-hand-vision.py" in source
    assert "MemoryMax=" in source
    assert "CPUQuota=150%" in source
    assert "Restart=on-failure" in source
    assert "Environment=MAMBO_HAND_FPS=12" in source


def test_hand_vision_requirements_pin_the_arm64_mediapipe_candidate() -> None:
    assert REQUIREMENTS.is_file()
    source = REQUIREMENTS.read_text(encoding="utf-8")

    assert "mediapipe==0.10.18" in source
    assert "matplotlib" in source
    assert "opencv-contrib-python-headless" in source
