# Device WebSocket Protocol v1

## Connection

```text
GET /ws/v1/devices/{device_id}
Authorization: Bearer <DEVICE_AUTH_TOKEN>
```

开发阶段允许 `ws://`。部署阶段必须改为 `wss://`。`device_id` 只允许字母、数字、点、下划线和连字符，长度 3 到 64。

## Envelope

所有消息均为 JSON：

```json
{
  "version": 1,
  "message_id": "UUID",
  "type": "heartbeat",
  "device_id": "orangepi4pro-dev-01",
  "timestamp": "2026-07-17T10:00:00Z",
  "payload": {}
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `version` | 协议版本，当前固定为 `1` |
| `message_id` | 消息唯一 ID，用于追踪和去重 |
| `type` | 消息类型 |
| `device_id` | 设备 ID，必须与连接路径一致 |
| `timestamp` | UTC ISO 8601 时间 |
| `payload` | 消息内容 |

## Device To Server

| 类型 | 说明 |
|---|---|
| `hello` | 代理版本、平台和能力声明 |
| `heartbeat` | 设备保活 |
| `status` | CPU、内存、磁盘、温度等状态 |
| `command_result` | 命令执行结果 |

## Server To Device

| 类型 | 说明 |
|---|---|
| `welcome` | 认证成功和心跳配置 |
| `heartbeat_ack` | 心跳确认 |
| `command` | 白名单命令 |

第一阶段命令白名单：

- `ping`
- `get_status`

任何未知命令都必须返回 `unsupported_command`，不得转交 Shell。

