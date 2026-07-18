# 香橙派硬件命令闭环实施计划

> **给执行代理的要求：** 必须按任务逐项执行。推荐使用 `superpowers:subagent-driven-development`，也可以使用 `superpowers:executing-plans` 在当前会话分批执行。每个任务都要先写失败测试，再写最小实现，完成后运行指定验证命令。

**目标：** 将现有只支持 `ping/get_status` 的香橙派设备代理扩展为可通过服务端控制拍照、媒体显示、音频播放和屏幕模式的安全硬件闭环。

**架构：** FastAPI 继续负责命令校验、持久化、超时状态和 WebSocket 下发；香橙派 `device-agent` 负责连接、分发和结果回执；摄像头、媒体、音频、X11 显示和能力探测分别放在独立适配器中。外部程序只通过参数数组启动，禁止 Shell 字符串执行。

**技术栈：** Python 3.10+、FastAPI、Pydantic、SQLAlchemy/Alembic、asyncio、websockets、ffmpeg、mpv、xset、pytest。

---

## 文件结构

本次修改的职责边界如下：

- `server/app/protocol.py`：服务端命令名称、参数模型、命令状态类型。
- `server/app/models.py`：命令截止时间字段。
- `server/app/repositories.py`：创建、完成、超时和迟到回执规则。
- `server/app/routes/devices.py`：命令参数规范化和服务端下发。
- `server/app/config.py`：命令默认超时配置。
- `server/migrations/versions/8f3c6e5d1a2b_device_command_deadlines.py`：新增 `expires_at` 字段。
- `device/commands.py`：设备端命令集合、轻量参数校验和错误模型。
- `device/hardware/process.py`：安全 argv 执行、超时、进程组和清理。
- `device/hardware/capabilities.py`：设备节点、工具和 X11 能力探测。
- `device/hardware/camera.py`：摄像头预热和 JPEG 原子写入。
- `device/hardware/media.py`：由代理持有的图片、视频和音频播放器。
- `device/hardware/display.py`：`xset` 屏幕唤醒、DPMS 和屏保控制。
- `device/agent.py`：配置、状态字段、命令分发、结果缓存和适配器组装。
- `device/tests/`：设备端参数、策略、适配器和分发器测试。
- `server/tests/`：服务端命令校验、超时、迟到回执和网关测试。
- `docs/protocol.md`、`README.md`、`deploy/device-agent.env.example`：协议、启动和配置文档。
- `scripts/verify-device-loop.ps1`：通过 Core API 执行真实板端验收，不打印密钥。

---

### 任务 1：扩展命令契约并先建立失败测试

**文件：**

- 修改：`server/app/protocol.py`
- 创建：`device/commands.py`
- 创建：`server/tests/test_protocol.py`
- 创建：`device/tests/test_commands.py`

- [ ] **步骤 1：写服务端契约失败测试**

在 `server/tests/test_protocol.py` 添加测试，验证以下行为：

```python
def test_command_request_accepts_hardware_commands() -> None:
    request = CommandRequest(
        name="play_audio",
        arguments={"source": "https://media.example.test/a.mp3", "volume": 80},
    )
    assert request.name == "play_audio"
    assert request.arguments["volume"] == 80


def test_command_request_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        CommandRequest(
            name="set_display_mode",
            arguments={"mode": "presentation", "extra": True},
        )


def test_command_request_rejects_invalid_volume_and_source() -> None:
    with pytest.raises(ValidationError):
        CommandRequest(
            name="play_audio",
            arguments={"source": "ftp://media.example.test/a.mp3", "volume": 101},
        )
```

- [ ] **步骤 2：写设备端命令测试**

验证设备端允许 `ping`、`get_status`、`capture_snapshot`、`show_artifact`、
`stop_artifact`、`play_audio`、`stop_audio` 和 `set_display_mode`，并拒绝未知命令、
多余参数、无效媒体类型和不在 `0..100` 的音量。

- [ ] **步骤 3：运行失败测试**

运行：

```powershell
.\.venv\Scripts\python.exe -m pytest server/tests/test_protocol.py device/tests/test_commands.py -q
```

预期：新增测试因命令模型和设备校验尚未实现而失败。

- [ ] **步骤 4：实现契约**

在 `server/app/protocol.py` 中把 `CommandRequest.name` 扩展为八个命令，并为每个
命令定义参数模型：

```python
HARDWARE_COMMANDS = {
    "capture_snapshot",
    "show_artifact",
    "stop_artifact",
    "play_audio",
    "stop_audio",
    "set_display_mode",
}
```

