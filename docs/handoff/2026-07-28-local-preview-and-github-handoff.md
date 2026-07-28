# 2026-07-28 本地源码、前端与 GitHub 交接

## 1. 本次交接结论

- Git 仓库：`https://github.com/MaomaoBuhuiJAVA/mambo-k12-ai-robot.git`
- 当前工作分支：`online-preview-source`
- 本地源码目录：`E:\Orange pi System\mambo-k12-ai-robot-online-preview-source`
- 本次提交覆盖用户确认的全部现有本地改动：前端、AI 对话、OrangePi 设备链路、手势能力、素材、测试、部署配置与项目文档。
- 本文档所在目录是本次版本的交接入口；更完整的 OrangePi 运行说明见 `docs/handoff/2026-07-27-orangepi-robot-runtime.md`，生产部署要求见 `docs/deployment/production.md`。

## 2. 代码版本与本地预览的关系

本机曾同时存在两个相近的项目目录。后续修改和提交必须以第一个目录为准：

| 目录 | 角色 | 使用规则 |
|---|---|---|
| `E:\Orange pi System\mambo-k12-ai-robot-online-preview-source` | 当前源码、当前 Git 工作树、应提交的目录 | 所有代码和文档修改都在这里完成。 |
| `E:\Orange pi System\tmp\mambo-k12-board-production-full-20260727` | 旧的本地生产构建副本 | 仅用于排查历史预览，不应在此目录继续改前端。 |

此前浏览器的 `http://127.0.0.1:3002/preview` 被临时代理到旧生产构建，导致“文件已改但浏览器没有变化”。本次已经把 `3002` 代理切回当前源码服务：

```text
浏览器 http://127.0.0.1:3002/preview
        -> 本地 loopback proxy（仅本机临时进程）
        -> http://127.0.0.1:3001/preview
        -> apps/web 的 Next.js 源码服务
```

排查页面不一致时，先确认当前打开的 URL，再检查 `3001` 是否由本源码目录启动；不要把 `tmp` 目录的生产构建当作编辑目标。

## 3. 本地启动与验证

### Web 前端

在仓库根目录执行：

```powershell
npm.cmd install
npm.cmd run dev --workspace apps/web -- --hostname 127.0.0.1 --port 3001
```

直接访问 `http://127.0.0.1:3001/preview` 可避开临时代理。若确实需要使用 `3002`，需要另外启动本机 loopback proxy 并将其上游配置为 `3001`；该代理不属于仓库代码，也不应作为生产部署方案。

前端常用校验：

```powershell
npm.cmd test --workspace apps/web -- --run src/app/preview/page.test.tsx src/app/preview/page.module.css.test.ts src/app/preview/pet-panel-position.test.ts
npm.cmd run typecheck --workspace apps/web
```

截至本次交接，上述目标测试为 `33 passed`，类型检查通过。运行完整项目校验前，先阅读 `README.md` 和 `docs/deployment/production.md` 中的 Web、Core、Redis、AI 与 OrangePi 配置要求。

### Core 与 OrangePi

- `server/`：FastAPI Core、数据库迁移、学习记录、设备状态和语音服务。
- `device/`：OrangePi 设备代理，负责 WebSocket、摄像头、显示、媒体、进程和 NPU 能力。
- `deploy/`：OrangePi systemd 服务、浏览器 Kiosk、手势视觉和唤醒词部署脚本。
- `apps/web/src/app/api/`：Next.js BFF 路由，承接网页对 AI、Starbao、设备、语音和绘本的调用。

正式运行前必须使用被忽略的 `.env` 填写真实凭据；只能提交 `.env.example`。密钥、设备令牌、Redis Token、Core 管理令牌和 AI Provider Key 均不应进入 Git。

## 4. 当前前端实现

### 首页与学习引导

主页面在 `apps/web/src/app/preview/page.tsx`，样式在同目录 `page.module.css`。

- 首页引导替换为四步“星宝 AI 通识教育课堂”旅程卡片。
- 卡片依次采集学段、AI 熟练度和优先学习方式；最终动作是“开始学习”。
- 星宝主体使用本地透明素材，保留星光装饰；展示厅的三张学段图已进行视觉尺寸平衡。
- 机器人区域取消原来的圆形气泡式提示，改为像素木质相框内的星宝入口。
- 语音功能区展示真实聊天界面截图，并通过 CSS 裁剪掉右侧设备控制区；编程功能区改为简约深色终端样式。

相关组件与素材：

```text
apps/web/src/components/star-journey-card/
apps/web/public/assets/chat/
apps/web/public/assets/learning-stages/
apps/web/public/assets/external/
```

外部像素素材的归属信息记录在 `apps/web/public/assets/external/ATTRIBUTIONS.md`。新增资产应保留来源和许可证信息。

