# 2026-07-27 香橙派机器人运行交接

> 下一位 AI 接手香橙派机器人页面、Kiosk 或手势功能前，先阅读本文。命令、路径、端口和进程名保持原样，方便直接执行。

## 一、当前结果

香橙派当前通过 WebKit 全屏显示 `/robot` 页面。板端本地代理、手势视觉服务、唤醒词服务和 Windows 生产页面均已验证可用。

- 香橙派地址：`192.168.1.26`
- Windows 主机地址：`192.168.1.18`
- 香橙派用户：`orangepi`
- 不要把密码写入仓库或文档。当前没有配置 SSH 公钥；需要连接时使用用户提供的凭据，并在连接结束后删除临时 askpass 文件。
- 当前 Git 工作区：`E:\Orange pi System\mambo-k12-ai-robot-online-preview-source`
- 当前分支：`online-preview-source`
- 工作区包含大量既有修改。禁止使用 `git reset --hard`、`git checkout --`、批量清理或自动提交。

## 二、实际运行链路

```text
香橙派 WebKit
  -> http://127.0.0.1:3010/robot
  -> /opt/mambo-k12-ai-robot/deploy/local-web-proxy.py
  -> http://192.168.1.18:3002
  -> E:\Orange pi System\tmp\codex-loopback-proxy.cjs
  -> http://127.0.0.1:3003
  -> Next.js 生产服务
```

Windows 当前端口分工：

| 端口 | 作用 | 注意事项 |
| --- | --- | --- |
| `3001` | 用户自己的 `next dev` 开发服务 | 不要停止；它不是香橙派 Kiosk 的上游。 |
| `3002` | `codex-loopback-proxy.cjs`，向局域网开放 | 除非重建整条代理链，否则不要停止。 |
| `3003` | 当前 `next start` 生产服务 | 页面修改后重新构建并重启这个服务。 |

当前生产构建副本不是 Git 工作区，而是：

```text
E:\Orange pi System\tmp\mambo-k12-board-production-full-20260727
```

香橙派的 `3010` 只监听设备本机回环地址，因此 Windows 直接访问 `192.168.1.26:3010` 失败是正常的。要检查它，必须通过 SSH 在香橙派上执行命令。

## 三、香橙派服务

检查板端服务：

```bash
pgrep -af 'launch-robot-webkit.py|local-web-proxy.py|mambo-hand-vision.py|wakeword-daemon.py'
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/robot
curl -sS http://127.0.0.1:3010/_mambo/hand/status
```

预期状态：

- `/robot` 返回 `200`。
- `/_mambo/hand/status` 中包含 `"status":"running"`。
- 手势视觉 FPS 曾在 7-12 FPS 之间波动。V 手势滚动按真实时间间隔计算，正常低帧率不会直接改变滚动速度。
- WebKit 当前由 `nohup` 启动，可能显示 `PPID 1`；Windows 生产页面更新后不会自动重新加载，需要手动重启 WebKit。

更新 Windows 生产服务后，只重启 WebKit 页面进程，使用现有代理参数：

```bash
nohup env \
  ROBOT_URL=http://127.0.0.1:3010/robot \
  ROBOT_BROWSER=webkit \
  ROBOT_LOCAL_PROXY=1 \
  ROBOT_PROXY_UPSTREAM=http://192.168.1.18:3002 \
  DISPLAY=:0 \
  XAUTHORITY=/home/orangepi/.Xauthority \
  /opt/mambo-k12-ai-robot/deploy/launch-robot-browser.sh \
  >/tmp/mambo-robot-browser.log 2>&1 </dev/null &
```

刷新页面时不要停止以下服务：

- `local-web-proxy.py`
- `mambo-hand-vision.py`
- `wakeword-daemon.py`

## 四、生产部署步骤

1. 只把本次修改涉及的运行时文件从 Git 工作区同步到生产构建副本。
2. 在生产构建副本中使用 Webpack 构建：

```powershell
Set-Location 'E:\Orange pi System\tmp\mambo-k12-board-production-full-20260727'
npm run build --workspace apps/web -- --webpack
```

