# Mambo K12 AI Robot

面向 K12 人工智能通识教育的多模态桌面机器人。当前版本只建立 OrangePi 与服务端之间的安全通信基础，暂不接入 ESP32、传感器和 Knodo。

## 当前能力

- OrangePi 主动建立 WebSocket 长连接，不开放公网入站端口
- 设备令牌认证、上线/离线状态和自动重连
- 心跳、系统状态上报和服务端 ACK
- 服务端查询在线设备和下发安全命令
- 仅支持 `ping`、`get_status`，不支持远程 Shell
- Knodo、ESP32、视觉和音频均通过后续适配器接入

## 目录

```text
device/              OrangePi device-agent
server/              FastAPI 服务端
docs/protocol.md      WebSocket 消息协议
```

## 1. 启动服务端

要求 Python 3.10 或更高版本。

```bash
python -m venv .venv
source .venv/bin/activate          # Linux/macOS
# .venv\Scripts\activate          # Windows PowerShell
pip install -r server/requirements-dev.txt
```

设置两个不同的随机令牌：

```bash
export DEVICE_AUTH_TOKEN="device-token-at-least-16-chars"
export ADMIN_API_TOKEN="admin-token-at-least-16-chars"
```

Windows PowerShell：

```powershell
$env:DEVICE_AUTH_TOKEN="device-token-at-least-16-chars"
$env:ADMIN_API_TOKEN="admin-token-at-least-16-chars"
```

启动：

```bash
uvicorn server.app.main:app --host 0.0.0.0 --port 8000
```

检查：

```bash
curl http://127.0.0.1:8000/api/v1/health
```

## 2. 启动开发板代理

在 OrangePi 上：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r device/requirements.txt

export DEVICE_ID="orangepi4pro-dev-01"
export DEVICE_AUTH_TOKEN="device-token-at-least-16-chars"
export SERVER_WS_URL="ws://<服务端局域网IP>:8000/ws/v1/devices"
python -m device.agent
```

生产环境必须使用 `wss://`、独立设备凭证和反向代理 TLS。共享开发令牌仅用于第一阶段局域网联调。

## 3. 查询设备

```bash
curl http://127.0.0.1:8000/api/v1/devices \
  -H "Authorization: Bearer admin-token-at-least-16-chars"
```

下发安全状态查询命令：

```bash
curl -X POST http://127.0.0.1:8000/api/v1/devices/orangepi4pro-dev-01/commands \
  -H "Authorization: Bearer admin-token-at-least-16-chars" \
  -H "Content-Type: application/json" \
  -d '{"name":"get_status","arguments":{}}'
```

## 4. 测试

```bash
pytest
```

## 5. OrangePi 开机自启

代码部署到 `/opt/mambo-k12-ai-robot` 并创建虚拟环境后：

```bash
sudo mkdir -p /etc/mambo
sudo cp deploy/device-agent.env.example /etc/mambo/device-agent.env
sudo chmod 600 /etc/mambo/device-agent.env
sudo cp deploy/mambo-device-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mambo-device-agent
sudo systemctl status mambo-device-agent
```

启用前必须修改 `/etc/mambo/device-agent.env`。局域网联调可以使用 `ws://<服务端IP>:8000`，公网部署必须使用 `wss://`。

## 安全边界

- 不在仓库、前端或开发板中存放 Knodo PAT、模型 API Key 或管理令牌。
- 设备端不执行服务端传来的任意命令或脚本。
- 机器人运动控制未来必须经过服务端白名单和 ESP32 本地安全约束。
- 当前连接与命令记录保存在内存中，服务重启后清空；数据库将在学习业务阶段加入。
