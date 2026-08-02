# 连续语音对话 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 让一次本地唤醒开启 30 秒免唤醒连续语音会话，星宝先播报“我在，请说”，超时后恢复唤醒词待机。

**Architecture:** 保留现有唤醒词守护进程与麦克风租约协议。RobotWorkspace 保存以 performance.now() 为准的连续会话截止时间；唤醒、有效语音开始和 TTS 播放结束都会续期。浏览器音频播放改为可等待完成，只有播放结束才重新开启环境音检测。

**Tech Stack:** Next.js client component、React refs/effects、TypeScript、Vitest + Testing Library、现有 /_mambo/wake 租约接口、PcmRecorder。

---

## File Structure

- Modify: apps/web/src/components/robot/robot-workspace.tsx — 连续会话定时、欢迎语、可等待 TTS、播报后恢复收音和状态文案。
- Modify: apps/web/src/components/robot/robot-workspace.test.tsx — 时间规则、唤醒欢迎语、租约保留与超时释放测试。
- Deploy: apps/web 生产构建；唤醒词守护进程和 systemd 单元不改动。

### Task 1: 定义可测的连续会话计时规则

**Files:**
- Modify: apps/web/src/components/robot/robot-workspace.tsx:64-155
- Test: apps/web/src/components/robot/robot-workspace.test.tsx

- [ ] **Step 1: 写入失败测试**

~~~tsx
import {
  CONTINUOUS_VOICE_SESSION_MS,
  isContinuousVoiceSessionExpired,
  nextContinuousVoiceDeadline,
} from "./robot-workspace";

it("opens and extends a local voice session for 30 seconds", () => {
  expect(CONTINUOUS_VOICE_SESSION_MS).toBe(30_000);
  expect(nextContinuousVoiceDeadline(1_000)).toBe(31_000);
  expect(nextContinuousVoiceDeadline(4_000)).toBe(34_000);
});

it("expires only when the monotonic deadline has elapsed", () => {
  const deadline = nextContinuousVoiceDeadline(1_000);
  expect(isContinuousVoiceSessionExpired(deadline, 30_999)).toBe(false);
  expect(isContinuousVoiceSessionExpired(deadline, 31_000)).toBe(true);
});
~~~

- [ ] **Step 2: 运行并确认红灯**

Run: npm exec vitest run src/components/robot/robot-workspace.test.tsx -t "30 seconds|monotonic deadline"

Expected: FAIL，因为三个时间规则导出尚不存在。

- [ ] **Step 3: 写入最小实现**

~~~ts
export const CONTINUOUS_VOICE_SESSION_MS = 30_000;

export function nextContinuousVoiceDeadline(now: number): number {
  return now + CONTINUOUS_VOICE_SESSION_MS;
}

export function isContinuousVoiceSessionExpired(deadline: number | null, now: number): boolean {
  return deadline !== null && now >= deadline;
}
~~~

组件边界只传入 performance.now()；不要使用 Date.now()。

- [ ] **Step 4: 运行并确认绿灯**

Run: npm exec vitest run src/components/robot/robot-workspace.test.tsx -t "30 seconds|monotonic deadline"

Expected: PASS。

- [ ] **Step 5: 提交计时契约**

~~~powershell
git add apps/web/src/components/robot/robot-workspace.tsx apps/web/src/components/robot/robot-workspace.test.tsx
git commit -m "feat: define continuous voice session window"
~~~

### Task 2: 将本地唤醒改为欢迎语后连续收音

**Files:**
- Modify: apps/web/src/components/robot/robot-workspace.tsx:680-1165
- Test: apps/web/src/components/robot/robot-workspace.test.tsx

- [ ] **Step 1: 写入失败的本地唤醒测试**

~~~tsx
it("greets after a local wake before starting continuous speech detection", async () => {
  const fetch = mockLocalWakeFetch();
  renderRobotWorkspace();

  await emitWakeSequence(2);

  expect(fetch).toHaveBeenCalledWith("/api/voice/tts", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ text: "我在，请说" }),
  }));
  expect(screen.getByText("连续对话中，可直接说话")).toBeInTheDocument();
});

it("does not release the wake lease before a continuous session expires", async () => {
  vi.useFakeTimers();
  const fetch = mockLocalWakeFetch();
  renderRobotWorkspace();

  await emitWakeSequence(2);
  await finishBrowserAudio();
  await vi.advanceTimersByTimeAsync(29_999);

  expect(fetch).not.toHaveBeenCalledWith("/_mambo/wake/release", expect.anything());
});

