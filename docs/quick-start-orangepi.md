# Windows 服务端与香橙派硬件端快速启动

> 适用于当前演示环境。先完成 Windows 服务端，再启动香橙派页面。本文只使用当前实际链路 `3002 -> 3003`；`3001` 是用户自己的开发服务，不能停止，也不是 Kiosk 上游。

## 运行结构

```text
香橙派 WebKit
  -> 127.0.0.1:3010/robot
  -> 香橙派本地代理
  -> Windows 192.168.1.18:3002
  -> Windows 转发代理
  -> 127.0.0.1:3003/robot
  -> Next.js 生产页面
```

当前地址和目录：

| 项目 | 当前值 |
| --- | --- |
| Windows 主机 | `192.168.1.18` |
| 香橙派 | `192.168.1.26` |
| 香橙派用户 | `orangepi` |
| Git 工作区 | `E:\Orange pi System\mambo-k12-ai-robot-online-preview-source` |
| Web 生产构建副本 | `E:\Orange pi System\tmp\mambo-k12-board-production-full-20260727` |

如果局域网地址变化，先替换下文所有 `192.168.1.18`，再启动服务。

## 一次性准备

Windows 需要 Node.js 20.9 或更高版本。FastAPI 服务端需要 Python 3.10 或更高版本。香橙派应已安装项目到 `/opt/mambo-k12-ai-robot`，并已配置手势、唤醒词和设备代理服务。

不要把 SSH 密码、`DEVICE_AUTH_TOKEN`、`ADMIN_API_TOKEN` 或语音服务密钥写入本文档、命令历史共享文件或 Git。

## 一、启动 Windows 服务端

### 1. 如需设备网关或 API，启动 FastAPI

首次启动前，在 Git 工作区创建 Python 环境、安装依赖并配置 `.env`。`.env` 至少需要设备和管理令牌；使用语音能力时还要配置百度语音密钥。完成准备后，在 PowerShell 执行：

```powershell
Set-Location 'E:\Orange pi System\mambo-k12-ai-robot-online-preview-source'
.\scripts\start-server.ps1
```

该窗口会持续运行。另开一个 PowerShell 检查：

```powershell
curl.exe -sS http://127.0.0.1:8000/api/v1/health
```

能返回健康状态即表示 API 已启动。OpenAPI 页面为 `http://127.0.0.1:8000/docs`。

### 2. 检查 Web 端口

先确认端口占用，不要为了“重新启动”而停止 `3001`：

