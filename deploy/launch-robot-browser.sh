#!/usr/bin/env bash
set -euo pipefail

ROBOT_URL="${ROBOT_URL:-http://192.168.1.18:3000/robot}"
ROBOT_BROWSER="${ROBOT_BROWSER:-}"
ROBOT_DISPLAY="${ROBOT_DISPLAY:-:0}"
ROBOT_XAUTHORITY="${ROBOT_XAUTHORITY:-/home/orangepi/.Xauthority}"
ROBOT_USER_DATA_DIR="${ROBOT_USER_DATA_DIR:-/tmp/mambo-robot-browser}"

if [[ -z "$ROBOT_BROWSER" ]]; then
  if command -v chromium-browser >/dev/null 2>&1; then
    ROBOT_BROWSER="$(command -v chromium-browser)"
  elif command -v chromium >/dev/null 2>&1; then
    ROBOT_BROWSER="$(command -v chromium)"
  else
    echo "未找到 Chromium，请先执行 install-orangepi-browser.sh。" >&2
    exit 1
  fi
fi

if [[ "$ROBOT_URL" == http://* && "${ROBOT_ALLOW_INSECURE_CAMERA:-0}" != "1" ]]; then
  echo "警告：HTTP 页面只能验证显示；摄像头手势需要 HTTPS。" >&2
fi

extra_flags=()
if [[ "$ROBOT_URL" == http://* && "${ROBOT_ALLOW_INSECURE_CAMERA:-0}" == "1" ]]; then
  origin="${ROBOT_URL%%/robot*}"
  extra_flags+=("--unsafely-treat-insecure-origin-as-secure=${origin}")
fi

export DISPLAY="$ROBOT_DISPLAY"
export XAUTHORITY="$ROBOT_XAUTHORITY"
exec "$ROBOT_BROWSER" \
  --kiosk \
  --no-first-run \
  --disable-session-crashed-bubble \
  --user-data-dir="$ROBOT_USER_DATA_DIR" \
  "${extra_flags[@]}" \
  "$ROBOT_URL"
