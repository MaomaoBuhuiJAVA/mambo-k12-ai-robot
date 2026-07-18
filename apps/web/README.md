# Mambo AI 教室 Web

`apps/web` 是比赛原型的学生学习工作台，基于 Next.js App Router、React、Vercel AI SDK 和 Gemini。它直接承载可操作的课程体验，不是营销落地页。

## 页面与能力

| 路径 | 能力 |
|---|---|
| `/` | 四学段、课程路径、流式对话、图片/语音输入、教学画布、动画、绘本、材料与练习 |
| `/lab` | Monaco + Pyodide Python 实验、确定性挑战检查、提示、停止与重置 |
| `/progress` | 本机答题记录、知识点掌握度、兴趣设置、间隔复习与下一课推荐 |
| `/api/chat` | Gemini 流式文字/单图问答 |
| `/api/transcribe` | Gemini 音频转写 |
| `/api/storybook` | 结构化绘本生成，失败或未配置 AI 时回退种子绘本 |
| `/api/materials/docx` | 根据课程数据生成 DOCX；锚点课含来源标签与超链接 |
| `/api/materials/pptx` | 根据课程数据生成 PPTX；锚点课增加参考来源页 |
| `/api/device` | 服务端读取 Core API，向浏览器返回清洗后的只读设备状态 |

当前课程是项目内原创、固定版本的种子数据：四个学段各 2 门，共 8 门。冒泡排序与神经网络/图像分类锚点课另有版本化参考目录，页面展示经核对事实以及 NIST、PyTorch、scikit-learn 来源，提示词要求模型用 `[S#]` 标注受支持事实。这是小规模权威来源 grounding，不是教材选择、文档检索或完整 RAG；教材上传、教师审核后台和任意主题内容生成尚未实现。

## 本地开发

在仓库根目录运行：

```powershell
npm install
Copy-Item apps/web/.env.example apps/web/.env.local
npm run dev --workspace apps/web
```

Linux：

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev --workspace apps/web
```

访问 `http://localhost:3000`。修改环境变量后需要重启开发服务器。

## 环境变量

所有变量都是服务端变量；不要添加 `NEXT_PUBLIC_` 前缀。

| 变量 | 必需条件 | 说明 |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | 使用对话/转写/AI 绘本 | Google Gemini 密钥，仅由 Route Handler 读取 |
| `GEMINI_MODEL` | 可选 | 默认 `gemini-3.5-flash` |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Vercel AI 请求必需，二选一组 | 首选 Redis REST 凭证组 |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | Vercel AI 请求必需，二选一组 | 兼容凭证组；只在首选组不完整时使用完整的本组 |
| `CORE_API_URL` | 可选 | FastAPI Core 根地址；Vercel 环境必须是 HTTPS |
| `CORE_API_ADMIN_TOKEN` | 使用设备状态 | Core 管理令牌，只在服务端 BFF 使用 |
| `CORE_DEVICE_ID` | 可选 | 指定展示的设备；为空时选 Core 返回的第一台设备 |
| `TRUST_PROXY_HEADERS` | 仅自托管本地限流可选 | 设为 `true` 才信任普通 `x-forwarded-for`；Vercel 使用平台转发头和 Redis 限流 |

Vercel 会自动设置 `VERCEL=1`，不要手工伪造。该标记下，`/api/chat`、`/api/transcribe` 和 AI 模式的 `/api/storybook` 必须成功访问 Redis REST；凭证缺失或 Redis 故障时返回 503，而不是退回单实例内存限流。

本地开发未设置 `VERCEL=1` 时使用进程内限流，适合单进程联调，不适合多实例公网部署。

## AI 与媒体约束

