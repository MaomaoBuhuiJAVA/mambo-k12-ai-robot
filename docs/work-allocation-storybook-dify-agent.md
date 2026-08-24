# 绘本接入与 Dify 智能体开发工作分配

版本：v1.1  
日期：2026-08-24  
负责人：当前 Codex 会话（绘本与 Dify 智能体）  
适用仓库：`E:\Orange pi System\mambo-k12-ai-robot-online-preview-source`

## 1. 任务目标

本会话负责两条相互关联的主线：

1. 将用户提供的 Word 绘本转换为网站可以稳定播放的版本化内容，包括原始图片、页面顺序、旁白、角色对白、互动题和知识点标签。
2. 在 Dify 云端设计、开发并接入符合比赛要求的 K12 分龄教学智能体，包括绘本学习对话、战斗出题与反馈、初中实验讲解、高中项目答辩和学习建议。

绘本正文和原图是权威内容。Dify 可以解释、追问和生成练习，但不得在运行时重新编写绘本正文、改变页面顺序或替换原图。

### 1.1 小学绘本的正确产品流程

小学阶段共有 5 个地图区域，每个区域固定 3 本绘本。绘本不是独立的全站内容中心，也不得新增“绘本馆”“绘本控制台”或全局绘本导航。唯一正确入口是地图区域展开后的三张卡片：

```text
小学地图区域
  -> 三张绘本卡片
  -> 点击已接入卡片打开 /storybook/[storybookId]
  -> 在最后一页明确点击“完成本绘本”
  -> 返回地图，卡片显示完成状态
  -> 三本均完成后解锁该区域“挑战怪兽”
  -> 战斗胜利后进入下一地图区域
```

- 每个区域始终显示 3 张绘本卡片；没有源文件或尚未导入的绘本显示“内容待接入”，不能打开。
- 单本绘本页面只负责阅读、对白、题目和完成确认，不承担绘本目录或课程控制台职责。
- 读到最后一页不等于完成，必须由学生点击“完成本绘本”后写入完成状态。
- 战斗解锁由本地确定性规则判断三本绘本是否全部完成，不能由 Dify 决定或绕过。
- Dify 只接收已经完成绘本的知识点，用于生成战斗题和反馈。

## 2. 已有绘本清单与导入决策

当前已确认 7 本唯一绘本。每本均为 10 页并含 10 张页面图片。

| 内容 ID | 来源文件 | 主题 | 互动题情况 | 导入决策 |
|---|---|---|---|---|
| `castle-lesson-01` | `城堡第一绘本.docx` | 按顺序观察；区分事实与猜想；使用颜色、形状、数量等特征 | 第 4、7、9 页各 1 题 | 导入 |
| `lava-lesson-01` | `熔岩第一绘本.docx` | 识别个人隐私；拒绝隐私索取；安全使用 AI | 第 3、5、7 页各 1 题 | 导入 |
| `lava-lesson-02` | `熔岩第二绘本.docx` | 识别伪造头像和 AI 合成声音；暂停、留证、核验、求助 | 含 3 组答案数据，其中第 5 页缺少明确题干 | 导入前补齐内容校验标记，不擅自编写题干 |
| `lava-lesson-03` | `熔岩第三绘本(1).docx` | 最小权限、安全规则、危险内容停止与求助 | 第 5、7、9 页各 1 题 | 作为正式版本导入 |
| `forest-lesson-01` | `第7课时绘本无拼音.docx` | 把任务、对象、篇幅和重点说清楚，再核验 AI 草稿 | 结尾 1 题 | 导入 |
| `forest-lesson-02` | `第8课时绘本无拼音.docx` | 说明资料来源、交叉核对并标记待确认内容 | 结尾 1 题 | 导入 |
| `forest-lesson-03` | `第9课时绘本无拼音.docx` | 说明 AI 协作、署名责任和可追溯性 | 结尾 1 题 | 导入 |
| `desert-lesson-07` | `第7课时_线索和证据一样吗.docx` | 区分说法、证据、猜测和线索 | 结尾 1 题 | 导入 |
| `desert-lesson-08` | `第8课时_哪条证据更可靠.docx` | 从来源、时间和一致性判断证据可靠性 | 结尾 1 题 | 导入 |
| `desert-lesson-09` | `第9课时_证据不够时怎样判断.docx` | 支持、反对、暂时不能确定；事实核验和更新结论 | 结尾 1 题 | 导入 |

`熔岩第三绘本.docx` 与 `熔岩第三绘本(1).docx` 的 10 张图片完全相同，正文主体也相同；后者补全了摘要并修正了标题，因此只导入 `(1)` 版本。原文件保留为来源记录，不生成第二本重复绘本。

