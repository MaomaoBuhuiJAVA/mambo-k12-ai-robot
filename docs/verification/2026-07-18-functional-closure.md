# 2026-07-18 功能收口验证补充

## 自动化

- Web Vitest：48 个测试文件，303 项测试通过。
- Web ESLint：通过。
- Web TypeScript：`tsc --noEmit` 通过。
- Next.js 生产构建：通过，`/`、`/lab`、`/progress` 和 AI/材料/设备 Route Handler 均生成成功。
- Pyodide smoke：`bubble-sort` 和 `image-classifier` 均通过。
- Python Core/device：此前验证 28 项通过；compileall、启动脚本语法和协议测试通过。
- 视觉伴侣线框稿只用于设计讨论，已在收口前清理，未进入产品构建。

## 云端链路

- Upstash Redis 已创建并连接到 `guoke-2y-knowledge-assistant-46k2`。
- `KV_REST_API_URL`、`KV_REST_API_TOKEN` 已覆盖 Preview、Production；本次未读取或展示密钥值。
- `d550d4a` Preview：`https://guoke-2y-knowledge-assistant-46k2-54o0go7s0.vercel.app`。
- 浏览器实测 `POST /api/chat` HTTP 200，收到 Gemini 真实回答，相关浏览器错误为空。
- Gemini 默认模型已从已下线的 `gemini-2.5-flash` 更新为 `gemini-3.5-flash`。
- Python 测试环境提示一个已有的 Starlette/httpx TestClient 弃用警告；没有失败项。

## 未完成的现场验收

- Vercel Production 仍需用户确认后再替换旧站点。
- Core API 公网 HTTPS/WSS、PostgreSQL 和 `CORE_API_*` 环境变量尚未形成可访问生产链路。
- OrangePi 新版 device-agent 需要在板端安装并重启 systemd；硬件音频、摄像头、屏幕和官方 NPU 示例已完成此前实机验证。
- 麦克风权限、移动端布局、Office 文件打开和公开域名验收需要在真实设备/浏览器完成。

详细功能、接口契约和前端重设计约束见 [`docs/handoff/functional-handoff.md`](../handoff/functional-handoff.md)。
