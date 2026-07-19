# OrangePi 浏览器现场验收

## 已验证

- OrangePi 800x480 屏幕已显示 `/robot` 页面，页面布局正常。
- Chromium Snap 已安装，但当前用户会话的 `snap-confine` 文件能力不完整，直接启动会崩溃。
- `deploy/launch-robot-browser.sh` 会自动回退到 WebKitGTK，并启动本地反向代理 `127.0.0.1:3010`。
- 本地代理转发到 Next 生产服务后，页面显示 `orangepi4pro 已连接`。
- 通过页面控制链路点击“开启手势”后，开发板摄像头画面成功显示，按钮变为“关闭手势”。
- Web BFF 下发的 `move_mouse` 和 `click_mouse` 命令均在 Core 中完成，屏幕分辨率为 `800x480`。

## 启动约定

Windows 端先运行生产 Web 服务（默认端口 `3001`）：

```powershell
npm run build --workspace apps/web
npm run start --workspace apps/web -- -p 3001
```

OrangePi 端使用普通用户运行：

```bash
DISPLAY=:0 XAUTHORITY=/home/orangepi/.Xauthority \
  /opt/mambo-k12-ai-robot/deploy/launch-robot-browser.sh
```

脚本会自动选择 WebKitGTK 本地代理；如果 Snap 权限已修复，也可以通过 `ROBOT_BROWSER=chromium` 显式选择 Chromium。

## 尚未完成

- 百度 OAuth 当前返回 `invalid_client`，需要替换为百度控制台复制出的有效 API Key 和 Secret Key。
- 握拳点击的算法和 XTest 设备命令已验证；现场用真实手掌触发一次完整点击仍需在无系统错误弹窗的屏幕上完成。
