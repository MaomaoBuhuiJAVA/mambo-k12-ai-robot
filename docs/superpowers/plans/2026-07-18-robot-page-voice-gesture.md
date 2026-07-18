# 机器人页面、语音与手势实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 OrangePi 浏览器上提供 800x480 机器人教学页面，打通讯飞 ASR -> 现有 AI -> 讯飞 TTS，并实现张手移动、握拳悬停确认点击的本地交互。

**Architecture:** Next.js 提供 `/robot` 和 BFF，Core FastAPI 负责讯飞 WebSocket、设备命令代理和安全策略，OrangePi 只运行现有 device-agent 与浏览器。连续摄像头帧只在页面本地处理；手势事件不直接拥有硬件命令权限。讯飞凭证只在 Core 环境变量中。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Vitest，FastAPI / Python 3 / websockets，浏览器 MediaStream + Web Audio PCM，OrangePi X11/现有硬件适配器，官方 VIPCore `.nb` 样例。

---

## 文件结构

- 创建 `server/app/voice/xfyun_auth.py`：讯飞 IAT/TTS 签名 URL 生成。
- 创建 `server/app/voice/xfyun_asr.py`：IAT v2 音频流上传、结果解析和超时。
- 创建 `server/app/voice/xfyun_tts.py`：TTS v2 文本合成和音频拼接。
- 创建 `server/app/routes/voice.py`：Core ASR/TTS 内部路由和凭证配置检查。
- 修改 `server/app/config.py`、`server/app/main.py`、`server/requirements.txt`：语音配置与路由。
- 创建 `server/tests/test_voice_auth.py`、`server/tests/test_voice_routes.py`：签名、输入边界和无凭证降级测试。
- 创建 `apps/web/src/app/robot/page.tsx`、`apps/web/src/app/robot/robot.module.css`：机器人页面。
- 创建 `apps/web/src/components/robot/robot-workspace.tsx`、`apps/web/src/components/robot/voice-session.ts`：页面状态和语音流程。
- 创建 `apps/web/src/components/robot/gesture-controller.ts`：光标、握拳进度和点击状态机。
- 创建 `apps/web/src/app/api/voice/asr/route.ts`、`apps/web/src/app/api/voice/tts/route.ts`：BFF 语音代理。
- 创建 `apps/web/src/app/api/device/command/route.ts`：固定命令 BFF。
- 创建对应 Web 测试文件，覆盖页面状态、手势状态机和 BFF 校验。
- 创建 `device/vision/npu_smoke.py`、`scripts/verify-npu-smoke.ps1`：官方 `.nb` 运行链路记录，不把未知模型当作手势实现。
- 修改 `deploy/device-agent.env.example`、README、协议文档和验收脚本。

### Task 1: 讯飞配置与签名

**Files:**
- Create: `server/app/voice/xfyun_auth.py`
- Modify: `server/app/config.py`
- Test: `server/tests/test_voice_auth.py`

- [ ] **Step 1: Write failing signature tests**

测试固定时间、主机、请求行和密钥，断言 IAT/TTS 生成的 `host`、`date`、`authorization` 参数存在且签名可复现；缺失密钥必须返回未配置状态。

- [ ] **Step 2: Run focused tests and verify failure**

Run: `\.venv\Scripts\python.exe -m pytest server/tests/test_voice_auth.py -q`

Expected: FAIL because the voice auth module does not exist.

- [ ] **Step 3: Implement HMAC-SHA256 auth and settings**

实现 RFC1123 UTC 时间、`host date request-line` 拼接和 URL 编码；配置只从 `XFUN_*` 环境变量读取，不在异常中打印值。

- [ ] **Step 4: Run focused tests**

Run: `\.venv\Scripts\python.exe -m pytest server/tests/test_voice_auth.py -q`

- [ ] **Step 5: Commit**

`git add server/app/voice server/app/config.py server/tests/test_voice_auth.py && git commit -m "feat: add xfyun signing configuration"`

### Task 2: Core ASR/TTS 适配器

