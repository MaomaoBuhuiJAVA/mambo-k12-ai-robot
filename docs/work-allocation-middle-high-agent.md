# 初高中应用开发智能体工作分配

版本：v1.0  
日期：2026-08-22  
负责人：另一个智能体会话（初高中应用与学习系统）  
适用仓库：`E:\Orange pi System\mambo-k12-ai-robot-online-preview-source`

## 1. 任务目标

本会话负责继续执行 `docs/middle-high-school-ai-learning-development-plan.md`，建设小学结束后的初中实验室与高中项目学习系统。

核心职责是应用侧确定性能力：地图、课程事实、学习路径、解锁、进度、实验、程序判分、证据记录和项目结构。绘本 Word 导入和 Dify 云端智能体由另一个会话负责。

## 2. 负责范围

### 2.1 初中应用

- 让树人胜利和旧 `/middle-map` 深链进入统一初中学习中心；历史地图不再作为产品入口。
- 将初中课程、实验和进度目标连接到统一学习中心的稳定 route resolver，不新增旧地图热点。
- 建立初中固定学习顺序：知识小课、星宝示范、跟着做、独立实验、研究挑战、知识点评价和补救。
- 实现人工智能基础、图像分类、模型评价、数据偏差和 AI 安全课程。
- 建立确定性的实验引擎、变量控制、指标、证据记录、评价和结业条件。

### 2.2 高中应用

- 建设 `/high` AI 研究站。
- 扩展 Monaco + Pyodide 实验模板、测试协议、超时和停止能力。
- 完成数据、机器学习流程、分类回归、神经网络训练、模型审计和综合项目。
- 建立结构化项目存储、程序评价、模型卡和答辩证据。

### 2.3 共用确定性系统

- `learning-paths.ts` 和解锁纯函数。
- `learning-store.ts` 的版本迁移、清洗、容量限制和实验证据。
- `curriculum.ts` 的课程事实、知识点和年龄适配内容。
- 进度、推荐候选、误区标签和补救路径。
- 实验与项目的确定性测试、指标和完成策略。

## 3. 不负责范围

本会话不得自行开发或替换以下能力：

- Word 绘本解析、绘本图片提取和绘本内容清单。
- 绘本播放器的气泡对白和页内互动实现。
- Dify Cloud 应用、Workflow、Chatflow、知识库和提示词。
- Dify API Key、服务端 Dify 客户端和 Dify 调用重试策略。
- 使用大模型生成标准答案、实验指标、分数、解锁结果或项目最终成绩。
- 把现有聊天接口直接改成另一种模型调用方式。

如果初高中页面需要 AI 对话，本会话只定义页面所需的 UI 状态和传入上下文，不直接调用 Dify。服务端接口由绘本与 Dify 会话提供。

## 4. 现有开发文档的执行顺序

继续按照 `docs/middle-high-school-ai-learning-development-plan.md` 的任务编号实施，每次只完成一个可以独立验证的任务。

### 第一阶段：入口收尾

1. `A-01`：读取并保护当前工作树。
2. `A-02`：完成旧初中目的地到统一学习中心的兼容转场。
3. `A-03`：将初中课程、实验和进度目标接入统一学习中心，停止旧地图热点开发。

### 第二阶段：确定性学习骨架

1. `B-01`：建立学习路径配置、引用校验和解锁纯函数。
2. `B-02`：扩展学习状态和迁移。
3. `B-03`：完成分学段任务总览。

### 第三阶段：初中第一章纵向闭环

依次完成 `C-01` 至 `C-07`。在第一章可以从知识小课连续演示到评价和补救之前，不批量扩展其他初中章节，也不开始高中页面。

### 第四阶段：扩展初中与高中

- 按 `D-01` 至 `D-06` 完成初中课程和结业。
- 用户确认初中闭环后，按 `E-01` 至 `E-07` 建设高中研究站。
- 按 `F-01` 至 `F-04` 完成项目、评价、答辩和报告导出。

## 5. 与 Dify 会话共享的数据契约

本会话负责生成并保存真实学习状态，Dify 会话只读取经过裁剪和匿名化的摘要。

需要稳定提供以下字段：

```ts
type LearningContextV1 = {
  schemaVersion: 1;
  traceId: string;
  anonymousLearnerId: string;
  stage: "lower_primary" | "upper_primary" | "middle_school" | "high_school";
  grade: number | null;
  activityId: string;
  courseId: string | null;
  moduleId: string | null;
  storybookId: string | null;
  completedPageIds: string[];
  knowledgePointIds: string[];
  masterySummary: Array<{ knowledgePointId: string; level: number }>;
  misconceptionTags: string[];
  allowedActionIds: string[];
};
```

其中：

- `activityId`、`courseId`、`knowledgePointIds` 和 `allowedActionIds` 只能来自版本化配置。
- `masterySummary` 来源于确定性评价和历史证据，不使用 Dify 自评分数。
- `allowedActionIds` 是当前已解锁候选，Dify 只能从中建议下一步。
- 不向 Dify 传姓名、联系方式、家庭信息、完整代码、完整原始聊天或其他不必要的未成年人数据。

