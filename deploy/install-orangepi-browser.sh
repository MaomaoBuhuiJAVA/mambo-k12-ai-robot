#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请用 sudo 执行此脚本；脚本不会保存或读取登录密码。" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y chromium-browser
echo "Chromium 已安装。请使用 deploy/launch-robot-browser.sh 打开机器人页面。"
