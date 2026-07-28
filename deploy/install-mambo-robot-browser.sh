#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
USER_UNIT_DIR="$HOME/.config/systemd/user"

mkdir -p "$USER_UNIT_DIR"
install -m 0644 "$PROJECT_DIR/deploy/mambo-robot-browser.service" \
  "$USER_UNIT_DIR/mambo-robot-browser.service"
systemctl --user daemon-reload
systemctl --user enable --now mambo-robot-browser.service

echo "Mambo Robot Kiosk 浏览器服务已启用。"
