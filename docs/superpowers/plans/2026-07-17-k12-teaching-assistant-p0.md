# Mambo K12 教学助手 P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有 FastAPI 设备网关的前提下，交付一个可部署到 Vercel、覆盖赛题六种多模态能力和个性化闭环的 K12 AI 教学助手网页原型。

**Architecture:** 仓库保持 Python 设备网关，新增 `apps/web` Next.js App Router 应用。网页通过受保护的 Route Handler 调用 Gemini，通过同一领域模型承载四学段课程、动画、绘本、编程练习、测验和掌握度；数据库未配置时使用版本化 localStorage 适配器，配置 Core API 后同步设备与学习记录。

**Tech Stack:** Next.js 16、React、TypeScript、Vercel AI SDK、Google Gemini、Vitest、Testing Library、Playwright、Monaco Editor、Pyodide、docx、PptxGenJS、现有 FastAPI/SQLAlchemy。

---

## 文件结构

```text
package.json                         根工作区脚本
vercel.json                         Vercel 从仓库根目录构建 apps/web
apps/web/src/app/                    页面、布局和 Route Handlers
apps/web/src/components/             应用壳与通用控件
apps/web/src/features/chat/          多模态对话、录音、朗读
apps/web/src/features/courses/       四学段课程与材料下载
apps/web/src/features/animation/     冒泡排序和神经网络动画
apps/web/src/features/storybook/     绘本生成、翻页和导出
apps/web/src/features/lab/           Monaco/Pyodide Python 实验
apps/web/src/features/quiz/          三类题型、批改与反馈
apps/web/src/features/progress/      掌握度、推荐和学习历史
apps/web/src/features/device/        Core API 设备状态读取
apps/web/src/lib/                    领域类型、持久化、AI 与安全策略
apps/web/src/data/                   原创课程种子数据
apps/web/src/**/*.test.ts(x)         单元与组件测试
apps/web/e2e/                        关键学习闭环端到端测试
```

### Task 1: 工作区与测试基线

**Files:**
- Create: `package.json`
- Create: `vercel.json`
- Create: `apps/web/**`（由 create-next-app 生成）
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Modify: `.gitignore`

- [ ] **Step 1: 生成 Next.js App Router 应用**

Run:

```powershell
npx create-next-app@latest apps/web --typescript --eslint --app --src-dir --use-npm --import-alias "@/*" --no-tailwind --yes
```

Expected: `apps/web/src/app/page.tsx` 存在且初始构建成功。

- [ ] **Step 2: 按 AI SDK 规范安装并检查本地文档**

Run:

```powershell
npm install ai --workspace apps/web
rg -n "streamText|Output.object|toTextStreamResponse" node_modules/ai/docs node_modules/ai/src
```

Expected: 先只安装 `ai`，并从已安装版本确认 API。

- [ ] **Step 3: 安装其余运行与测试依赖**

Run:

```powershell
npm install @ai-sdk/google zod lucide-react docx pptxgenjs @monaco-editor/react --workspace apps/web
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test --workspace apps/web
```

Expected: lockfile 固定全部依赖，浏览器端不包含任何服务端密钥。

- [ ] **Step 4: 添加测试配置并先运行空基线**

Run:

```powershell
npm run test --workspace apps/web -- --run
npm run lint --workspace apps/web
```

Expected: 测试运行器可启动，ESLint 无错误。

### Task 2: 领域模型、四学段课程和本地持久化

**Files:**
- Create: `apps/web/src/lib/domain.ts`
- Create: `apps/web/src/lib/stage-policy.ts`
- Create: `apps/web/src/lib/learning-store.ts`
- Create: `apps/web/src/data/curriculum.ts`
- Test: `apps/web/src/lib/stage-policy.test.ts`
- Test: `apps/web/src/lib/learning-store.test.ts`

- [ ] **Step 1: 写学段策略失败测试**

```ts
it('为低年级选择故事化短回复策略', () => {
  expect(getStagePolicy('lower_primary')).toMatchObject({
    tone: 'story',
    maxAnswerChars: 220,
    preferredModes: ['voice', 'storybook', 'game'],
  });
});
```

Run: `npm run test --workspace apps/web -- stage-policy.test.ts --run`

Expected: FAIL，因为 `getStagePolicy` 尚不存在。

- [ ] **Step 2: 实现四学段策略并通过测试**

实现 `lower_primary`、`upper_primary`、`middle_school`、`high_school` 的语气、深度、回答长度、首选交互和代码难度映射。

