"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Hand,
  Keyboard,
  Mic,
  MonitorUp,
  Play,
  ScanFace,
  Send,
  Square,
  Trash2,
  UserRoundPlus,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";

import { getFeaturedCourses } from "@/data/curriculum";
import { useSharedStarbaoConversation } from "@/features/starbao/use-shared-starbao-conversation";
import type { Stage } from "@/lib/domain";

import styles from "./robot.module.css";
import { GestureController, type GestureEvent } from "./gesture-controller";
import { GesturePointer } from "./gesture-pointer";
import { findGestureInteractiveTarget, normalizedPointToViewport } from "./gesture-screen-target";
import { parseGestureVoiceCommand, type GestureVoiceCommand } from "./gesture-voice-command";
import { clearHandOverlay, drawHandOverlay } from "./hand-overlay";
import { isHandVisionFrameStale, type HandVisionSnapshot } from "./hand-vision-client";
import {
  beginFaceEnrollment,
  cancelFaceEnrollment,
  deleteFaceIdentity,
  fetchFaceIdentities,
  fetchFaceIdentityStatus,
  startFaceIdentity,
  stopFaceIdentity,
  type FaceIdentity,
  type FaceIdentitySnapshot,
} from "./face-identity-client";
import { BrowserHandTracker, createBrowserHandTracker } from "./hand-tracker";
import { LatestPointerCommand } from "./latest-pointer-command";
import { useRobotGesture, type GestureStatus } from "./robot-gesture-provider";
import { PcmRecorder } from "./voice-session";

type RobotPhase = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";
type RobotMessage = { id: string; author: "assistant" | "learner"; text: string };
type DeviceStatus = "checking" | "online" | "offline" | "unavailable";
type WakeWordStatus = "checking" | "online" | "offline";
type WakeCaptureState = "idle" | "awaiting_claim" | "capturing";
type WakeCaptureAction = "claim" | "renew" | "release";
type ControlDock = "voice" | "vision" | "face" | "device";

const STAGE: Stage = "lower_primary";
const course = getFeaturedCourses(STAGE)[0];
const AUTO_SPEECH_THRESHOLD = 0.010;
const AUTO_SPEECH_ONSET_MS = 180;
const AUTO_SPEECH_SILENCE_MS = 1_400;
const AUTO_SPEECH_MAX_MS = 15_000;
const VOICE_METER_PAINT_MS = 500;
export const CONTINUOUS_VOICE_SESSION_MS = 30_000;
export const WAKE_WORD_POLL_MS = 150;
const FACE_IDENTITY_POLL_MS = 750;
const FACE_NICKNAME_MAX_LENGTH = 20;