参数模型必须拒绝额外字段；`show_artifact` 的 `media_type` 只允许 `image/video`；
`play_audio.volume` 的范围为 `0..100`；`set_display_mode.mode` 只允许
`on/presentation/off`。在 `device/commands.py` 实现不依赖 Pydantic 的同等校验，
使开发板端可以只安装 `device/requirements.txt`。

- [ ] **步骤 5：运行测试并提交**

```powershell
.\.venv\Scripts\python.exe -m pytest server/tests/test_protocol.py device/tests/test_commands.py -q
git add server/app/protocol.py device/commands.py server/tests/test_protocol.py device/tests/test_commands.py
git commit -m "feat: define hardware command contracts"
```

预期：新增契约测试全部通过。

### 任务 2：增加服务端命令截止时间和终态保护

**文件：**

- 修改：`server/app/models.py`
- 修改：`server/app/repositories.py`
- 修改：`server/app/routes/devices.py`
- 修改：`server/app/config.py`
- 创建：`server/migrations/versions/8f3c6e5d1a2b_device_command_deadlines.py`
- 修改：`server/tests/test_gateway.py`

- [ ] **步骤 1：先写超时和迟到回执测试**

在网关测试中创建一个已经过期的 `sent` 命令，验证查询或协调逻辑将其标记为
`timed_out`；再发送同一命令的迟到 `command_result`，验证状态仍为 `timed_out`。
新增测试还要验证所有新命令可以通过 `/api/v1/devices/{device_id}/commands` 下发。

- [ ] **步骤 2：运行指定失败测试**

```powershell
.\.venv\Scripts\python.exe -m pytest server/tests/test_gateway.py -q
```

预期：当前状态模型没有 `expires_at` 和 `timed_out` 支持，新增测试失败。

- [ ] **步骤 3：实现数据库字段和迁移**

在 `DeviceCommand` 增加：

```python
expires_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), nullable=False, index=True
)
```

迁移文件为 `8f3c6e5d1a2b_device_command_deadlines.py`，升级时为已有命令填充
`created_at + 30 seconds`，再创建非空索引字段；降级时删除该字段。`CommandRecord.state`
增加 `timed_out`。

- [ ] **步骤 4：实现命令终态保护**

`create_command` 使用 `settings.command_timeout_seconds` 计算截止时间；完成函数只
允许 `sent` 状态转为 `completed/failed`，不得覆盖 `timed_out` 或已有终态。增加
`expire_stale_commands` 查询过期的 `sent` 记录并写入：

```json
{"ok": false, "error": "command_timeout", "source": "server"}
```

在读取命令和设备命令历史前调用一次该协调函数，保证开发阶段即使没有后台任务也能
观察到正确终态。

- [ ] **步骤 5：运行迁移、测试并提交**

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest server/tests/test_gateway.py -q
git add server/app/models.py server/app/repositories.py server/app/routes/devices.py server/app/config.py server/migrations/versions/8f3c6e5d1a2b_device_command_deadlines.py server/tests/test_gateway.py
git commit -m "feat: protect device commands with deadlines"
```

预期：迁移成功，过期命令测试通过，迟到结果不能改写终态。

### 任务 3：实现安全进程执行和资源来源策略

**文件：**

- 创建：`device/hardware/process.py`
- 创建：`device/hardware/__init__.py`
- 修改：`device/commands.py`
- 创建：`device/tests/test_process.py`

- [ ] **步骤 1：写来源策略和进程测试**

测试必须覆盖：

- `/home/orangepi/.local/share/mambo/media/a.jpg` 允许；
- `MEDIA_ROOT/../.ssh/id_ed25519` 拒绝；
- 指向媒体目录外文件的软链接拒绝；
- `https://allowed.example/a.mp3` 允许；
- `ftp://...`、带用户名密码的 URL 和未知主机拒绝；
- 假执行器收到 `list[str]` 参数，且 `shell` 永远为 `False`；
- 超时后先终止进程组，再返回 `command_timeout`。

- [ ] **步骤 2：实现 `ProcessRunner` 和路径策略**

实现以下明确接口：

```python
class ProcessRunner:
    async def run(self, argv: list[str], timeout_seconds: float) -> ProcessResult: ...
    def start_owned(self, argv: list[str]) -> OwnedProcess: ...

def resolve_managed_source(source: str, media_root: Path, allowed_hosts: set[str]) -> str: ...
```

`resolve_managed_source` 返回规范化本地路径或原始远程 URL；不允许空值、控制字符、
路径穿越、软链接逃逸、非 HTTP(S) 协议和 URL 凭据。`start_owned` 保存进程组并提供
`stop()`，只允许停止由当前代理创建的子进程。

