# 香橙派硬件命令闭环设计

## 1. 设计目标

本设计在现有香橙派 WebSocket 设备代理基础上，将设备能力从 `ping` 和
`get_status` 扩展为一个小而安全的硬件命令闭环。服务端可以要求开发板拍照、
展示教学资源、播放音频和控制屏幕；设备执行后返回结构化结果，并由现有命令
接口持久化。

本设计遵循 `docs/product-technical-design.md` 中确定的总体架构：

- 网页和 Core API 仍是主产品及唯一业务真源。
- 香橙派是语音、视觉、屏幕和硬件交互终端。
- 设备只执行版本化、白名单化的高层教学动作。
- 设备绝不执行模型生成的 Shell 或任意命令。

## 2. 当前基础

仓库与真实开发板已经具备：

- 带鉴权的设备 WebSocket 长连接；
- 心跳、状态上报、断线重连和 systemd 进程守护；
- 服务端设备、状态、命令及学习数据持久化；
- `ping` 和 `get_status` 命令往返；
- 位于 `/dev/video0` 的可用 USB V4L2 摄像头；
- 可用的 `ffmpeg`、`mpv` 和 X11 显示会话 `:0`；
- 可用的 ALSA 录音及播放设备；
- 可用的 `/dev/vipcore` NPU 运行时。

Windows Core API 与 `orangepi4pro-dev-01` 的当前连接已经通过真实的
服务端到设备 `ping` 命令验证。

## 3. 本轮范围

### 3.1 实现目标

新增以下设备命令：

| 命令 | 作用 |
|---|---|
| `capture_snapshot` | 摄像头预热后拍摄一张 JPEG，保存到受管媒体目录并返回元数据。 |
| `show_artifact` | 全屏显示受管本地图片、视频或获准的 HTTP(S) 资源。 |
| `stop_artifact` | 仅停止由设备代理启动的教学资源播放器。 |
| `play_audio` | 播放受管本地音频或获准的 HTTP(S) 音频。 |
| `stop_audio` | 仅停止由设备代理启动的音频播放器。 |
| `set_display_mode` | 唤醒屏幕、进入常亮演示模式或关闭屏幕。 |

同时完成：

- 在 `hello` 消息中上报实际检测到的摄像头、显示器、音频、NPU 和工具能力；
- 在状态上报中加入硬件可用性和播放器运行状态；
- 服务端与设备端双重校验命令参数；
- 为每种命令设置超时并返回结构化错误；
- 在设备代理进程生命周期内，对重复 `command_id` 实现幂等；
- 更新协议文档、部署配置和自动化测试；
- 部署到真实开发板，并通过服务端 API 验证全部命令。

### 3.2 本轮不实现

本轮不包含：

- 手势识别、手部追踪或指针事件；
- ASR、TTS 生成、唤醒词或麦克风流式传输；
- 机器人专用 Kiosk 网页或浏览器安装；
- 媒体上传到对象存储；
- 任意本地路径、任意程序或远程 Shell；
- 在开发板上直接渲染 PowerPoint；
- 自定义 NPU 模型转换或 YOLO 运行依赖修复。

PPT、DOCX、绘本和视频在服务端生成或由后台上传。开发板只消费已经完成的
图片、视频、HTML 页面和音频资源。

## 4. 总体架构

```text
FastAPI 命令 API
  -> 经过校验的白名单命令
  -> 带鉴权的设备 WebSocket
  -> DeviceCommandDispatcher
       -> CameraAdapter
       -> ArtifactPlayer
       -> AudioPlayer
       -> DisplayAdapter
       -> CapabilityDetector
  -> 结构化 command_result
  -> 持久化 CommandRecord
```

`device/agent.py` 只负责连接生命周期、消息分发、定时状态上报和结果发送。
硬件操作拆分到 `device/hardware/` 下的专用模块：

```text
device/
  agent.py
  commands.py              命令名、设备端参数校验和错误模型
  hardware/
    capabilities.py        工具和设备节点探测
    camera.py              V4L2/ffmpeg 拍照适配器
    media.py               由代理持有的 mpv 图片、视频和音频进程
    display.py             X11 显示与 DPMS 控制
    process.py             安全参数执行、超时和进程清理
```

硬件适配器不接受 Shell 命令字符串。所有外部程序均以参数数组和
`shell=False` 启动。

## 5. 设备配置

现有环境文件新增：

```text
MEDIA_ROOT=/home/orangepi/.local/share/mambo/media
CAMERA_DEVICE=/dev/video0
CAMERA_WIDTH=1920
CAMERA_HEIGHT=1080
CAMERA_FPS=30
CAMERA_WARMUP_FRAMES=120
DISPLAY_NAME=:0
XAUTHORITY_PATH=/home/orangepi/.Xauthority
MEDIA_ALLOWED_HOSTS=192.168.1.18
COMMAND_TIMEOUT_SECONDS=30
```

配置约束：