`apps/web/next.config.ts` 中存在 Webpack alias。Next 16 默认选择 Turbopack，直接执行 `next build` 会因为自定义 Webpack 配置而失败，所以必须加 `--webpack`。

3. 构建成功后，只替换 `3003` 的生产服务：

```powershell
npm run start --workspace apps/web -- --hostname 0.0.0.0 --port 3003
```

4. 在 Windows 上确认生产页可用：

```powershell
curl.exe -sS -o NUL -w "%{http_code}" http://127.0.0.1:3003/robot
```

5. 通过 SSH 重启香橙派 WebKit，再确认板端 `3010/robot` 返回 `200`。

不要使用 `next dev` 作为香橙派上游。板端本地代理不会转发 HMR WebSocket，使用开发模式会导致页面重复刷新、组件闪烁，并可能导致语音和手势初始化失败。

## 五、最新 V 手势行为

相关文件：

- `apps/web/src/components/robot/gesture-controller.ts`
- `apps/web/src/components/robot/robot-gesture-provider.tsx`
- `apps/web/src/components/robot/gesture-pointer.tsx`
- `apps/web/src/components/robot/robot.module.css`

当前行为约定：

1. 两指摆成 V 后，保持至少 200ms。
2. 手位于摄像头画面上方 40% 区域：页面持续向上滚动。
3. 手位于摄像头画面下方 40% 区域：页面持续向下滚动。
4. 手位于中间 20% 区域：页面暂停滚动。
5. 丢失追踪、松开 V 手势或变成其他手势：立即停止滚动。
6. 默认速度为 `0.3` 个标准化页面单位/秒，已从 `0.5` 调低。
7. 单次手势视觉帧间隔超过 250ms 时跳过该帧，不在恢复后产生突然补偿跳动。
8. 向上滚动时指针显示 Lucide 上箭头，向下滚动时显示 Lucide 下箭头，中间暂停时保留中性提示。

`robot-gesture-provider.tsx` 以控制器事件为准：负 `deltaY` 映射为 `scroll_up`，正 `deltaY` 映射为 `scroll_down`。不要在界面层仅根据手的位置自行推断滚动方向。

## 六、测试和验证

部署前至少运行：

```powershell
npm run test --workspace apps/web -- gesture-controller.test.ts gesture-pointer.test.tsx robot-gesture-provider.test.tsx robot-workspace.test.tsx
npm run typecheck --workspace apps/web
```

2026-07-27 最新完整验证：

```powershell
npm run test --workspace apps/web
npm run typecheck --workspace apps/web
```

结果：74 个测试文件、539 项测试全部通过；TypeScript 检查通过；Windows 生产页和香橙派本地 `/robot` 均返回 `200`。

## 七、硬件连接和剩余事项

- 视频连接：香橙派 HDMI 接显示开发板 Micro HDMI。
- USB 连接：香橙派 USB 接显示开发板 Type-C。
- 触控板开发板通过标有 `USB IIC TY V1` 的排线连接到大屏开发板。
- 触控板开发板标记为 `EP43056-V1`。
- 屏幕触控在物理上已确认存在，但本次交接没有完成 Linux 输入设备层面的最终验证。后续应先检查输入设备并使用 `evtest`，再决定是否需要驱动。
- `README.md` 中的通用 Kiosk 示例使用 `3001`；当前实际香橙派链路是 `3002 -> 3003`，以本文为准。修改前必须先检查端口监听情况。
- 当前没有为 Kiosk 浏览器创建永久 systemd 服务，因此重启生产页面后仍需手动重启 WebKit。

## 八、快速状态检查

Windows：

```powershell
Get-NetTCPConnection -LocalPort 3001,3002,3003 -State Listen
curl.exe -sS -o NUL -w "%{http_code}" http://127.0.0.1:3003/robot
```

香橙派 SSH 会话中：

```bash
pgrep -af 'launch-robot-webkit.py|local-web-proxy.py|mambo-hand-vision.py|wakeword-daemon.py'
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/robot
curl -sS http://127.0.0.1:3010/_mambo/hand/status
```