- [ ] **步骤 3：运行测试并提交**

```powershell
.\.venv\Scripts\python.exe -m pytest device/tests/test_process.py -q
git add device/hardware/__init__.py device/hardware/process.py device/commands.py device/tests/test_process.py
git commit -m "feat: add safe device process execution"
```

### 任务 4：实现能力探测和摄像头拍照适配器

**文件：**

- 创建：`device/hardware/capabilities.py`
- 创建：`device/hardware/camera.py`
- 创建：`device/tests/test_capabilities.py`
- 创建：`device/tests/test_camera.py`

- [ ] **步骤 1：写能力探测测试**

使用临时目录和假的 `shutil.which` 验证工具探测结果；使用假的 `/dev/video0`、
`/dev/vipcore` 和 `DISPLAY` 环境验证相机、NPU、显示、音频能力字段稳定且不包含
环境变量或目录列表。

- [ ] **步骤 2：写拍照失败测试**

用假进程执行器验证 ffmpeg 参数固定为：

```text
-f v4l2 -input_format mjpeg -video_size 1920x1080
-framerate 30 -i /dev/video0 -vf select=gte(n\,120)
-frames:v 1 -q:v 2 <temporary-file>
```

测试空输出、非 JPEG 输出、超时和进程失败都会删除临时文件并返回稳定错误码。

- [ ] **步骤 3：实现能力探测和 `CameraAdapter`**

能力探测读取配置的设备路径和 `shutil.which`，不调用 `sudo`。拍照适配器只接受
空参数，使用 `MEDIA_ROOT/snapshots/<command_id>.tmp` 写入，再通过 `Path.replace`
原子改名为 `.jpg`，并用图片头和文件大小验证结果。

- [ ] **步骤 4：运行测试并提交**

```powershell
.\.venv\Scripts\python.exe -m pytest device/tests/test_capabilities.py device/tests/test_camera.py -q
git add device/hardware/capabilities.py device/hardware/camera.py device/tests/test_capabilities.py device/tests/test_camera.py
git commit -m "feat: add board capability detection and snapshots"
```

### 任务 5：实现媒体播放器和 X11 显示控制

**文件：**

- 创建：`device/hardware/media.py`
- 创建：`device/hardware/display.py`
- 创建：`device/tests/test_media.py`
- 创建：`device/tests/test_display.py`

- [ ] **步骤 1：写播放器测试**

用假 `start_owned` 验证：图片使用全屏和无限停留参数，视频使用全屏并默认播放一次，
启动新资源会先停止旧资源；音频使用 `--no-video`，音量只允许 `0..100`；重复停止
返回成功且不创建进程。

- [ ] **步骤 2：写显示控制测试**

验证 `on` 调用 `xset dpms force on`，`presentation` 还调用
`xset s off -dpms`，`off` 调用 `xset dpms force off`。任何非零退出都映射为
`display_failed`，不会泄露命令输出。

- [ ] **步骤 3：实现 `ArtifactPlayer`、`AudioPlayer` 和 `DisplayAdapter`**

播放器只接受 `resolve_managed_source` 的结果，环境固定使用 `DISPLAY_NAME` 和
`XAUTHORITY_PATH`。图片、视频和音频进程分别持有，不互相停止；代理退出时统一清理。

- [ ] **步骤 4：运行测试并提交**

```powershell
.\.venv\Scripts\python.exe -m pytest device/tests/test_media.py device/tests/test_display.py -q
git add device/hardware/media.py device/hardware/display.py device/tests/test_media.py device/tests/test_display.py
git commit -m "feat: add board media and display adapters"
```

### 任务 6：接入设备代理、状态和结果缓存

**文件：**

- 修改：`device/agent.py`
- 修改：`device/tests/test_status.py`
- 创建：`device/tests/test_agent_commands.py`

- [ ] **步骤 1：写设备代理分发测试**

用假的 WebSocket 和硬件适配器发送所有新命令，验证结果包含 `command_id`、`ok`、
`duration_ms`，失败结果只含稳定错误码；重复命令 ID 只调用适配器一次并重放第一次
结果；未知命令返回 `unsupported_command`。

- [ ] **步骤 2：扩展 `Settings`**

加入规格中的 `MEDIA_ROOT`、摄像头、显示、XAUTHORITY、允许主机和超时配置，并为
开发板环境提供安全默认值。默认媒体目录为
`/home/orangepi/.local/share/mambo/media`，启动时创建 `snapshots`。

- [ ] **步骤 3：实现 `DeviceCommandDispatcher`**

