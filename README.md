# Mambo K12 AI Robot

面向 K12 人工智能通识教育的多模态桌面机器人。当前阶段完成了 OrangePi 设备网关和学习业务数据基础，暂不接入 ESP32、传感器与 Knodo。

## 当前能力

- OrangePi 主动建立 WebSocket 长连接，支持认证、心跳、状态上报和自动重连
- 服务端持久化设备、状态历史和命令结果，重启后记录不丢失
- 服务端下发拍照、媒体显示、音频播放和屏幕模式白名单命令，不提供远程 Shell
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

修改 `.env`，至少设置不同的 `DEVICE_AUTH_TOKEN` 和 `ADMIN_API_TOKEN`。本地默认数据库为 `data/mambo.db`。

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
