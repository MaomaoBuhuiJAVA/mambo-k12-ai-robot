# Mambo K12 AI 教室功能交接文档

更新时间：2026-07-18
当前分支：`feat/k12-teaching-assistant`
当前可用 Preview：<https://guoke-2y-knowledge-assistant-46k2-54o0go7s0.vercel.app>

这份文档描述当前代码真实可运行的功能边界，供后续前端视觉重设计、比赛演示和部署使用。它不把规划中的账号、教师后台、正式教材 RAG 或公网设备链路写成已完成能力。

## 1. 已交付功能

| 能力 | 页面/接口 | 当前实现 |
| --- | --- | --- |
| 四学段适配 | `/` | 小学低段、小学高段、初中、高中；每个学段有课程、提示、目标和难度策略 |
| 对话问答 | `/`、`POST /api/chat` | Gemini 流式文本回答；按学段和课程生成系统提示；模型异常时返回课程事实降级回答 |
| 图片提问 | `/` | 支持 JPEG/PNG/WebP 单图，图片只附在最后一条学生消息 |
| 语音输入 | `/`、`POST /api/transcribe` | 浏览器 `MediaRecorder` 录音，服务端调用 Gemini 转写；格式、大小和超时有边界 |
| 语音朗读 | `/` | 使用浏览器 `speechSynthesis`，不依赖云端 TTS |
| 教学材料 | `/`、`POST /api/materials/docx`、`POST /api/materials/pptx` | 根据课程固定数据生成真实 DOCX/PPTX 下载；课程资料区提供来源和推荐材料 |
| 动画讲解 | `/` | 冒泡排序、神经网络/图像分类确定性动画；支持播放、暂停、单步、重置和速度切换 |
| 互动绘本 | `/`、`POST /api/storybook` | Zod 结构化绘本；Gemini 可用时生成，失败或未配置时回退种子绘本；支持翻页、朗读、问题和本机保存 |
| 编程实践 | `/lab` | Monaco 编辑器 + Pyodide Worker；冒泡排序和图像分类两个挑战；运行、停止、重置、stdout/错误和确定性检查 |
| 游戏化练习 | `/`、`/progress` | 单选、排序、代码追踪三类题型；即时判分、提示、错题标签、掌握度更新和间隔复习时间 |
| 个性化路径 | `/progress` | 按掌握度、证据数、近期主题、兴趣和复习时间推荐下一课程；记录保存在当前浏览器 |
| 设备状态 | `/`、`GET /api/device` | Web BFF 只读读取 Core API 清洗后的在线状态、能力和最后心跳；设备离线时网页仍可教学 |

## 2. 数据边界

当前学生侧闭环使用浏览器 `localStorage`，键包括：

- `mambo.learning-state`：学段、最近课程、兴趣、练习、知识点掌握度和推荐数据。
- `mambo.conversation.v1.<courseId>`：每门课程最多保存 20 条完整文字对话轮次，并限制总字符数。
- `mambo.storybooks.v1`：本机保存有限数量的绘本版本。

刷新页面可以恢复同一浏览器的文字对话、答题和进度；图片、录音二进制和 Python 源码不做持久化。当前不支持账号登录、跨浏览器、跨设备或跨机器人共享学习档案。

Core API 的学生、课程、学习会话、消息和练习表已经存在，但网页尚未把匿名浏览器状态迁移到 Core 数据库。不要把这些数据库表描述成网页已接入的云端学习档案。

## 3. AI 与 Redis 配置

服务端只读取以下变量，禁止使用 `NEXT_PUBLIC_` 前缀：