分发器按命令调用对应适配器，使用 `time.monotonic()` 计算 `duration_ms`，并使用
有序字典保留最近 128 个结果。硬件异常统一转换为设备错误模型，不能让接收循环退出。

- [ ] **步骤 4：扩展 hello 和 status**

`hello.payload.hardware` 使用 `CapabilityDetector` 的结果；`collect_status()` 增加
`hardware` 和 `players`，继续保留 CPU、内存、磁盘和温度字段。

- [ ] **步骤 5：运行设备端完整测试并提交**

```powershell
.\.venv\Scripts\python.exe -m pytest device/tests -q
git add device/agent.py device/tests/test_status.py device/tests/test_agent_commands.py
git commit -m "feat: connect hardware adapters to device agent"
```

### 任务 7：更新文档、环境模板和验收脚本

**文件：**

- 修改：`docs/protocol.md`
- 修改：`README.md`
- 修改：`deploy/device-agent.env.example`
- 创建：`scripts/verify-device-loop.ps1`

- [ ] **步骤 1：补充协议文档**

为每个命令加入参数、成功结果、错误码和资源安全规则，明确设备不会执行远程 Shell。

- [ ] **步骤 2：补充启动文档和环境模板**

写入媒体目录、摄像头、X11、允许主机和超时变量；说明 `MEDIA_ALLOWED_HOSTS` 必须
配置为 Core API 或对象存储实际主机，不能为了方便填写 `*`。

- [ ] **步骤 3：编写 PowerShell 验收脚本**

脚本从当前项目 `.env` 读取 `ADMIN_API_TOKEN` 到内存，不打印令牌；按顺序调用
`get_status`、`set_display_mode`、`capture_snapshot`、`show_artifact`、
`stop_artifact`、`play_audio`、`stop_audio`，轮询命令记录直到完成或超过 35 秒，
只输出设备 ID、命令名、状态、错误码和快照元数据。

- [ ] **步骤 4：运行文档检查并提交**

```powershell
rg -n "capture_snapshot|show_artifact|play_audio|set_display_mode|MEDIA_ROOT" docs README.md deploy scripts
git add docs/protocol.md README.md deploy/device-agent.env.example scripts/verify-device-loop.ps1
git commit -m "docs: document and automate device loop acceptance"
```

### 任务 8：本地回归、部署和真实板端验收

**文件：**

- 使用：`scripts/verify-device-loop.ps1`
- 使用：`deploy/mambo-device-agent.service`
- 使用：`deploy/device-agent.env.example`

- [ ] **步骤 1：运行本地全部测试和迁移**

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest -q
```

预期：所有测试通过，现有学习、设备连接和新增硬件测试均为绿色。

- [ ] **步骤 2：检查部署权限和文件归属**

通过 SSH 只读检查 `/opt/mambo-k12-ai-robot`、systemd 服务和环境文件的归属；
不输出环境文件内容。如果同步或重启需要 `sudo`，在执行前向用户明确说明具体
命令和影响并等待授权。

- [ ] **步骤 3：同步代码并重启代理**

将 `device/`、`pyproject.toml`、部署模板和协议文件同步到开发板，保留现有
`DEVICE_AUTH_TOKEN`。必要时只安装 `device/requirements.txt` 中的依赖，然后重启
`mambo-device-agent.service`。

- [ ] **步骤 4：检查服务日志和能力上报**

确认 systemd 为 `active (running)`，日志出现 `registered as orangepi4pro-dev-01`，
服务端设备列表显示真实 `hardware` 能力，且日志不包含令牌。

- [ ] **步骤 5：运行真实闭环验收**

从 Windows 执行：

```powershell
.\scripts\verify-device-loop.ps1
```

逐项检查服务端命令记录、开发板日志、照片文件非空且为 1920x1080 JPEG、屏幕全屏
显示照片、音频播放/停止，以及重复停止和非法来源的拒绝结果。

- [ ] **步骤 6：提交部署验证记录**

将测试命令、服务端返回状态、设备版本、能力摘要和已知限制写入提交说明或
`docs/evidence/`，不写入令牌、完整 URL 签名或个人隐私媒体。

---

## 计划自检

- 规格中的六个设备命令均由任务 1、4、5、6、8 覆盖。
- 能力上报、状态字段和 systemd 部署由任务 4、6、7、8 覆盖。
- 本地路径、远程 URL、Shell 禁止、超时、幂等和迟到回执由任务 2、3、6 覆盖。
- 自动化测试和真实板端验收由任务 1 至 8 覆盖。
- 手势、语音和 Kiosk 被明确列为后续范围，不会混入本轮实现。
- 计划中没有要求输出密钥，也没有默认执行 `sudo`、重启、关机或递归删除。