**Files:**
- Create: `server/app/voice/xfyun_asr.py`
- Create: `server/app/voice/xfyun_tts.py`
- Modify: `server/requirements.txt`
- Test: `server/tests/test_voice_adapters.py`

- [ ] **Step 1: Write adapter tests with fake WebSocket**

覆盖 IAT 首帧、音频帧、结束帧、动态修正结果、TTS 多帧 base64 音频、错误码、超时和最大文本/音频长度。

- [ ] **Step 2: Run tests and verify failure**

Run: `\.venv\Scripts\python.exe -m pytest server/tests/test_voice_adapters.py -q`

- [ ] **Step 3: Implement bounded WebSocket adapters**

使用现有 `websockets` 依赖；IAT 只接受 16-bit mono PCM/WAV，TTS 限制 8000 字节以内，所有连接设置超时并在错误时关闭。解析结果时合并 `ws`/`wpgs` 结果，不能把服务端错误文本当作识别结果。

- [ ] **Step 4: Run adapter tests and commit**

Run: `\.venv\Scripts\python.exe -m pytest server/tests/test_voice_adapters.py -q`

`git add server/app/voice server/requirements.txt server/tests/test_voice_adapters.py && git commit -m "feat: integrate xfyun asr and tts adapters"`

### Task 3: Core 语音路由

**Files:**
- Create: `server/app/routes/voice.py`
- Modify: `server/app/main.py`, `server/app/config.py`
- Test: `server/tests/test_voice_routes.py`

- [ ] **Step 1: Write route contract tests**

覆盖 `POST /api/v1/voice/asr` 的 `audio/wav`、大小/时长边界、认证、无凭证 503；覆盖 TTS JSON 文本、媒体类型和错误映射。

- [ ] **Step 2: Run route tests and verify failure**

Run: `\.venv\Scripts\python.exe -m pytest server/tests/test_voice_routes.py -q`

- [ ] **Step 3: Implement routes**

路由使用 Core 管理令牌保护，读取请求体上限，调用适配器并返回 `{text,duration_ms}` 或 `audio/mpeg`。不得把讯飞响应原文、签名 URL 或密钥返回给客户端。

- [ ] **Step 4: Run server tests and commit**

Run: `\.venv\Scripts\python.exe -m pytest server/tests/test_voice_routes.py server/tests/test_protocol.py -q`

### Task 4: Web BFF 语音与设备命令

**Files:**
- Create: `apps/web/src/app/api/voice/asr/route.ts`
- Create: `apps/web/src/app/api/voice/tts/route.ts`
- Create: `apps/web/src/app/api/device/command/route.ts`
- Modify: `apps/web/src/lib/core-api.ts`
- Test: corresponding `*.test.ts` files

- [ ] **Step 1: Write BFF contract tests**

覆盖 Core 未配置、超时、非 JSON/非音频响应、设备离线、命令白名单、参数边界和管理令牌不出现在响应体。

- [ ] **Step 2: Implement server-only proxy helpers**

扩展 Core client，仅在服务端添加 `Authorization`，统一 3 秒状态请求和 30 秒语音/命令超时，限制响应字节数。

- [ ] **Step 3: Run Web tests and commit**

Run: `npm test --workspace apps/web -- --run src/app/api/voice src/app/api/device/command`

### Task 5: 机器人页面和语音会话

**Files:**
- Create: `apps/web/src/app/robot/page.tsx`
- Create: `apps/web/src/app/robot/robot.module.css`
- Create: `apps/web/src/components/robot/robot-workspace.tsx`
- Create: `apps/web/src/components/robot/voice-session.ts`
- Test: `apps/web/src/components/robot/*.test.tsx`

- [ ] **Step 1: Write state-machine tests**

覆盖 idle/listening/transcribing/thinking/speaking/error 状态、取消和重试；缺少麦克风权限时可回到文字输入。

- [ ] **Step 2: Implement 800x480 layout**

使用现有字体和颜色变量，页面首屏只保留课程标题、对话区、主语音按钮、状态和必要控制；保证 800x480 不滚动遮挡，触控/鼠标按钮尺寸稳定。

