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
- `capture_snapshot`
- `show_artifact`
- `stop_artifact`
- `play_audio`
- `stop_audio`
- `set_display_mode`

任何未知命令都必须返回 `unsupported_command`，不得转交 Shell。

## 硬件命令参数

所有命令都必须带 `command_id`。设备端会缓存最近的结果，同一个命令 ID 在同一
进程内重复到达时只执行一次。

```json
{"name": "capture_snapshot", "arguments": {}}
{"name": "show_artifact", "arguments": {"source": "/home/orangepi/.local/share/mambo/media/snapshots/id.jpg", "media_type": "image"}}
{"name": "play_audio", "arguments": {"source": "https://media.example/audio.mp3", "volume": 80}}
{"name": "set_display_mode", "arguments": {"mode": "presentation"}}
```

`media_type` 只能是 `image` 或 `video`，音量范围为 `0..100`，显示模式只能是
`on`、`presentation` 或 `off`。本地文件必须位于设备 `MEDIA_ROOT` 内；远程资源
只能使用 `http/https` 且主机必须在 `MEDIA_ALLOWED_HOSTS` 中。设备不会执行任意
Shell，也不会返回令牌、环境变量或完整命令输出。

命令结果至少包含：

```json
{"command_id": "...", "ok": true, "duration_ms": 12}
```

失败时使用 `unsupported_command`、`invalid_arguments`、`source_not_allowed`、
`tool_unavailable`、`device_unavailable`、`command_timeout`、`capture_failed`、
`playback_failed` 或 `display_failed` 等稳定错误码。
