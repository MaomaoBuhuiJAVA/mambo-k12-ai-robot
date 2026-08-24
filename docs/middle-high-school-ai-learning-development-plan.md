# 初中与高中 AI 学习系统详细开发文档

> **v2 重构提示（2026-08-22）：** 用户已提出将初中、高中改造成统一学习平台。新的 UI 信息架构、课程目录、AI 导师、PPT/语音教学和 Dify 设计以 `docs/middle-high-school-learning-platform-redesign.md` 为准。本文档继续保留确定性学习路径、实验、判分、安全边界和既有任务历史；两者冲突时采用更严格的安全和文件所有权规则。

> **入口决策（2026-08-23）：** 初中地图不再作为用户入口或日常学习导航。初中、高中统一从首页阶段入口进入 `/learn`；`/middle-map` 及其历史资源仅保留兼容重定向，后续新功能不得依赖地图热点。

版本：v1.0
日期：2026-08-22
适用仓库：`E:\Orange pi System\mambo-k12-ai-robot-online-preview-source`
当前开发分支：`codex/battle-cloud-release`
目标读者：后续接手本项目的 AI 编程工具和人工开发者

## 1. 文档用途

本文档定义小学战斗阶段之后，初中与高中 AI 学习系统的产品目标、技术边界、数据契约、开发顺序、具体任务和验收标准。

后续 AI 编程工具必须按本文档的里程碑顺序工作。每次只处理一个可以独立验证的任务，不得在没有完成测试和本地页面验收的情况下同时扩展多个阶段。

本文档是实施路线，不代表所有功能已经完成。文中使用以下状态：

- `已存在`：当前工作树已有代码或资源，但仍可能尚未提交或部署。
- `待收尾`：主要代码已存在，仍缺少连贯性、测试或发布前验收。
- `待开发`：尚未形成可使用的纵向闭环。
- `后期`：不进入当前 PC 端第一轮开发。

## 2. 产品总目标

产品需要形成连续的 K12 AI 学习旅程：

```text
小学：故事探索、地图与知识战斗
  -> 初中：理解概念、控制变量、完成实验、解释结果
  -> 高中：编写代码、训练和评价模型、完成项目、进行答辩
```

三个阶段不能只是更换背景和文案：

- 小学以故事、角色、动画和战斗建立兴趣与直觉。
- 初中以“先学习、再示范、再实验”的顺序建立数据意识和因果解释能力。
- 高中以代码、数据、指标、模型限制和项目证据建立工程与研究能力。

## 3. 当前代码基线

### 3.1 已存在的主要能力

- `/preview`：星宝学习旅程入口。
- `/map`：小学知识地图及热点交互。
- `/ai-battle`：五个战斗模块、剧情字幕、星宝与怪兽视频动画、音效和结算。
- `CloudTransitionProvider`：首页、小学地图之间的云朵覆盖和揭示状态机；历史初中目的地只保留兼容重定向。
- `/learn`：初中、高中统一学习中心，包含路径、课程、练习、个人画像、实验和项目入口。
- `/workspace`：通用课程工作区，可以承载课程讲解、动画、材料、练习和对话。
- `/lab`：Monaco + Pyodide Python 实验室，已有冒泡排序和图像特征分类模板。
- `/progress`：掌握度、练习证据、复习推荐和学习进度。
- `apps/web/src/data/curriculum.ts`：四学段课程数据和知识点。
- `apps/web/src/lib/learning-store.ts`：本地学习状态、迁移、清洗和容量限制。
- `apps/web/src/features/lab`：沙箱运行、测试协议、实验模板和实验进度。

### 3.2 当前未完成状态