本批次没有提供城堡第 2、3 本，以及森林、科技岛对应绘本。本会话不得用 AI 自动补写缺失绘本并当作正式课程内容。

当前地图可用状态：城堡第 1 本、火山第 1 至 3 本、沙漠第 7 至 9 本均已完成导入并可点击；城堡第 2、3 本以及森林、科技岛卡片继续锁定。

## 3. 内容架构

### 3.1 权威绘本清单

新增版本化清单，建议结构如下：

```ts
type StorybookManifestV1 = {
  schemaVersion: 1;
  id: string;
  stage: "lower_primary" | "upper_primary";
  moduleId: string;
  lessonNumber: number;
  title: string;
  summary: string;
  source: {
    originalFileName: string;
    sha256: string;
  };
  knowledgePointIds: string[];
  pages: StorybookPageV1[];
};

type StorybookPageV1 = {
  pageNumber: number;
  title: string;
  imageSrc: string;
  narration: string;
  dialogue: DialogueCueV1[];
  question?: StorybookQuestionV1;
};

type DialogueCueV1 = {
  id: string;
  speaker: "narrator" | "starbao" | "guardian" | "teacher" | "ai_sprite" | "system";
  text: string;
  order: number;
  displayMode: "caption" | "bubble";
};
```

首期对白按顺序播放，不虚构精确音视频时间码。播放器使用稳定的逐句节奏，并允许学生点击继续、暂停和回看。以后有配音文件时，再增加 `startMs`、`durationMs` 和音频资源字段。

### 3.2 文件位置

建议由本会话独占以下目录：

```text
apps/web/public/assets/storybooks/
apps/web/src/data/storybooks/
apps/web/src/features/storybook/
apps/web/src/lib/dify/
apps/web/src/app/api/ai/
apps/web/scripts/storybook-import/
```

导入脚本只在开发或构建准备阶段运行。生产页面不得直接解析 Word 文件，也不得把原始 Word 文件发送给浏览器。

### 3.3 内容导入规则

- 按 Word 文档关系映射提取图片，不能假设压缩包中的文件名顺序就是页面顺序。
- 保留原图像素，不做有损重复压缩；网页端再通过稳定尺寸和响应式加载展示。
- 旁白使用字幕区域，角色对白使用气泡；括号中的动作说明存为可选的 `stageDirection`，不直接混入朗读文本。
- 每道题必须校验选项唯一、答案属于选项、反馈非空、题干非空。
- 发现源内容缺失时生成导入报告并阻止该题启用，不由模型静默补齐。
- 每本书保存源文件 SHA-256、清单版本和内容版本，便于比赛演示时说明内容来源和可追溯性。

## 4. Dify 云端应用设计

### 4.1 总体原则

- Dify 使用 DeepSeek 作为首期模型提供方。
- 浏览器不得直接访问 Dify；所有密钥只保存在 Next.js 服务端环境变量中。
- 网站只接入一个运行时 Dify 智能体 `k12-teaching-agent`。应用根据确定性的 `stage`、`grade`、`teaching_mode` 和 `battle_action` 选择该智能体内的工作流分支，不额外调用大模型做路由。
- 课程事实、绘本正文、实验结果、标准答案、分数、血量和解锁状态由应用侧管理。
- Dify 返回的结构化结果必须经过 Zod 校验后才能进入页面或题库。
- 所有核心调用必须有超时、并发限制、缓存或预取、本地降级和 trace ID。

### 4.2 单智能体、多工作流分支

只创建一个 Dify Chatflow：`k12-teaching-agent`。它是网站唯一的运行时智能体，使用一个服务端 API Key。Chatflow 的 Start 节点接收统一上下文，先经过输入校验，再用 If/Else 按 `teaching_mode` 分流；小学战斗再用 `battle_action` 选择出题或反馈。这样既保留每条业务链路独立的输入输出契约，也避免多个应用重复配置模型、知识库和安全规则。

```text
Start
  -> Code: validate_context_and_limits
  -> If/Else: teaching_mode
       storybook/dialogue -> 当前绘本检索 -> 分龄导师 LLM -> Answer(stream)
       battle              -> If/Else: battle_action
                              question -> 小学题库检索 -> 严格 JSON LLM -> Answer(blocking)
                              feedback -> 网站判分事实 -> 反馈 LLM -> Answer(blocking)
       lab                 -> 初中课程/实验结果检索 -> 实验教练 LLM -> Answer(stream)
       defense             -> 项目证据模板 -> 答辩计划/反馈 LLM -> Answer(blocking/stream)
       recommendation      -> 候选活动模板 -> 建议 LLM -> Answer(blocking)
       else                -> 通用安全教学链路 -> Answer(stream)
```