```powershell
Get-NetTCPConnection -LocalPort 3001,3002,3003 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

端口含义：

| 端口 | 服务 | 操作原则 |
| --- | --- | --- |
| `3001` | 用户自己的 `next dev` | 保持运行，不参与 Kiosk 链路。 |
| `3002` | 面向香橙派的 Windows 转发代理 | 上游必须指向 `3003`。 |
| `3003` | Next.js 生产页面 | Kiosk 实际使用的 Web 服务。 |

### 3. 启动或更新 Next.js 生产页面

在生产构建副本中执行。首次启动或页面代码更新后都必须构建；本项目含自定义 Webpack 配置，因此必须带 `--webpack`：

```powershell
Set-Location 'E:\Orange pi System\tmp\mambo-k12-board-production-full-20260727'
npm run build --workspace apps/web -- --webpack
npm run start --workspace apps/web -- --hostname 0.0.0.0 --port 3003
```

最后一条命令会占用当前窗口。端口已被已有生产服务占用时，不要直接再启动第二个实例；先确认拥有该端口的进程，再通过原有终端或进程管理方式重启它。

在另一个 PowerShell 验证：

```powershell
curl.exe -sS -o NUL -w "%{http_code}" http://127.0.0.1:3003/robot
```

预期输出为 `200`。

### 4. 启动 Windows 转发代理

当前转发脚本位于 Windows 的临时运行目录，启动前先确认文件存在：

```powershell
Test-Path 'E:\Orange pi System\tmp\codex-loopback-proxy.cjs'
```

若 `3002` 没有监听，在独立 PowerShell 中启动它，并明确把上游指定为 `3003`：

```powershell
$env:CODEX_LOOPBACK_TARGET_PORT = '3003'
node 'E:\Orange pi System\tmp\codex-loopback-proxy.cjs'
```

验证本机和局域网入口：

```powershell
curl.exe -sS -o NUL -w "%{http_code}" http://127.0.0.1:3002/robot
curl.exe -sS -o NUL -w "%{http_code}" http://192.168.1.18:3002/robot
```

两次都应返回 `200`。此脚本不在 Git 工作区内，是当前演示链路的一部分；长期部署前应将其替换为受版本控制的服务。

## 二、启动香橙派硬件端

从 Windows 连接香橙派：

```powershell
ssh orangepi@192.168.1.26
```

### 1. 启动后台硬件服务

在香橙派 SSH 会话中执行：

```bash
systemctl --user start mambo-hand-vision.service
systemctl --user start mambo-wakeword.service
sudo systemctl start mambo-device-agent.service
```

确认服务状态：

```bash
systemctl --user is-active mambo-hand-vision.service
systemctl --user is-active mambo-wakeword.service
sudo systemctl is-active mambo-device-agent.service
```

预期都返回 `active`。其中设备代理负责设备网关与状态上报；手势和唤醒词服务负责页面交互。它们都不会自动打开 Kiosk 页面。

### 2. 打开机器人 Kiosk 页面

在 `orangepi` 用户会话中执行以下命令。WebKit 会全屏显示 `/robot`；如 `3010` 尚未运行，启动脚本会自动启动香橙派本地代理。

```bash
nohup env \
  ROBOT_URL=http://127.0.0.1:3010/robot \
  ROBOT_BROWSER=webkit \
  ROBOT_LOCAL_PROXY=1 \
  ROBOT_PROXY_UPSTREAM=http://192.168.1.18:3002 \
  DISPLAY=:0 \
  XAUTHORITY=/home/orangepi/.Xauthority \
  /opt/mambo-k12-ai-robot/deploy/launch-robot-browser.sh \
  >/tmp/mambo-robot-browser.log 2>&1 </dev/null &
```

页面应从桌面切换为全屏机器人界面。启动后验证：

```bash
pgrep -af 'launch-robot-webkit.py|local-web-proxy.py|mambo-hand-vision.py|wakeword-daemon.py'
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/robot
curl -sS http://127.0.0.1:3010/_mambo/hand/status
```

预期：`/robot` 返回 `200`，手势状态中包含 `"status":"running"`。`3010` 只监听香橙派本机，因此在 Windows 访问 `192.168.1.26:3010` 失败是正常的。

## 三、更新页面后的最短流程

1. 将运行时改动同步到 Windows 生产构建副本。
2. 在生产构建副本重新执行 `npm run build --workspace apps/web -- --webpack`。
3. 重启 `3003` 的生产页面进程，确认 `http://127.0.0.1:3003/robot` 返回 `200`。
4. 保持 `3002`、`mambo-hand-vision.service`、`mambo-wakeword.service` 继续运行。
5. 在香橙派只重启 WebKit 页面进程，再执行上面的 Kiosk 启动命令。

不要让香橙派上游指向 `next dev` 或端口 `3001`。本地代理不会转发 HMR WebSocket，会导致页面反复刷新、界面组件闪烁，并可能使语音或手势初始化失败。

## 四、快速排查

| 现象 | 首先检查 |
| --- | --- |
| 香橙派停在桌面 | 执行 Kiosk 启动命令；设备代理不会打开浏览器。 |
| 香橙派页面无法打开 | Windows 上依次检查 `3003/robot`、`3002/robot`，再检查香橙派 `3010/robot`。 |
| `3002` 返回 `502` | 检查 `3003` 是否监听，以及代理是否设置了 `CODEX_LOOPBACK_TARGET_PORT=3003`。 |
| 页面闪烁或服务反复初始化 | 确认没有把 Kiosk 上游接到 `3001` 或 `next dev`。 |
| 手势无效 | 检查 `mambo-hand-vision.service` 是否为 `active`，并读取 `/_mambo/hand/status`。 |
| 语音无效 | 检查 `mambo-wakeword.service`、浏览器日志 `/tmp/mambo-robot-browser.log` 和所需密钥配置。 |

更完整的端口、部署、手势和硬件连接记录见 [香橙派机器人运行交接](handoff/2026-07-27-orangepi-robot-runtime.md)。