- `/middle-map` 及其背景资源保留为历史资源；当前路由只做兼容重定向，不再作为初中产品入口。
- 首页阶段入口和学习中心切换已指向 `/learn?stage=middle_school|high_school&view=path`，旧深链需要继续保持可用。
- 初中课程已有 `middle-neural-signals`、`middle-data-bias` 两个内容种子，但缺少从零开始的“人工智能基础”前置课程和完整学习顺序。
- 高中已有 `high-bubble-analysis`、`high-image-model-audit` 内容种子，但没有高中研究站、项目工作区和答辩闭环。
- 当前网页学习记录主要保存在 `localStorage`，尚未与 FastAPI Core 的学生档案贯通。

## 4. 教学模型

### 4.1 初中固定学习顺序

每个初中主题必须包含以下步骤：

```text
知识小课
  -> 星宝示范
  -> 跟着做
  -> 独立实验
  -> 研究挑战
  -> 知识点评价
  -> 错误补救或下一主题
```

禁止学生在没有完成知识小课和示范的情况下直接进入开放实验。独立实验允许提示、重试和改变变量；研究挑战必须有明确目标、评价规则、证据要求和补救路径。

### 4.2 高中固定学习顺序

```text
概念复习
  -> 阅读可运行示例
  -> 修改代码
  -> 处理数据
  -> 训练或执行模型
  -> 测试与指标比较
  -> 项目报告
  -> 星宝答辩
```

高中评价不能只判断最终输出。必须同时检查：

- 代码是否通过测试。
- 数据切分和实验变量是否合理。
- 指标是否计算正确。
- 结论是否与证据一致。
- 是否说明失败案例、适用范围和风险。

### 4.3 AI 的职责边界

AI 可以：

- 根据课程内容进行流式讲解。
- 提问、追问、提供分级提示。
- 把确定性的实验结果翻译成学生能理解的反馈。
- 帮助学生组织实验结论和项目报告。
- 在答辩中围绕学生已经提交的证据追问。

AI 不可以：

- 直接决定实验数值、正确答案、解锁状态或最终分数。
- 执行模型生成的任意 HTML、JavaScript、Python、Shell 或设备命令。
- 在没有权威来源或确定性计算的情况下编造课程事实。
- 代替学生完成研究结论和项目答辩。

所有解锁、评分、测试、指标和实验结果必须由程序逻辑和版本化数据决定。

## 5. 推荐技术架构

### 5.1 继续复用现有系统

不得为初中和高中重新创建一套平行课程系统。应继续复用：

- `apps/web/src/data/curriculum.ts`：课程事实和年龄适配内容。
- `apps/web/src/components/learning-workspace.tsx`：课程主工作区。
- `apps/web/src/features/lab`：代码实验沙箱。
- `apps/web/src/features/quiz`：知识点评价和练习证据。
- `apps/web/src/features/progress`：掌握度和推荐。
- `apps/web/src/lib/learning-store.ts`：本地学习状态。
- `apps/web/src/components/cloud-transition`：阶段切换动画。

### 5.2 新增学习路径配置层

新增建议文件：

```text
apps/web/src/data/learning-paths.ts
apps/web/src/data/learning-paths.test.ts
```

建议数据契约：

```ts
type LearningActivityKind =
  | "lesson"
  | "demonstration"
  | "guided_lab"
  | "independent_lab"
  | "research_challenge"
  | "assessment"
  | "remediation"
  | "project"
  | "defense";

type LearningActivity = {
  id: string;
  stage: "middle_school" | "high_school";
  title: string;
  kind: LearningActivityKind;
  courseId?: string;
  labTemplateId?: string;
  prerequisites: string[];
  route: string;
  completionPolicyId: string;
};
```

要求：

- 路径配置只引用现有课程 ID、实验模板 ID 和评价策略 ID。
- 配置加载时校验重复 ID、未知引用、循环依赖和不可达节点。
- 解锁逻辑是纯函数，并具有单元测试。
- React 页面不得自行散落判断前置条件。

### 5.3 扩展学习状态

在不破坏现有迁移和清洗逻辑的前提下，为 `LearningState` 增加：

