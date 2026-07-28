# Mambo K12 AI Robot

面向 K12 人工智能通识教育的多模态桌面机器人。当前阶段完成了 OrangePi 设备网关和学习业务数据基础，暂不接入 ESP32、传感器与 Knodo。

## 当前能力

- OrangePi 主动建立 WebSocket 长连接，支持认证、心跳、状态上报和自动重连
- 服务端持久化设备、状态历史和命令结果，重启后记录不丢失
- 服务端下发拍照、媒体显示、音频播放和屏幕模式白名单命令，不提供远程 Shell
- `/robot` 提供 800x480 机器人课堂页：百度 ASR/TTS、文字对话、本地手势光标和握拳确认点击
- 学生档案支持四个学段和兴趣标签
- 课程按学段管理，学习会话会校验学生与课程学段是否匹配
- 持久化对话消息、多模态元数据、练习答案、成绩和反馈
- 开发环境使用 SQLite，生产环境可通过连接串切换 PostgreSQL
- 提供 Alembic 数据库迁移、OpenAPI 文档、Dockerfile 和自动化测试

## 目录

```text
device/                 OrangePi device-agent
server/app/             FastAPI 服务端
server/migrations/      Alembic 数据库迁移
docs/protocol.md        WebSocket 消息协议
docs/architecture.md    架构边界与后续路线
docs/product-technical-design.md  产品与完整技术设计
deploy/                 OrangePi systemd 配置
scripts/                服务端启动脚本
```

## 启动服务端

要求 Python 3.10 或更高版本。

```bash
python -m venv .venv
source .venv/bin/activate          # Linux/macOS
# .venv\Scripts\activate          # Windows PowerShell
pip install -r server/requirements-dev.txt
cp .env.example .env
```

修改 `.env`，至少设置不同的 `DEVICE_AUTH_TOKEN` 和 `ADMIN_API_TOKEN`；机器人语音还需要配置 `BAIDU_APP_ID`、`BAIDU_API_KEY`、`BAIDU_SECRET_KEY`。本地默认数据库为 `data/mambo.db`。真实密钥只写入被忽略的 `.env`，不要写入开发板或 Git。

Windows PowerShell：

```powershell
.\scripts\start-server.ps1
```

Linux：

```bash
./scripts/start-server.sh
```

启动脚本会先执行 `python -m alembic upgrade head`，再启动 API。检查地址：

- 健康检查：`http://127.0.0.1:8000/api/v1/health`
- OpenAPI 页面：`http://127.0.0.1:8000/docs`

## 核心 API

除健康检查和设备 WebSocket 外，以下接口均需管理令牌：

```text
GET    /api/v1/devices
GET    /api/v1/devices/{device_id}
GET    /api/v1/devices/{device_id}/status-history
GET    /api/v1/devices/{device_id}/commands
POST   /api/v1/devices/{device_id}/commands
GET    /api/v1/commands/{command_id}

POST   /api/v1/students
GET    /api/v1/students
GET    /api/v1/students/{student_id}
PATCH  /api/v1/students/{student_id}

POST   /api/v1/courses
GET    /api/v1/courses
GET    /api/v1/courses/{course_id}

POST   /api/v1/learning-sessions
GET    /api/v1/learning-sessions
GET    /api/v1/learning-sessions/{session_id}
POST   /api/v1/learning-sessions/{session_id}/end
GET    /api/v1/learning-sessions/{session_id}/messages
POST   /api/v1/learning-sessions/{session_id}/messages
GET    /api/v1/learning-sessions/{session_id}/attempts
POST   /api/v1/learning-sessions/{session_id}/attempts
```

请求头：

```text
Authorization: Bearer <ADMIN_API_TOKEN>
```

机器人语音接口（供 Web BFF 调用）为 `POST /api/v1/voice/asr` 和 `POST /api/v1/voice/tts`，同样使用管理令牌保护。

## 启动 OrangePi 代理

在开发板上：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r device/requirements.txt