- 代理负责创建 `MEDIA_ROOT`，其中包含 `snapshots/` 和可选的预置教学资源。
- 本地资源解析真实路径后必须仍位于 `MEDIA_ROOT` 内，防止 `..` 和软链接逃逸。
- 远程资源只能使用 `http` 或 `https`，不能包含 URL 用户名或密码，并且主机名
  必须位于 `MEDIA_ALLOWED_HOSTS`。
- 密钥仍保存在现有环境文件中，不能出现在能力上报或命令结果内。

## 6. 命令协议

所有命令继续使用现有消息信封和 `command_id`。命令结果统一增加
`duration_ms`，失败时使用稳定错误码。

### 6.1 `capture_snapshot`

第一版参数固定为空：

```json
{}
```

服务端不能指定设备路径、输出路径或 ffmpeg 参数。设备使用配置的摄像头，
持续采集到预热帧数后保存一张 JPEG，文件路径为：

```text
MEDIA_ROOT/snapshots/<command_id>.jpg
```

成功结果示例：

```json
{
  "command_id": "...",
  "ok": true,
  "duration_ms": 4300,
  "snapshot": {
    "path": "/home/orangepi/.local/share/mambo/media/snapshots/<id>.jpg",
    "content_type": "image/jpeg",
    "width": 1920,
    "height": 1080,
    "size_bytes": 123456,
    "captured_at": "2026-07-18T00:00:00Z"
  }
}
```

拍照失败时删除临时文件。除同一 `command_id` 的幂等重放外，不覆盖已有文件。

### 6.2 `show_artifact`

参数示例：

```json
{
  "source": "https://allowed-host/path/image.jpg",
  "media_type": "image"
}
```

`media_type` 只能是 `image` 或 `video`。图片持续显示到被替换或停止；视频默认
播放一次。内容使用配置的 X11 会话全屏显示。启动新内容时，只停止设备代理
自己持有的上一个教学资源播放器。

### 6.3 `stop_artifact`

参数为空。没有资源正在播放时也返回成功，因此命令可以安全重试。

### 6.4 `play_audio`

参数示例：

```json
{
  "source": "https://allowed-host/path/narration.mp3",
  "volume": 80
}
```

`volume` 可省略，允许范围为 `0..100`。新音频会替换设备代理持有的旧音频，
但不会修改系统混音器音量。

### 6.5 `stop_audio`

参数为空。没有音频正在播放时也返回成功。

### 6.6 `set_display_mode`

参数示例：

```json
{"mode": "presentation"}
```

支持三种模式：

- `on`：强制唤醒屏幕；
- `presentation`：强制唤醒屏幕，并在当前桌面会话中关闭屏保和 DPMS 自动熄屏；
- `off`：通过 DPMS 关闭屏幕。

该命令不修改启动配置，也不需要 `sudo`。

## 7. 能力与状态上报

`hello.payload` 保留 `agent_version`、`platform` 和 `capabilities`，并新增
`hardware`：

```json
{
  "camera": {"available": true, "device": "/dev/video0"},
  "display": {"available": true, "name": ":0"},
  "audio_playback": {"available": true},
  "audio_capture": {"available": true},
  "npu": {"available": true, "device": "/dev/vipcore"},
  "tools": {"ffmpeg": true, "mpv": true, "xset": true}
}
```

状态上报只增加少量运行信息：

```json
{
  "hardware": {"camera_available": true, "display_available": true},
  "players": {"artifact_active": false, "audio_active": false}
}
```

设备不会上报连续摄像头画面、麦克风采样、本地目录列表或环境变量。

## 8. 执行、幂等与错误处理

命令分发器按 `command_id` 缓存最近 128 个结果。同一代理进程内收到重复命令时，
直接重放缓存结果，不再次操作硬件。

硬件操作受 `COMMAND_TIMEOUT_SECONDS` 限制。由代理启动的子进程使用独立进程组。
停止、替换、超时或代理退出时，先请求正常结束，短暂等待后再强制终止。

稳定错误码如下：

| 错误码 | 含义 |
|---|---|
| `unsupported_command` | 命令不在设备白名单中。 |
| `invalid_arguments` | 参数类型、枚举、范围或额外字段不合法。 |
| `source_not_allowed` | URL 协议、主机或本地路径不符合策略。 |
| `tool_unavailable` | 缺少所需外部工具。 |
| `device_unavailable` | 摄像头、显示器或音频设备不可用。 |
| `command_timeout` | 操作超过规定时间。 |
| `capture_failed` | ffmpeg 失败或没有生成有效 JPEG。 |
| `playback_failed` | mpv 启动失败或立即异常退出。 |
| `display_failed` | X11 或 DPMS 控制失败。 |
| `internal_error` | 未预期错误，向服务端返回经过清理的说明。 |

命令结果不能包含令牌、完整环境变量、任意命令输出或堆栈。详细诊断只写入
开发板本地 systemd 日志。

## 9. 服务端改动

服务端扩展命令名白名单。每种命令使用独立 Pydantic 参数模型，并设置
`extra="forbid"`。API 在持久化和下发前使用规范化后的参数。

