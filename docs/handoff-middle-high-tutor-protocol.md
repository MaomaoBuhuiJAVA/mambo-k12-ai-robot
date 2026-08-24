# 初高中 AI 导师协议交接说明

版本：TUTOR-02 / v1
日期：2026-08-23
适用项目：`E:\Orange pi System\mambo-k12-ai-robot-online-preview-source`

## 交接范围

本交接只固定浏览器与 Dify 会话之间的类型、白名单和校验边界。实现位于：

`apps/web/src/features/ai-tutor/tutor-protocol.ts`

本任务没有修改 Dify 客户端、Dify API、知识库、聊天接口或环境密钥。Dify 会话接入时必须把服务端流转换为 `TutorProtocolEvent`，再交给前端处理。

## 输入：`LearningContextV2`

调用方必须在 BFF 侧构造和校验 `LearningContextV2`，不能让浏览器直接提交未经裁剪的学习状态。课程、单元、课节和活动必须来自：

- `curriculum.ts`
- `course-structure.ts`
- `learning-paths.ts`

必须保留 `schemaVersion: 2`、`traceId`、匿名学习者 ID、学段、课程/课节/活动、知识点、掌握证据、误区、最近证据和 `allowedActionIds`。不得发送姓名、联系方式、家庭信息、完整原始聊天、原始音频或完整代码。

`validateLearningContextV2` 会拒绝：

- 跨学段或跨课程的 `courseId`、`lessonId`、`unitId`、`activityId`。
- 未配置的知识点、未知动作、非法掌握度和负数证据次数。
- 超长 ID、文本、指标、数组和不支持的教学模式。
- 不带当前应用候选白名单的 `allowedActionIds`；候选列表必须由程序按当前活动和解锁状态计算，不能由浏览器或 Dify 自己扩展。
- 裸知识点标签、跨课程知识点、重复掌握记录和超出上限的证据次数。知识点必须使用稳定的 `courseId:知识点` ID；实验模板知识点使用模板注册表中的稳定 ID。

## 输出：结构化教学流

只允许以下事件：

```text
session.started
plan.ready
slide.ready
narration.delta
narration.segment
interaction.ready
session.completed
session.degraded
```

除 `session.started` 外，每个事件也必须携带由 BFF 写入的 `sessionId` 和 `traceId`。事件载荷分别对应 `PresentationPlanV1`、`SlideSpecV1`、`NarrationSegmentV1`、`TutorInteractionV1` 和 `TutorSummaryV1`。所有事件都必须带 `schemaVersion: 1`；未知事件直接丢弃并记录 `traceId`。

幻灯片只允许固定 `SlideType` 和以下块：`text`、`bullets`、Python `code`、`table`、白名单 `chart`、白名单 `asset`。每个提纲必须包含 4-12 页；`objectiveIds`、提纲知识点、`sourceIds`、`chartId`、`dataRef` 和 `assetId` 都必须通过当前应用白名单。缺少对应白名单时 fail closed。Dify 不得返回 HTML、JavaScript、SVG 源码、外链脚本、任意 PPTX 或任意资源 URL。

`validatePresentationPlanV1`、`validateSlideSpecV1`、`validateNarrationSegmentV1`、`validateTutorInteractionV1`、`validateTutorSummaryV1` 和 `validateTutorProtocolEvent` 是纯函数，返回 `ProtocolResult`；只有 `ok: true` 的结果才能进入 UI。

连续流必须使用 `createTutorProtocolStreamValidator`。它在纯函数校验之后继续检查：

- `session.started` 是首事件，后续事件的 `sessionId`、`traceId` 与它和 `LearningContextV2.traceId` 一致。
- `plan.ready` 的课程和课节与当前上下文一致，且只能出现一次。
- `slide.ready` 的 `slideId`、类型和知识点必须来自当前提纲，不能重复；讲稿和互动只能引用已就绪的幻灯片。
- `session.completed` 只能在所有提纲页就绪后出现，下一活动必须在当前学段和 `allowedActionIds` 候选中。
- 会话完成或降级后拒绝继续注入事件，避免旧流污染新会话。

## 动作与判定边界

Dify 返回的下一步建议必须与网页当前的 `allowedActionIds` 求交集，使用 `intersectAllowedActionIds`。Dify 不得：

- 判定题目正确答案、代码测试、实验指标、掌握度或项目通过。
- 创建新课程、活动、资源或跨学段动作。
- 执行代码、命令、网络请求或设备控制。

客观互动由网页根据 `evaluationPolicyId` 判定；开放回答只能产生表达反馈，不能单独写入完成证据。

互动策略与题型固定对应：`single_choice -> single-choice-v1`、`prediction -> prediction-v1`、`short_answer -> short-answer-required-v1`、`code_observation -> code-observation-required-v1`。Dify 不能通过更换策略绕过确定性判分。

## 降级与验收

- 生成超时、连续 schema 校验失败或事件流中断时，前端切到仓库内版本化种子课程。
- 语音不可用时切换为仅字幕；字幕、练习和实验仍可继续。
- 刷新后恢复课节、当前幻灯片和笔记，但不得自动播放声音。
- Dify 接入前，使用 `features/ai-tutor` 的本地 Mock 验收；Dify 会话不得绕过这些校验直接渲染模型输出。

定向验证：

```powershell
npm.cmd test --workspace apps/web -- --run src/features/ai-tutor/tutor-protocol.test.ts src/features/ai-tutor/tutor-data.test.ts src/features/ai-tutor/tutor-theater.test.tsx src/app/learn/tutor/[lessonId]/page.test.tsx --no-file-parallelism --maxWorkers=1
npm.cmd run typecheck --workspace apps/web
npm.cmd run lint --workspace apps/web -- src/features/ai-tutor/tutor-protocol.ts src/features/ai-tutor/tutor-theater.tsx
```

下一会话可以在不修改课程判定和学习状态的前提下实现 BFF/Dify 调用、限流、取消、trace、缓存和 SSE/流事件转换。