```ts
type ExperimentEvidence = {
  runId: string;
  activityId: string;
  courseId: string;
  templateId: string;
  mode: "guided" | "independent" | "research" | "project";
  variables: Record<string, string | number | boolean>;
  metrics: Record<string, number>;
  conclusion: string;
  completedAt: string;
};

type StageProgress = {
  completedActivityIds: string[];
  experimentEvidence: ExperimentEvidence[];
  activeActivityId: string | null;
};
```

约束：

- 必须提升存储 schema 版本并提供旧版本迁移测试。
- 所有字符串、数组和记录数量继续设上限。
- 不保存学生提交的完整代码答案到普通学习记录；代码作品使用独立作品存储。
- 未知 activity、course、template ID 必须在解析时丢弃。

## 6. 初中产品结构

### 6.1 地图五个区域的职责

| 热点 ID | 显示名称 | 首期目标 |
|---|---|---|
| `mission-board` | 任务总览 | 当前章节、学习顺序、解锁状态和完成证据 |
| `knowledge-library` | 知识资料室 | 当前课程的概念、材料、术语和失败案例 |
| `ai-foundations` | 人工智能基础 | 从零开始的课程讲解与星宝示范 |
| `guided-lab` | 引导实验 | 固定步骤、单变量控制、即时解释 |
| `model-studio` | 模型训练 | 独立实验、研究挑战和实验结论 |

### 6.2 初中首批课程顺序

1. `middle-ai-foundations`：人工智能、规则程序、数据、样本、特征和标签。
2. `middle-image-classification`：图像数字化、特征、分类分数和预测不确定性。
3. `middle-model-evaluation`：训练集、测试集、准确率、错误率和混淆矩阵。
4. `middle-data-bias`：复用并扩展现有数据偏差课程。
5. `middle-ai-safety`：隐私、错误使用、模型边界和负责任 AI。

现有 `middle-neural-signals` 保留，调整为图像分类主题中的进阶节点，不得删除或重命名造成已有链接失效。

## 7. 高中产品结构

### 7.1 高中主界面

新增 `/high` 作为高中 AI 研究站首页。首期 PC 端采用工作型界面，不制作大型营销首屏或装饰性卡片墙。

建议布局：

```text
左侧：研究路径、先修状态、当前任务
中间：代码、数据表、实验控制和运行输出
右侧：指标图表、星宝研究助手、实验记录
```

具体视觉背景和阶段转场素材尚未确定。在用户提供或确认高中视觉方案前，不生成正式高中背景图，不自行决定高中场景主题。

### 7.2 高中首批课程顺序

1. `high-python-data-lab`：Python 数据结构、CSV/JSON、统计和可视化基础。
2. `high-bubble-analysis`：复用现有课程，作为测试驱动和可复现实验热身。
3. `high-ml-pipeline`：数据清洗、训练/验证/测试切分和基线模型。
4. `high-classification-regression`：分类、回归、损失和指标选择。
5. `high-neural-network-training`：权重、损失、梯度下降、过拟合和正则化直觉。
6. `high-image-model-audit`：复用现有课程，形成模型卡和分组指标审计。
7. `high-capstone-project`：综合项目、报告和答辩。

### 7.3 高中运行环境约束

- 继续使用现有 Monaco 和 Pyodide 沙箱。
- 运行时不得访问主站同源权限、系统文件或公网网络。
- 首期数据集使用仓库内固定的小型 CSV/JSON 文件。
- 首期算法优先使用纯 Python 或已经随运行时打包的能力。
- 不允许运行时在线安装未知包。
- 如必须增加 Python wheel，资源必须本地托管、固定版本并校验哈希。
- 每个模板必须有超时、输出长度限制、测试用例和可恢复的停止按钮。

## 8. 详细任务清单

### 里程碑 A：完成初中统一学习中心入口迁移

#### A-01 保护并确认当前工作树

状态：待执行

任务：

- 读取 `git status --short --branch`、`git diff --stat` 和未跟踪文件。
- 保留 `.superpowers/`、`apps/web/tmp/` 和用户现有改动，不得删除或重置。
- 只把本里程碑涉及的源代码、测试、文档和必要资源列入暂存范围。
- 确认 `middle-school-lab.jpg` 与用户提供原图哈希一致。