- [ ] **Step 3: Implement PCM capture and voice flow**

使用 `getUserMedia` + Web Audio 将输入重采样为 16kHz 16-bit mono WAV，上传 ASR；将文本传给现有 `/api/chat`，答案结束后调用 TTS 并播放 `audio/mpeg`。保留文字输入和降级回答。

- [ ] **Step 4: Run Web tests and build**

Run: `npm test --workspace apps/web -- --run`; `npm run typecheck --workspace apps/web`; `npm run build --workspace apps/web`

### Task 6: 页面内手势光标和确认点击

**Files:**
- Create: `apps/web/src/components/robot/gesture-controller.ts`
- Create: `apps/web/src/components/robot/gesture-controller.test.ts`
- Modify: `apps/web/src/components/robot/robot-workspace.tsx`

- [ ] **Step 1: Write pure gesture state tests**

覆盖 palm move、fist start、progress、confirmed、tracking_lost、confidence threshold、冷却窗口和重复点击保护。

- [ ] **Step 2: Implement normalized event controller**

控制器只接收 `{x,y,gesture,confidence,timestamp}`，输出虚拟光标位置和一次性 click 事件，使用指数平滑和 1200ms 悬停阈值。

- [ ] **Step 3: Connect camera model behind an adapter**

页面相机帧不上传服务器；模型实现通过 adapter 隔离，首版可使用浏览器 WASM/CPU 手部关键点模型。模型加载失败时不显示虚假光标，回退鼠标/键盘。

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test --workspace apps/web -- --run src/components/robot/gesture-controller.test.ts`

### Task 7: X11 鼠标适配和 NPU 冒烟

**Files:**
- Create: `device/hardware/mouse.py`
- Create: `device/vision/npu_smoke.py`
- Create: `scripts/verify-npu-smoke.ps1`
- Modify: `device/requirements.txt`, `deploy/device-agent.env.example`
- Test: `device/tests/test_mouse.py`, `device/tests/test_npu_smoke.py`

- [ ] **Step 1: Add optional XTest backend**

优先使用用户态 Python X11 库；如果板端没有库，保留 `mouse_available=false`，不自动执行 sudo 安装。所有坐标、点击和冷却时间必须受限。

- [ ] **Step 2: Run the official `.nb` sample**

记录 `/opt/yolov5/model/yolov5.nb` 的启动命令、输入尺寸、单帧耗时和错误；不把目标检测结果伪装成手势识别。

- [ ] **Step 3: Evaluate ONNX conversion prerequisites**

检查厂商转换工具、版本、手部模型和输入输出说明。若缺失，只提交评估记录和可插拔接口，不下载来源不明模型。

### Task 8: 部署与端到端验收

**Files:**
- Modify: `deploy/device-agent.env.example`, `README.md`, `docs/protocol.md`, `scripts/verify-device-loop.ps1`
- Create: `scripts/verify-robot-voice.ps1`, `docs/verification/2026-07-18-robot-voice-gesture.md`

- [ ] **Step 1: Run all local checks**

Run: `\.venv\Scripts\python.exe -m pytest -q`; `npm test --workspace apps/web -- --run`; `npm run lint --workspace apps/web`; `npm run typecheck --workspace apps/web`; `npm run build --workspace apps/web`.

- [ ] **Step 2: Configure credentials without printing them**

将讯飞变量写入 Core `.env` 或受保护环境文件，不提交、不通过 SSH 命令回显；缺少凭证时先验证结构化 503。

- [ ] **Step 3: Open `/robot` on OrangePi**

确认 800x480 布局、语音状态、AI 回答和 TTS 扬声器播放；验证设备离线时页面仍能文字对话。

- [ ] **Step 4: Verify gesture and display actions**

确认张手移动、握拳圆圈进度、满进度单击、跟踪丢失取消；再验证拍照、展示和屏幕模式命令。

- [ ] **Step 5: Record limits and commit verification evidence**

记录模型帧率、语音延迟、讯飞错误码、设备版本和已知限制，不写入密钥、完整签名 URL 或个人音频。