export function initialMessages(): RobotMessage[] {
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

export function buildChatHistory(messages: RobotMessage[], userMessage: RobotMessage) {
  const firstLearnerIndex = messages.findIndex((message) => message.author === "learner");
  const conversation = firstLearnerIndex === -1 ? [] : messages.slice(firstLearnerIndex);

  return [...conversation, userMessage].map((message) => ({
    role: message.author === "learner" ? "user" as const : "assistant" as const,
    content: message.text,
  }));
}

export function usesDeviceAudioPlayback(response: Pick<Response, "headers">): boolean {
  return response.headers.get("X-Mambo-Device-Playback") === "complete";
}

export function usesLocalDeviceProxy(location: Pick<Location, "hostname" | "port">): boolean {
  return location.hostname === "127.0.0.1" && location.port === "3010";
}

export function usesLocalWakeWordService(location: Pick<Location, "hostname" | "port">): boolean {
  return usesLocalDeviceProxy(location);
}

export function shouldMonitorBrowserMicrophone(localWakeWordMode: boolean): boolean {
  return !localWakeWordMode;
}

export type StarbaoAnnouncementCandidate = {
  messageId: string;
  role: "user" | "assistant" | "system";
  announceOnOrangePi: boolean;
};

export function selectNewStarbaoAnnouncements<T extends StarbaoAnnouncementCandidate>(
  messages: T[],
  seenMessageIds: ReadonlySet<string>,
  localDevicePlayback: boolean,
): T[] {
  if (!localDevicePlayback) return [];
  return messages.filter((message) => (
    message.role === "assistant"
    && message.announceOnOrangePi
    && !seenMessageIds.has(message.messageId)
  ));
}

export function shouldHandleWakeEvent(previousSequence: number | null, sequence: number): boolean {
  return previousSequence !== null && sequence > previousSequence;
}

export function nextContinuousVoiceDeadline(now: number): number {
  return now + CONTINUOUS_VOICE_SESSION_MS;
}

export function isContinuousVoiceSessionExpired(deadline: number | null, now: number): boolean {
  return deadline !== null && now >= deadline;
}

export function wakeCapturePath(action: WakeCaptureAction): string {
  return `/_mambo/wake/${action}`;
}

export function getVoiceMeterState(localWakeWordMode: boolean, wakeWordStatus: WakeWordStatus, autoListening: boolean, voiceDb: number): {
  label: string;
  value: string;
  showLevel: boolean;
} {
  if (localWakeWordMode && !autoListening) {
    return {
      label: "本地唤醒模型",
      value: wakeWordStatus === "online" ? "在线" : wakeWordStatus === "offline" ? "不可用" : "连接中",
      showLevel: false,
    };
  }
  return { label: "实时音量", value: `${voiceDb} dB`, showLevel: true };
}

export function shouldPaintVoiceLevel(lastPaintAt: number, now: number): boolean {
  return now - lastPaintAt >= VOICE_METER_PAINT_MS;
}

export function shouldSendPhysicalGestureClick(hasDomInteractiveTarget: boolean, deviceOnline: boolean): boolean {
  return deviceOnline && !hasDomInteractiveTarget;
}

export function shouldApplyHandVisionSnapshot(requestLifecycle: number, currentLifecycle: number): boolean {
  return requestLifecycle === currentLifecycle;
}

export function invalidateHandVisionLifecycle(currentLifecycle: number): number {
  return currentLifecycle + 1;
}

export type GestureClickTimerRef = {
  current: number | null;
};

export type GestureClickLifecycleRef = {
  current: number;
};

export function scheduleGestureDomClick(
  timerRef: GestureClickTimerRef,
  lifecycleRef: GestureClickLifecycleRef,
  click: () => void,
): void {
  if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  const scheduledLifecycle = lifecycleRef.current;
  timerRef.current = window.setTimeout(() => {
    timerRef.current = null;
    if (scheduledLifecycle !== lifecycleRef.current) return;
    click();
  }, 160);
}

export function invalidateGestureDomClick(
  timerRef: GestureClickTimerRef,
  lifecycleRef: GestureClickLifecycleRef,
): void {
  lifecycleRef.current += 1;
  if (timerRef.current === null) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

export function isBrowserGestureClick(event: GestureEvent): event is Extract<GestureEvent, { type: "click" }> {
  return event.type === "click";
}

export type BrowserGesturePointerState = {
  cursor: { x: number; y: number } | null;
  progress: number;
};

export function nextBrowserGesturePointerState(
  current: BrowserGesturePointerState,
  event: GestureEvent,
): BrowserGesturePointerState {
  if (event.type === "cursor_move") return { ...current, cursor: { x: event.x, y: event.y } };
  if (event.type === "progress") return { ...current, progress: event.value };
  if (event.type === "tracking_lost") return { cursor: null, progress: 0 };
  return current;
}

export function shouldRenderBrowserGesturePointer(localHandVisionMode: boolean): boolean {
  return !localHandVisionMode;
}

export function BrowserGesturePointerOverlay({
  localHandVisionMode,
  pointer,
}: {
  localHandVisionMode: boolean;
  pointer: BrowserGesturePointerState;
}) {
  if (!shouldRenderBrowserGesturePointer(localHandVisionMode)) return null;
  return <GesturePointer cursor={pointer.cursor} progress={pointer.progress} />;
}

export function shouldShowHandVisionOverlay(
  localHandVisionMode: boolean,
  handVision: HandVisionSnapshot | null,
): boolean {
  return localHandVisionMode && (
    handVision?.status !== "running"
    || isHandVisionFrameStale(handVision)
    || (handVision.brightness !== undefined && handVision.brightness < 18)
  );
}

export function getHandVisionStatusMessage(
  localHandVisionMode: boolean,
  handVision: HandVisionSnapshot | null,
): string {
  if (!localHandVisionMode) {
    return "摄像头画面只在本机处理";
  }
  if (handVision?.status === "loading") return "正在启动板端手势模型";
  if (handVision?.status === "error") {
    return handVision.error?.code === "camera_releasing"
      ? "摄像头正在释放，请稍后重试"
      : "板端手势服务暂时不可用，请稍后重试";
  }
  if (handVision?.status === "idle") return "手势服务已关闭";
  if (handVision?.status !== "running") return "正在连接板端手势服务";
  if (isHandVisionFrameStale(handVision)) return "摄像头画面未更新，请重新开启手势控制";
  if (handVision.brightness !== undefined && handVision.brightness < 18) {
    return "摄像头画面过暗，请打开灯或检查镜头";
  }
  if (handVision.landmarks.length !== 21) {
    return "未识别到手，请将手掌放进明亮画面";
  }
  if (handVision.gesture === "open_palm") {
    return "已识别张开的手掌，正在移动光标";
  }
  if (handVision.gesture === "fist") {
    return "已识别握拳，请保持完成确认";
  }
  return "已识别手部节点";
}

export type GestureVoiceCommandHandlers = {
  captureSnapshot: () => Promise<boolean | void>;
  localHandVisionMode: boolean;
  startGesture: () => Promise<boolean>;
  stopGesture: () => Promise<void>;
};

export async function runGestureVoiceCommand(
  command: GestureVoiceCommand,
  handlers: GestureVoiceCommandHandlers,
): Promise<string> {
  if (typeof command === "object" && command.type === "device" && command.action === "capture_snapshot") {
    await handlers.captureSnapshot();
    return "已发送拍照指令。";
  }
  if (command === "stop") {
    await handlers.stopGesture();
    return "手势控制已关闭。";
  }
  return (await handlers.startGesture())
    ? handlers.localHandVisionMode
      ? "手势视觉服务正在启动。请将一只手放入摄像头画面。"
      : "手势控制已开启。请张开手掌移动光标，握拳保持确认点击。"
    : "手势控制暂时无法开启，请检查摄像头。";
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

function isFaceRecognitionActive(snapshot: FaceIdentitySnapshot | null): boolean {
  return snapshot?.status === "loading" || snapshot?.status === "running";
}

function getFaceBackendErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (
    code === "face_models_missing"
    || code === "face_models_unavailable"
    || code === "model_missing"
    || code === "model_load_failed"
    || code.startsWith("face_model_")
  ) {
    return "人脸模型未安装，请安装模型后重试。";
  }
  if (code === "camera_unavailable") return "摄像头不可用，请检查连接后重试。";
  if (code === "vision_unavailable") return "视觉输入不可用，请检查摄像头画面后重试。";
  if (code.startsWith("face_engine_") || code.includes("inference") || code.includes("runtime")) {
    return "人脸推理出现问题，请稍后重试。";
  }
  return null;
}

export function getFaceIdentityStatusMessage(
  localMode: boolean,
  snapshot: FaceIdentitySnapshot | null,
  requestError = "",
): string {
  if (!localMode) return "人脸识别仅在开发板本地页面可用，当前浏览器不会打开摄像头。";
  if (requestError) return requestError;
  if (!snapshot) return "人脸识别未启动";
  const backendErrorMessage = getFaceBackendErrorMessage(snapshot.error?.code);
  if (backendErrorMessage) return backendErrorMessage;
  if (snapshot.status === "unavailable") return "板端人脸识别服务暂不可用，请稍后重试。";
  if (snapshot.status === "error") return "人脸识别服务出错，请稍后重试。";
  if (snapshot.status === "loading") return "正在加载板端人脸模型";
  if (snapshot.identity?.confirmed) return `已识别：${snapshot.identity.label}`;

  switch (snapshot.state) {
    case "idle":
      return "人脸识别已关闭";
    case "no_face":
      return "未检测到人脸，请面向摄像头";
    case "low_light":
      return "光线不足，请打开灯或调整镜头";
    case "multiple_faces":
      return "检测到多张人脸，请只保留一人";
    case "collecting":
      return snapshot.enrollment
        ? `正在录入${snapshot.enrollment.label}：${snapshot.enrollment.collected}/${snapshot.enrollment.required}`
        : "正在准备录入人脸";
    case "unknown":
      return "未识别到已录入的人脸";
    case "recognizing":
      return snapshot.identity ? `正在确认：${snapshot.identity.label}` : "正在确认身份";
    case "confirmed":
      return snapshot.identity ? `已识别：${snapshot.identity.label}` : "已完成身份确认";
  }
}

export function FaceIdentityPanel({ localMode, standalone = false }: { localMode: boolean; standalone?: boolean }) {
  const [snapshot, setSnapshot] = useState<FaceIdentitySnapshot | null>(null);
  const [identities, setIdentities] = useState<FaceIdentity[]>([]);
  const [identityCount, setIdentityCount] = useState(0);
  const [nickname, setNickname] = useState("");
  const [faceEnabled, setFaceEnabled] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [deletingIdentityId, setDeletingIdentityId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState("");
  const [identityListError, setIdentityListError] = useState("");
  const enrollmentWasActiveRef = useRef(false);
  const faceSessionRef = useRef(0);
  const identityRequestRef = useRef(0);

  function beginFaceSession(): number {
    faceSessionRef.current += 1;
    identityRequestRef.current += 1;
    return faceSessionRef.current;
  }

  function isCurrentFaceSession(session: number): boolean {
    return faceSessionRef.current === session;
  }

  function isCurrentIdentityRequest(session: number, request: number): boolean {
    return isCurrentFaceSession(session) && identityRequestRef.current === request;
  }

  async function refreshIdentities(session: number): Promise<void> {
    if (!isCurrentFaceSession(session)) return;
    const request = identityRequestRef.current + 1;
    identityRequestRef.current = request;
    try {
      const list = await fetchFaceIdentities();
      if (!isCurrentIdentityRequest(session, request)) return;
      setIdentities(list.identities);
      setIdentityCount(list.count);
      setIdentityListError(list.error ? "本机身份列表暂时不可用。" : "");
    } catch {
      if (!isCurrentIdentityRequest(session, request)) return;
      setIdentityListError("本机身份列表暂时不可用。");
    }
  }

  function applySnapshot(nextSnapshot: FaceIdentitySnapshot, session: number): boolean {
    if (!isCurrentFaceSession(session)) return false;
    setSnapshot(nextSnapshot);
    setRequestError("");
    const hasEnrollment = nextSnapshot.enrollment !== null;
    if (enrollmentWasActiveRef.current && !hasEnrollment) void refreshIdentities(session);
    enrollmentWasActiveRef.current = hasEnrollment;
    return true;
  }

  useEffect(() => {
    const session = beginFaceSession();
    if (!localMode) return;

    let active = true;
    const loadLocalFaceState = async () => {
      try {
        const nextSnapshot = await fetchFaceIdentityStatus();
        if (!active || !isCurrentFaceSession(session)) return;
        applySnapshot(nextSnapshot, session);
        setFaceEnabled(isFaceRecognitionActive(nextSnapshot));
      } catch {
        if (active && isCurrentFaceSession(session)) {
          setRequestError("板端人脸识别服务连接失败，请稍后重试。");
        }
      }
    };

    void loadLocalFaceState();
    queueMicrotask(() => {
      if (!active || !isCurrentFaceSession(session)) return;
      setActionPending(false);
      setDeletingIdentityId(null);
      void refreshIdentities(session);
    });
    return () => {
      active = false;
      beginFaceSession();
    };
    // localMode is the only lifecycle boundary for board-local identity state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMode]);

  useEffect(() => {
    if (!localMode || !faceEnabled || actionPending) return;
    let active = true;
    let timer: number | undefined;
    const session = faceSessionRef.current;

    const pollFaceState = async () => {
      try {
        const nextSnapshot = await fetchFaceIdentityStatus();
        if (!active || !isCurrentFaceSession(session)) return;
        applySnapshot(nextSnapshot, session);
        if (!isFaceRecognitionActive(nextSnapshot)) {
          setFaceEnabled(false);
          return;
        }
      } catch {
        if (active && isCurrentFaceSession(session)) {
          setFaceEnabled(false);
          setRequestError("板端人脸识别服务连接失败，请稍后重试。");
        }
        return;
      }
      if (active) timer = window.setTimeout(() => void pollFaceState(), FACE_IDENTITY_POLL_MS);
    };

    timer = window.setTimeout(() => void pollFaceState(), FACE_IDENTITY_POLL_MS);
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
    // The poller only runs for an explicitly started local recognition session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionPending, faceEnabled, localMode]);

  async function toggleFaceRecognition(): Promise<void> {
    if (!localMode || actionPending) return;
    const session = beginFaceSession();
    setActionPending(true);
    setRequestError("");
    try {
      if (faceEnabled) {
        setFaceEnabled(false);
        applySnapshot(await stopFaceIdentity(), session);
      } else {
        const nextSnapshot = await startFaceIdentity();
        if (!applySnapshot(nextSnapshot, session)) return;
        setFaceEnabled(isFaceRecognitionActive(nextSnapshot));
        if (isFaceRecognitionActive(nextSnapshot)) void refreshIdentities(session);
      }
    } catch {
      if (isCurrentFaceSession(session)) {
        setRequestError("板端人脸识别服务连接失败，请稍后重试。");
        setFaceEnabled(false);
      }
    } finally {
      if (isCurrentFaceSession(session)) setActionPending(false);
    }
  }

  async function enrollCurrentFace(): Promise<void> {
    const label = nickname.trim();
    if (!localMode || !faceEnabled || !label || actionPending) return;
    const session = beginFaceSession();
    setActionPending(true);
    setRequestError("");
    try {
      applySnapshot(await beginFaceEnrollment(label), session);
    } catch {
      if (isCurrentFaceSession(session)) setRequestError("无法开始录入当前人脸，请稍后重试。");
    } finally {
      if (isCurrentFaceSession(session)) setActionPending(false);
    }
  }

  async function cancelEnrollment(): Promise<void> {
    if (!localMode || snapshot?.enrollment === null || actionPending) return;
    const session = beginFaceSession();
    setActionPending(true);
    setRequestError("");
    try {
      applySnapshot(await cancelFaceEnrollment(), session);
    } catch {
      if (isCurrentFaceSession(session)) setRequestError("无法取消人脸录入，请稍后重试。");
    } finally {
      if (isCurrentFaceSession(session)) setActionPending(false);
    }
  }

  async function removeIdentity(id: string): Promise<void> {
    if (!localMode || actionPending || deletingIdentityId) return;
    const session = beginFaceSession();
    const request = identityRequestRef.current + 1;
    identityRequestRef.current = request;
    setActionPending(true);
    setDeletingIdentityId(id);
    setIdentityListError("");
    try {
      const list = await deleteFaceIdentity(id);
      if (!isCurrentIdentityRequest(session, request)) return;
      setIdentities(list.identities);
      setIdentityCount(list.count);
      setIdentityListError(list.error ? "本机身份列表暂时不可用。" : "");
    } catch {
      if (isCurrentIdentityRequest(session, request)) setIdentityListError("无法删除本机身份，请稍后重试。");
    } finally {
      if (isCurrentIdentityRequest(session, request)) {
        setDeletingIdentityId(null);
        setActionPending(false);
      }
    }
  }

  const faceStatusMessage = getFaceIdentityStatusMessage(localMode, snapshot, requestError);
  const enrollment = snapshot?.enrollment ?? null;

  return (
    <section
      className={`${styles.faceIdentitySection} ${standalone ? styles.faceIdentityStandalone : ""}`}
      aria-labelledby="face-identity-title"
    >
      <div className={styles.faceIdentityHeader}>
        <div id="face-identity-title" className={styles.controlTitle}><ScanFace size={16} aria-hidden="true" /><span>人脸身份</span></div>
        {localMode && (
          <button
            type="button"
            className={styles.faceIconButton}
            title={faceEnabled ? "关闭人脸识别" : "开启人脸识别"}
            aria-label={faceEnabled ? "关闭人脸识别" : "开启人脸识别"}
            onClick={() => void toggleFaceRecognition()}
            disabled={actionPending}
          >
            {faceEnabled ? <Square size={15} /> : <ScanFace size={16} />}
          </button>
        )}
      </div>
      <p className={styles.faceIdentityStatus} role="status" aria-live="polite">{faceStatusMessage}</p>

      {localMode && (
        <>
          <div className={styles.faceEnrollmentRow}>
            <label className="sr-only" htmlFor="face-identity-nickname">录入昵称</label>
            <input
              id="face-identity-nickname"
              aria-label="录入昵称"
              value={nickname}
              maxLength={FACE_NICKNAME_MAX_LENGTH}
              onChange={(event) => setNickname(event.target.value.slice(0, FACE_NICKNAME_MAX_LENGTH))}
              placeholder="输入昵称"
              disabled={!faceEnabled || enrollment !== null || actionPending}
            />
            <button
              type="button"
              className={styles.faceEnrollButton}
              onClick={() => void enrollCurrentFace()}
              disabled={!faceEnabled || enrollment !== null || !nickname.trim() || actionPending}
            >
              <UserRoundPlus size={14} aria-hidden="true" />
              录入当前人脸
            </button>
          </div>
          {enrollment && (
            <button type="button" className={styles.faceCancelButton} onClick={() => void cancelEnrollment()} disabled={actionPending}>
              <X size={14} aria-hidden="true" />
              取消录入
            </button>
          )}
          {identityListError && <p className={styles.faceIdentityError} role="alert">{identityListError}</p>}
          <p className={styles.faceIdentityCount}>已录入 {identityCount} 人</p>
          {identities.length > 0 && (
            <ul className={styles.faceIdentityList} aria-label="已录入人脸">
              {identities.map((identity) => (
                <li key={identity.id}>
                  <span><strong>{identity.label}</strong><small>{identity.samples} 个样本</small></span>
                  <button
                    type="button"
                    className={styles.faceIconButton}
                    title={`删除${identity.label}`}
                    aria-label={`删除${identity.label}`}
                    onClick={() => void removeIdentity(identity.id)}
                    disabled={deletingIdentityId !== null}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export function RobotWorkspace() {
  const [draft, setDraft] = useState("");
  const [activeControl, setActiveControl] = useState<ControlDock>("voice");
  const {
    localHandVisionMode,
    handVision,
    gestureStatus: boardGestureStatus,
    gestureError: boardGestureError,
    startGesture: startBoardGesture,
    stopGesture: stopBoardGesture,
    resetGesture: resetBoardGesture,
  } = useRobotGesture();
  const {
    conversation: sharedConversation,
    messages: sharedMessages,
    isLoading: sharedConversationLoading,
    error: sharedConversationError,
    sendTurn: sendSharedTurn,
    setSpeakOnOrangePi: setSharedSpeakOnOrangePi,
  } = useSharedStarbaoConversation();
  const [phase, setPhase] = useState<RobotPhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [autoListening, setAutoListening] = useState(false);
  const [localWakeWordMode, setLocalWakeWordMode] = useState(false);
  const [wakeWordStatus, setWakeWordStatus] = useState<WakeWordStatus>("checking");
  const [wakeCaptureState, setWakeCaptureState] = useState<WakeCaptureState>("idle");
  const [wakeLeaseClaimed, setWakeLeaseClaimed] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceDb, setVoiceDb] = useState(-60);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("checking");
  const [deviceMessage, setDeviceMessage] = useState("正在读取设备状态");
  const [browserGestureStatus, setBrowserGestureStatus] = useState<GestureStatus>("off");
  const [browserGestureError, setBrowserGestureError] = useState("");
  const [browserGesturePointer, setBrowserGesturePointer] = useState<BrowserGesturePointerState>({ cursor: null, progress: 0 });
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const nativePreviewRef = useRef<HTMLImageElement | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const pendingVoiceCaptureRef = useRef<PcmRecorder | null>(null);
  const phaseRef = useRef<RobotPhase>(phase);
  const autoMonitorEnabledRef = useRef(true);
  const localWakeWordModeRef = useRef(false);
  const wakeEventSequenceRef = useRef<number | null>(null);
  const wakeLeaseClaimedRef = useRef(false);
  const continuousVoiceDeadlineRef = useRef<number | null>(null);
  const continuousVoiceExpiryTimerRef = useRef<number | null>(null);
  const continuousVoiceStartInFlightRef = useRef(false);
  const continuousVoiceLifecycleRef = useRef(0);
  const wakeLeaseRenewInFlightRef = useRef(false);
  const wakeLeaseRenewAbortControllerRef = useRef<AbortController | null>(null);
  const autoStartInFlightRef = useRef(false);
  const speechCandidateAtRef = useRef<number | null>(null);
  const speechStartedAtRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef<number | null>(null);
  const noiseFloorRef = useRef(0.0025);
  const lastVoicePaintAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioPlaybackRejectRef = useRef<((error: Error) => void) | null>(null);
  const handTrackerRef = useRef<BrowserHandTracker | null>(null);
  const browserGestureStatusRef = useRef(browserGestureStatus);
  const handVisionLifecycleRef = useRef(0);
  const gestureControllerRef = useRef(new GestureController());
  const gestureClickTimerRef = useRef<number | null>(null);
  const gestureClickLifecycleRef = useRef(0);
  const deviceStatusRef = useRef(deviceStatus);
  const pointerCommandRef = useRef<LatestPointerCommand | null>(null);
  const announcedMessageIdsRef = useRef(new Set<string>());
  const sharedHistoryInitializedRef = useRef(false);
  const speechQueueRef = useRef(Promise.resolve());
  const gestureStatus = localHandVisionMode ? boardGestureStatus : browserGestureStatus;
  const gestureError = localHandVisionMode ? boardGestureError : browserGestureError;
  const lastUserMessage = useMemo(
    () => [...sharedMessages].reverse().find((message) => message.role === "user")?.content ?? "",
    [sharedMessages],
  );

  useEffect(() => {
    deviceStatusRef.current = deviceStatus;
  }, [deviceStatus]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    browserGestureStatusRef.current = browserGestureStatus;
  }, [browserGestureStatus]);

  useEffect(() => {
    const enabled = usesLocalWakeWordService(window.location);
    localWakeWordModeRef.current = enabled;
    const frame = window.requestAnimationFrame(() => {
      setLocalWakeWordMode(enabled);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [sharedMessages]);

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
    const handOverlay = handOverlayRef.current;
    return () => {
      active = false;
      autoMonitorEnabledRef.current = false;
      abortWakeLeaseRenewal();
      continuousVoiceLifecycleRef.current += 1;
      continuousVoiceDeadlineRef.current = null;
      if (continuousVoiceExpiryTimerRef.current !== null) {
        window.clearTimeout(continuousVoiceExpiryTimerRef.current);
        continuousVoiceExpiryTimerRef.current = null;
      }
      invalidateGestureInteraction();
      handVisionLifecycleRef.current = invalidateHandVisionLifecycle(handVisionLifecycleRef.current);
      recorderRef.current?.cancel();
      pendingVoiceCaptureRef.current?.cancel();
      if (wakeLeaseClaimedRef.current) {
        wakeLeaseClaimedRef.current = false;
        void fetch(wakeCapturePath("release"), { method: "POST", cache: "no-store" }).catch(() => undefined);
      }
      const tracker = handTrackerRef.current;
      tracker?.stop();
      pointerCommandRef.current?.dispose();
      pointerCommandRef.current = null;
      stopCameraStream(video);
      if (tracker) clearHandOverlay(handOverlay);
      audioRef.current?.pause();
      audioPlaybackRejectRef.current?.(new Error("tts_cancelled"));
      audioPlaybackRejectRef.current = null;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  async function ask(text: string, options: { fromVoice?: boolean } = {}) {
    const question = text.trim();
    if (!question || (!options.fromVoice && (phaseRef.current === "thinking" || phaseRef.current === "transcribing" || phaseRef.current === "listening"))) return;
    setDraft("");
    setTranscript("");
    setError("");
    const gestureCommand = options.fromVoice ? parseGestureVoiceCommand(question) : null;
    if (gestureCommand) {
      try {
        setDeviceMessage(await handleGestureVoiceCommand(gestureCommand));
      } catch {
        setDeviceMessage("手势命令暂时无法完成，但对话会继续同步。");
      }
    }

    phaseRef.current = "thinking";
    setPhase("thinking");
    try {
      await sendSharedTurn({
        text: question,
        stage: STAGE,
        courseId: course.id,
        origin: options.fromVoice ? "asr" : "orangepi",
      });
      phaseRef.current = "idle";
      setPhase("idle");
      extendExpiredContinuousVoiceSession();
      return;
    } catch {
      if (hasContinuousVoiceSession()) {
        closeContinuousVoiceSession();
      } else {
        releasePendingVoiceCapture();
      }
      setError("共享对话暂时不可用，请稍后重试。");
      phaseRef.current = "error";
      setPhase("error");
    }
  }

  function hasContinuousVoiceSession(): boolean {
    return continuousVoiceDeadlineRef.current !== null;
  }

  function clearContinuousVoiceExpiryTimer(): void {
    if (continuousVoiceExpiryTimerRef.current === null) return;
    window.clearTimeout(continuousVoiceExpiryTimerRef.current);
    continuousVoiceExpiryTimerRef.current = null;
  }

  function closeContinuousVoiceSession(): void {
    abortWakeLeaseRenewal();
    continuousVoiceLifecycleRef.current += 1;
    continuousVoiceDeadlineRef.current = null;
    clearContinuousVoiceExpiryTimer();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    releaseRecorder(recorder, true);
    releasePendingVoiceCapture(true);
    resetSpeechTiming();
    setAutoListening(false);
    releaseWakeMicrophone();
  }

  function finalizeContinuousVoiceSessionIfExpired(): boolean {
    if (!isContinuousVoiceSessionExpired(continuousVoiceDeadlineRef.current, performance.now())) return false;
    if (phaseRef.current !== "idle") return false;
    closeContinuousVoiceSession();
    return true;
  }

  function scheduleContinuousVoiceExpiry(): void {
    clearContinuousVoiceExpiryTimer();
    const deadline = continuousVoiceDeadlineRef.current;
    if (deadline === null) return;
    continuousVoiceExpiryTimerRef.current = window.setTimeout(() => {
      continuousVoiceExpiryTimerRef.current = null;
      finalizeContinuousVoiceSessionIfExpired();
    }, Math.max(0, deadline - performance.now()));
  }

  function extendContinuousVoiceSession(): void {
    if (!hasContinuousVoiceSession()) return;
    continuousVoiceDeadlineRef.current = nextContinuousVoiceDeadline(performance.now());
    scheduleContinuousVoiceExpiry();
  }

  function extendExpiredContinuousVoiceSession(): void {
    if (!isContinuousVoiceSessionExpired(continuousVoiceDeadlineRef.current, performance.now())) return;
    extendContinuousVoiceSession();
  }

  async function beginContinuousVoiceSession(): Promise<boolean> {
    if (hasContinuousVoiceSession() || continuousVoiceStartInFlightRef.current) return false;
    continuousVoiceStartInFlightRef.current = true;
    const lifecycle = continuousVoiceLifecycleRef.current;
    try {
      const claimed = await claimWakeMicrophone(lifecycle);
      if (!claimed || lifecycle !== continuousVoiceLifecycleRef.current) return false;
      continuousVoiceDeadlineRef.current = nextContinuousVoiceDeadline(performance.now());
      scheduleContinuousVoiceExpiry();
      return true;
    } finally {
      continuousVoiceStartInFlightRef.current = false;
    }
  }

  async function resumeContinuousVoiceSessionAfterPlayback(): Promise<void> {
    if (!hasContinuousVoiceSession()) return;
    extendContinuousVoiceSession();
    await startAutoListening();
  }

  async function speak(text: string) {
    const lifecycle = continuousVoiceLifecycleRef.current;
    const devicePlayback = usesLocalDeviceProxy(window.location);
    const continuousSession = hasContinuousVoiceSession();
    if (devicePlayback) stopListeningForDevicePlayback();
    phaseRef.current = "speaking";
    setPhase("speaking");
    const response = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (lifecycle !== continuousVoiceLifecycleRef.current) throw new Error("tts_cancelled");
    if (!response.ok) throw new Error("tts_failed");
    if (usesDeviceAudioPlayback(response)) {
      releasePendingVoiceCapture(continuousSession);
      phaseRef.current = "idle";
      setPhase("idle");
      if (continuousSession) await resumeContinuousVoiceSessionAfterPlayback();
      return;
    }
    const blob = await response.blob();
    if (lifecycle !== continuousVoiceLifecycleRef.current) throw new Error("tts_cancelled");
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    audioRef.current?.pause();
    audioPlaybackRejectRef.current?.(new Error("tts_replaced"));
    const audio = new Audio();
    audio.src = url;
    audioRef.current = audio;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (audioPlaybackRejectRef.current === cancelPlayback) audioPlaybackRejectRef.current = null;
        if (error) reject(error);
        else resolve();
      };
      const cancelPlayback = (error: Error) => settle(error);
      audioPlaybackRejectRef.current = cancelPlayback;
      audio.onended = () => settle();
      audio.onerror = () => settle(new Error("tts_playback_failed"));
      void Promise.resolve(audio.play()).catch(() => settle(new Error("tts_playback_failed")));
    });
    releasePendingVoiceCapture(continuousSession);
    phaseRef.current = "idle";
    setPhase("idle");
    if (continuousSession) await resumeContinuousVoiceSessionAfterPlayback();
  }

  useEffect(() => {
    if (sharedConversationLoading || sharedConversationError) return;

    if (!sharedHistoryInitializedRef.current) {
      for (const message of sharedMessages) announcedMessageIdsRef.current.add(message.messageId);
      sharedHistoryInitializedRef.current = true;
      return;
    }

    const announcements = selectNewStarbaoAnnouncements(
      sharedMessages,
      announcedMessageIdsRef.current,
      usesLocalDeviceProxy(window.location),
    );
    for (const message of sharedMessages) announcedMessageIdsRef.current.add(message.messageId);

    for (const message of announcements) {
      speechQueueRef.current = speechQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await speak(message.content);
          } catch (speechError) {
            if (speechError instanceof Error && (speechError.message === "tts_stopped" || speechError.message === "tts_cancelled")) return;
            if (hasContinuousVoiceSession()) {
              closeContinuousVoiceSession();
            } else {
              releasePendingVoiceCapture();
            }
            setError("星宝回答已同步，但香橙派播报暂时不可用。");
            phaseRef.current = "error";
            setPhase("error");
          }
        });
    }
    // speak only reads stable setters and refs; replay is guarded by server message IDs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedConversationError, sharedConversationLoading, sharedMessages]);

  async function sendWakeCaptureAction(action: WakeCaptureAction, options: { signal?: AbortSignal } = {}): Promise<void> {
    const response = await fetch(wakeCapturePath(action), { method: "POST", cache: "no-store", signal: options.signal });
    if (!response.ok) throw new Error("wake_capture_unavailable");
  }

  function abortWakeLeaseRenewal(): void {
    wakeLeaseRenewAbortControllerRef.current?.abort();
    wakeLeaseRenewAbortControllerRef.current = null;
    wakeLeaseRenewInFlightRef.current = false;
  }

  async function claimWakeMicrophone(lifecycle = continuousVoiceLifecycleRef.current): Promise<boolean> {
    if (lifecycle !== continuousVoiceLifecycleRef.current) return false;
    if (!localWakeWordModeRef.current || wakeLeaseClaimedRef.current) return true;
    await sendWakeCaptureAction("claim");
    if (lifecycle !== continuousVoiceLifecycleRef.current) {
      void sendWakeCaptureAction("release").catch(() => undefined);
      return false;
    }
    wakeLeaseClaimedRef.current = true;
    setWakeLeaseClaimed(true);
    setWakeCaptureState("capturing");
    return true;
  }

  function releaseWakeMicrophone(): void {
    if (!wakeLeaseClaimedRef.current) return;
    wakeLeaseClaimedRef.current = false;
    setWakeLeaseClaimed(false);
    setWakeCaptureState("idle");
    void sendWakeCaptureAction("release").catch(() => undefined);
  }

  function releaseRecorder(recorder: PcmRecorder | null, keepWakeLease = false): void {
    if (!recorder) {
      if (!keepWakeLease) releaseWakeMicrophone();
      return;
    }
    void recorder.cancel().finally(() => {
      if (!keepWakeLease) releaseWakeMicrophone();
    });
  }

  function releasePendingVoiceCapture(keepWakeLease = false) {
    const recorder = pendingVoiceCaptureRef.current;
    pendingVoiceCaptureRef.current = null;
    releaseRecorder(recorder, keepWakeLease);
  }

  function stopListeningForDevicePlayback() {
    releaseRecorder(recorderRef.current, true);
    recorderRef.current = null;
    releasePendingVoiceCapture(true);
    resetSpeechTiming();
    setAutoListening(false);
  }

  function resetSpeechTiming() {
    speechCandidateAtRef.current = null;
    speechStartedAtRef.current = null;
    lastVoiceAtRef.current = null;
  }

  function beginAutoCapture() {
    const recorder = recorderRef.current;
    if (!recorder || phaseRef.current === "listening") return;
    if (hasContinuousVoiceSession()) {
      if (finalizeContinuousVoiceSessionIfExpired()) return;
      extendContinuousVoiceSession();
    }
    try {
      recorder.beginCapture();
      const now = performance.now();
      speechCandidateAtRef.current = null;
      speechStartedAtRef.current = now;
      lastVoiceAtRef.current = now;
      phaseRef.current = "listening";
      setError("");
      setTranscript("");
      setPhase("listening");
    } catch {
      if (hasContinuousVoiceSession()) {
        closeContinuousVoiceSession();
      } else {
        releaseRecorder(recorder);
      }
      recorderRef.current = null;
      setAutoListening(false);
      phaseRef.current = "error";
      setError("无法开始自动录音，请检查麦克风权限。");
      setPhase("error");
    }
  }

  function handleAudioLevel(level: number) {
    const now = performance.now();
    if (shouldPaintVoiceLevel(lastVoicePaintAtRef.current, now)) {
      lastVoicePaintAtRef.current = now;
      setVoiceLevel(Math.min(1, level * 3));
      setVoiceDb(Math.max(-60, Math.round(20 * Math.log10(Math.max(level, 0.001)))));
    }

    const currentPhase = phaseRef.current;
    if (currentPhase !== "idle" && currentPhase !== "error" && currentPhase !== "listening") return;

    if (currentPhase === "idle" || currentPhase === "error") {
      noiseFloorRef.current = noiseFloorRef.current * 0.97 + level * 0.03;
    }
    const threshold = Math.max(AUTO_SPEECH_THRESHOLD, noiseFloorRef.current * 2.8);
    const silenceThreshold = Math.max(0.005, threshold * 0.55);
    const voiceDetected = level >= (currentPhase === "listening" ? silenceThreshold : threshold);

    if (currentPhase === "idle" || currentPhase === "error") {
      if (!voiceDetected) {
        speechCandidateAtRef.current = null;
        return;
      }
      speechCandidateAtRef.current ??= now;
      if (now - speechCandidateAtRef.current >= AUTO_SPEECH_ONSET_MS) beginAutoCapture();
      return;
    }

    if (voiceDetected) lastVoiceAtRef.current = now;
    const startedAt = speechStartedAtRef.current;
    const lastVoiceAt = lastVoiceAtRef.current ?? startedAt ?? now;
    if (startedAt && now - startedAt >= AUTO_SPEECH_MAX_MS) {
      void stopRecording();
    } else if (startedAt && now - lastVoiceAt >= AUTO_SPEECH_SILENCE_MS) {
      void stopRecording();
    }
  }

  async function startAutoListening() {
    if (!autoMonitorEnabledRef.current || autoStartInFlightRef.current || recorderRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    if (phaseRef.current !== "idle" && phaseRef.current !== "error") return;

    autoStartInFlightRef.current = true;
    let recorder: PcmRecorder | null = null;
    try {
      recorder = new PcmRecorder();
      await recorder.start({ capture: false, onLevel: handleAudioLevel });
      if (!autoMonitorEnabledRef.current || (phaseRef.current !== "idle" && phaseRef.current !== "error")) {
        await recorder.cancel();
        return;
      }
      const claimed = await claimWakeMicrophone();
      if (!claimed) {
        await recorder.cancel();
        return;
      }
      recorderRef.current = recorder;
      setVoiceLevel(0);
      setVoiceDb(-60);
      setAutoListening(true);
    } catch {
      if (hasContinuousVoiceSession()) {
        closeContinuousVoiceSession();
      } else {
        releaseRecorder(recorder);
      }
      setAutoListening(false);
      phaseRef.current = "error";
      setError("无法访问麦克风，请检查浏览器权限。");
      setPhase("error");
    } finally {
      autoStartInFlightRef.current = false;
    }
  }

  async function startRecording() {
    if (phase !== "idle" && phase !== "error") return;
    releasePendingVoiceCapture();
    releaseRecorder(recorderRef.current);
    recorderRef.current = null;
    resetSpeechTiming();
    setAutoListening(false);
    setError("");
    setTranscript("");
    try {
      const recorder = new PcmRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      phaseRef.current = "listening";
      setPhase("listening");
    } catch {
      setError("无法访问麦克风，请检查浏览器权限或改用文字输入。");
      setPhase("error");
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || phaseRef.current !== "listening") return;
    phaseRef.current = "transcribing";
    resetSpeechTiming();
    setAutoListening(false);
    setPhase("transcribing");
    try {
      const wav = await recorder.stop({ release: false });
      recorderRef.current = null;
      pendingVoiceCaptureRef.current = recorder;
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
      await ask(text, { fromVoice: true });
    } catch {
      if (hasContinuousVoiceSession()) {
        closeContinuousVoiceSession();
      } else {
        releaseRecorder(recorder);
      }
      recorderRef.current = null;
      if (pendingVoiceCaptureRef.current === recorder) pendingVoiceCaptureRef.current = null;
      setAutoListening(false);
      resetSpeechTiming();
      setError("百度语音识别暂时不可用，请重试或改用文字输入。");
      phaseRef.current = "error";
      setPhase("error");
    }
  }

  useEffect(() => {
    if (!localWakeWordModeRef.current) return;
    let active = true;
    let timer: number | undefined;

    const pollWakeEvent = async () => {
      try {
        const response = await fetch("/_mambo/wake", { cache: "no-store" });
        if (!active || !response.ok) return;
        const payload = await response.json() as { sequence?: unknown; online?: unknown; capture?: unknown };
        if (!active) return;
        if (typeof payload.sequence !== "number" || !Number.isInteger(payload.sequence)) return;
        setWakeWordStatus(payload.online === true ? "online" : payload.online === false ? "offline" : "checking");
        setWakeCaptureState(
          payload.capture === "awaiting_claim" || payload.capture === "capturing" || payload.capture === "idle"
            ? payload.capture
            : "idle",
        );
        const previousSequence = wakeEventSequenceRef.current;
        wakeEventSequenceRef.current = payload.sequence;
        if (
          shouldHandleWakeEvent(previousSequence, payload.sequence)
          && !hasContinuousVoiceSession()
          && (phaseRef.current === "idle" || phaseRef.current === "error")
        ) {
          void (async () => {
            if (!active) return;
            try {
              const started = await beginContinuousVoiceSession();
              if (!active || !started) return;
              await speak("我在，请说");
            } catch (speechError) {
              if (!active) return;
              if (speechError instanceof Error && (speechError.message === "tts_stopped" || speechError.message === "tts_cancelled")) return;
              closeContinuousVoiceSession();
              setError("语音播报暂时不可用，请稍后重试。");
              phaseRef.current = "error";
              setPhase("error");
            }
          })();
        }
      } catch {
        // The local wake service can restart independently of the web page.
        if (active) setWakeWordStatus("offline");
      } finally {
        if (active) timer = window.setTimeout(() => void pollWakeEvent(), WAKE_WORD_POLL_MS);
      }
    };

    void pollWakeEvent();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
    // The mode ref is initialized by the earlier mount effect; the poll itself reads stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!localWakeWordMode || !wakeLeaseClaimed) return;
    let active = true;
    const renew = async () => {
      if (wakeLeaseRenewInFlightRef.current) return;
      const controller = new AbortController();
      const lifecycle = continuousVoiceLifecycleRef.current;
      wakeLeaseRenewInFlightRef.current = true;
      wakeLeaseRenewAbortControllerRef.current = controller;
      try {
        await sendWakeCaptureAction("renew", { signal: controller.signal });
      } catch {
        if (
          active
          && !controller.signal.aborted
          && wakeLeaseRenewAbortControllerRef.current === controller
          && lifecycle === continuousVoiceLifecycleRef.current
          && hasContinuousVoiceSession()
        ) {
          closeContinuousVoiceSession();
          phaseRef.current = "idle";
          setPhase("idle");
        }
      } finally {
        if (wakeLeaseRenewAbortControllerRef.current === controller) {
          wakeLeaseRenewAbortControllerRef.current = null;
          wakeLeaseRenewInFlightRef.current = false;
        }
      }
    };
    void renew();
    const timer = window.setInterval(() => {
      if (active) void renew();
    }, 5_000);
    return () => {
      active = false;
      abortWakeLeaseRenewal();
      window.clearInterval(timer);
    };
    // Renewal is subscribed to lease state; failure handling reads stable session refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localWakeWordMode, wakeLeaseClaimed]);

  function invalidateGestureInteraction() {
    invalidateGestureDomClick(gestureClickTimerRef, gestureClickLifecycleRef);
    pointerCommandRef.current?.cancelBarrier();
  }

  function getPointerCommand(): LatestPointerCommand {
    if (!pointerCommandRef.current) {
      pointerCommandRef.current = new LatestPointerCommand((latestPoint) => (
        issueDeviceCommand("move_mouse", latestPoint, { silent: true })
      ));
    }
    return pointerCommandRef.current;
  }

  function submitPhysicalPointerMove(point: { x: number; y: number }) {
    if (deviceStatusRef.current !== "online") return;
    getPointerCommand().submit(point);
  }

  function sendPhysicalGestureClick(point: { x: number; y: number }) {
    if (deviceStatusRef.current !== "online") return;
    const clickLifecycle = gestureClickLifecycleRef.current;
    void getPointerCommand().moveThenRun(point, async () => {
      if (clickLifecycle !== gestureClickLifecycleRef.current) return;
      const clicked = await issueDeviceCommand("click_mouse", {}, { silent: true });
      if (!clicked) throw new Error("physical_click_failed");
    });
  }

  function handleBrowserGestureEvent(event: GestureEvent) {
    setBrowserGesturePointer((current) => nextBrowserGesturePointerState(current, event));
    if (event.type === "cursor_move") {
      submitPhysicalPointerMove({ x: event.x, y: event.y });
      return;
    }
    if (event.type === "progress") {
      return;
    }
    if (event.type === "tracking_lost") {
      return;
    }
    if (!isBrowserGestureClick(event)) return;
    const point = normalizedPointToViewport(
      { x: event.x, y: event.y },
      { width: window.innerWidth, height: window.innerHeight },
    );
    const interactive = findGestureInteractiveTarget(document.elementFromPoint(point.x, point.y));
    const hasDomInteractiveTarget = interactive !== null;
    if (hasDomInteractiveTarget) {
      scheduleGestureDomClick(gestureClickTimerRef, gestureClickLifecycleRef, () => interactive.click());
      return;
    }
    if (shouldSendPhysicalGestureClick(hasDomInteractiveTarget, deviceStatusRef.current === "online")) {
      sendPhysicalGestureClick({ x: event.x, y: event.y });
    }
  }

  function updateBrowserGestureStatus(status: GestureStatus) {
    browserGestureStatusRef.current = status;
    setBrowserGestureStatus(status);
  }

  function resetBrowserGestureUi() {
    invalidateGestureInteraction();
    gestureControllerRef.current.reset();
    setBrowserGestureError("");
    setBrowserGesturePointer({ cursor: null, progress: 0 });
  }

  function resetGestureUi() {
    if (localHandVisionMode) {
      resetBoardGesture();
      return;
    }
    resetBrowserGestureUi();
  }

  async function startGesture(): Promise<boolean> {
    if (localHandVisionMode) return startBoardGesture();
    if (browserGestureStatusRef.current === "ready") return true;
    if (browserGestureStatusRef.current === "loading" || browserGestureStatusRef.current === "stopping") return false;
    const lifecycle = handVisionLifecycleRef.current + 1;
    handVisionLifecycleRef.current = lifecycle;
    setBrowserGestureError("");
    updateBrowserGestureStatus("loading");
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
      const tracker = await withTimeout(createBrowserHandTracker(video, (frame) => {
        drawHandOverlay(handOverlayRef.current, video, frame);
        const events = gestureControllerRef.current.update(frame.observation);
        events.forEach(handleBrowserGestureEvent);
      }), 15_000);
      if (!shouldApplyHandVisionSnapshot(lifecycle, handVisionLifecycleRef.current)) {
        tracker.stop();
        stopCameraStream(video);
        return false;
      }
      handTrackerRef.current = tracker;
      tracker.start();
      updateBrowserGestureStatus("ready");
      return true;
    } catch {
      if (!shouldApplyHandVisionSnapshot(lifecycle, handVisionLifecycleRef.current)) return false;
      handTrackerRef.current?.stop();
      handTrackerRef.current = null;
      stopCameraStream(videoRef.current);
      clearHandOverlay(handOverlayRef.current);
      resetBrowserGestureUi();
      setBrowserGestureError("摄像头或手势模型暂时不可用，可继续使用鼠标和键盘。");
      updateBrowserGestureStatus("error");
      return false;
    }
  }

  async function handleGestureVoiceCommand(command: GestureVoiceCommand): Promise<string> {
    if (typeof command === "object") {
      return runGestureVoiceCommand(command, {
        captureSnapshot: () => issueDeviceCommand("capture_snapshot", {}),
        localHandVisionMode,
        startGesture,
        stopGesture,
      });
    }
    if (command === "stop") {
      await stopGesture();
      return "手势控制已关闭。";
    }
    return (await startGesture())
      ? localHandVisionMode
        ? "手势视觉服务正在启动。请将一只手放入摄像头画面。"
        : "手势控制已开启。请张开手掌移动光标，握拳保持确认点击。"
      : "手势控制暂时无法开启，请检查摄像头。";
  }

  async function stopGesture(): Promise<void> {
    if (localHandVisionMode) {
      await stopBoardGesture();
      return;
    }
    invalidateGestureInteraction();
    if (browserGestureStatusRef.current === "off" || browserGestureStatusRef.current === "stopping") return;
    const lifecycle = handVisionLifecycleRef.current + 1;
    handVisionLifecycleRef.current = lifecycle;
    handTrackerRef.current?.stop();
    handTrackerRef.current = null;
    stopCameraStream(videoRef.current);
    clearHandOverlay(handOverlayRef.current);
    resetBrowserGestureUi();
    setBrowserGestureError("");
    if (!shouldApplyHandVisionSnapshot(lifecycle, handVisionLifecycleRef.current)) return;
    updateBrowserGestureStatus("off");
  }

  function stopSpeaking() {
    const continuousSession = hasContinuousVoiceSession();
    audioRef.current?.pause();
    audioPlaybackRejectRef.current?.(new Error("tts_stopped"));
    audioPlaybackRejectRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if (continuousSession) {
      closeContinuousVoiceSession();
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }
    releasePendingVoiceCapture();
    phaseRef.current = "idle";
    setPhase("idle");
  }

  async function issueDeviceCommand(name: string, args: Record<string, unknown>, options: { silent?: boolean } = {}): Promise<boolean> {
    try {
      const response = await fetch("/api/device/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
      });
      if (!response.ok) throw new Error("device_failed");
      if (!options.silent) setDeviceMessage("命令已发送，等待开发板完成");
      return true;
    } catch {
      if (!options.silent) setDeviceMessage("设备命令失败或设备离线");
      return false;
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
  const voiceMeter = getVoiceMeterState(localWakeWordMode, wakeWordStatus, autoListening, voiceDb);
  const handVisionStatusMessage = getHandVisionStatusMessage(localHandVisionMode, handVision);
  const showHandVisionOverlay = shouldShowHandVisionOverlay(localHandVisionMode, handVision);
  const continuousVoiceSessionActive = hasContinuousVoiceSession();

  return (
    <main className={styles.robotPage}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <span className={styles.brandMark} aria-hidden="true">M</span>
          <div>
            <h1>Mambo 机器人课堂</h1>
            <p>{course.title}</p>
          </div>
        </div>
        <Link className={styles.homeLink} href="/preview">
          <ArrowLeft size={15} aria-hidden="true" />
          返回首页
        </Link>
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

        <section className={styles.conversation} aria-label="共享对话">
          <div className={styles.conversationHeader}>
            <div>
              <span className={styles.sectionLabel}>星宝 · 学习同伴</span>
              <h2>共享对话</h2>
            </div>
            <span className={styles.phase} data-phase={phase}>{phaseLabel[phase]}</span>
          </div>
          <div ref={messagesRef} className={styles.messages} role="log" aria-live="polite">
            {sharedConversationLoading ? <p className={styles.conversationStatus}>正在同步星宝对话...</p> : null}
            {sharedMessages.map((message) => (
              <article key={message.messageId} className={styles.message} data-author={message.role === "user" ? "learner" : "assistant"}>
                <span className={styles.messageAvatar} aria-hidden="true">{message.role === "user" ? "我" : "星"}</span>
                <div className={styles.messageBody}>
                  <span className={styles.messageMeta}>
                    {message.origin === "web" ? "网页输入" : message.origin === "asr" ? "香橙派语音" : message.origin === "orangepi" ? "香橙派输入" : "星宝回答"}
                  </span>
                  <p>{message.content}</p>
                </div>
              </article>
            ))}
            {sharedConversationError ? <p className={styles.conversationStatus} role="alert">星宝暂时无法同步，请稍后重试。</p> : null}
            {transcript && <div className={styles.transcript}>刚才听到：{transcript}</div>}
          </div>
          <form className={styles.composer} onSubmit={submit}>
            <Keyboard size={17} aria-hidden="true" />
            <label className="sr-only" htmlFor="robot-question">输入问题</label>
            <input id="robot-question" aria-label="输入问题" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="也可以输入问题..." />
            <button type="submit" aria-label="发送问题" disabled={!draft.trim() || phase === "thinking"}><Send size={17} /></button>
          </form>
        </section>

        <aside className={styles.controlRail} aria-label="星宝控制">
          <div className={styles.controlDockHeader}>
            <div>
              <span className={styles.sectionLabel}>桌面伙伴</span>
              <h2>星宝控制</h2>
              <label className={styles.controlSpeechToggle}>
                <input
                  type="checkbox"
                  checked={sharedConversation?.speakOnOrangePi ?? false}
                  disabled={!sharedConversation}
                  onChange={(event) => { void setSharedSpeakOnOrangePi(event.target.checked); }}
                />
                <span>网页消息同步到香橙派播报</span>
              </label>
            </div>
            <div className={styles.dockTabs} role="tablist" aria-label="星宝控制">
              <button
                id="robot-control-voice-tab"
                type="button"
                role="tab"
                aria-controls="robot-control-voice-panel"
                aria-selected={activeControl === "voice"}
                className={styles.dockTab}
                data-active={activeControl === "voice"}
                onClick={() => setActiveControl("voice")}
              >
                <Mic size={14} aria-hidden="true" />
                语音对话
              </button>
              <button
                id="robot-control-vision-tab"
                type="button"
                role="tab"
                aria-controls="robot-control-vision-panel"
                aria-selected={activeControl === "vision"}
                className={styles.dockTab}
                data-active={activeControl === "vision"}
                onClick={() => setActiveControl("vision")}
              >
                <Hand size={14} aria-hidden="true" />
                手势视觉
              </button>
              <button
                id="robot-control-device-tab"
                type="button"
                role="tab"
                aria-controls="robot-control-device-panel"
                aria-selected={activeControl === "device"}
                className={styles.dockTab}
                data-active={activeControl === "device"}
                onClick={() => setActiveControl("device")}
              >
                <MonitorUp size={14} aria-hidden="true" />
                设备控制
              </button>
              <button
                id="robot-control-face-tab"
                type="button"
                role="tab"
                aria-controls="robot-control-face-panel"
                aria-selected={activeControl === "face"}
                className={styles.dockTab}
                data-active={activeControl === "face"}
                onClick={() => setActiveControl("face")}
              >
                <ScanFace size={14} aria-hidden="true" />
                人脸身份
              </button>
            </div>
          </div>

          {activeControl === "voice" && (
          <section id="robot-control-voice-panel" role="tabpanel" aria-labelledby="robot-control-voice-tab" className={styles.voiceCard}>
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
              disabled={localWakeWordMode && (wakeWordStatus !== "offline" || wakeCaptureState !== "idle") && phase !== "listening"}
            >
              {phase === "listening" ? <Square size={22} /> : <Mic size={22} />}
              <span>{phase === "listening" ? "结束说话" : "开始说话"}</span>
            </button>
            <p className={styles.autoVoiceStatus} data-active={autoListening} role="status" aria-live="polite">
              {localWakeWordMode
                ? continuousVoiceSessionActive ? "连续对话中，可直接说话" : autoListening ? "已唤醒，正在监听你的问题" : wakeCaptureState === "awaiting_claim"
                  ? "已唤醒，正在连接麦克风"
                  : wakeWordStatus === "online"
                  ? "本地唤醒词待机：请说“你好星宝”"
                  : wakeWordStatus === "checking"
                    ? "正在确认本地唤醒服务"
                    : "本地唤醒服务不可用或正在恢复，可点击开始说话手动提问"
                : autoListening ? "自动监听环境音，可以直接说话" : "点击开始说话，或使用键盘输入"}
            </p>
            <div className={styles.voiceMeterMeta}>
              <span>{voiceMeter.label}</span>
              <strong>{voiceMeter.value}</strong>
            </div>
            {voiceMeter.showLevel && (
              <div className={styles.voiceMeter} aria-label={`当前环境音量 ${voiceDb} 分贝`}>
                <span style={{ width: `${Math.min(100, voiceLevel * 100)}%` }} />
              </div>
            )}
            {phase === "speaking" && <button type="button" className={styles.secondaryButton} onClick={stopSpeaking}><VolumeX size={15} />停止播放</button>}
            {lastUserMessage && phase === "error" && <button type="button" className={styles.secondaryButton} onClick={() => void ask(lastUserMessage)}><Play size={15} />重试上一问</button>}
            {error && <p className={styles.error} role="alert">{error}</p>}
          </section>
          )}

          {activeControl === "vision" && (
          <section id="robot-control-vision-panel" role="tabpanel" aria-labelledby="robot-control-vision-tab" className={styles.gestureCard}>
            <div className={styles.controlTitle}><Hand size={16} aria-hidden="true" /><span>手势输入</span></div>
            <p role="status" aria-live="polite">{handVisionStatusMessage}</p>
            <div className={styles.cameraViewport}>
              {localHandVisionMode ? (
                handVision?.status === "running" && handVision.sequence > 0
                  ? (
                    // eslint-disable-next-line @next/next/no-img-element -- this is a short-lived loopback camera frame, not an optimizable asset.
                    <img ref={nativePreviewRef} className={styles.cameraPreview} src={`/_mambo/hand/frame.jpg?sequence=${handVision.sequence}`} alt="手势摄像头预览" />
                  )
                  : <div className={styles.cameraPreview} aria-label="等待手势视觉服务" />
              ) : (
                <>
                  <video ref={videoRef} className={styles.cameraPreview} muted playsInline aria-label="手势摄像头预览" />
                  <canvas ref={handOverlayRef} className={styles.handOverlay} aria-hidden="true" />
                </>
              )}
              {showHandVisionOverlay && <span className={styles.cameraStatusOverlay} aria-hidden="true">{handVisionStatusMessage}</span>}
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void ((gestureStatus === "ready" || gestureStatus === "loading") ? stopGesture() : startGesture())}
              disabled={gestureStatus === "stopping"}
            >
              <Camera size={15} />
              {gestureStatus === "loading"
                ? localHandVisionMode ? "正在启动板端手势模型" : "正在加载手势模型"
                : gestureStatus === "stopping" ? "正在关闭手势控制"
                : gestureStatus === "ready" ? "关闭手势" : "开启手势"}
            </button>
            {gestureError && <p className={styles.error} role="alert">{gestureError}</p>}
            <button type="button" className={`${styles.secondaryButton} ${styles.gestureResetButton}`} onClick={resetGestureUi}><Hand size={15} />重置手势</button>
            <div className={styles.compactDeviceActions} aria-label="快捷设备控制">
              <button type="button" title="重置手势" aria-label="重置手势" onClick={resetGestureUi}><Hand size={14} /></button>
              <button type="button" title="唤醒屏幕" aria-label="唤醒屏幕" onClick={() => void issueDeviceCommand("set_display_mode", { mode: "on" })}><MonitorUp size={14} /></button>
              <button type="button" title="演示模式" aria-label="演示模式" onClick={() => void issueDeviceCommand("set_display_mode", { mode: "presentation" })}><Play size={14} /></button>
              <button type="button" title="拍照" aria-label="拍照" onClick={() => void issueDeviceCommand("capture_snapshot", {})}><Camera size={14} /></button>
            </div>
          </section>
          )}

          {activeControl === "face" && (
          <section id="robot-control-face-panel" role="tabpanel" aria-labelledby="robot-control-face-tab" className={styles.faceCard}>
            <FaceIdentityPanel localMode={localHandVisionMode} standalone />
          </section>
          )}

          {activeControl === "device" && (
          <section id="robot-control-device-panel" role="tabpanel" aria-labelledby="robot-control-device-tab" className={styles.deviceCard}>
            <div className={styles.controlTitle}><MonitorUp size={16} aria-hidden="true" /><span>屏幕控制</span></div>
            <div className={styles.actionRow}>
              <button type="button" title="唤醒屏幕" aria-label="唤醒屏幕" onClick={() => void issueDeviceCommand("set_display_mode", { mode: "on" })}><MonitorUp size={16} /></button>
              <button type="button" title="演示模式" aria-label="演示模式" onClick={() => void issueDeviceCommand("set_display_mode", { mode: "presentation" })}><Play size={16} /></button>
              <button type="button" title="拍照" aria-label="拍照" onClick={() => void issueDeviceCommand("capture_snapshot", {})}><Camera size={16} /></button>
            </div>
          </section>
          )}
        </aside>
      </section>
      <BrowserGesturePointerOverlay localHandVisionMode={localHandVisionMode} pointer={browserGesturePointer} />
    </main>
  );
}