it("releases the wake lease after 30 seconds of continuous-session silence", async () => {
  vi.useFakeTimers();
  const fetch = mockLocalWakeFetch();
  renderRobotWorkspace();

  await emitWakeSequence(2);
  await finishBrowserAudio();
  await vi.advanceTimersByTimeAsync(30_000);

  expect(fetch).toHaveBeenCalledWith("/_mambo/wake/release", expect.objectContaining({ method: "POST" }));
});
~~~

mockLocalWakeFetch、emitWakeSequence 和 finishBrowserAudio 放在既有测试文件。finishBrowserAudio 触发捕获到的 Audio.onended，不模拟虚假的播放时长。

- [ ] **Step 2: 运行并确认红灯**

Run: npm exec vitest run src/components/robot/robot-workspace.test.tsx -t "greets after|does not release|releases the wake lease"

Expected: FAIL，因为当前唤醒事件直接调用 startAutoListening()，且播报结束会释放租约。

- [ ] **Step 3: 添加会话引用和超时清理**

~~~ts
const continuousVoiceDeadlineRef = useRef<number | null>(null);
const continuousVoiceTimerRef = useRef<number | null>(null);
const [continuousVoiceSession, setContinuousVoiceSession] = useState(false);

function closeContinuousVoiceSession() {
  continuousVoiceDeadlineRef.current = null;
  if (continuousVoiceTimerRef.current !== null) window.clearTimeout(continuousVoiceTimerRef.current);
  continuousVoiceTimerRef.current = null;
  setContinuousVoiceSession(false);
  releasePendingVoiceCapture();
  releaseRecorder(recorderRef.current);
  recorderRef.current = null;
  setAutoListening(false);
}

function extendContinuousVoiceSession() {
  const deadline = nextContinuousVoiceDeadline(performance.now());
  continuousVoiceDeadlineRef.current = deadline;
  setContinuousVoiceSession(true);
  if (continuousVoiceTimerRef.current !== null) window.clearTimeout(continuousVoiceTimerRef.current);
  continuousVoiceTimerRef.current = window.setTimeout(() => {
    if (isContinuousVoiceSessionExpired(continuousVoiceDeadlineRef.current, performance.now()) && phaseRef.current === "idle") {
      closeContinuousVoiceSession();
    }
  }, CONTINUOUS_VOICE_SESSION_MS);
}
~~~

当 phaseRef.current 为 listening、transcribing、thinking 或 speaking 时，超时回调不释放正在进行的回合；在该回合结束时再次调用 extendContinuousVoiceSession()。

- [ ] **Step 4: 使浏览器 TTS 可等待完成**

将 speak() 的浏览器音频部分改为等待 onended：

~~~ts
await new Promise<void>((resolve, reject) => {
  audio.onended = () => {
    releasePendingVoiceCapture(true);
    phaseRef.current = "idle";
    setPhase("idle");
    resolve();
  };
  audio.onerror = () => reject(new Error("tts_playback_failed"));
  void audio.play().catch(reject);
});
~~~

仍然在 TTS 之前调用 stopListeningForDevicePlayback()；连续会话中 onended 后调用 extendContinuousVoiceSession()，再调用 startAutoListening()。非连续会话保持现有释放租约的行为。

- [ ] **Step 5: 用欢迎语替换直接自动录音**

~~~ts
async function beginContinuousVoiceSession() {
  if (!localWakeWordModeRef.current || phaseRef.current !== "idle") return;
  extendContinuousVoiceSession();
  await claimWakeMicrophone();
  await speak("我在，请说");
  if (!isContinuousVoiceSessionExpired(continuousVoiceDeadlineRef.current, performance.now())) {
    await startAutoListening();
  }
}
~~~

在唤醒轮询中把 void startAutoListening() 改为 void beginContinuousVoiceSession()。在 beginAutoCapture() 中调用 extendContinuousVoiceSession()；在手动停止、ASR/TTS 失败和组件卸载路径调用 closeContinuousVoiceSession()。

- [ ] **Step 6: 运行并确认绿灯**

Run: npm exec vitest run src/components/robot/robot-workspace.test.tsx -t "greets after|does not release|releases the wake lease"

Expected: PASS。

- [ ] **Step 7: 提交连续租约行为**

