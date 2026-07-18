# 赛题需求与评分证据矩阵

最新统一验证结果见 [`docs/verification/2026-07-18-p0-results.md`](../verification/2026-07-18-p0-results.md)。

赛题：JBGS-2026-02 多模态 K12 人工智能通识课教学助手对话智能体。

证据状态说明：

- **代码存在**：当前仓库可定位到实现；不代表最新统一测试已运行。
- **自动化覆盖**：存在对应测试文件；最终结果要以发布 commit 的完整日志为准。
- **手工待采集**：需要浏览器、Office、云环境或 OrangePi 实机，本轮未执行浏览器验收。
- **规划**：未实现，不计入已交付能力。

## 最新交接

- [P0 功能交接文档](../handoff/functional-handoff.md)：当前真实功能、接口、环境变量、硬件边界和前端重设计契约。

## R01-R16

| requirement_id | claim | owner/status | code_ref | api_ref | test_ref | visual_ref / demo_timestamp |
|---|---|---|---|---|---|---|
| R01 学段/教材选择 | 四学段策略与 8 门原创种子课可切换；没有教材选择/版本管理 | 项目负责人 / 部分；自动化覆盖 | `apps/web/src/lib/stage-policy.ts`；`apps/web/src/data/curriculum.ts`；`apps/web/src/components/stage-switcher.tsx` | 无 | `stage-policy.test.ts`；`curriculum.test.ts`；`stage-switcher.test.tsx` | 四学段同主题对比截图待采集 |
| R02 对话问答 | Gemini 流式文本、单图、录音转写、浏览器朗读；按课程有界恢复文字；锚点主题用版本化事实/来源 grounding | 项目负责人 / 部分；自动化覆盖 | `conversation-classroom.tsx`；`conversation-store.ts`；`data/knowledge-sources*`；`media-input.tsx`；`lib/ai/*` | `POST /api/chat`；`POST /api/transcribe` | conversation store/classroom、knowledge sources/prompt、chat/transcribe route tests | 真实 Gemini 文本/图片/录音、刷新恢复与 `[S#]` 录屏待采集 |
| R03 主动教学 | 种子欢迎、快捷问题、目标和练习反馈；无可恢复状态机 | 项目负责人 / 部分；自动化覆盖 | `conversation-classroom.tsx`；`teaching-canvas.tsx`；`quiz-player.tsx` | 无 | 对话、画布和 Quiz 组件测试 | 新课开场与答错反馈录屏待采集 |
| R04 教学材料 | 真实生成 DOCX 和 PPTX；锚点课编入参考来源标签/URL，其他课明确项目种子/无正式教材；没有上传、PDF/视频库 | 项目负责人 / 部分；自动化覆盖 | `resource-library.tsx`；`lib/materials.ts`；`data/knowledge-sources*` | `POST /api/materials/docx`；`POST /api/materials/pptx` | `materials-route.test.ts`；`resource-library.test.tsx`；knowledge source tests | Word/PowerPoint 实际打开与来源页截图待采集 |
| R05 动画 | 冒泡排序和神经网络可播放、暂停、单步、重置、调速 | 项目负责人 / 代码存在；自动化覆盖 | `features/animation/*` | 无 | 两个 machine tests；`teaching-animations.test.tsx` | 两个动画操作录屏待采集 |
| R06 绘本 | 4-8 页结构化绘本、项目插图、朗读、问题、本机保存回看、种子降级 | 项目负责人 / 代码存在；自动化覆盖 | `features/storybook/*`；`public/storybook/*` | `POST /api/storybook` | storybook schema/player/storage/route/illustration tests | AI 与种子两种来源、保存回看录屏待采集 |
| R07 编程 | Monaco + 隔离 Pyodide、2 个模板、确定性挑战、停止/重置/错误反馈 | 项目负责人 / 代码存在；自动化覆盖；手工待采集 | `features/lab/*`；`public/lab-runtime*` | 浏览器内执行，无服务端判题 API | lab protocol/controller/runtime/transport/UI tests；`smoke:lab` | 真实 Pyodide 成功/错误/停止录屏待采集 |
| R08 游戏化练习 | 3 种题型、确定性评分、即时反馈、提示、错题记录 | 项目负责人 / 代码存在；自动化覆盖 | `features/quiz/*`；课程 `exercises` | 无 | quiz engine/player/progress tests | 故意答错到反馈/掌握度变化录屏待采集 |
| R09 个性化路径 | 本机掌握度、连续正确、间隔复习、兴趣和当前学段内解释推荐；先修图缺失 | 项目负责人 / 部分；自动化覆盖 | `learning-store.ts`；`features/progress/*` | 无 | learning-store/recommendation/progress tests | `/progress` 前后对比截图待采集 |
| R10 学习历史 | 本机保存答题、掌握度、兴趣、最近课程、绘本和每课最多 20 条完整文字对话；媒体/代码未保存，未接 Core | 项目负责人 / 部分；自动化覆盖 | `learning-store.ts`；`storybook-storage.ts`；`conversation-store.ts` | Core 有学习 API，但 Web 未调用 | learning/storybook/conversation store tests；Core learning tests | 刷新恢复文字与清站点数据边界录屏待采集 |
| R11 知识准确 | 两个锚点主题有 schema v1 事实/来源目录、页面引用、提示 grounding 和 Office 来源；无教材上传/动态检索/引用强校验/准确性评测集 | 项目负责人 / 部分；自动化覆盖 | `data/knowledge-sources.v1.json`；`knowledge-sources.ts`；`knowledge-evidence.tsx`；`lib/ai/prompt.ts`；`lib/materials.ts` | 无 RAG API | knowledge sources/prompt/teaching canvas/resource/material route tests | 事实依据、外链、回答 `[S#]` 和 Office 来源手工证据待采集 |
| R12 软硬件集成 | OrangePi WSS、节点能力探测与网页只读状态；网关有空闲离线、连接内去重、协议边界和历史上限；无共享会话/作品/语音视觉同步 | 项目负责人 / 部分；自动化覆盖；实机待采集 | `device/agent.py`；`server/app/protocol.py`；`server/app/routes/devices.py`；`features/device/*` | `WS /ws/v1/devices/{id}`；`GET /api/device`；Core devices API | Core protocol/gateway/device status tests；core-api/device-status tests | 在线/离线、能力声明、网页模式和 WSS 心跳录屏待采集 |
| R13 部署集成 | Vercel 配置、Docker、Alembic、systemd、OpenAPI 与部署文档存在；Preview 构建成功但受 SSO 保护，未提升 Production | 项目负责人 / 部分；手工待采集 | `vercel.json`；`server/Dockerfile`；`deploy/*` | `GET /api/v1/health`；`/docs`；WSS | build/Python tests 已通过；受保护 Preview 的公网 smoke 待执行 | Preview 构建记录已采集；Production URL、Core 域名、WSS 证据待采集 |
| R14 项目报告 | 架构、模型、多模态、知识边界、难题、安全、部署、差距和演示文档已建立 | 项目负责人 / 文档存在；需随发布补证据 | `docs/report/*`；`docs/evidence/*` | 同各项 | 同各项 | 截图、录屏时间戳、最终测试日志待补 |
| R15 未成年人安全 | 聊天提示限制个人信息与账号凭据、医学/心理/自闭症诊断、危险操作、密钥与角色绕过；绘本提示限制医疗/心理诊断；学习状态匿名化/去答案；文字对话未脱敏；无登录/RBAC/监护/审计 | 项目负责人 / 部分；自动化覆盖有限 | `lib/ai/prompt.ts`；`app/api/storybook/route.ts`；`learning-store.ts`；`conversation-store.ts`；`core-api.ts` | AI routes no-store；Core Bearer auth | prompt/store/request guard/core adapter tests；对抗评测待建 | 隐私说明、删除流程、诊断/危险问答对抗评测尚无产品证据 |
| R16 稳定性 | 请求大小、Schema、超时、AI 空流/中断课程降级、Redis 限流/故障关闭、绘本种子降级、设备空闲超时/重放与终态保护/历史上限、网页模式 | 项目负责人 / 部分；自动化覆盖；生产待采集 | `bounded-json.ts`；`request-guard.ts`；`route-deadline.ts`；`text-stream-fallback.ts`；`server/app/protocol.py`；device adapter | AI/Device routes；Core health/WSS | guard/deadline/fallback/routes/runtime/protocol/gateway/device tests | Redis/Gemini 故障、重复消息与设备离线演练待采集 |