Run: `npm run test --workspace apps/web -- stage-policy.test.ts --run`

Expected: PASS。

- [ ] **Step 3: 写掌握度与迁移失败测试**

```ts
it('正确答案提升掌握度且结果限制在 0 到 1', () => {
  expect(updateMastery(0.55, { score: 1, hints: 0 })).toBeCloseTo(0.66);
  expect(updateMastery(0.99, { score: 1, hints: 0 })).toBe(1);
});
```

Run: `npm run test --workspace apps/web -- learning-store.test.ts --run`

Expected: FAIL，因为版本化存储与掌握度函数尚不存在。

- [ ] **Step 4: 实现版本化学习者状态**

存储 `profile`、`masteryByKnowledgePoint`、`attempts`、`recentTopics`、`interests` 和 `lastCourseId`；服务端渲染时使用内存默认值，浏览器挂载后再读取 `localStorage`。

Run: `npm run test --workspace apps/web -- learning-store.test.ts --run`

Expected: PASS，损坏 JSON 会回退到安全默认值。

- [ ] **Step 5: 写入原创种子课程**

每个学段至少两个单元；“冒泡排序”和“图像分类”包含目标、分层讲解、材料、动画脚本、绘本页、Python 代码框架、三类测验及知识点标签。内容必须原创，不摘录受版权保护教材。

