"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Hand,
  Keyboard,
  Mic,
  MonitorUp,
  Play,
  Send,
  Square,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";

import { getFeaturedCourses } from "@/data/curriculum";
import type { Stage } from "@/lib/domain";

import styles from "./robot.module.css";
import { GestureController, type GestureEvent } from "./gesture-controller";
import { BrowserHandTracker, createBrowserHandTracker } from "./hand-tracker";
import { PcmRecorder } from "./voice-session";

type RobotPhase = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";
type RobotMessage = { id: string; author: "assistant" | "learner"; text: string };
type DeviceStatus = "checking" | "online" | "offline" | "unavailable";

const STAGE: Stage = "lower_primary";
const course = getFeaturedCourses(STAGE)[0];

function initialMessages(): RobotMessage[] {
  return [
    {
      id: "welcome",
      author: "assistant",
      text: `你好，我是 Mambo。今天我们一起学习“${course.title}”。`,
    },
    {
      id: "guide",
      author: "assistant",
      text: course.explanation.keyIdeas[0],
    },
  ];
}

async function readText(response: Response): Promise<string> {
  if (!response.ok || !response.body) throw new Error("voice_upstream_failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return `${text}${decoder.decode()}`.trim();
}

function stopCameraStream(video: HTMLVideoElement | null): void {
  const source = video?.srcObject as { getTracks?: () => MediaStreamTrack[] } | null;
  for (const track of source?.getTracks?.() ?? []) track.stop();
  if (video) video.srcObject = null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("gesture_model_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function RobotWorkspace() {
  const [messages, setMessages] = useState<RobotMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<RobotPhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("checking");
  const [deviceMessage, setDeviceMessage] = useState("正在读取设备状态");
  const [gestureProgress, setGestureProgress] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [gestureStatus, setGestureStatus] = useState<"off" | "loading" | "ready" | "error">("off");
  const [gestureError, setGestureError] = useState("");
  const pageRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const handTrackerRef = useRef<BrowserHandTracker | null>(null);
  const gestureControllerRef = useRef(new GestureController());
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((message) => message.author === "learner")?.text ?? "",
    [messages],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/device", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { online?: boolean; status?: DeviceStatus; name?: string | null }) => {
        if (!active) return;
        const online = data.online === true;
        setDeviceStatus(online ? "online" : data.status === "unavailable" ? "unavailable" : "offline");
        setDeviceMessage(online ? `${data.name ?? "OrangePi"} 已连接` : "设备离线，文字课堂仍可用");
      })
      .catch(() => {
        if (!active) return;
        setDeviceStatus("unavailable");
        setDeviceMessage("设备状态暂不可用");
      });
    const video = videoRef.current;
    return () => {
      active = false;
      recorderRef.current?.cancel();
      handTrackerRef.current?.stop();
      stopCameraStream(video);
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || phase === "thinking" || phase === "transcribing" || phase === "listening") return;
    const userMessage = { id: crypto.randomUUID(), author: "learner" as const, text: question };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setTranscript("");
    setError("");
    setPhase("thinking");
    try {
      const history = [...messages, userMessage]
        .slice(-18)
        .map((message) => ({ role: message.author === "learner" ? "user" as const : "assistant" as const, content: message.text }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: STAGE, courseId: course.id, messages: history }),
      });
      const answer = await readText(response);
      setMessages((current) => [...current, { id: crypto.randomUUID(), author: "assistant", text: answer }]);
      try {
        await speak(answer);
      } catch {
        setError("百度语音暂时不可用，文字回答已保留。你仍然可以继续提问。");
        setPhase("error");
      }
    } catch {
      setError("回答或语音服务暂时不可用，可以继续文字提问。");
      setPhase("error");
    }
  }

  async function speak(text: string) {
    const response = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error("tts_failed");
    const blob = await response.blob();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    audioRef.current?.pause();
    const audio = new Audio();
    audio.src = url;
    audio.onended = () => setPhase("idle");
    audioRef.current = audio;
    setPhase("speaking");
    await audio.play();
  }

  async function startRecording() {
    if (phase !== "idle" && phase !== "error") return;
    setError("");
    setTranscript("");
    try {
      const recorder = new PcmRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      setPhase("listening");
    } catch {
      setError("无法访问麦克风，请检查浏览器权限或改用文字输入。");
      setPhase("error");
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || phase !== "listening") return;
    setPhase("transcribing");
    try {
      const wav = await recorder.stop();
      recorderRef.current = null;
      const response = await fetch("/api/voice/asr", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wav,
      });
      if (!response.ok) throw new Error("asr_failed");
      const result = await response.json() as { text?: string };
      const text = result.text?.trim();
      if (!text) throw new Error("empty_asr");
      setTranscript(text);
      await ask(text);
    } catch {
      recorder.cancel();
      recorderRef.current = null;
      setError("百度语音识别暂时不可用，请重试或改用文字输入。");
      setPhase("error");
    }
  }

  function handleGestureEvent(event: GestureEvent) {
    if (event.type === "cursor_move") {
      setCursor({ x: event.x, y: event.y });
      return;
    }
    if (event.type === "progress") {
      setGestureProgress(event.value);
      return;
    }
    if (event.type === "tracking_lost") {
      setGestureProgress(0);
      return;
    }
    const page = pageRef.current;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + event.x * rect.width, rect.top + event.y * rect.height);
    const interactive = target instanceof HTMLElement ? target.closest("button, a, input, [role='button']") : null;
    if (interactive instanceof HTMLElement && !interactive.hasAttribute("disabled")) interactive.click();
  }

  async function startGesture() {
    if (gestureStatus === "loading" || gestureStatus === "ready") return;
    setGestureError("");
    setGestureStatus("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera_unavailable");
      const video = videoRef.current;
      if (!video) throw new Error("camera_preview_unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      video.srcObject = stream;
      await video.play();
      const tracker = await withTimeout(createBrowserHandTracker(video, (observation) => {
        const events = gestureControllerRef.current.update(observation);
        events.forEach(handleGestureEvent);
      }), 15_000);
      handTrackerRef.current = tracker;
      tracker.start();
      setGestureStatus("ready");
    } catch {
      handTrackerRef.current?.stop();
      handTrackerRef.current = null;
      stopCameraStream(videoRef.current);
      gestureControllerRef.current.reset();
      setCursor(null);
      setGestureProgress(0);
      setGestureError("摄像头或手势模型暂时不可用，可继续使用鼠标和键盘。");
      setGestureStatus("error");
    }
  }

  function stopGesture() {
    handTrackerRef.current?.stop();
    handTrackerRef.current = null;
    stopCameraStream(videoRef.current);
    gestureControllerRef.current.reset();
    setCursor(null);
    setGestureProgress(0);
    setGestureStatus("off");
    setGestureError("");
  }

  function stopSpeaking() {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setPhase("idle");
  }

  async function issueDeviceCommand(name: string, args: Record<string, unknown>) {
    try {
      const response = await fetch("/api/device/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
      });
      if (!response.ok) throw new Error("device_failed");
      setDeviceMessage("命令已发送，等待开发板完成");
    } catch {
      setDeviceMessage("设备命令失败或设备离线");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  const phaseLabel: Record<RobotPhase, string> = {
    idle: "准备好了",
    listening: "正在听你说",
    transcribing: "正在识别语音",
    thinking: "Mambo 正在思考",
    speaking: "正在播放回答",
    error: "需要再试一次",
  };
  const deviceIcon = deviceStatus === "online" ? <Wifi size={15} /> : <WifiOff size={15} />;

  return (
    <main ref={pageRef} className={styles.robotPage}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <span className={styles.brandMark} aria-hidden="true">M</span>
          <div>
            <h1>Mambo 机器人课堂</h1>
            <p>{course.title}</p>
          </div>
        </div>
        <div className={styles.connection} data-status={deviceStatus}>
          {deviceIcon}
          <span>{deviceMessage}</span>
        </div>
      </header>

      <section className={styles.contentGrid}>
        <aside className={styles.lessonRail} aria-label="课程提示">
          <div className={styles.sectionLabel}>今天学习</div>
          <h2>{course.title}</h2>
          <p className={styles.summary}>{course.summary}</p>
          <div className={styles.keyPoint}>
            <span>关键点</span>
            <strong>{course.knowledgePointTags[0]}</strong>
            <p>{course.explanation.keyIdeas[0]}</p>
          </div>
          <div className={styles.modeHint}>
            <Hand size={16} aria-hidden="true" />
            <span>张手移动 · 握拳确认</span>
          </div>
        </aside>

        <section className={styles.conversation} aria-label="机器人对话">
          <div className={styles.conversationHeader}>
            <div>
              <span className={styles.sectionLabel}>Mambo</span>
              <h2>和我一起学</h2>
            </div>
            <span className={styles.phase} data-phase={phase}>{phaseLabel[phase]}</span>
          </div>
          <div className={styles.messages} role="log" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={styles.message} data-author={message.author}>
                <span className={styles.messageAvatar} aria-hidden="true">{message.author === "assistant" ? "M" : "我"}</span>
                <p>{message.text}</p>
              </article>
            ))}
            {transcript && <div className={styles.transcript}>刚才听到：{transcript}</div>}
          </div>
          <form className={styles.composer} onSubmit={submit}>
            <Keyboard size={17} aria-hidden="true" />
            <label className="sr-only" htmlFor="robot-question">输入问题</label>
            <input id="robot-question" aria-label="输入问题" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="也可以输入问题..." />
            <button type="submit" aria-label="发送问题" disabled={!draft.trim() || phase === "thinking"}><Send size={17} /></button>
          </form>
        </section>

        <aside className={styles.controlRail} aria-label="机器人控制">
          <div className={styles.voiceCard}>
            <div className={styles.controlTitle}>
              <Volume2 size={16} aria-hidden="true" />
              <span>语音对话</span>
            </div>
            <button
              type="button"
              className={styles.voiceButton}
              data-recording={phase === "listening"}
              aria-label={phase === "listening" ? "结束说话" : "开始说话"}
              onClick={() => void (phase === "listening" ? stopRecording() : startRecording())}
            >
              {phase === "listening" ? <Square size={22} /> : <Mic size={22} />}
              <span>{phase === "listening" ? "结束说话" : "开始说话"}</span>
            </button>
            {phase === "speaking" && <button type="button" className={styles.secondaryButton} onClick={stopSpeaking}><VolumeX size={15} />停止播放</button>}
            {lastUserMessage && phase === "error" && <button type="button" className={styles.secondaryButton} onClick={() => void ask(lastUserMessage)}><Play size={15} />重试上一问</button>}
            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>

          <div className={styles.gestureCard}>
            <div className={styles.controlTitle}><Hand size={16} aria-hidden="true" /><span>手势输入</span></div>
            <div className={styles.gestureTrack} aria-label={`握拳确认进度 ${Math.round(gestureProgress * 100)}%`}>
              <span style={{ width: `${gestureProgress * 100}%` }} />
            </div>
            <p>摄像头画面只在本机处理</p>
            <video ref={videoRef} className={styles.cameraPreview} muted playsInline aria-label="手势摄像头预览" />
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void (gestureStatus === "ready" ? stopGesture() : startGesture())}
              disabled={gestureStatus === "loading"}
            >
              <Camera size={15} />
              {gestureStatus === "loading" ? "正在加载手势模型" : gestureStatus === "ready" ? "关闭手势" : "开启手势"}
            </button>
            {gestureError && <p className={styles.error} role="alert">{gestureError}</p>}
            {cursor && <span className={styles.virtualCursor} style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }} aria-hidden="true" />}
            <button type="button" className={styles.secondaryButton} onClick={() => { setCursor(null); setGestureProgress(0); }}><Hand size={15} />重置手势</button>
          </div>

          <div className={styles.deviceCard}>
            <div className={styles.controlTitle}><MonitorUp size={16} aria-hidden="true" /><span>屏幕控制</span></div>
            <div className={styles.actionRow}>
              <button type="button" title="唤醒屏幕" aria-label="唤醒屏幕" onClick={() => void issueDeviceCommand("set_display_mode", { mode: "on" })}><MonitorUp size={16} /></button>
              <button type="button" title="演示模式" aria-label="演示模式" onClick={() => void issueDeviceCommand("set_display_mode", { mode: "presentation" })}><Play size={16} /></button>
              <button type="button" title="拍照" aria-label="拍照" onClick={() => void issueDeviceCommand("capture_snapshot", {})}><Camera size={16} /></button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