- 对话请求体最多 6 MiB；最多一张图片，只允许 JPEG、PNG、WebP，解码后最多 4 MiB，并且只能附在最后一条学生消息上。
- 录音总 multipart 请求最多 9 MiB；音频最多 8 MiB，允许 WebM、Ogg、WAV、MP3、MP4。
- 对话与绘本总路由时限为 90 秒，转写为 60 秒；客户端断开会取消上游请求并释放并发租约。
- 三个交互接口不做 SDK 自动重试，避免 Provider 不可达时重复等待；聊天空流/中断转为明确的课程内降级回答，绘本回退种子版本，转写返回稳定失败码。
- Vercel Redis 限流同时约束客户端分钟/天配额、客户端并发、路由并发和全局并发。
- API 响应使用 `Cache-Control: no-store`，错误码不会返回上游响应或密钥。
- 朗读使用浏览器 `speechSynthesis`，录音使用 `MediaRecorder`；支持程度和可用语音取决于浏览器/操作系统，麦克风需要安全上下文与用户授权。

## Python 实验边界

实验室从固定版本的 jsDelivr 地址加载 Pyodide `314.0.2`。运行时位于 `sandbox="allow-scripts"` 且没有 `allow-same-origin` 的隐藏 iframe 中，再由 Blob Worker 执行；随机通道令牌与消息来源校验隔离主页面，运行时加载后关闭网络能力。单次课程运行上限 5 秒，代码最多 20,000 字符，输出会截断。

这套隔离用于比赛课程练习，并不等价于服务端微虚拟机。客户端挑战结果不可作为正式考试成绩；同一挑战版本只记一次、固定 0.7 权重的形成性证据。

## 本机学习数据

- `mambo.learning-state`：学段、最近课程、兴趣、最多 100 次尝试、最多 200 个知识点记录和推荐数据。
- `mambo.storybooks.v1`：最多 30 个有效绘本版本，每门课最多保留 10 个。
- `mambo.conversation.v1.<courseId>`：按课程保存最多 20 条完整交替文字消息；单条最多 4,000 字符、总计最多 20,000 字符。
- 持久化前会去除答题原文并匿名化档案；损坏、超限或未知知识点数据会被丢弃或回退默认值。
- 对话只保存完成的学生文字/助手文字对；欢迎语、未完成半轮和图片不会保存。录音二进制不保存，但转写文字发送后会作为学生文字进入对话历史。Python 源码不持久化。

清除站点数据会清空学习记录。当前没有账号同步、云端备份、班级共享或跨设备恢复；Core API 的学习表尚未接入这个网页。

## 设备状态适配

浏览器每 18 秒、仅在页面可见且没有前一个请求时调用 `/api/device`。Route Handler 使用 3 秒超时和 `CORE_API_ADMIN_TOKEN` 请求 Core API，只返回设备名、在线状态、最后心跳及白名单能力。管理令牌、完整状态 JSON 和命令接口不会暴露给浏览器。

Core 未配置、离线或响应不合法时，界面显示“网页模式”，教学功能继续可用。网页当前不能下发设备命令，也没有把对话或作品同步到机器人。

## 验证命令

```powershell
npm run test --workspace apps/web -- --run
npm run lint --workspace apps/web
npm run typecheck --workspace apps/web
npm run build --workspace apps/web
npm run smoke:lab --workspace apps/web
```

`smoke:lab` 使用真实 Pyodide 运行两个固定挑战，需要能访问固定 jsDelivr 资源。自动化测试不能替代：真实浏览器权限、麦克风/扬声器、移动端布局、Office 打开生成文件、Vercel/Redis、Core 公网 WSS 和 OrangePi 实机验收。本轮按用户要求未运行浏览器验收。

## Vercel

仓库根目录已有 `vercel.json`。Vercel 项目应以仓库根目录为项目根，安装命令使用 `npm install`，构建命令使用 `npm run build --workspace apps/web`。先配置 Preview 环境变量并验证，再复制到 Production；没有 Redis REST 凭证时 AI 路由会按设计拒绝服务。

完整步骤见 [`docs/deployment/production.md`](../../docs/deployment/production.md)。仓库中没有可证明当前项目已经登录 Vercel、完成 Preview/Production 部署或绑定数据库的状态，因此不能把代码可部署等同于已经上线。
