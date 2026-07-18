#!/usr/bin/env bash
set -euo pipefail

ROBOT_URL="${ROBOT_URL:-http://192.168.1.18:3001/robot}"
ROBOT_BROWSER="${ROBOT_BROWSER:-}"
ROBOT_DISPLAY="${ROBOT_DISPLAY:-:0}"
ROBOT_XAUTHORITY="${ROBOT_XAUTHORITY:-/home/orangepi/.Xauthority}"
ROBOT_USER_DATA_DIR="${ROBOT_USER_DATA_DIR:-/tmp/mambo-robot-browser}"

if [[ -z "$ROBOT_BROWSER" && -x /usr/bin/snap ]]; then
  snap_caps="$(getcap /usr/lib/snapd/snap-confine 2>/dev/null || true)"
  if [[ "$snap_caps" != *"=ep"* && -x /usr/lib/aarch64-linux-gnu/webkit2gtk-4.0/WebKitNetworkProcess ]] \
    && python3 -c 'import gi' >/dev/null 2>&1; then
    ROBOT_BROWSER="webkit"
    ROBOT_LOCAL_PROXY="${ROBOT_LOCAL_PROXY:-1}"
  fi
fi

if [[ "${ROBOT_LOCAL_PROXY:-0}" == "1" ]]; then
  proxy_upstream="${ROBOT_PROXY_UPSTREAM:-http://192.168.1.18:3001}"
  if ! (echo >/dev/tcp/127.0.0.1/3010) >/dev/null 2>&1; then
    nohup env ROBOT_PROXY_UPSTREAM="$proxy_upstream" ROBOT_PROXY_DEBUG="${ROBOT_PROXY_DEBUG:-0}" \
      python3 /opt/mambo-k12-ai-robot/deploy/local-web-proxy.py \
      >/tmp/mambo-local-web-proxy.log 2>&1 </dev/null &
    sleep 1
  fi
  ROBOT_URL="http://127.0.0.1:3010/robot"
fi

if [[ "${ROBOT_BROWSER:-}" == "webkit" ]]; then
  export DISPLAY="$ROBOT_DISPLAY"
  export XAUTHORITY="$ROBOT_XAUTHORITY"
  export LIBGL_ALWAYS_SOFTWARE="${LIBGL_ALWAYS_SOFTWARE:-1}"
  export WEBKIT_DISABLE_DMABUF_RENDERER="${WEBKIT_DISABLE_DMABUF_RENDERER:-1}"
  exec python3 /opt/mambo-k12-ai-robot/deploy/launch-robot-webkit.py
fi

browser_command=()
browser_extra_flags=()
if [[ -z "$ROBOT_BROWSER" ]]; then
  snap_root="/snap/chromium/current"
  snap_chromium="$snap_root/usr/lib/chromium-browser/chrome"
  snap_loader="/snap/core24/current/lib/ld-linux-aarch64.so.1"
  snap_library_path="/snap/core24/current/lib/aarch64-linux-gnu:/snap/core24/current/usr/lib/aarch64-linux-gnu:$snap_root/usr/lib/aarch64-linux-gnu:$snap_root/usr/lib/chromium-browser"
  if [[ -x "$snap_chromium" && -x "$snap_loader" ]]; then
    export SNAP="$snap_root"
    export SNAP_REAL_HOME="${SNAP_REAL_HOME:-$HOME}"
    export SNAP_USER_DATA="${SNAP_USER_DATA:-$HOME/snap/chromium/current}"
    export SNAP_USER_COMMON="${SNAP_USER_COMMON:-$HOME/snap/chromium/common}"
    export SNAP_INSTANCE_NAME="${SNAP_INSTANCE_NAME:-chromium}"
    export CHROME_VERSION_EXTRA="snap"
    export CHROME_WRAPPER="/snap/bin/chromium"
    browser_command=("$snap_loader" --library-path "$snap_library_path" "$snap_chromium")
    browser_extra_flags=("--password-store=basic" "--icu-data-dir=$snap_root/usr/lib/chromium-browser")
  elif command -v chromium-browser >/dev/null 2>&1; then
    ROBOT_BROWSER="$(command -v chromium-browser)"
    browser_command=("$ROBOT_BROWSER")
  elif command -v chromium >/dev/null 2>&1; then
    ROBOT_BROWSER="$(command -v chromium)"
    browser_command=("$ROBOT_BROWSER")
  else
    echo "未找到 Chromium，请先执行 install-orangepi-browser.sh。" >&2
    exit 1
  fi
else
  browser_command=("$ROBOT_BROWSER")
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
exec "${browser_command[@]}" \
  "${browser_extra_flags[@]}" \
  --kiosk \
  --no-first-run \
  --disable-session-crashed-bubble \
  --user-data-dir="$ROBOT_USER_DATA_DIR" \
  "${extra_flags[@]}" \
  "$ROBOT_URL"