### 星宝聊天框

聊天状态由 `apps/web/src/features/starbao/use-shared-starbao-conversation.ts` 统一管理，网页和 OrangePi 的对话记录通过 Starbao API 共享。

当前首页聊天框行为：

1. 点击右下角星宝可打开或关闭对话。
2. 星宝头像本身仍可拖动；未手动移动聊天框时，聊天框会随头像更新锚点位置。
3. 打开后的聊天框可以从顶部标题栏拖动。关闭按钮不会触发拖拽。
4. 聊天框会限制在视口内；一旦用户手动移动，它会保持自由位置，不会在头像移动或窗口大小变化时跳回默认锚点。
5. 再次关闭并重新打开聊天框时，窗口恢复由星宝入口决定的默认位置。
6. 聊天面板使用中文身份信息，已移除设备标签页、快捷回复和“同步到香橙派播报”控件。

对应测试覆盖：

```text
apps/web/src/app/preview/page.test.tsx
apps/web/src/app/preview/page.module.css.test.ts
apps/web/src/app/preview/pet-panel-position.test.ts
```

### AI、语音与设备

- AI Provider、提示词和限流逻辑：`apps/web/src/lib/ai/`。
- 共享对话协议和 API：`apps/web/src/lib/starbao-core.ts`、`apps/web/src/app/api/starbao/`。
- 网页语音入口：`apps/web/src/app/api/chat/`、`api/transcribe/`、`api/voice/`。
- OrangePi 设备命令和状态转发：`apps/web/src/app/api/device/`、`apps/web/src/lib/core-proxy.ts`。
- 机器人页、手势光标、手势导航、面部身份和本地视觉能力：`apps/web/src/components/robot/`。

本地页面能否获得真实模型回复取决于 `.env` 中 AI、Core 和限流存储配置。聊天窗口可用和接口凭据齐全是两个独立条件：前端交互测试不等于生产 AI 链路已验收。

## 5. 重要新增文件与体积

本次新增了聊天背景与截图、学段素材、像素场景素材、MediaPipe WASM、手势模型和人脸模型。单个文件均低于 GitHub 的 100 MB 限制；当前最大的单文件为人脸识别 ONNX 模型，约 36.9 MiB。

提交和拉取时请预留网络与磁盘空间。若未来模型体积增长到 GitHub 单文件限制附近，应改用对象存储、发布包或 Git LFS，并同步调整下载与部署逻辑。

`git diff --check` 会报告部分导入的 MediaPipe 生成 JavaScript、许可证文本和历史 Markdown 中已有的尾随空格。它们属于第三方或历史内容；本次不对二进制和生成产物进行格式化，以避免无意义的上游差异。

## 6. 部署与运维边界

- Vercel 只负责 Web；发布设置和环境变量见 `docs/deployment/production.md`。
- Core 生产环境使用 PostgreSQL 和迁移，不能把本机 SQLite 当作生产数据库。
- OrangePi 的设备代理和 Kiosk 浏览器是独立进程；详细 systemd 和反向代理启动方式见 `docs/handoff/2026-07-27-orangepi-robot-runtime.md`。
- 生产环境仅使用 HTTPS/WSS；为局域网演示打开的非安全摄像头开关不能带入公网部署。
- 对外部署前需在 Preview 环境验证 AI、Redis 故障关闭、Core HTTPS、OrangePi WSS、桌面和移动端页面，以及真实设备硬件链路。

## 7. Git 提交与后续协作

本次提交目标是把当前整个工作区同步到远端 `online-preview-source` 分支。远端默认分支为 `main`；完成代码评审和部署验证后，再由仓库维护者决定是否合并到 `main`。

提交前检查项：

```powershell
git status -sb
git diff --stat
git diff --check
```

之后继续修改时：

1. 固定在 `mambo-k12-ai-robot-online-preview-source` 目录工作。
2. 新增用户可见行为时，先为该行为增加测试。
3. 修改页面后同时检查桌面和手机布局，尤其是固定定位的星宝与聊天框。
4. 提交前运行目标测试、类型检查，并确认没有 `.env` 或真实令牌被暂存。
5. 将分支推送到 GitHub 后，通过 Vercel Preview 复核，不把本地 `3002` 临时代理当作线上验收。

## 8. 已知待办与风险

- 本次已验证首页聊天框的 UI、拖动边界和前端类型；真实 AI 回复仍依赖部署环境中的 Provider、Redis 和 Core 配置。
- 大型模型与 WASM 资产会增加克隆、安装和部署时间；首次部署后要确认 Vercel 构建输出与浏览器资源加载。
- 当前工作树包含跨前端、Core、设备端和文档的集中改动。后续如需拆分发布，建议从这次提交之后再按功能拆分，而不是回滚或混合本次用户确认的完整改动。