`demo_timestamp` 暂为空：尚未生成正式演示录像，不能虚构时间点。录屏完成后把每一行补成 `demo-v1.mp4 00:00-00:00`，并固定对应 commit SHA。

## 评分项证据准备

| 评分项 | 可展示的当前证据 | 风险与不应过度表述 |
|---|---|---|
| 智能体设计合理性 25% | Vercel/Core/WSS 分层；确定性学段策略；结构化绘本；锚点来源 grounding；AI 生成与程序执行分离；限流和降级 | 还没有通用 TeachingAgent 编排、主动教学状态机、完整教材 RAG、Provider 适配层或调用追踪 |
| 多模态交互质量 25% | 文本、图片、语音转写/朗读、DOCX/PPTX、两类动画、互动绘本、Python、三类练习 | 没有视频生成/上传、AI 图片生成、实时双工语音；浏览器视觉/音频仍需手工验收 |
| 教育适配与实用性 20% | 四学段确定性策略；8 门原创课程；两个主题的版本化事实/来源；适龄解释/提示；掌握度、错题与间隔复习 | 没有正式教材/完整 RAG、教师审校、真实学生效果评测、先修知识图或生产档案 |
| 用户体验 15% | 三栏工作台、移动视图切换、键盘可访问 tabs、即时反馈、网页模式降级、明确错误/重试 | 本轮未执行浏览器、移动视口和可访问性手工验收；无账号、教师端或跨端历史 |
| 创新性 15% | “知识内容编译器”方向的结构化 Spec + 确定性渲染；网页与边缘机器人分工；机器人页本地手势、百度语音和白名单屏幕/鼠标命令 | 共享学习会话、NPU 手势模型和正式实机语音仍待现场配置 |

## 最终提交证据包

发布负责人应在同一个 release commit 上收集：

1. `npm test/lint/typecheck/build/smoke:lab` 与 Python `pytest` 完整日志。
2. 1440x900、1024x768、390x844 三个视口截图和无遮挡检查表。
3. Gemini 文本、图片、录音转写、文字历史恢复与锚点课 `[S#]`；AI key 缺失/Redis 故障时的降级证据。
4. DOCX/PPTX 用真实 Word/PowerPoint 打开的文件和截图。
5. 两套动画、种子/AI 绘本、三类练习、进度推荐和 Python 实际执行录屏。
6. Vercel deployment、Core 镜像 digest、健康检查、PostgreSQL migration、WSS 和 OrangePi 心跳的脱敏证据。
7. 所有证据记录 commit SHA、环境、日期、操作者、结果和已知限制。

本轮没有执行浏览器验收、云部署或实机端到端演示，因此这些证据仍是发布阻断项，而不是“默认通过”。
# 最新交接

- [P0 功能交接文档](../handoff/functional-handoff.md)：当前真实功能、接口、环境变量、硬件边界和前端重设计契约。