完成标准：

- AI 编程工具能明确报告哪些是已提交内容、已修改内容和未跟踪内容。
- 未发生 `git reset --hard`、`git clean`、`git add -A` 或批量回滚。

#### A-02 兼容旧初中入口并接入统一学习中心

修改建议：

```text
apps/web/src/components/cloud-transition/cloud-transition-machine.ts
apps/web/src/components/cloud-transition/cloud-transition-machine.test.ts
apps/web/src/components/cloud-transition/cloud-transition-provider.tsx
apps/web/src/components/cloud-transition/cloud-transition-provider.test.tsx
apps/web/src/features/ai-battle/ai-battle-game.tsx
apps/web/src/features/ai-battle/ai-battle-game.test.tsx
apps/web/src/app/middle-map/page.tsx
apps/web/src/app/middle-map/page.test.tsx
```

任务：

- 保留历史 `middle-map` destination 名称以兼容旧战斗状态，但 pathname 映射必须直接指向 `/learn?stage=middle_school&view=path`。
- Provider 的旧 `startMiddleMapTransition()` 只能作为兼容 API，不得再等待地图资源或挂载热点。
- 使用明确的 destination 到 pathname 映射，不在 effect 内继续嵌套三元表达式。
- 树人胜利或旧书签进入初中时，最终页面必须是统一学习中心，不得重新打开旧地图。
- 为状态机、Provider、兼容重定向和页面跳转补测试。

完成标准：

- 旧目的地触发后云朵先完全覆盖，再导航到统一初中学习中心并揭示。
- 过渡期间不能重复触发按钮。
- 失败超时不会卡死。
- 其他小学/首页转场行为不回归。

#### A-03 停止旧地图热点开发并迁移入口目标

任务：

- 不再为旧地图增加热点或课程入口；历史资源只保留在仓库中作为参考。
- 统一学习中心的课程、实验和项目入口必须使用版本化 route resolver 和稳定 ID。
- 在 TypeScript 中建立 `target -> route builder` 白名单映射。
- 悬停/聚焦继续只负责预览；点击后显示选中状态和明确的“进入”命令。
- 不要求用户依靠双击进入。
- `Escape` 和空白区域仍能取消选择。
- 首期目标映射：
  - 任务总览 -> 初中阶段进度视图。
  - 知识资料室 -> 当前课程材料/知识证据视图。
  - 人工智能基础 -> `middle-ai-foundations` 课程。
  - 引导实验 -> 图像分类 `guided` 模式。
  - 模型训练 -> 图像分类 `independent` 模式。

完成标准：

- 五个区域都能通过鼠标和键盘进入目标。
- 标签、按钮和目标均有可访问名称。
- 未知 target 在构建或测试阶段失败，而不是运行时跳转到任意地址。

### 里程碑 B：建立共用学习路径与解锁机制

#### B-01 创建学习路径配置和校验器

任务：

- 创建 `learning-paths.ts` 和测试。
- 定义初中、高中活动节点、先修关系、路由和完成策略。
- 提供 `getLearningPath(stage)`、`getActivity(id)`、`isActivityUnlocked(...)` 等纯函数。
- 检测重复 ID、缺失引用、循环依赖和跨学段错误引用。

完成标准：

- 所有配置引用的课程和实验模板真实存在。
- 初中第一节点默认解锁，后续节点严格按前置证据解锁。
- 解锁测试不依赖 React 或浏览器。

#### B-02 扩展学习状态和版本迁移

任务：

- 增加活动完成记录、实验证据和当前活动。
- 提升 schema 版本。
- 添加旧状态迁移、未知 ID 清洗、容量上限和损坏 JSON 回退测试。
- 保持现有 quiz、lab 和 progress 数据不丢失。

完成标准：

- 旧用户状态可迁移。
- 不合法数据不会污染推荐和解锁。
- 本地存储失败时页面仍可使用，只提示记录未保存。

