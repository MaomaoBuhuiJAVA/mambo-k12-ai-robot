#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
MAMBO_HAND_HOME="${MAMBO_HAND_HOME:-$HOME/.local/share/mambo-hand-vision}"
VENV_DIR="$MAMBO_HAND_HOME/venv"
PYTHON_BIN="${PYTHON_BIN:-python3}"

"$PYTHON_BIN" -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install "matplotlib>=3.8,<4"
"$VENV_DIR/bin/python" -m pip install --no-deps -r "$PROJECT_DIR/deploy/requirements-hand-vision.txt"

mkdir -p "$HOME/.config/systemd/user"
install -m 0644 "$PROJECT_DIR/deploy/mambo-hand-vision.service" "$HOME/.config/systemd/user/mambo-hand-vision.service"
systemctl --user daemon-reload
systemctl --user enable --now mambo-hand-vision.service