分支名称是工作流版本和监控标签，不是独立 Dify 应用：

| 分支 | 触发字段 | 主要职责 | 输出模式 |
|---|---|---|---|
| `storybook` | `teaching_mode=storybook`（网站将绘本问答映射到此） | 结合当前绘本页和知识点进行适龄讲解、追问 | 流式文本 |
| `battle.question` | `teaching_mode=battle,battle_action=question` | 根据已完成绘本生成一道四选一题 | 阻塞式严格 JSON |
| `battle.feedback` | `teaching_mode=battle,battle_action=feedback` | 将网站已经判定的结果改写为适龄反馈 | 阻塞式严格 JSON |
| `lab` | `teaching_mode=lab` | 解释真实实验结果并引导下一步验证 | 流式文本 |
| `defense` | `teaching_mode=defense` | 根据已提交证据生成答辩问题或反馈 | 阻塞式/流式 |
| `recommendation` | `teaching_mode=recommendation` | 从已解锁候选活动中给出下一步建议 | 阻塞式严格 JSON |

题目、反馈、实验指标、分数、血量、完成状态和解锁仍由网站确定性代码负责。Dify 只做受约束的解释和生成；每个分支的结果在 BFF 侧分别通过对应 Zod schema 校验。

### 4.3 知识库分区

知识库按学段和内容域分区，至少包含以下元数据：

```text
stage
gradeMin
gradeMax
moduleId
courseId
storybookId
pageNumber
knowledgePointId
contentVersion
sourceType
```

绘本图片保存在网站资源目录，Dify 知识库只保存经过清洗的正文、对白、题目和知识点说明。检索必须带元数据过滤，不能让小学战斗题检索到初高中材料。

## 5. 应用与 Dify 的共享协议

### 5.1 输入上下文

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

不得向 Dify 发送姓名、联系方式、家庭住址、完整原始聊天历史或未成年人不必要的敏感信息。

### 5.2 输出约束

所有 Workflow 返回 `schemaVersion`、`traceId`、`workflowVersion` 和严格业务对象。输出中的活动 ID、课程 ID、绘本 ID、页面 ID 和知识点 ID 必须在应用白名单中，否则拒绝使用并进入本地降级。

## 6. 性能设计与初始指标

- 绘本翻页、图片和固定对白播放不调用 Dify。
- 每次学生操作的关键路径最多包含 1 个大模型节点。
- 对话使用流式返回，首段文本 P95 目标不高于 2.5 秒；8 秒内无有效内容则终止并显示本地提示。
- 战斗题在进入战斗前预取；前台最多等待 15 秒，仍未得到合格题目则使用版本化本地题库。统一 Chatflow 实测阻塞式战斗题通常约 6-10 秒。
- 结构化 Workflow 不自动进行多轮模型重试；仅对网络级瞬时错误进行一次受控重试。
- 同一学习上下文和内容版本生成的题目可以短期缓存，但同一场战斗只保存并使用锁定题目。
- 记录 Dify 应用 ID、工作流版本、模型、耗时、结果类型和降级原因，不记录完整敏感对话。

## 7. 实施里程碑

### S-01 内容清单和契约

- 建立绘本清单、页面、对白和题目 schema。
- 建立 7 本唯一绘本的来源登记和哈希。
- 为缺题干、未知角色、缺图片和重复页建立失败测试。

完成标准：schema、来源登记和导入验证测试通过，未修改播放器 UI。

### S-02 首本绘本纵向导入

- 首先导入 `castle-lesson-01`。
- 提取 10 张原图，生成 10 页清单。
- 改造播放器展示原图、旁白、气泡对白和页内互动题。
- 保留键盘操作、朗读、暂停和回看能力。
- 将城堡区域第 1 张卡片绑定到 `castle-lesson-01`，删除独立绘本馆和全局绘本入口。
- 在最后一页提供明确的完成确认；返回地图后显示 `1 / 3`，另外两张缺内容卡片保持锁定。

完成标准：可从城堡地图卡片打开绘本、完成阅读、确认完成并返回地图；刷新后页码和完成状态恢复；未完成三本时不能进入城堡战斗。

### S-03 批量导入剩余绘本

- 导入熔岩第 1、2、3 课和沙漠第 7、8、9 课。
- 输出内容质量报告。
- `lava-lesson-02` 第 5 页缺失题干时，该题保持禁用并在报告中明确列出，等待用户确认。
- 每导入一本绘本，只更新其所属地图区域的对应卡片，不新增目录页或全局导航。
- 城堡第 2、3 本以及森林/科技岛缺失绘本继续锁定，等待用户提供源文件。

完成标准：7 本唯一绘本均可按原顺序播放，图片与对白不串页，没有重复导入。