#### B-03 阶段任务总览

修改建议：

```text
apps/web/src/features/progress/progress-dashboard.tsx
apps/web/src/features/progress/recommendation.ts
apps/web/src/app/progress/page.tsx
```

任务：

- 支持 `?stage=middle_school` 和 `?stage=high_school`。
- 显示当前阶段节点、完成/进行中/锁定状态、下一步和解锁原因。
- 推荐只能在当前学段内产生。
- 每个推荐给出确定性原因。

完成标准：

- 从首页阶段入口或旧 `/middle-map` 兼容链接进入初中任务总览时不会混入小学或高中课程。
- 锁定节点明确说明缺少哪个前置活动。

### 里程碑 C：完成初中第一章纵向闭环

#### C-01 新增“人工智能基础”课程

修改建议：

```text
apps/web/src/data/curriculum.ts
apps/web/src/data/curriculum.test.ts
```

课程 ID：`middle-ai-foundations`

必须覆盖：

- 普通规则程序与机器学习的区别。
- 数据、样本、特征、标签、模型、预测。
- 预测不是事实，模型可能出错。
- 一个生活化图像分类案例。
- 至少三个可评价知识点。

完成标准：

- 课程可在 `/workspace` 打开。
- 课程讲解、动画、材料、练习和聊天上下文均使用同一课程事实。
- 不把“神经网络”当作初学者理解 AI 的第一个前置概念。

#### C-02 创建阶段式学习序列组件

新增建议：

```text
apps/web/src/features/learning-sequence/learning-sequence.tsx
apps/web/src/features/learning-sequence/learning-sequence.test.tsx
apps/web/src/features/learning-sequence/learning-sequence.module.css
```

任务：

- 显示当前步骤、目标、完成要求和下一步。
- 复用 `LearningWorkspace`，不要复制对话区、教学画布和课程栏。
- “继续”按钮只有在当前 completion policy 满足后可用。
- 支持恢复到上次进行中的步骤。
- PC 端保证信息密度清楚，不制作卡片套卡片。

完成标准：

- 学生不能跳过知识小课直接进入研究挑战。
- 刷新页面后可以恢复当前活动。

#### C-03 星宝示范：确定性图像分类模拟器

新增建议：

```text
apps/web/src/features/image-classification/image-classification-engine.ts
apps/web/src/features/image-classification/image-classification-engine.test.ts
apps/web/src/features/image-classification/image-classification-demo.tsx
apps/web/src/features/image-classification/image-classification-demo.test.tsx
```

任务：

- 使用固定样本和固定特征表。
- 展示特征如何形成类别分数。
- 允许逐步播放、暂停、单步、重置和速度调整。
- 结果由纯函数计算，禁止调用大模型产生标签或分数。
- 星宝讲解只引用计算结果。

完成标准：

- 相同输入始终产生相同输出。
- 每一步都能看到输入、特征、分数和预测。
- 减少动态效果设置下仍可完成学习。

#### C-04 引导实验模式

任务：

- 为 `/lab` 增加 `mode=guided|independent|research|project` 参数解析。
- 初中引导实验默认使用 `stage=middle_school&template=image-classifier&mode=guided`。
- 引导模式一次只要求改变一个变量。
- 每一步先让学生预测，再运行，再记录观察。
- 完成时生成结构化实验证据。

完成标准：

- 学生在明确提示下完成一次特征规则实验。
- 证据包含变量、指标、提示次数和学生结论。
- 不完成必要记录不能直接标记完成。

#### C-05 独立实验模式

任务：

- 允许选择一项自变量并多次运行。
- 提供实验运行对比表。
- 允许提示和重试，但提示会记录在形成性证据中。
- 要求学生填写“改变了什么、结果如何变化、原因是什么”。

完成标准：

- 至少保存两次可比较运行。
- 结论必须引用实际运行指标。
- 不设置唯一标准结论，但程序检查证据是否完整且自洽。

#### C-06 研究挑战模式