命令状态新增 `timed_out`，与产品设计保持一致。硬件操作自身超时时，设备返回
`command_timeout` 并将命令记为失败。对于设备断线或回执丢失造成的长期 `sent`，
服务端超时协调逻辑在截止时间后将其标记为 `timed_out`。迟到回执只写审计日志，
不能覆盖已经形成的终态。

数据库结构通过新的 Alembic 迁移升级，现有命令记录继续有效。

## 10. 数据流程

### 10.1 拍照并显示

```text
管理端/测试客户端 -> POST capture_snapshot
Core API -> WebSocket command
设备代理 -> 参数校验 -> CameraAdapter -> JPEG
设备代理 -> command_result（照片元数据）
Core API -> 持久化完成结果
管理端/测试客户端 -> POST show_artifact（本地照片路径）
设备代理 -> 校验受管路径 -> ArtifactPlayer
设备代理 -> command_result（播放器状态）
```

### 10.2 远程教学资源

```text
Core API -> show_artifact/play_audio（获准的短期 URL）
设备代理 -> 校验协议和主机
mpv -> 获取并播放资源
设备代理 -> 返回启动结果
```

命令结果只证明播放已经启动，不代表学生完整观看。播放完成和学习进度事件属于
后续 Kiosk 与统一学习会话设计。

## 11. 测试设计

### 11.1 自动化测试

- 命令 Schema 接受全部合法命令，拒绝额外字段、错误枚举、越界音量和未知命令；
- 资源策略允许受管文件和配置主机，拒绝路径穿越、软链接逃逸、URL 凭据及未知主机；
- 使用假进程执行器核对完整参数数组，不在单元测试中调用真实硬件工具；
- 摄像头适配器测试预热帧、原子写入、超时和失败清理；
- 媒体适配器测试替换、重复停止和所属进程清理；
- 显示适配器测试三种模式和清理后的错误结果；
- 分发器测试重复 `command_id` 只重放结果；
- 网关测试每类命令的下发和结果持久化；
- 超时测试覆盖 `sent -> timed_out` 及迟到结果不覆盖终态；
- 现有学习和设备测试继续通过。

### 11.2 真实开发板验收

以下操作全部从 Windows Core API 发起，不在 SSH 中手动调用硬件程序：

1. `get_status` 返回真实开发板和检测到的硬件能力。
2. `set_display_mode(presentation)` 唤醒屏幕并关闭自动熄屏。
3. `capture_snapshot` 在预热后生成非空的 1920x1080 JPEG。
4. `show_artifact` 将该照片全屏显示。
5. `stop_artifact` 返回桌面，重复调用仍成功。
6. `play_audio` 播放已知本地音频或服务端音频。
7. `stop_audio` 停止音频，重复调用仍成功。
8. 非法路径、主机、参数和命令名均被拒绝。
9. 服务端断开并恢复后，设备在现有最大 30 秒退避周期内重新上线。
10. 部署并重启后，systemd 显示设备代理处于 active 状态。

每项验收都检查服务端持久化命令记录和开发板日志。摄像头与屏幕结果还需要
进行实际画面检查。

## 12. 部署方案

部署只更新仓库文件和设备环境配置，保留现有私密令牌且不打印令牌内容。

执行顺序：

1. 运行完整本地测试；
2. 将变更后的设备文件同步到 `/opt/mambo-k12-ai-robot`；
3. 在保留现有密钥的前提下更新 `/etc/mambo/device-agent.env` 中的非敏感配置；
4. 重启 `mambo-device-agent.service`；
5. 检查服务状态和近期日志；
6. 通过 Core API 执行真实开发板验收流程。

需要 `sudo` 的操作必须在执行前获得用户明确确认。部署不执行 `reboot`、
`shutdown`、递归删除或任意远程 Shell。

## 13. 后续手势、语音与 Kiosk 接入

后续机器人网页是专门为 800x480 屏幕设计的精简 Kiosk 界面，不是桌面端学习
工作台的缩小版。

手势识别作为本地输入模块运行，只产生规范化事件：

```text
pointer_move(x, y, confidence)
click_progress(progress)
click_confirmed(x, y)
tracking_lost
```

张开手掌时移动光标；握拳时开始悬停确认并显示圆形进度；达到阈值后只产生一次
点击。重新张手或跟踪丢失会取消进度。语音负责提问和语义命令，手势负责本地
导航和确认。

这些事件只作用于 Kiosk 页面，不作为具有权限的设备命令上传。这样可以把存在
抖动和误识别的视觉输入，与服务端授权的摄像头、显示和音频操作隔离。

## 14. 完成定义

只有同时满足以下条件，本轮硬件闭环才算完成：

- 所有自动化测试通过；
- 新协议和环境配置已写入文档；
- 部署后的开发板如实上报硬件能力；
- 每个白名单硬件命令都能通过服务端 API 完成；
- 命令结果和失败被持久化，且不泄露密钥；
- 非法资源和畸形参数被拒绝；
- 服务由 systemd 守护并能断线重连；
- 未经用户明确授权，不执行 `sudo`、重启、关机或破坏性操作。
