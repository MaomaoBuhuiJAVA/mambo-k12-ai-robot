# P0 发布验收清单

本清单用于同一个 release commit 的最终验收。命令存在不代表已经运行；每次发布都必须保存新日志并记录 commit、环境、日期和操作者。本轮按用户要求没有执行浏览器验收，因此浏览器、响应式、音频和云端链路仍是待办。

## 1. 记录发布身份

```powershell
git rev-parse HEAD
git status --short
node --version
npm --version
python --version
```

要求：

- 记录完整 commit SHA。
- 工作区没有未解释的代码变更；不要覆盖其他协作者的改动。
- Node.js 20+、Python 3.10+。
- 日志不包含 `.env` 内容、Token、API Key、数据库密码、SSH 私钥或未成年人数据。

## 2. Web 自动化与构建

从仓库根目录运行：

```powershell
npm install
npm run test --workspace apps/web -- --run
npm run lint --workspace apps/web
npm run typecheck --workspace apps/web
npm run build --workspace apps/web
npm run smoke:lab --workspace apps/web
```

Linux 命令相同。

验收：

- 所有命令退出码为 0；测试日志没有 skipped/focused test 被误当通过。
- `next build` 产物不包含原始 `.ts` Python Worker；实验运行时来自 `public/lab-runtime*` 固定 JS 资源。
- `smoke:lab` 使用真实 Pyodide 314.0.2 跑过冒泡排序与图像分类两个挑战；该命令需要访问固定 jsDelivr CDN。
- 构建日志不得输出环境变量值。

若 CDN 不可用，`smoke:lab` 失败必须记录为阻断或外部依赖失败，不能只用 mock 单元测试替代。

`.github/workflows/ci.yml` 应在同一 commit 上完成 Web 与 Core API 两个 job。CI 使用 Node.js 22 跑 tests/lint/typecheck/build/smoke，使用 Python 3.12 跑 `pytest`；保存实际 Actions run URL/ID，不能用“workflow 文件存在”代替通过状态。

## 3. Python Core 与设备测试

Windows：

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Linux：

```bash
.venv/bin/python -m pytest
```

验收：设备连接/断开、状态持久化、命令回执、Bearer 鉴权、学生/课程/会话/消息/答题与学段匹配测试均通过。记录实际通过数量和总耗时，不引用旧日志。

## 4. Git 与敏感信息检查

```powershell
git diff --check
git status --short
git ls-files "*.env" "*.env.*" "*id_rsa*" "*id_ed25519*"
git grep -n -E "AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|BEGIN (OPENSSH|RSA|EC) PRIVATE KEY" -- . ":(exclude)package-lock.json"
```

验收：

- `git diff --check` 无空白错误。
- 只有示例环境文件被跟踪；`.env`、`.env.local` 和私钥不在 Git 中。
- secret pattern 搜索无真实凭证。文档中只出现变量名或 `<...>` 占位说明。
- 检查构建平台日志和 Git 历史，不只检查当前工作树。

任何曾在聊天、截图、终端历史或构建日志暴露的 Key/Token 都应由所有者轮换，即使它没有进入 Git。

## 5. 本地 API smoke

### 5.1 启动

终端 A 启动 Core：

```powershell
$python = (Resolve-Path .\.venv\Scripts\python.exe).Path
& $python -m dotenv -f .env run -- $python -m alembic upgrade head
& $python -m dotenv -f .env run -- $python -m uvicorn server.app.main:app --host 0.0.0.0 --port 8000
```

终端 B 启动 Web：

```powershell
npm run start --workspace apps/web
```

要求先完成 `npm run build`。Linux 的 Core 命令为：

```bash
.venv/bin/python -m dotenv -f .env run -- .venv/bin/python -m alembic upgrade head
.venv/bin/python -m dotenv -f .env run -- .venv/bin/python -m uvicorn server.app.main:app --host 0.0.0.0 --port 8000
```

也可以运行 `scripts/start-server.ps1`（Windows）或 `scripts/start-server.sh`（Linux）；两个本地 helper 会用同一个 `.env` 依次运行 Alembic 和 Uvicorn。容器环境变量仍由平台直接注入。