首个挑战建议：`改善逆光图片分类表现`。

任务：

- 提供固定数据分组和明确目标指标。
- 减少直接提示，只保留逐级解锁提示。
- 评价样本选择、实验次数、指标改善和结论一致性。
- 失败后给出具体补救活动，不直接展示完整答案。

完成标准：

- 挑战目标、输入数据和评分规则版本化。
- 相同提交获得相同程序评分。
- AI 反馈只能解释程序评分和证据缺口。

#### C-07 知识点评价与补救

任务：

- 为第一章配置单选、排序、结果解释题。
- 将错误映射到误区标签，例如：`预测等于事实`、`标签和特征混淆`、`只看总体准确率`。
- 为每个误区提供短讲解、一个示例和一次复测。
- 更新 `masteryByKnowledgePoint` 和 `nextReviewAt`。

完成标准：

- 评价结果能够改变下一步推荐。
- 补救成功后保留原错误证据，不覆盖历史。

### 里程碑 D：扩展完整初中课程

#### D-01 图像分类与神经网络

- 将现有 `middle-neural-signals` 接入学习路径。
- 增加像素输入、加权连接和类别分数的可视化实验。
- 明确“最高分是预测，不是事实”。

#### D-02 模型评价

- 新增 `middle-model-evaluation`。
- 实现训练集/测试集切分、准确率、错误率和混淆矩阵活动。
- 使用固定小数据集，不做重型在线训练。

#### D-03 数据偏差

- 复用 `middle-data-bias`。
- 增加总体指标与分组指标对比。
- 研究挑战要求提出补采样方案并重新评价。

#### D-04 AI 安全

- 新增 `middle-ai-safety`。
- 覆盖隐私、错误依赖、数据授权、模型边界和负责任使用。
- 使用情境判断和证据解释，不使用抽象口号式答题。

#### D-05 知识资料室

- 基于现有 `ResourceLibrary` 和 `KnowledgeEvidence`。
- 按当前课程显示概念、术语、权威来源、材料和失败案例。
- 所有课程事实有版本和来源，不把聊天回答直接写回权威内容。

#### D-06 初中阶段结业条件

- 五章核心知识点达到规定掌握度。
- 至少完成一项研究挑战。
- 至少提交一份结构化实验结论。
- 未完成项有明确补救入口。
- 结业后才解锁高中研究站入口。

### 里程碑 E：建设高中 AI 研究站

#### E-01 新增高中首页 `/high`

任务：

- 显示研究路径、当前项目、最近实验和下一步。
- 使用现有课程、进度和实验数据。
- 高中未解锁时显示前置要求，不使用仅靠隐藏按钮的限制。
- 不在本任务中生成最终视觉背景。

完成标准：

- PC 端主要任务、代码入口和指标入口在首屏可见。
- 页面不是营销落地页，不使用大量装饰卡片。

#### E-02 扩展实验协议和模板注册表

任务：

- 将当前固定的两个 `LabTemplateId` 扩展为可校验注册表。
- 保留已有 `bubble-sort` 和 `image-classifier` ID。
- 新增高中模板时同时注册知识点、测试、资源和完成策略。
- 未知模板参数使用明确 fallback 或 404，不静默执行任意代码。

建议首批模板：

- `python-data-basics`
- `bubble-sort-analysis`
- `dataset-split`
- `classification-metrics`
- `gradient-descent-demo`
- `model-audit`

#### E-03 Python 数据实验

- 新增 `high-python-data-lab`。
- 使用本地 CSV/JSON 数据。
- 教学内容覆盖读取、清洗、统计和可视化数据准备。
- 测试同时检查输出和关键中间结果。

#### E-04 机器学习流程实验

- 新增 `high-ml-pipeline`。
- 实现确定性数据切分、基线预测和指标计算。
- 明确训练、验证、测试三者职责。
- 增加数据泄漏错误示例。

#### E-05 分类、回归和指标选择

