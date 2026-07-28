from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).parents[2]
INSTALLER = ROOT / "deploy" / "install-mambo-robot-browser.sh"
SERVICE = ROOT / "deploy" / "mambo-robot-browser.service"


def test_robot_browser_service_starts_the_kiosk_page_in_the_graphical_session() -> None:
    assert SERVICE.is_file()
    source = SERVICE.read_text(encoding="utf-8")

    assert "After=graphical-session.target" in source
    assert "ExecStart=/opt/mambo-k12-ai-robot/deploy/launch-robot-browser.sh" in source
    assert "Environment=DISPLAY=:0" in source
    assert "Environment=XAUTHORITY=/home/orangepi/.Xauthority" in source
    assert "Environment=ROBOT_BROWSER=webkit" in source
    assert "Environment=ROBOT_LOCAL_PROXY=1" in source
    assert "Environment=ROBOT_PROXY_UPSTREAM=http://192.168.1.18:3001" in source
    assert "WantedBy=graphical-session.target" in source


def test_robot_browser_installer_enables_the_user_service() -> None:
    assert INSTALLER.is_file()
    source = INSTALLER.read_text(encoding="utf-8")

    assert 'install -m 0644 "$PROJECT_DIR/deploy/mambo-robot-browser.service"' in source
    assert "systemctl --user enable --now mambo-robot-browser.service" in source
    assert "sudo" not in source
