# Device WebSocket Protocol v1

## Connection

```text
GET /ws/v1/devices/{device_id}
Authorization: Bearer <DEVICE_AUTH_TOKEN>
```

开发阶段允许 `ws://`。部署阶段必须改为 `wss://`。`device_id` 只允许字母、数字、点、下划线和连字符，长度 3 到 64。

连接建立后，设备在 `DEVICE_STALE_AFTER_SECONDS` 内没有发送任何有效消息时，网关以 `4008 device_inactive` 关闭连接并把设备持久化为离线。代理随后按指数退避自动重连。

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

`hello.capabilities` 除 `ping`、`get_status` 外，可由代理根据设备节点声明 `camera`、`audio`、`microphone`、`speaker`、`display` 和 `npu`。声明只表示节点存在，不等同于一次完整功能自检已经通过。

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

## Replay And Bounds

- 每条连接保留最近 256 个 `message_id`。重复状态和命令结果不会再次产生数据库副作用；重复心跳仍会刷新在线状态并返回 ACK。
- 命令进入 `completed` 或 `failed` 后不可被重放结果改写。
- 单条 `payload` JSON 编码后最大 16 KiB，最多 64 个字段或列表项，嵌套深度最大 4，单字符串最大 2048 字符。
- `hello` 最多声明 32 项 capability；名称只允许受限 ASCII 字符，单项最大 64 字符。
- 每台设备只保留最近 1000 条状态历史，避免长期运行导致无界增长。
- 当前去重窗口属于单连接内存状态。跨重连、跨实例的持久化幂等和设备路由属于后续多副本网关范围。

## Close Codes

| Code | Reason |
|---|---|
| `4000` | 设备 ID 非法 |
| `4001` | 设备令牌无效 |
| `4002` | 消息结构或 payload 越界 |
| `4003` | 消息内设备 ID 与连接路径不一致 |
| `4008` | 设备超过空闲时限 |
| `4009` | 同一设备的新连接替换旧连接 |