- 新增 `high-classification-regression`。
- 让学生比较准确率、精确率、召回率和均方误差的适用场景。
- 评价必须包含代码测试和指标解释。

#### E-06 神经网络训练实验

- 新增 `high-neural-network-training`。
- 使用小型固定数据和可复现初始化。
- 展示损失变化、学习率、过拟合和正则化直觉。
- 首期不追求大型真实模型训练。

#### E-07 模型审计

- 接入现有 `high-image-model-audit`。
- 学生必须检查数据来源切分、总体指标、分组指标和失败样本。
- 输出一份结构化模型卡。

### 里程碑 F：高中综合项目与答辩

#### F-01 项目工作区

新增建议：

```text
apps/web/src/features/projects/project-workspace.tsx
apps/web/src/features/projects/project-store.ts
apps/web/src/features/projects/project-schema.ts
apps/web/src/app/high/project/[projectId]/page.tsx
```

项目结构至少包含：

- 研究问题。
- 数据来源和授权说明。
- 数据处理步骤。
- 模型或算法版本。
- 实验运行与指标。
- 失败案例。
- 结论、限制和下一步。

#### F-02 项目评价器

- 使用结构化规则检查材料完整性、可复现性和证据一致性。
- 代码测试和数值指标由程序生成。
- 开放性文字只检查是否引用已有证据，不让 LLM 独立给最终分数。

#### F-03 星宝答辩

- 星宝根据学生已提交的项目事实提出 3 至 5 个问题。
- 问题覆盖方法选择、失败案例、局限和改进。
- 学生回答后，程序记录回答和引用的证据。
- AI 可以给表达反馈，但最终通过条件由完成度和证据规则决定。

#### F-04 项目作品导出

- 支持生成可下载的项目报告。
- 报告内容来自结构化项目数据，不直接导出未校验聊天文本。
- 保存课程、模板、数据集和评价规则版本，保证可复现。

### 里程碑 G：共享数据、教师端和机器人协同（后期）

#### G-01 学习状态接入 Core API

- 为学生学习状态提供鉴权、版本和幂等更新。
- FastAPI/PostgreSQL 成为正式业务真源。
- 本地存储变为离线缓存和待同步队列。
- 提供导出、删除和跨设备恢复。

#### G-02 教师查看

- 查看班级课程进度、知识点薄弱项、实验证据和项目作品。
- 教师只能访问所属班级。
- 不把学生原始聊天内容作为默认分析页面。

#### G-03 OrangePi 学习接力

- 网页和机器人共享活动 ID 和会话 ID。
- 机器人可朗读课程、接收白名单语音指令、播报实验结果。
- 机器人不得直接执行学生代码或模型生成命令。

#### G-04 可观测与生产化

- 增加活动、实验、AI 调用和同步 trace ID。
- 记录耗时、失败类型、模型和提示版本，不记录不必要的未成年人敏感内容。
- 增加备份、恢复、限流和成本统计。

## 9. AI 编程工具执行规则

### 9.1 开工前

每个新任务必须先执行并阅读：

```powershell
git -c safe.directory='E:/Orange pi System/mambo-k12-ai-robot-online-preview-source' status --short --branch
git -c safe.directory='E:/Orange pi System/mambo-k12-ai-robot-online-preview-source' diff --stat
```

然后读取任务涉及的源文件、测试和相邻实现。不得根据文件名猜测接口。

### 9.2 修改范围

- 每次只完成一个任务编号，例如只做 `A-02`。
- 保留用户和其他会话留下的修改。
- 不得删除 `.superpowers/`、`apps/web/tmp/` 或其他未跟踪目录。
- 不得使用 `git reset --hard`、`git clean`、`git checkout --` 回滚用户内容。
- 不得使用 `git add -A`；提交时只暂存任务明确涉及的文件。
- 不进行与当前任务无关的重构、依赖升级和格式化。
- 当前阶段只验收 PC 端；不要为了移动端改动现有 PC 布局。

### 9.3 测试策略

每个行为修改都必须有对应测试：