如果状态 schema 发生变化，必须保持 `LearningContextV1` 兼容，或先协商升级到 `V2`。不得无通知地改变字段语义。

## 6. 文件所有权

本会话可以独立修改：

```text
apps/web/src/app/middle-map/**
apps/web/src/app/high/**
apps/web/src/components/cloud-transition/**
apps/web/src/data/curriculum.ts
apps/web/src/data/curriculum.test.ts
apps/web/src/data/learning-paths.ts
apps/web/src/data/learning-paths.test.ts
apps/web/src/features/lab/**
apps/web/src/features/progress/**
apps/web/src/features/learning-sequence/**
apps/web/src/features/image-classification/**
apps/web/src/features/projects/**
apps/web/src/lib/learning-store.ts
apps/web/src/lib/learning-store.test.ts
```

不得修改以下由绘本与 Dify 会话负责的目录：

```text
apps/web/public/assets/storybooks/**
apps/web/src/data/storybooks/**
apps/web/src/features/storybook/**
apps/web/src/lib/dify/**
apps/web/src/app/api/ai/**
apps/web/scripts/storybook-import/**
```

## 7. 必须交接的共享文件

以下文件不能由两个会话同时修改：

```text
apps/web/src/features/ai-battle/ai-battle-game.tsx
apps/web/src/features/ai-battle/ai-battle-game.test.tsx
apps/web/src/features/ai-battle/ai-battle-game.module.css
apps/web/src/components/learning-workspace.tsx
apps/web/src/app/api/chat/route.ts
```

### 7.1 战斗文件交接

当前战斗三个文件已有本地修改，同时 `A-02` 需要继续修改它们。本会话先完成 `A-02` 所需的转场改动、测试和本地验收，然后向用户报告：

- 修改文件清单。
- 当前 diff 状态。
- 测试结果。
- 是否还有未完成的战斗相关修改。

完成报告后停止编辑这三个文件，由绘本与 Dify 会话接入实时出题、锁题和反馈。未经再次交接，不回头修改这些文件。

### 7.2 学习工作区交接

本会话负责工作区布局、课程步骤、实验结果和聊天面板所需 props。Dify 会话负责服务端接口和数据校验。需要改变组件输入协议时，先把类型和测试固定，再交给 Dify 会话接入，不能同时重写组件和接口。

### 7.3 聊天接口交接

本会话不修改 `/api/chat` 的模型提供方。课程结构稳定后，向 Dify 会话提供课程 ID、学段、活动 ID、知识点和允许操作，由对方完成 Dify 迁移。

## 8. 给 Dify 会话的阶段性交付物

完成 `B-02` 后提供：

- 学段、年级、活动、课程和知识点 ID 的正式定义。
- 学习状态 schema 版本和匿名化摘要规则。
- 已解锁活动候选的纯函数接口。

完成 `C-03` 至 `C-06` 后提供：

- 实验输入、变量、确定性结果和指标协议。
- 提示次数、尝试记录、误区标签和学生结论字段。
- 允许 AI 解释的字段与禁止 AI 修改的字段。

开始高中项目前提供：

- 项目 schema、实验运行、指标、失败案例和证据引用协议。
- 答辩可读取字段和最终通过条件。

## 9. 工作树安全规则

每项任务开始前执行：

```powershell
git -c safe.directory='E:/Orange pi System/mambo-k12-ai-robot-online-preview-source' status --short --branch
git -c safe.directory='E:/Orange pi System/mambo-k12-ai-robot-online-preview-source' diff --stat
```

- 保留用户和其他会话的所有已有修改。
- 不使用 `git reset --hard`、`git clean`、`git checkout --` 或 `git add -A`。
- 不切换当前共享工作树的分支。
- 每次只修改当前任务和本文件所有权允许的文件。
- 发现未知修改时读取 diff；不确定所有权时停止该文件，不自行覆盖。
- 未经用户明确要求，不推送、不部署、不创建 PR。

## 10. 每项任务的验收

至少执行：

```powershell
npm.cmd test --workspace apps/web -- --run <focused-test-files> --no-file-parallelism --maxWorkers=1
npm.cmd run typecheck --workspace apps/web
npm.cmd run lint --workspace apps/web -- <changed-source-files>
git -c safe.directory='E:/Orange pi System/mambo-k12-ai-robot-online-preview-source' diff --check
```

涉及可见页面时，在 `1440 x 900` 和 `1920 x 1080` 下进行浏览器验收，并报告 URL、截图、控制台情况、键盘操作和刷新恢复结果。

## 11. 本会话现在应执行的任务

先完整阅读：

1. `docs/middle-high-school-ai-learning-development-plan.md`
2. 本工作分配文档
3. 当前 `git status` 和 `git diff`

然后只执行 `A-01`。如果 `A-01` 已经完成并有可验证报告，再执行 `A-02`。不要一次开始多个里程碑，也不要修改绘本或 Dify 文件。