export DEVICE_ID="orangepi4pro-dev-01"
export DEVICE_AUTH_TOKEN="与服务端一致的设备令牌"
export SERVER_WS_URL="ws://<服务端局域网IP>:8000/ws/v1/devices"
python -m device.agent
```

设备端硬件配置包括：

```text
MEDIA_ROOT=/home/orangepi/.local/share/mambo/media
CAMERA_DEVICE=/dev/video0
CAMERA_WIDTH=1920
CAMERA_HEIGHT=1080
CAMERA_FPS=30
CAMERA_WARMUP_FRAMES=120
DISPLAY_NAME=:0
XAUTHORITY_PATH=/home/orangepi/.Xauthority
MEDIA_ALLOWED_HOSTS=<服务端或对象存储主机>
COMMAND_TIMEOUT_SECONDS=30
```

代理启动后会在 `hello` 中上报摄像头、显示器、音频、NPU 和工具能力；拍照文件
默认写入 `MEDIA_ROOT/snapshots`。图片、视频和音频由代理持有的 `mpv` 进程管理。

服务端设备命令的完整参数和错误码见 `docs/protocol.md`。

已经安装 systemd 服务时，开发板开机后会自行连接服务端，无需先 SSH。部署详情见 `deploy/mambo-device-agent.service`。

## 启动机器人 Kiosk 页面

设备代理和机器人页面是两个独立进程：`mambo-device-agent.service` 负责设备
WebSocket、硬件命令和状态上报；`/robot` 由 OrangePi 桌面的 WebKit/Chromium
窗口显示。仅启动代理时，开发板会停留在桌面，这是预期行为。

### 1. 在 Windows 启动可被开发板访问的生产 Web 服务

`/robot` 的上游 Web 服务必须监听局域网地址，不能只绑定 `127.0.0.1`。以下命令
以 Windows 主机 `192.168.1.18` 为例；换网络后应替换为该主机当前的局域网 IPv4
地址：

```powershell
npm run build --workspace apps/web
npm run start --workspace apps/web -- --hostname 0.0.0.0 --port 3001
```

从 OrangePi 验证上游页面：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.1.18:3001/robot
```

预期输出为 `200`。如果 Windows 服务只监听 `127.0.0.1`，开发板无法访问它。
不要将 `next dev` 作为 Kiosk 上游：本地代理不会转发开发服务器的 HMR WebSocket，
会导致页面反复重载、组件闪烁，并使语音和手势初始化无法完成。

### 2. 启动设备代理

安装完成后，设备代理应由 systemd 守护：

```bash
sudo systemctl enable --now mambo-device-agent.service
systemctl is-active mambo-device-agent.service
journalctl -u mambo-device-agent.service -n 40 --no-pager
```

预期状态为 `active`，日志中出现设备注册信息。该服务不会自动打开浏览器页面。

### 3. 启动 OrangePi 页面

在 OrangePi 的 `orangepi` 用户会话中运行。当前板子的 Chromium Snap 已验证为
不可用，因此显式使用 WebKit；脚本会在 `127.0.0.1:3010` 启动本地代理，再由
WebKit 全屏显示页面。

```bash
nohup env \
  ROBOT_URL=http://127.0.0.1:3010/robot \
  ROBOT_BROWSER=webkit \
  ROBOT_LOCAL_PROXY=1 \
  ROBOT_PROXY_UPSTREAM=http://192.168.1.18:3001 \
  DISPLAY=:0 \
  XAUTHORITY=/home/orangepi/.Xauthority \
  /opt/mambo-k12-ai-robot/deploy/launch-robot-browser.sh \
  >/tmp/mambo-robot-browser.log 2>&1 </dev/null &
```

确认页面进程和代理都正常：

```bash
pgrep -af 'launch-robot-webkit.py|local-web-proxy.py'
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/robot
tail -n 40 /tmp/mambo-robot-browser.log
```

预期 WebKit 和 `local-web-proxy.py` 两个进程存在，`3010/robot` 返回 `200`。
HTTP 上游仅用于页面显示验证；摄像头手势应使用 HTTPS，不能为正式部署开启
`ROBOT_ALLOW_INSECURE_CAMERA=1`。

## 数据库

本地默认值：

```text
DATABASE_URL=sqlite+aiosqlite:///./data/mambo.db
AUTO_CREATE_SCHEMA=false
```

生产 PostgreSQL 示例：

```text
DATABASE_URL=postgresql+asyncpg://mambo:password@db:5432/mambo
```

数据库结构只通过迁移升级：

```bash
python -m alembic upgrade head
python -m alembic current
```

`AUTO_CREATE_SCHEMA=true` 仅供隔离测试使用，不应在正式环境开启。

## 测试

```bash
python -m pytest
```

测试覆盖设备连接与断开、状态持久化、命令回执、鉴权、学习记录闭环和学段匹配。

## 安全边界

- 不在仓库、浏览器前端或开发板中存放 Knodo PAT、模型 API Key 或管理令牌。
- 设备端不执行服务端传来的任意命令或脚本。
- 公网部署必须使用 `https://` 和 `wss://`，并为每台设备逐步切换独立凭证。
- 机器人运动控制未来必须经过服务端命令白名单和 ESP32 本地安全约束。
- Knodo 只通过服务端适配器调用；设备端和网页端不直接持有 Knodo 密钥。