- 纯逻辑：单元测试。
- React 状态与无障碍：Testing Library。
- 路由和跨组件流程：集成测试。
- 视觉与真实交互：本地浏览器验收。
- 沙箱协议：正常、超时、异常输出和取消测试。
- 存储修改：迁移、损坏数据、容量上限和未知 ID 测试。

### 9.4 每项任务的最低验证

按实际文件替换测试路径：

```powershell
npm.cmd test --workspace apps/web -- --run <focused-test-files> --no-file-parallelism --maxWorkers=1
npm.cmd run typecheck --workspace apps/web
npm.cmd run lint --workspace apps/web -- <changed-source-files>
git -c safe.directory='E:/Orange pi System/mambo-k12-ai-robot-online-preview-source' diff --check
```

每个里程碑结束额外执行：

```powershell
npm.cmd test --workspace apps/web -- --run --no-file-parallelism --maxWorkers=1
npm.cmd run build --workspace apps/web
```

### 9.5 浏览器验收

当前阶段以 PC 为主，至少检查：

- `1440 x 900`。
- `1920 x 1080`。

每个页面必须验证：

- URL 和页面标题正确。
- 页面不为空，没有框架错误覆盖层。
- 控制台没有相关 error/warn。
- 主要文字没有裁切和重叠。
- 键盘焦点、Enter/Space、Escape 可用。
- 动画结束后的静态状态正确。
- 交互不会导致布局跳动。
- 刷新后需要恢复的状态能够恢复。

### 9.6 提交和部署

- 用户已明确要求先在本地完成并检查，不要每一步部署生产。
- 未经用户明确要求，不推送、不创建 PR、不部署。
- 本地验收通过后报告修改文件、验证命令、截图和剩余风险。
- 用户批准发布后，再进行窄范围提交、推送、部署和生产 URL 验证。

## 10. 里程碑验收总表

| 里程碑 | 可见成果 | 进入下一阶段条件 |
|---|---|---|
| A | 首页和旧链接都进入统一初中学习中心 | 阶段切换、兼容重定向、测试和 PC 浏览器验收通过 |
| B | 学习路径、解锁和进度状态可复用 | 配置校验、迁移和任务总览测试通过 |
| C | 初中第一章完整闭环 | 从知识小课到补救的真实流程可演示 |
| D | 初中五章和结业条件 | 研究挑战、知识资料和结业解锁可验证 |
| E | 高中代码与模型实验平台 | 代码、数据、指标和模型审计可运行 |
| F | 高中综合项目和答辩 | 项目报告可复现、答辩证据可追踪 |
| G | 跨端正式数据和教师端 | 鉴权、同步、隐私、备份和设备接力通过 |

## 11. 当前建议立即执行的任务顺序

后续 AI 编程工具应按以下顺序开始：

1. `A-01`：确认并保护当前工作树。
2. `A-02`：让旧初中目的地经云朵转场进入统一学习中心。
3. `A-03`：停止旧地图热点开发，完善课程、实验和学习状态入口。
4. `B-01`：建立学习路径配置和解锁纯函数。
5. `B-02`：扩展学习状态和迁移。
6. `C-01`：新增 `middle-ai-foundations`。
7. `C-02` 至 `C-07`：完成初中第一章纵向闭环。

在 `C-07` 完成并通过本地演示前，不要批量制作其他初中章节，也不要开始高中页面开发。第一章闭环将验证课程结构、实验模型、证据记录和补救方式是否正确，是后续扩展的模板。

## 12. 明确不在当前阶段处理的事项

- 移动端重新设计。
- 高中最终视觉背景和地图资产。
- 通用教师课程 CMS。
- 大型真实神经网络在线训练。
- 任意第三方 Python 包在线安装。
- 生产账号、班级和权限体系。
- 把每一步本地修改立即部署到生产。
- 为追求视觉效果重写已有小学地图和战斗系统。

这些事项只有在初中第一章闭环完成并经用户确认后，才能进入新的设计和实施文档。