```text
GOOGLE_GENERATIVE_AI_API_KEY
GEMINI_MODEL=gemini-3.5-flash
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

兼容旧 Vercel KV 命名：`KV_REST_API_URL` 与 `KV_REST_API_TOKEN`。Vercel 项目当前已存在这组变量，并覆盖 Preview、Production；Redis 缺失或不可达时，AI 路由会 fail closed，返回 503，而不会在多实例环境中退回进程内限流。

当前真实验证结果：新 Preview 的 `/api/chat` 返回 HTTP 200，并渲染 Gemini 生成的回答；此前的 503 根因是 Redis 未注入，之后的 AI 降级根因是 `gemini-2.5-flash` 对新用户不可用，默认模型已改为 `gemini-3.5-flash`。

## 4. OrangePi 与 Core API

拓扑：

```text
浏览器 --HTTPS--> Vercel Next.js BFF --HTTPS + 管理令牌--> FastAPI Core
OrangePi device-agent --WSS + 设备令牌--> FastAPI Core
```

Core API 不是 Vercel Function，必须部署在支持常驻进程和 WebSocket 的主机/容器平台。公网网页要显示真实设备状态，Vercel 需要配置：

```text
CORE_API_URL=https://<Core 公网域名>
CORE_API_ADMIN_TOKEN=<服务端管理令牌>
CORE_DEVICE_ID=orangepi4pro-dev-01
```

OrangePi 侧使用 `deploy/mambo-device-agent.service`，启动命令为 `python -m device.agent`。设备协议只允许 `ping`、`get_status` 等白名单命令，不接受远程 Shell。扬声器、麦克风、摄像头、屏幕和官方 NPU YOLOv5 `.nb` 示例此前已在开发板验证；仓库中的新 agent 能力需要在开发板上重新安装并重启 systemd 后才会生效。

## 5. 本地启动

```powershell
# Core API
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r server/requirements-dev.txt
python -m uvicorn server.app.main:app --host 0.0.0.0 --port 8000

# Web
npm install
npm run dev --workspace apps/web
```

访问 `http://localhost:3000`；Core 健康检查为 `http://127.0.0.1:8000/api/v1/health`。本地未设置 `VERCEL=1` 时使用进程内 AI 限流，适合单实例联调，不适合多实例公网部署。

## 6. 验收命令

```powershell
npm test --workspace apps/web -- --run
npm run lint --workspace apps/web
npm run typecheck --workspace apps/web
npm run build --workspace apps/web
npm run smoke:lab --workspace apps/web
python -m pytest
git diff --check
```

本轮最新 Web 验证为 48 个测试文件、303 项测试通过；ESLint、TypeScript 和生产构建通过。Python Core/device 测试此前为 28 项通过。真实 Gemini、Redis 和 Vercel Preview 已单独手工验证；浏览器视觉、麦克风权限、移动端布局和公网 Core/WSS 仍需要现场验收。

## 7. 明确未交付能力

以下项目不是当前版本的已实现功能，后续可单独立项：

1. 学生登录、教师/管理员 RBAC、家长监护和内容审核后台。
2. 官方教材导入、文档解析、向量/混合检索、强制引用校验和教师审核流。
3. Core 数据库与网页学习状态的匿名迁移、跨浏览器/跨设备同步和删除导出。
4. 网页与机器人共享同一学习会话、网页投屏、机器人 ASR/TTS 接力和视觉事件回写。
5. Vercel Production 替换旧站点、Core 公网 HTTPS/WSS、PostgreSQL/备份/监控和生产域名验收。
6. 自定义视觉模型的 ONNX/浮点/量化精度基线；当前只把官方 NPU `.nb` 示例作为硬件验证依据。

## 8. 前端重设计约束

后续视觉重设计可以替换布局、颜色、导航和组件，但建议保持以下契约不变：

- 页面入口：`/`、`/lab`、`/progress`。
- AI 接口：`POST /api/chat`、`POST /api/transcribe`、`POST /api/storybook`。
- 材料接口：`POST /api/materials/docx`、`POST /api/materials/pptx`。
- 设备接口：`GET /api/device`。
- 学习状态和对话存储键、课程 ID、学段枚举与 `src/data/curriculum.ts` 保持兼容。

视觉重设计完成后，应重新执行第 6 节命令，并对桌面、平板、窄屏、AI 实际回答、绘本生成、下载文件、Pyodide 运行和设备离线降级逐项验收。