### S-04 Dify 基础设施和统一 Chatflow

- 创建服务端 Dify 客户端、环境变量校验、超时、错误分类和测试替身。
- 在 Dify Cloud 配置 DeepSeek 模型和小学知识库。
- 在同一个 `k12-teaching-agent` Chatflow 中先打通 `battle.question` 分支，建立严格 JSON 输出和离线评测集；随后按相同入口补齐其他分支，不新建同职责应用。

完成标准：本地使用模拟 Dify 可测试；真实 Dify 返回题目经应用校验；断网和超时均能回退。

### S-05 战斗接入

- 等另一个会话完成 `A-02` 云朵转场并交接战斗文件后再开始。
- 在战斗会话开始前预取、校验和锁定题目。
- 应用本地判分，再调用受控反馈流程。
- 保留版本化静态题库作为降级内容。
- 地图只在同一区域三本绘本全部完成后显示战斗入口；Dify 不参与解锁判断。
- 进入战斗时携带区域 `battleModuleId` 和三本已完成绘本 ID，出题知识点只能来自这些绘本。

完成标准：五个战斗模块均能获取与已学内容匹配的题目；重复渲染不会换题；Dify 故障不阻断战斗。

### S-06 初高中对话接入

- 等另一个会话固定课程、活动、实验和项目协议后，把 `lab`、`defense` 分支接入同一 `k12-teaching-agent` Chatflow。
- 不修改实验数值、判分函数或解锁逻辑。
- 使用对方提供的确定性结果生成讲解和追问。

完成标准：小学、初中、高中使用相同协议版本，但呈现难度、句长、提示深度和自主程度明显不同。

### S-07 比赛验收与性能评测

- 建立分龄测试样例、越权检索测试、提示注入测试和不确定性测试。
- 记录首段响应、完整响应、失败率、降级率和结构化输出合格率。
- 准备可展示的调用链、内容来源、工作流版本和学习闭环证据。

完成标准：结构化输出合格率 100%；故障场景可恢复；关键操作满足本节初始性能指标。

## 8. 文件所有权与冲突规则

本会话可以独立修改：

- `apps/web/public/assets/storybooks/**`
- `apps/web/src/data/storybooks/**`
- `apps/web/src/features/storybook/**`
- `apps/web/src/lib/dify/**`
- `apps/web/src/app/api/ai/**`
- 与上述目录直接对应的新测试和导入工具
- `apps/web/src/app/map/page.tsx`、`page.module.css`、`page.test.tsx` 中与三张绘本卡片、完成进度和战斗解锁直接相关的部分

必须等待交接后才能修改：

- `apps/web/src/features/ai-battle/ai-battle-game.tsx`
- `apps/web/src/features/ai-battle/ai-battle-game.test.tsx`
- `apps/web/src/features/ai-battle/ai-battle-game.module.css`
- `apps/web/src/components/learning-workspace.tsx`
- `apps/web/src/app/api/chat/route.ts`

根据 2026-08-22 用户对产品流程的纠正，本会话已接手地图中的绘本卡片内容、绘本完成进度和三本完成后的战斗入口；仍不得修改地图热点几何、岛屿视觉、云朵状态机、实验引擎、学习路径、学习存储迁移、确定性判分和高中项目存储，除非双方先在工作文档中完成明确交接。

任何共享文件出现未识别修改时立即停止该文件的编辑，读取 diff 并与用户确认，不得回滚、覆盖或批量格式化。

## 9. 开工前所需外部信息

实际创建 Dify Cloud 资源前，需要用户提供或确认：

- Dify Cloud 工作区访问方式。
- 是否允许本会话创建应用、Workflow、Chatflow 和知识库。
- DeepSeek 模型提供方是否已在 Dify 中配置。
- 统一 `k12-teaching-agent` API Key 的安全保存方式。
- 生产与测试是否使用不同的 Dify 应用或密钥。

在这些权限具备前，可以完成本地 schema、导入、Dify 客户端模拟、测试和接口契约，但不能声称真实 Dify 工作流已经上线。

## 10. 每项任务的最低验证

```powershell
npm.cmd test --workspace apps/web -- --run <focused-test-files> --no-file-parallelism --maxWorkers=1
npm.cmd run typecheck --workspace apps/web
npm.cmd run lint --workspace apps/web -- <changed-source-files>
git -c safe.directory='E:/Orange pi System/mambo-k12-ai-robot-online-preview-source' diff --check
```

涉及可见页面时，在 `1440 x 900` 和 `1920 x 1080` 下验证图片完整、气泡不遮挡角色或正文、文字不裁切、翻页不跳动、键盘可操作、控制台无相关错误。
