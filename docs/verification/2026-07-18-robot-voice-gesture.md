# 机器人语音与手势验收记录

## 已验证

- 网页 `/robot` 已完成生产构建，800x480 页面无横向溢出。
- 百度 ASR/TTS 路由、Token 缓存、鉴权和错误映射已通过 Core 测试。
- 浏览器端使用 MediaPipe Hand Landmarker WASM/CPU 处理本地摄像头帧；张手移动光标，握拳保持 1.2 秒后触发一次页面内按钮点击。
- 手势模型加载失败或摄像头无权限时，页面回退鼠标/键盘，并保留文字对话。
- OrangePi SSH、摄像头设备和 `mambo-device-agent` 已确认可用。
- OrangePi 官方 VIPLite 冒烟样例已运行成功：`vpm_run -s sample.txt -l 1 -b 1`，记录的单帧推理耗时约 `2904us`。

## 尚需现场配置

- Core 服务器需要在受保护的 `.env` 中配置 `BAIDU_APP_ID`、`BAIDU_API_KEY`、`BAIDU_SECRET_KEY`；密钥不写入开发板、不提交 Git。
- `/robot` 需要从 OrangePi 浏览器访问运行中的 Web 服务地址；当前板上未发现 Chromium/Firefox 命令，需确认实际桌面浏览器或安装策略。
- 现有 `/opt/yolov5/model/yolov5.nb` 是目标检测模型，不能作为手势模型。手势识别首版走浏览器 CPU；若改用 NPU，需要供应商转换工具、手部模型和输入输出说明。

## 安全提醒

截图中曾显示百度 API Key 和 Secret Key。完成替换前应在百度控制台撤销/轮换已暴露的旧密钥，再把新值仅写入 Core 服务环境变量。