~~~powershell
git add apps/web/src/components/robot/robot-workspace.tsx apps/web/src/components/robot/robot-workspace.test.tsx
git commit -m "feat: keep voice session open after wake"
~~~

### Task 3: 显示状态并执行完整验证

**Files:**
- Modify: apps/web/src/components/robot/robot-workspace.tsx:1506-1544
- Test: apps/web/src/components/robot/robot-workspace.test.tsx

- [ ] **Step 1: 写入失败的状态文案测试**

~~~tsx
it("shows continuous conversation status while the local wake lease is held", async () => {
  renderRobotWorkspace();

  await emitWakeSequence(2);

  expect(screen.getByText("连续对话中，可直接说话")).toBeInTheDocument();
});
~~~

- [ ] **Step 2: 运行并确认红灯**

Run: npm exec vitest run src/components/robot/robot-workspace.test.tsx -t "continuous conversation status"

Expected: FAIL，因为语音卡片当前只有“已唤醒”和唤醒词待机文案。

- [ ] **Step 3: 添加连续对话状态文案**

在本地唤醒词文案分支最前面加入：

~~~tsx
{localWakeWordMode
  ? continuousVoiceSession
    ? "连续对话中，可直接说话"
    : autoListening ? "已唤醒，正在监听你的问题" : wakeCaptureState === "awaiting_claim"
      ? "已唤醒，正在连接麦克风"
      : wakeWordStatus === "online"
        ? "本地唤醒词待机：请说“你好星宝”"
        : wakeWordStatus === "checking"
          ? "正在确认本地唤醒服务"
          : "本地唤醒服务不可用或正在恢复，可点击开始说话手动提问"
  : autoListening ? "自动监听环境音，可以直接说话" : "点击开始说话，或使用键盘输入"}
~~~

- [ ] **Step 4: 运行全部网页验证**

Run:

~~~powershell
npm exec vitest run src/components/robot/robot-workspace.test.tsx src/components/robot/voice-session.test.ts
npm exec vitest run src/components/robot
npm run typecheck
npm run lint
npm run build
~~~

Expected: 全部测试通过；typecheck、lint 和 build 均以 0 退出。

- [ ] **Step 5: 提交 UI 和验证改动**

~~~powershell
git add apps/web/src/components/robot/robot-workspace.tsx apps/web/src/components/robot/robot-workspace.test.tsx
git commit -m "feat: show continuous voice conversation state"
~~~

### Task 4: 部署并在 Orange Pi 验收

**Files:**
- Deploy only: apps/web 生产构建；不改动唤醒词守护进程或 systemd 单元。

- [ ] **Step 1: 启动已验证构建**

~~~powershell
$node = (Get-Command node).Source
$nextCli = "D:\Orange pi System\mambo-k12-ai-robot\node_modules\next\dist\bin\next"
Start-Process -FilePath $node -ArgumentList ('"' + $nextCli + '" start --port 3018') -WorkingDirectory "D:\Orange pi System\mambo-k12-ai-robot\apps\web" -WindowStyle Hidden
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3018/robot
~~~

Expected: /robot 返回 HTTP 200。

- [ ] **Step 2: 将开发板代理切到新构建**

~~~powershell
ssh orangepi "pkill -TERM -f '[l]ocal-web-proxy.py' || true
pkill -TERM -f '[l]aunch-robot-webkit.py' || true
nohup env ROBOT_BROWSER=webkit ROBOT_LOCAL_PROXY=1 ROBOT_PROXY_UPSTREAM=http://192.168.1.18:3018 /opt/mambo-k12-ai-robot/deploy/launch-robot-browser.sh >/tmp/mambo-robot-browser.log 2>&1 </dev/null &"
ssh orangepi "sleep 4
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/robot
curl -sS http://127.0.0.1:3010/_mambo/wake"
~~~

Expected: 页面返回 200；唤醒端点报告 online: true。

- [ ] **Step 3: 进行物理验收**

1. 只说一次“你好星宝”。
2. 确认扬声器播报“我在，请说”。
3. 在 30 秒内连续问两个问题，第二轮不说唤醒词。
4. 确认两轮语音都被识别并有回答。
5. 静默超过 30 秒后直接提问，确认不会开始录音。
6. 再次说“你好星宝”，确认可开启新会话。

- [ ] **Step 4: 检查提交范围**

~~~powershell
git status --short
~~~

Expected: 不提交 .next、日志或其他已有未提交改动。