### Task 3: 产品壳与主学习工作台

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/stage-switcher.tsx`
- Create: `apps/web/src/components/learning-workspace.tsx`
- Test: `apps/web/src/components/stage-switcher.test.tsx`

- [ ] **Step 1: 写学段切换组件失败测试**

```tsx
it('选择高中后通知父组件', async () => {
  const onChange = vi.fn();
  render(<StageSwitcher value="lower_primary" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: '高中' }));
  expect(onChange).toHaveBeenCalledWith('high_school');
});
```

Expected: FAIL，因为组件尚不存在。

- [ ] **Step 2: 实现响应式应用壳**

桌面为左侧主导航、中央学习区、右侧上下文画布；移动端为顶部标题、底部五项导航和全宽内容。所有按钮具备可见焦点、工具提示或可访问名称，图标统一使用 Lucide。

- [ ] **Step 3: 建立设计令牌**

使用白色主背景、炭黑文本、青绿色主操作、珊瑚色学习反馈和黄色高亮；圆角不超过 8px；无装饰渐变、无嵌套卡片、无营销 Hero。

- [ ] **Step 4: 通过组件测试与无障碍检查**

Run:

```powershell
npm run test --workspace apps/web -- stage-switcher.test.tsx --run
npm run lint --workspace apps/web
```

Expected: PASS，移动导航不会与主内容重叠。

### Task 4: Gemini 多模态对话、语音和图片

**Files:**
- Create: `apps/web/src/lib/ai/prompt.ts`
- Create: `apps/web/src/lib/ai/provider.ts`
- Create: `apps/web/src/app/api/chat/route.ts`
- Create: `apps/web/src/app/api/transcribe/route.ts`
- Create: `apps/web/src/features/chat/chat-panel.tsx`
- Create: `apps/web/src/features/chat/media-input.tsx`
- Test: `apps/web/src/lib/ai/prompt.test.ts`
- Test: `apps/web/src/app/api/chat/route.test.ts`

- [ ] **Step 1: 写提示词约束失败测试**

```ts
it('低年级系统提示包含年龄适配和安全约束', () => {
  const prompt = buildTutorPrompt({ stage: 'lower_primary', topic: '图像分类' });
  expect(prompt).toContain('小学低年级');
  expect(prompt).toContain('不索取真实姓名、住址或联系方式');
});
```

Expected: FAIL，因为提示词构建器尚不存在。

- [ ] **Step 2: 实现可替换 AI Provider**

使用 `GOOGLE_GENERATIVE_AI_API_KEY` 和可配置 `GEMINI_MODEL`；Route Handler 只返回必要错误码，不泄露上游响应、密钥或完整系统提示。

- [ ] **Step 3: 实现流式文字与图片问答**

客户端发送文本和经过大小/MIME 校验的单张图片；服务端将消息转换为 Gemini 支持的内容部分并流式返回文本。未配置密钥时返回可识别的 `AI_NOT_CONFIGURED`，界面继续提供种子课程演示。

- [ ] **Step 4: 实现录音转写与浏览器朗读**

录音使用 `MediaRecorder`，限制时长和文件大小；`/api/transcribe` 使用 Gemini 音频理解返回文字。回答朗读采用浏览器 `speechSynthesis`，提供播放、暂停和停止状态。

- [ ] **Step 5: 验证错误与安全边界**

Run:

```powershell
npm run test --workspace apps/web -- prompt.test.ts route.test.ts --run
```

Expected: 缺少密钥、非法 MIME、超限附件和上游失败均得到稳定、无敏感信息的响应。

### Task 5: 教学材料、动画与绘本

**Files:**
- Create: `apps/web/src/features/courses/resource-library.tsx`
- Create: `apps/web/src/app/api/materials/docx/route.ts`
- Create: `apps/web/src/app/api/materials/pptx/route.ts`
- Create: `apps/web/src/features/animation/bubble-sort-animation.tsx`
- Create: `apps/web/src/features/animation/neural-network-animation.tsx`
- Create: `apps/web/src/features/storybook/storybook-player.tsx`
- Create: `apps/web/src/app/api/storybook/route.ts`
- Test: `apps/web/src/features/animation/bubble-sort.test.ts`
- Test: `apps/web/src/features/storybook/storybook.test.ts`

- [ ] **Step 1: 写冒泡排序状态机失败测试**

```ts
it('一轮比较后把最大值移动到末尾', () => {
  const states = buildBubbleSortFrames([3, 1, 2]);
  expect(states.some((frame) => frame.values.join(',') === '1,2,3')).toBe(true);
});
```

Expected: FAIL，因为帧生成器尚不存在。

- [ ] **Step 2: 实现两个可控动画**

冒泡排序支持播放、暂停、单步、重置、速度；神经网络支持输入像素、隐藏特征、类别概率逐层点亮。两者都提供当前步骤的年龄适配文字。

- [ ] **Step 3: 写绘本结构校验失败测试**

要求 4 到 8 页，每页有 `title`、`narration`、`scene` 和互动问题；不合格 AI 输出回退到原创种子绘本。

- [ ] **Step 4: 实现绘本生成和阅读器**

结构化生成绘本文字，插画接口可用时生成场景图，不可用时使用项目内原创场景资产；支持翻页、朗读、互动回答和重新生成。

- [ ] **Step 5: 实现 Word/PPT 下载**

Word 包含学习目标、讲解、活动和测验；PPT 包含封面、概念、动画步骤、练习和总结。文件名、MIME 和中文内容正确。

- [ ] **Step 6: 运行单元和路由测试**

Run: `npm run test --workspace apps/web -- animation storybook materials --run`

Expected: PASS，下载文件非空且绘本始终满足页数约束。

### Task 6: Python 编程实验室

**Files:**
- Create: `apps/web/src/app/lab/page.tsx`
- Create: `apps/web/src/features/lab/python-lab.tsx`
- Create: `apps/web/src/features/lab/pyodide.worker.ts`
- Create: `apps/web/src/features/lab/lab-protocol.ts`
- Test: `apps/web/src/features/lab/lab-protocol.test.ts`

- [ ] **Step 1: 写 Worker 协议失败测试**

```ts
it('拒绝超过执行时限的请求配置', () => {
  expect(() => parseRunRequest({ code: 'print(1)', timeoutMs: 30000 })).toThrow();
});
```

Expected: FAIL，因为协议解析器尚不存在。

- [ ] **Step 2: 实现 Monaco 编辑与 Pyodide Worker**

预置冒泡排序和简单分类两个代码框架；运行在独立 Worker，捕获 stdout/stderr，限制单次执行时长，超时后终止并重建 Worker。

- [ ] **Step 3: 实现调试反馈**

显示运行、停止、重置按钮，正确输出和行号化错误；完成挑战后写入尝试记录和掌握度。明确浏览器实验仅用于课程练习，不作为服务端正式判题沙箱。

- [ ] **Step 4: 运行协议测试和浏览器流程测试**

Expected: 正常代码输出可见，无限循环可停止，重置恢复课程代码框架。

### Task 7: 游戏化练习与个性化闭环

**Files:**
- Create: `apps/web/src/features/quiz/quiz-engine.ts`
- Create: `apps/web/src/features/quiz/quiz-player.tsx`
- Create: `apps/web/src/features/progress/progress-dashboard.tsx`
- Create: `apps/web/src/features/progress/recommendation.ts`
- Test: `apps/web/src/features/quiz/quiz-engine.test.ts`
- Test: `apps/web/src/features/progress/recommendation.test.ts`

- [ ] **Step 1: 写三类题型批改失败测试**

覆盖单选、排序、代码执行轨迹；断言分数、知识点和年龄适配反馈。

- [ ] **Step 2: 实现确定性批改器**

答案只在本地课程数据或服务端保存，客户端提交后得到 `correct`、`score`、`feedback` 和 `nextAction`；禁止让大模型直接决定客观题正确性。

- [ ] **Step 3: 写推荐算法失败测试**

低掌握度优先复习，相近难度优先，兴趣只作为同等候选的排序因子；已连续掌握的知识点进入间隔复习队列。

- [ ] **Step 4: 实现学习闭环与进度页**

答题后更新掌握度、连续正确、提示使用和最近学习；进度页显示知识点趋势、推荐下一课和最近作品，不使用虚假统计。

- [ ] **Step 5: 运行全部领域测试**

Run: `npm run test --workspace apps/web -- --run`

Expected: 所有测试通过，四学段切换后推荐与反馈发生可重复变化。

### Task 8: 设备状态与 Core API 适配

**Files:**
- Create: `apps/web/src/lib/core-api.ts`
- Create: `apps/web/src/app/api/device/route.ts`
- Create: `apps/web/src/features/device/device-status.tsx`
- Test: `apps/web/src/lib/core-api.test.ts`

- [ ] **Step 1: 写设备响应归一化失败测试**

测试在线、离线、Core API 未配置和请求超时四种状态，浏览器永远不接触 `ADMIN_API_TOKEN`。

- [ ] **Step 2: 实现服务端代理**

Route Handler 从 `CORE_API_URL` 与 `CORE_API_ADMIN_TOKEN` 调用现有 FastAPI；只向前端返回设备名、在线状态、最后心跳和能力列表。

- [ ] **Step 3: 实现工作台设备状态**

在线时展示“机器人已连接”和能力；离线或未配置时明确展示网页独立可用，不阻断教学流程。

- [ ] **Step 4: 验证现有 Python 回归测试**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Expected: 现有 6 项设备与学习 API 测试仍通过。

### Task 9: 部署、安全与全链路验收

**Files:**
- Create: `apps/web/.env.example`
- Modify: `README.md`
- Create: `apps/web/e2e/learning-flow.spec.ts`
- Create: `docs/verification/p0-fidelity-ledger.md`

- [ ] **Step 1: 完成环境变量模板**

只列键名：`GOOGLE_GENERATIVE_AI_API_KEY`、`GEMINI_MODEL`、`CORE_API_URL`、`CORE_API_ADMIN_TOKEN`。真实值仅进入被忽略的 `.env.local` 与 Vercel 加密环境变量。

- [ ] **Step 2: 写端到端学习闭环**

Playwright 流程：选择学段 -> 打开冒泡排序课程 -> 播放动画 -> 完成练习 -> 查看掌握度变化 -> 打开 Python 实验 -> 返回工作台。

- [ ] **Step 3: 全量静态与构建验证**

Run:

```powershell
npm run test --workspace apps/web -- --run
npm run lint --workspace apps/web
npm run build --workspace apps/web
.\.venv\Scripts\python.exe -m pytest
```

Expected: 全部退出码为 0，构建日志无密钥和未处理警告。

- [ ] **Step 4: 浏览器视觉验收**

在 1440×900、1024×768、390×844 三个视口检查首屏、课程、动画、绘本、实验、测验和进度；截图与视觉基准逐项比较布局、字级、颜色、容器、图标、资源和响应式，无溢出或遮挡。

- [ ] **Step 5: Vercel 预览与生产部署**

CLI 登录后链接用户已有项目，先拉取环境变量名称并确认数据库是否存在；添加 Gemini 密钥到 Preview/Production，部署 Preview、验证 `/api/chat`，再部署 Production。若未绑定 Postgres，保留 localStorage 演示模式并在部署说明中列为生产化待办。

- [ ] **Step 6: 安全收尾**

扫描仓库与构建产物，确认没有用户提供的 Gemini 或百度密钥；百度语音凭据只通过 Core 环境变量注入。提醒用户轮换已经在对话中暴露的所有密钥。

## 计划自检

- 赛题六类多模态能力均有对应任务和可运行验收。
- 四学段适配、主动教学提示、掌握度和下一课推荐形成闭环。
- Vercel 网页与持久 WebSocket 设备网关保持职责分离。
- 所有新领域函数先写失败测试，再写最小实现。
- 无待定项、占位密钥或受版权保护教材摘录。