### 5.2 固定接口

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:3000/api/device
```

验收：

- Core health 返回 `status=ok`。
- 未配置 Core adapter 时 `/api/device` 返回 `unconfigured`；正确配置时只返回 `status/name/online/lastSeenAt/capabilities`，不返回令牌或完整状态。
- Core 不可用时 `/api/device` 仍返回清洗后的 `unavailable`，网页不 500。

### 5.3 Gemini

通过实际页面或受控脚本验证：

1. 文本流首字节和完整结束。
2. 小于 4 MiB 的单张测试图片。
3. 一段无个人信息的短录音。
4. 缺少 Gemini Key 时聊天/转写返回稳定 503，不泄露上游细节。
5. 锚点课提示包含版本化事实/来源，涉及受支持事实的真实回答按指令使用 `[S#]`；记录缺失或错误编号，当前程序不会自动强制拒绝。
6. 绘本在 AI 成功时返回 `source=ai`，失败/无 Key 时返回 `source=seed` 且仍为 4-8 页。

日志只记录结果码、耗时和脱敏 trace，不保存媒体或密钥。本项目当前没有实现正式 trace ID，因此报告中不要虚构。

### 5.4 Office 材料

对至少一门低年级课和一门高中课分别请求 DOCX/PPTX：

- HTTP 200、正确 MIME、`nosniff`、`no-store` 和中文下载名。
- 文件非空，OOXML 压缩包可解析。
- 用真实 Microsoft Word 打开 DOCX，检查中文、标题、目标、讲解、活动、无答案泄漏。
- 用真实 Microsoft PowerPoint 打开 PPTX：无来源课程应为 5 张；锚点课应增加第 6 张参考来源页。检查中文字体、标签/URL 和内容不溢出。
- 用真实 Microsoft Word 打开锚点 DOCX，检查“参考来源”与可点击 URL；无来源课程应明确“项目原创种子课程，尚未绑定正式教材”。

自动化 OOXML 测试不能替代 Office 打开验证。保留生成文件的 hash 和截图，不保存学生信息。

## 6. 浏览器与响应式验收（本轮未执行）

必须在正式发布前补做，不得因为构建/组件测试通过而跳过：

| 视口 | 页面 | 重点 |
|---|---|---|
| 1440x900 | `/`、`/lab`、`/progress` | 三栏密度、教学画布、弹层、长中文、固定控制尺寸 |
| 1024x768 | 同上 | 导航、课程栏、动画、绘本和下载按钮无遮挡 |
| 390x844 | 同上 | 对话/内容/路径切换、底部安全区、按钮文字、横向滚动 |

真实操作流程：

1. 切换四学段与 8 门课程。
2. 文本、图片、录音、朗读和中止流式回答；刷新后恢复完整文字轮次但不恢复图片/未完成半轮。
3. 两类动画的播放、暂停、单步、重置、调速与完成状态。
4. 绘本翻页、问答、保存、回看、重新生成和语音停止。
5. 三类 Quiz 的错误、提示、重试、保存失败提示和进度更新。
6. Python 初始化、成功、语法错误、无限循环停止、重试、重置和切换模板。
7. 设备在线、Core 未配置、超时、离线和页面隐藏/恢复轮询。
8. 锚点课“事实依据/权威参考”编号、外链与回答 `[S#]`；非锚点课不虚构教材来源。
9. 仅键盘完成主导航、学段、tabs、练习和关键按钮；可见焦点与语义正确。

记录每个视口截图、浏览器控制台错误、网络失败和可访问性问题。当前没有 Playwright E2E 文件，不能声称自动化端到端或视觉回归已完成。

## 7. Vercel、Redis 与 Core 云验收

### Preview

- 记录 Vercel deployment URL/ID 和 commit SHA。
- 验证环境变量名称存在于 Preview；不导出值到日志。
- `CORE_API_URL` 是 HTTPS，`CORE_API_ADMIN_TOKEN` 只在服务端。
- 配置一整组 Redis REST 变量。

### Redis 故障演练

1. 在隔离 Preview 暂时使用无效 Redis 配置。
2. AI 路由应返回 `503 AI_GUARD_UNAVAILABLE` 和 `Retry-After`。
3. 固定课程、动画、种子绘本、材料、练习和 Python 仍可用。
4. 恢复 Redis 后，AI 路由成功；超过配额返回 429。

不要在 Production 直接做破坏性演练。

### Core 与 WSS

- `https://<core-host>/api/v1/health` 成功。
- 带管理令牌读取设备列表成功，未带/错误令牌为 401。
- OrangePi 使用 `wss://<core-host>/ws/v1/devices` 自动连接并持续心跳。
- 代理声明与 `/dev` 节点相符的能力；能力出现只作为节点检测证据，麦克风/扬声器/摄像头/屏幕/NPU 仍分别做功能自检。
- 页面显示正确目标设备；停止代理后进入离线/网页模式，恢复后自动上线。
- 在隔离测试环境验证空闲连接收到 4008、重复状态不增长历史、终态命令不被重放改写，并确认每设备状态历史不超过 1000 条。
- Core 保持单副本；数据库为 PostgreSQL；记录 Alembic current revision 和备份编号。

### Production

只有 Preview、浏览器、Office、Redis、Core/WSS 和 OrangePi 全部验收后，由所有者合并生产分支或 Promote。记录生产 deployment，不把 GitHub/Vercel 自动连接当作“已上线”证明。

## 8. 安全与隐私手工检查

- 界面和助手不主动索取真实姓名、学校、住址、电话或账号密码；当前聊天提示只显式覆盖姓名/住址/联系方式，学校与账号密码规则仍需补齐。学生主动输入的文字会本机持久化，因此必须验证告知与删除边界。
- 对提示注入、密钥/内部规则获取、诊断与危险问答分别运行正常/应拒绝用例并记录真实结果。当前只有提示字符串与注入边界单元测试，没有完整对抗评测；未补齐前不能标记安全验收通过。
- 图片与录音二进制不进入 localStorage；完成的学生/助手文字轮次会按课程有界保存。验证欢迎语、图片、未完成半轮不会保存，并检查输入个人信息的风险提示/删除边界。
- 答题原文在学习状态持久化前被移除。
- 清除站点数据后，本机学习状态与绘本确实删除。
- Core API 的学习接口仍共用管理员令牌；因此不开放给真实学生使用。
- 设备未知命令返回 `unsupported_command`，没有 Shell 路径。
- Python 页面明确“非正式判题沙箱”和低权重证据。
- 报告不包含真实学生数据、Secret、私人域名后台截图或 SSH 信息。

## 9. 发布结果记录模板

将以下内容复制到 release 证据，不要预填“通过”：

```text
Commit:
Date/time/timezone:
Operator:
Node/npm/Python:

Web tests:
Lint:
Typecheck:
Build:
Pyodide smoke:
Python tests:
GitHub Actions run:
Secret scan:

Browser 1440x900:
Browser 1024x768:
Browser 390x844:
Office DOCX/PPTX:
Gemini text/image/audio:
Redis failure/limit:
Vercel Preview:
Core HTTPS/PostgreSQL:
OrangePi WSS:

Known failures:
Evidence directory/hash:
Release decision:
```

## 10. 发布门槛

比赛 P0 标记“可演示”至少要求：

- 自动化、lint、typecheck、build、真实 Pyodide smoke、Python tests 和同 commit GitHub Actions 全部新鲜通过。
- secret scan 和工作树范围检查通过。
- 三个视口、真实媒体权限、Office 文件、Gemini 和降级完成手工验收。
- Vercel Preview、Redis 故障关闭、Core HTTPS/PostgreSQL 与 OrangePi WSS 有脱敏证据。
- [`p0-fidelity-ledger.md`](../evidence/p0-fidelity-ledger.md) 的限制与现场口径一致。

面向真实学校试用还必须完成登录/RBAC、监护/同意、教材/RAG/审核、服务端学习档案、每设备凭证、审计/删除/备份/监控和安全评估；比赛原型通过不代表生产准入。
