import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { FaceIdentitySnapshot } from "./face-identity-client";
import { HAND_VISION_POLL_MS, RobotGestureProvider, useRobotGesture } from "./robot-gesture-provider";
import * as robotWorkspaceModule from "./robot-workspace";
import type { SharedStarbaoConversation, SharedStarbaoMessage } from "@/features/starbao/use-shared-starbao-conversation";
import {
  buildChatHistory,
  BrowserGesturePointerOverlay,
  CONTINUOUS_VOICE_SESSION_MS,
  FaceIdentityPanel,
  getFaceIdentityStatusMessage,
  getHandVisionStatusMessage,
  isContinuousVoiceSessionExpired,
  isBrowserGestureClick,
  nextContinuousVoiceDeadline,
  nextBrowserGesturePointerState,
  invalidateGestureDomClick,
  invalidateHandVisionLifecycle,
  RobotWorkspace,
  runGestureVoiceCommand,
  scheduleGestureDomClick,
  selectNewStarbaoAnnouncements,
  type StarbaoAnnouncementCandidate,
  shouldApplyHandVisionSnapshot,
  shouldRenderBrowserGesturePointer,
  shouldPaintVoiceLevel,
  shouldSendPhysicalGestureClick,
  usesDeviceAudioPlayback,
  usesLocalDeviceProxy,
  wakeCapturePath,
  WAKE_WORD_POLL_MS,
} from "./robot-workspace";

const sendSharedTurn = vi.fn();
const setSharedSpeakOnOrangePi = vi.fn();
const sharedConversationState: {
  conversation: SharedStarbaoConversation;
  messages: SharedStarbaoMessage[];
  latestSequence: number;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  refresh: ReturnType<typeof vi.fn>;
  sendTurn: ReturnType<typeof vi.fn>;
  setSpeakOnOrangePi: ReturnType<typeof vi.fn>;
} = {
  conversation: {
    conversationId: "conversation-1",
    deviceId: "orangepi4pro-dev-01",
    speakOnOrangePi: false,
    latestSequence: 0,
  },
  messages: [],
  latestSequence: 0,
  isLoading: false,
  isSending: false,
  error: null,
  refresh: vi.fn(),
  sendTurn: sendSharedTurn,
  setSpeakOnOrangePi: setSharedSpeakOnOrangePi,
};

vi.mock("@/features/starbao/use-shared-starbao-conversation", () => ({
  useSharedStarbaoConversation: () => sharedConversationState,
}));

const faceIdentity = {
  id: "student-1",
  label: "小明",
  samples: 5,
  created_at: "2026-07-19T00:00:00Z",
};

function faceSnapshot(overrides: Record<string, unknown> = {}): FaceIdentitySnapshot {
  return {
    status: "idle",
    state: "idle",
    message: "人脸识别已关闭",
    enrollment: null,
    identity: null,
    error: null,
    ...overrides,
  } as unknown as FaceIdentitySnapshot;
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
}

function useLocalWakeWindow() {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  const nativeWindow = window;
  vi.stubGlobal("window", new Proxy(nativeWindow, {
    get(target, property, receiver) {
      if (property === "location") return { hostname: "127.0.0.1", port: "3010" };
      return Reflect.get(target, property, receiver);
    },
  }));
}

function installVoiceBrowserFakes() {
  const audioInstances: Array<{
    src: string;
    onended: (() => void) | null;
    onerror: (() => void) | null;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
  }> = [];
  const processors: Array<{
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onaudioprocess: ((event: { inputBuffer: { getChannelData: (channel: number) => Float32Array } }) => void) | null;
  }> = [];

  class FakeAudio {
    src = "";
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();

    constructor() {
      audioInstances.push(this);
    }
  }

  const getUserMedia = vi.fn().mockImplementation(async () => ({
    getTracks: () => [{ stop: vi.fn() }],
  }));
  const FakeAudioContext = vi.fn(function FakeAudioContext() {
    const processor: typeof processors[number] = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
    processors.push(processor);
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const mute = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    return {
      sampleRate: 16_000,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createMediaStreamSource: vi.fn(() => source),
      createScriptProcessor: vi.fn(() => processor),
      createGain: vi.fn(() => mute),
    };
  });

  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:voice"),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

  return { audioInstances, getUserMedia, processors };
}

function handVisionSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    status: "running",
    sequence: 1,
    gesture: "none",
    confidence: 0,
    cursor: null,
    landmarks: [],
    fps: 8,
    latency_ms: 50,
    width: 320,
    height: 240,
    error: null,
    ...overrides,
  };
}

function RobotWorkspaceHarness() {
  return <RobotGestureProvider><RobotWorkspace /></RobotGestureProvider>;
}

function renderRobotWorkspace() {
  return render(<RobotWorkspaceHarness />);
}

function ProviderGestureState() {
  const { gestureStatus, handVision } = useRobotGesture();
  return <output data-testid="provider-gesture-state">{`${gestureStatus}:${handVision?.sequence ?? "none"}`}</output>;
}

function PersistentGestureHarness({ showWorkspace }: { showWorkspace: boolean }) {
  return (
    <RobotGestureProvider>
      <ProviderGestureState />
      {showWorkspace ? <RobotWorkspace /> : <span>preview route</span>}
    </RobotGestureProvider>
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("RobotWorkspace", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    sharedConversationState.messages = [];
    sharedConversationState.conversation = {
      conversationId: "conversation-1",
      deviceId: "orangepi4pro-dev-01",
      speakOnOrangePi: false,
      latestSequence: 0,
    };
    sendSharedTurn.mockReset();
    setSharedSpeakOnOrangePi.mockReset();
  });

  it("scrolls the conversation after a canonical message is synchronized", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
    const { rerender } = renderRobotWorkspace();
    scrollTo.mockClear();
    sharedConversationState.messages = [{
      messageId: "message-1",
      conversationId: "conversation-1",
      sequence: 1,
      clientMessageId: "web-1:assistant",
      role: "assistant",
      origin: "starbao",
      content: "follow-up",
      replyToMessageId: null,
      announceOnOrangePi: false,
      createdAt: "2026-07-19T09:00:01Z",
    }];
    rerender(<RobotWorkspaceHarness />);

    await screen.findByText("follow-up");
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
  });

  it("keeps the global board hand service polling when the robot workspace route unmounts", async () => {
    vi.useFakeTimers();
    const nativeWindow = window;
    vi.stubGlobal("window", new Proxy(nativeWindow, {
      get(target, property, receiver) {
        if (property === "location") return { hostname: "127.0.0.1", port: "3010" };
        return Reflect.get(target, property, receiver);
      },
    }));
    let sequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot({ sequence: ++sequence })));
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: 0, online: true, capture: "idle" }));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = render(<PersistentGestureHarness showWorkspace />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.getByTestId("provider-gesture-state")).toHaveTextContent("ready:1");
    fetch.mockClear();
    rerender(<PersistentGestureHarness showWorkspace={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(HAND_VISION_POLL_MS); });

    expect(fetch).not.toHaveBeenCalledWith("/_mambo/hand/stop", expect.anything());
    expect(fetch).toHaveBeenCalledWith("/_mambo/hand/status", expect.anything());
    expect(screen.getByTestId("provider-gesture-state")).toHaveTextContent("ready:2");
  });

  it("keeps remote browser pointer feedback separate from the board-global pointer", () => {
    const cursorMoved = nextBrowserGesturePointerState(
      { cursor: null, progress: 0 },
      { type: "cursor_move", x: 0.4, y: 0.6 },
    );
    expect(cursorMoved).toEqual({ cursor: { x: 0.4, y: 0.6 }, progress: 0 });
    expect(nextBrowserGesturePointerState(cursorMoved, { type: "progress", value: 0.75 })).toEqual({
      cursor: { x: 0.4, y: 0.6 },
      progress: 0.75,
    });
    expect(nextBrowserGesturePointerState(cursorMoved, { type: "tracking_lost" })).toEqual({ cursor: null, progress: 0 });
    expect(shouldRenderBrowserGesturePointer(false)).toBe(true);
    expect(shouldRenderBrowserGesturePointer(true)).toBe(false);
  });

  it("renders the workspace pointer only for the nonlocal browser fallback", () => {
    const pointer = { cursor: { x: 0.4, y: 0.6 }, progress: 0.75 };
    const { rerender } = render(<BrowserGesturePointerOverlay localHandVisionMode={false} pointer={pointer} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
    rerender(<BrowserGesturePointerOverlay localHandVisionMode pointer={pointer} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("reads local board gesture state from the provider and delegates its toggle", async () => {
    vi.useFakeTimers();
    const nativeWindow = window;
    vi.stubGlobal("window", new Proxy(nativeWindow, {
      get(target, property, receiver) {
        if (property === "location") return { hostname: "127.0.0.1", port: "3010" };
        return Reflect.get(target, property, receiver);
      },
    }));
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/_mambo/hand/stop") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "idle" })));
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: 0, online: true, capture: "idle" }));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60); });
    fireEvent.click(screen.getByRole("tab", { name: "手势视觉" }));

    const toggle = screen.getByRole("button", { name: "关闭手势" });
    fireEvent.click(toggle);
    await act(async () => { await Promise.resolve(); });

    expect(fetch).toHaveBeenCalledWith("/_mambo/hand/stop", expect.objectContaining({ method: "POST" }));
  });

  it("uses the local device proxy only on the robot loopback address", () => {
    expect(usesLocalDeviceProxy({ hostname: "127.0.0.1", port: "3010" })).toBe(true);
    expect(usesLocalDeviceProxy({ hostname: "192.168.1.18", port: "3001" })).toBe(false);
  });

  it("enables local wake word mode only on the robot loopback address", () => {
    const usesLocalWakeWordService = (
      robotWorkspaceModule as typeof robotWorkspaceModule & {
        usesLocalWakeWordService?: (location: Pick<Location, "hostname" | "port">) => boolean;
      }
    ).usesLocalWakeWordService ?? (() => false);

    expect(usesLocalWakeWordService({ hostname: "127.0.0.1", port: "3010" })).toBe(true);
    expect(usesLocalWakeWordService({ hostname: "192.168.1.18", port: "3001" })).toBe(false);
  });

  it("keeps the browser microphone free while the local wake word listener is active", () => {
    const shouldMonitorBrowserMicrophone = (
      robotWorkspaceModule as typeof robotWorkspaceModule & {
        shouldMonitorBrowserMicrophone?: (localWakeWordMode: boolean) => boolean;
      }
    ).shouldMonitorBrowserMicrophone ?? (() => true);

    expect(shouldMonitorBrowserMicrophone(true)).toBe(false);
    expect(shouldMonitorBrowserMicrophone(false)).toBe(true);
  });

  it("responds only to a wake event newer than the initial local sequence", () => {
    const shouldHandleWakeEvent = (
      robotWorkspaceModule as typeof robotWorkspaceModule & {
        shouldHandleWakeEvent?: (previousSequence: number | null, sequence: number) => boolean;
      }
    ).shouldHandleWakeEvent ?? (() => false);

    expect(shouldHandleWakeEvent(null, 4)).toBe(false);
    expect(shouldHandleWakeEvent(4, 4)).toBe(false);
    expect(shouldHandleWakeEvent(4, 5)).toBe(true);
  });

  it("uses explicit local endpoints to claim and release the wake-word microphone lease", () => {
    expect(wakeCapturePath("claim")).toBe("/_mambo/wake/claim");
    expect(wakeCapturePath("renew")).toBe("/_mambo/wake/renew");
    expect(wakeCapturePath("release")).toBe("/_mambo/wake/release");
  });

  it("checks the local wake event quickly enough for a conversational response", () => {
    expect(WAKE_WORD_POLL_MS).toBe(150);
  });

  it("defines a 30-second continuous voice session window", () => {
    expect(CONTINUOUS_VOICE_SESSION_MS).toBe(30_000);
  });

  it("sets the next continuous voice deadline from the supplied time", () => {
    expect(nextContinuousVoiceDeadline(1_000)).toBe(31_000);
  });

  it("expires a continuous voice session at its deadline but not before", () => {
    expect(isContinuousVoiceSessionExpired(null, 31_000)).toBe(false);
    expect(isContinuousVoiceSessionExpired(31_000, 30_999)).toBe(false);
    expect(isContinuousVoiceSessionExpired(31_000, 31_000)).toBe(true);
  });

  it("labels the local wake word listener instead of showing a stale browser volume", () => {
    const getVoiceMeterState = (
      robotWorkspaceModule as typeof robotWorkspaceModule & {
        getVoiceMeterState?: (localWakeWordMode: boolean, wakeWordStatus: "checking" | "online" | "offline", autoListening: boolean, voiceDb: number) => {
          label: string;
          value: string;
          showLevel: boolean;
        };
      }
    ).getVoiceMeterState ?? (() => ({ label: "实时音量", value: "-60 dB", showLevel: true }));

    expect(getVoiceMeterState(true, "online", false, -60)).toEqual({ label: "本地唤醒模型", value: "在线", showLevel: false });
    expect(getVoiceMeterState(true, "offline", false, -60)).toEqual({ label: "本地唤醒模型", value: "不可用", showLevel: false });
    expect(getVoiceMeterState(true, "online", true, -22)).toEqual({ label: "实时音量", value: "-22 dB", showLevel: true });
  });

  it("recognizes audio that the local device proxy already played", () => {
    expect(usesDeviceAudioPlayback(new Response(null, { headers: { "X-Mambo-Device-Playback": "complete" } }))).toBe(true);
    expect(usesDeviceAudioPlayback(new Response())).toBe(false);
  });

  it("greets before opening automatic capture for a local wake event", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });

    expect(fetch).toHaveBeenCalledWith("/api/voice/tts", expect.objectContaining({
      body: JSON.stringify({ text: "我在，请说" }),
    }));
    expect(audioInstances).toHaveLength(1);
    expect(getUserMedia).not.toHaveBeenCalled();
    const claimIndex = fetch.mock.calls.findIndex(([input]) => String(input) === "/_mambo/wake/claim");
    const greetingIndex = fetch.mock.calls.findIndex(([input]) => String(input) === "/api/voice/tts");
    expect(claimIndex).toBeGreaterThanOrEqual(0);
    expect(claimIndex).toBeLessThan(greetingIndex);
  });

  it("shows the continuous conversation status while a local wake session is active", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances } = installVoiceBrowserFakes();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });

    const voiceStatus = screen.getByRole("status");
    expect(voiceStatus).toHaveAttribute("aria-live", "polite");
    expect(voiceStatus).toHaveTextContent("连续对话中，可直接说话");

    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });

    expect(screen.getByText("连续对话中，可直接说话")).toBeInTheDocument();
  });

  it("returns an expired local wake session to the existing standby status", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances } = installVoiceBrowserFakes();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });

    expect(screen.getByText("连续对话中，可直接说话")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(CONTINUOUS_VOICE_SESSION_MS); });

    expect(screen.getByText("本地唤醒词待机：请说“你好星宝”")).toBeInTheDocument();
  });

  it("clears the local continuous status when greeting TTS fails", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(null, { status: 502 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });

    expect(fetch).toHaveBeenCalledWith("/api/voice/tts", expect.anything());
    expect(screen.queryByText("连续对话中，可直接说话")).not.toBeInTheDocument();
    expect(screen.getByText("语音播报暂时不可用，请稍后重试。")).toBeInTheDocument();
    expect(screen.getByText("本地唤醒词待机：请说“你好星宝”")).toBeInTheDocument();
  });

  it("clears the local continuous status when automatic ASR fails", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, processors } = installVoiceBrowserFakes();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      if (path === "/api/voice/asr") return Promise.resolve(new Response(null, { status: 502 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });

    const levelEvent = { inputBuffer: { getChannelData: () => new Float32Array([0.1, -0.1]) } };
    await act(async () => {
      processors[0].onaudioprocess?.(levelEvent);
      await vi.advanceTimersByTimeAsync(180);
      processors[0].onaudioprocess?.(levelEvent);
    });
    fireEvent.click(screen.getByRole("button", { name: "结束说话" }));
    await act(async () => { await Promise.resolve(); });

    expect(fetch).toHaveBeenCalledWith("/api/voice/asr", expect.anything());
    expect(screen.queryByText("连续对话中，可直接说话")).not.toBeInTheDocument();
    expect(screen.getByText("百度语音识别暂时不可用，请重试或改用文字输入。")).toBeInTheDocument();
    expect(screen.getByText("本地唤醒词待机：请说“你好星宝”")).toBeInTheDocument();
  });

  it("keeps the nonlocal browser voice card on its manual status", () => {
    renderRobotWorkspace();

    expect(screen.getByText("点击开始说话，或使用键盘输入")).toBeInTheDocument();
    expect(screen.queryByText("连续对话中，可直接说话")).not.toBeInTheDocument();
  });

  it("holds the wake lease for 29,999ms after greeting playback and releases it at 30,000ms", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });

    expect(getUserMedia).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(1);
  });

  it("rearms automatic listening after assistant audio ends without another wake event", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });
    expect(getUserMedia).toHaveBeenCalledOnce();

    sharedConversationState.messages = [{
      messageId: "assistant-reply-1",
      conversationId: "conversation-1",
      sequence: 1,
      clientMessageId: "assistant-reply-1",
      role: "assistant",
      origin: "starbao",
      content: "继续听你说",
      replyToMessageId: null,
      announceOnOrangePi: true,
      createdAt: "2026-07-19T09:00:01Z",
    }];
    rerender(<RobotWorkspaceHarness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(audioInstances).toHaveLength(2);
    const wakeCallsBeforeReplyEnds = fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake").length;

    await act(async () => {
      audioInstances[1].onended?.();
      await Promise.resolve();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake")).toHaveLength(wakeCallsBeforeReplyEnds);
  });

  it("ignores a newer wake while its continuous-session claim is still pending", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    const pendingClaim = deferred<Response>();
    let wakeSequence = 1;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "awaiting_claim" }));
      if (path === "/_mambo/wake/claim") return pendingClaim.promise;
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 2;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/claim")).toHaveLength(1);

    wakeSequence = 3;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/claim")).toHaveLength(1);
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(0);

    await act(async () => {
      pendingClaim.resolve(jsonResponse({ ok: true }));
      await Promise.resolve();
    });

    expect(fetch.mock.calls.filter(([input]) => String(input) === "/api/voice/tts")).toHaveLength(1);
    expect(audioInstances).toHaveLength(1);
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(0);
  });

  it("releases a stale wake claim that resolves after the workspace unmounts", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    const pendingClaim = deferred<Response>();
    let wakeSequence = 1;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "awaiting_claim" }));
      if (path === "/_mambo/wake/claim") return pendingClaim.promise;
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { unmount } = renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 2;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/claim")).toHaveLength(1);

    unmount();
    await act(async () => {
      pendingClaim.resolve(jsonResponse({ ok: true }));
      await Promise.resolve();
    });

    expect(fetch.mock.calls.filter(([input]) => String(input) === "/api/voice/tts")).toHaveLength(0);
    expect(audioInstances).toHaveLength(0);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(1);
  });

  it("extends the wake lease after reply playback completes beyond the prior deadline", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });
    expect(getUserMedia).toHaveBeenCalledOnce();

    sharedConversationState.messages = [{
      messageId: "long-reply-1",
      conversationId: "conversation-1",
      sequence: 1,
      clientMessageId: "long-reply-1",
      role: "assistant",
      origin: "starbao",
      content: "我一直在听",
      replyToMessageId: null,
      announceOnOrangePi: true,
      createdAt: "2026-07-19T09:00:01Z",
    }];
    rerender(<RobotWorkspaceHarness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(audioInstances).toHaveLength(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(CONTINUOUS_VOICE_SESSION_MS); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(0);

    await act(async () => {
      audioInstances[1].onended?.();
      await Promise.resolve();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(CONTINUOUS_VOICE_SESSION_MS - 1); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(1);
  });

  it("ignores a wake response that resolves after the workspace unmounts", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances } = installVoiceBrowserFakes();
    const pendingWake = deferred<Response>();
    let wakeRequests = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") {
        wakeRequests += 1;
        return wakeRequests === 1
          ? Promise.resolve(jsonResponse({ sequence: 1, online: true, capture: "idle" }))
          : pendingWake.promise;
      }
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { unmount } = renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    expect(wakeRequests).toBe(2);

    unmount();
    await act(async () => {
      pendingWake.resolve(jsonResponse({ sequence: 2, online: true, capture: "awaiting_claim" }));
      await Promise.resolve();
    });

    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/claim")).toHaveLength(0);
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/api/voice/tts")).toHaveLength(0);
    expect(audioInstances).toHaveLength(0);
  });

  it("closes an active continuous session when wake lease renewal fails", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    let wakeSequence = 0;
    let rejectRenewal = false;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") {
        return rejectRenewal ? Promise.reject(new Error("renew_failed")) : Promise.resolve(jsonResponse({ ok: true }));
      }
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });
    expect(getUserMedia).toHaveBeenCalledOnce();

    rejectRenewal = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(1);

    rejectRenewal = false;
    wakeSequence = 2;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/claim")).toHaveLength(2);
    expect(audioInstances).toHaveLength(2);
  });

  it("recovers from renew failure while reply TTS is pending so a later wake can start", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    const pendingReplyTts = deferred<Response>();
    let wakeSequence = 0;
    let rejectRenewal = false;
    let ttsRequests = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") {
        return rejectRenewal ? Promise.reject(new Error("renew_failed")) : Promise.resolve(jsonResponse({ ok: true }));
      }
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") {
        ttsRequests += 1;
        return ttsRequests === 1 ? Promise.resolve(new Response(new Blob(["voice"]), { status: 200 })) : pendingReplyTts.promise;
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });
    expect(getUserMedia).toHaveBeenCalledOnce();

    sharedConversationState.messages = [{
      messageId: "renew-pending-reply-1",
      conversationId: "conversation-1",
      sequence: 1,
      clientMessageId: "renew-pending-reply-1",
      role: "assistant",
      origin: "starbao",
      content: "稍等一下",
      replyToMessageId: null,
      announceOnOrangePi: true,
      createdAt: "2026-07-19T09:00:01Z",
    }];
    rerender(<RobotWorkspaceHarness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(ttsRequests).toBe(2);

    rejectRenewal = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(1);
    await act(async () => {
      pendingReplyTts.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      await Promise.resolve();
    });

    rejectRenewal = false;
    wakeSequence = 2;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/claim")).toHaveLength(2);
    expect(audioInstances).toHaveLength(2);
  });

  it("does not overlap wake lease renewal while the previous renewal is pending", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances } = installVoiceBrowserFakes();
    const pendingRenewal = deferred<Response>();
    let wakeSequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return pendingRenewal.promise;
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(audioInstances).toHaveLength(1);
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/renew")).toHaveLength(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/renew")).toHaveLength(1);

    await act(async () => {
      pendingRenewal.resolve(jsonResponse({ ok: true }));
      await Promise.resolve();
    });
  });

  it("aborts a prior renewal before a new wake session renews", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances } = installVoiceBrowserFakes();
    const oldRenewal = deferred<Response>();
    const newRenewal = deferred<Response>();
    let wakeSequence = 0;
    let renewals = 0;
    let oldRenewSignal: AbortSignal | undefined;
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") {
        renewals += 1;
        if (renewals === 1) {
          oldRenewSignal = init?.signal ?? undefined;
          return oldRenewal.promise;
        }
        return newRenewal.promise;
      }
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") return Promise.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(renewals).toBe(1);
    expect(oldRenewSignal?.aborted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "停止播放" }));
    expect(oldRenewSignal?.aborted).toBe(true);

    wakeSequence = 2;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(audioInstances).toHaveLength(2);
    expect(renewals).toBe(2);

    await act(async () => {
      oldRenewal.reject(new Error("late_old_renew_failure"));
      await Promise.resolve();
    });
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(renewals).toBe(2);
    await act(async () => {
      newRenewal.resolve(jsonResponse({ ok: true }));
      await Promise.resolve();
    });
  });

  it("does not create browser audio when a stopped continuous session receives a stale TTS response", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    const pendingReplyTts = deferred<Response>();
    let wakeSequence = 0;
    let ttsRequests = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") {
        ttsRequests += 1;
        return ttsRequests === 1 ? Promise.resolve(new Response(new Blob(["voice"]), { status: 200 })) : pendingReplyTts.promise;
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });
    expect(getUserMedia).toHaveBeenCalledOnce();

    sharedConversationState.messages = [{
      messageId: "pending-reply-1",
      conversationId: "conversation-1",
      sequence: 1,
      clientMessageId: "pending-reply-1",
      role: "assistant",
      origin: "starbao",
      content: "稍等一下",
      replyToMessageId: null,
      announceOnOrangePi: true,
      createdAt: "2026-07-19T09:00:01Z",
    }];
    rerender(<RobotWorkspaceHarness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(ttsRequests).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "停止播放" }));
    await act(async () => {
      pendingReplyTts.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      await Promise.resolve();
    });

    expect(audioInstances).toHaveLength(1);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(fetch.mock.calls.filter(([input]) => String(input) === "/_mambo/wake/release")).toHaveLength(1);
  });

  it("does not create browser audio when an unmounted continuous session receives a stale TTS response", async () => {
    vi.useFakeTimers();
    useLocalWakeWindow();
    const { audioInstances, getUserMedia } = installVoiceBrowserFakes();
    const pendingReplyTts = deferred<Response>();
    let wakeSequence = 0;
    let ttsRequests = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/wake") return Promise.resolve(jsonResponse({ sequence: wakeSequence, online: true, capture: "idle" }));
      if (path === "/_mambo/wake/claim") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/release") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/wake/renew") return Promise.resolve(jsonResponse({ ok: true }));
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handVisionSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handVisionSnapshot()));
      if (path === "/api/device") return Promise.resolve(jsonResponse({ online: true, name: "OrangePi" }));
      if (path === "/api/voice/tts") {
        ttsRequests += 1;
        return ttsRequests === 1 ? Promise.resolve(new Response(new Blob(["voice"]), { status: 200 })) : pendingReplyTts.promise;
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender, unmount } = renderRobotWorkspace();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    wakeSequence = 1;
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKE_WORD_POLL_MS); });
    await act(async () => {
      audioInstances[0].onended?.();
      await Promise.resolve();
    });
    expect(getUserMedia).toHaveBeenCalledOnce();

    sharedConversationState.messages = [{
      messageId: "pending-reply-unmount-1",
      conversationId: "conversation-1",
      sequence: 1,
      clientMessageId: "pending-reply-unmount-1",
      role: "assistant",
      origin: "starbao",
      content: "稍等一下",
      replyToMessageId: null,
      announceOnOrangePi: true,
      createdAt: "2026-07-19T09:00:01Z",
    }];
    rerender(<RobotWorkspaceHarness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(ttsRequests).toBe(2);

    unmount();
    await act(async () => {
      pendingReplyTts.resolve(new Response(new Blob(["voice"]), { status: 200 }));
      await Promise.resolve();
    });

    expect(audioInstances).toHaveLength(1);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it("limits visual audio meter updates to twice per second", () => {
    expect(shouldPaintVoiceLevel(1_000, 1_499)).toBe(false);
    expect(shouldPaintVoiceLevel(1_000, 1_500)).toBe(true);
  });

  it("does not combine a DOM gesture click with a physical XTest click", () => {
    expect(shouldSendPhysicalGestureClick(true, true)).toBe(false);
    expect(shouldSendPhysicalGestureClick(true, false)).toBe(false);
    expect(shouldSendPhysicalGestureClick(false, true)).toBe(true);
    expect(shouldSendPhysicalGestureClick(false, false)).toBe(false);
  });

  it("keeps scroll and navigation events out of the browser click path", () => {
    expect(isBrowserGestureClick({ type: "scroll", deltaY: 0.08 })).toBe(false);
    expect(isBrowserGestureClick({ type: "navigate", direction: "next" })).toBe(false);
    expect(isBrowserGestureClick({ type: "click", x: 0.5, y: 0.5 })).toBe(true);
  });

  it("routes a spoken photo command to capture without starting hand tracking", async () => {
    const startGesture = vi.fn(async () => true);
    const stopGesture = vi.fn(async () => undefined);
    const captureSnapshot = vi.fn(async () => undefined);

    await expect(runGestureVoiceCommand(
      { type: "device", action: "capture_snapshot" },
      { captureSnapshot, localHandVisionMode: false, startGesture, stopGesture },
    )).resolves.toBe("已发送拍照指令。");

    expect(captureSnapshot).toHaveBeenCalledTimes(1);
    expect(startGesture).not.toHaveBeenCalled();
    expect(stopGesture).not.toHaveBeenCalled();
  });

  it("drops a hand-vision response that belongs to an older start or stop cycle", () => {
    expect(shouldApplyHandVisionSnapshot(4, 4)).toBe(true);
    expect(shouldApplyHandVisionSnapshot(4, 5)).toBe(false);
  });

  it("cancels a deferred DOM click when reset or stop invalidates the gesture lifecycle", () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const timerRef = { current: null as number | null };
    const lifecycleRef = { current: 3 };

    scheduleGestureDomClick(timerRef, lifecycleRef, click);
    expect(timerRef.current).not.toBeNull();
    invalidateGestureDomClick(timerRef, lifecycleRef);
    expect(timerRef.current).toBeNull();
    vi.advanceTimersByTime(160);
    expect(click).not.toHaveBeenCalled();

    scheduleGestureDomClick(timerRef, lifecycleRef, click);
    invalidateGestureDomClick(timerRef, lifecycleRef);
    vi.advanceTimersByTime(160);
    expect(click).not.toHaveBeenCalled();

    scheduleGestureDomClick(timerRef, lifecycleRef, click);
    lifecycleRef.current += 1;
    vi.advanceTimersByTime(160);
    expect(click).not.toHaveBeenCalled();
  });

  it("invalidates an unfinished browser hand initialization on unmount", () => {
    const startLifecycle = 8;
    const unmountedLifecycle = invalidateHandVisionLifecycle(startLifecycle);

    expect(shouldApplyHandVisionSnapshot(startLifecycle, unmountedLifecycle)).toBe(false);
  });

  it("shows a clear overlay while the local camera is loading, unavailable, or too dark", () => {
    const shouldShowHandVisionOverlay = (
      robotWorkspaceModule as typeof robotWorkspaceModule & {
        shouldShowHandVisionOverlay?: (localMode: boolean, snapshot: unknown) => boolean;
      }
    ).shouldShowHandVisionOverlay ?? (() => false);
    const running = {
      status: "running",
      sequence: 1,
      gesture: "none",
      confidence: 0,
      cursor: null,
      landmarks: [],
      fps: 8,
      latencyMs: 50,
      width: 320,
      height: 240,
      error: null,
    };

    expect(shouldShowHandVisionOverlay(true, { ...running, status: "loading" })).toBe(true);
    expect(shouldShowHandVisionOverlay(true, { ...running, brightness: 8 })).toBe(true);
    expect(shouldShowHandVisionOverlay(true, { ...running, frameAgeMs: 2_600 })).toBe(true);
    expect(shouldShowHandVisionOverlay(true, { ...running, brightness: 40 })).toBe(false);
    expect(shouldShowHandVisionOverlay(false, { ...running, brightness: 8 })).toBe(false);
  });

  it("explains when the local hand service is running but cannot see a hand yet", () => {
    expect(getHandVisionStatusMessage(true, {
      status: "loading",
      sequence: 0,
      gesture: "none",
      confidence: 0,
      cursor: null,
      landmarks: [],
      fps: 0,
      latencyMs: 0,
      width: 0,
      height: 0,
      error: null,
    })).toBe("正在启动板端手势模型");

    expect(getHandVisionStatusMessage(true, {
      status: "error",
      sequence: 0,
      gesture: "none",
      confidence: 0,
      cursor: null,
      landmarks: [],
      fps: 0,
      latencyMs: 0,
      width: 0,
      height: 0,
      error: { code: "camera_releasing", message: "Hand camera is still shutting down" },
    })).toBe("摄像头正在释放，请稍后重试");

    expect(getHandVisionStatusMessage(true, {
      status: "running",
      sequence: 3,
      gesture: "none",
      confidence: 0,
      cursor: null,
      landmarks: [],
      fps: 8,
      latencyMs: 50,
      width: 320,
      height: 240,
      error: null,
    })).toBe("未识别到手，请将手掌放进明亮画面");

    expect(getHandVisionStatusMessage(true, {
      status: "running",
      sequence: 3,
      gesture: "none",
      confidence: 0,
      cursor: null,
      landmarks: [],
      fps: 8,
      latencyMs: 50,
      width: 320,
      height: 240,
      brightness: 8,
      error: null,
    })).toBe("摄像头画面过暗，请打开灯或检查镜头");

    expect(getHandVisionStatusMessage(true, {
      status: "running",
      sequence: 3,
      gesture: "none",
      confidence: 0,
      cursor: null,
      landmarks: [],
      fps: 8,
      latencyMs: 50,
      width: 320,
      height: 240,
      frameAgeMs: 2_600,
      error: null,
    })).toBe("摄像头画面未更新，请重新开启手势控制");

    expect(getHandVisionStatusMessage(true, {
      status: "running",
      sequence: 4,
      gesture: "open_palm",
      confidence: 0.9,
      cursor: { x: 0.5, y: 0.5 },
      landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 })),
      fps: 8,
      latencyMs: 50,
      width: 320,
      height: 240,
      error: null,
    })).toBe("已识别张开的手掌，正在移动光标");
  });

  it("omits the assistant-only opening messages from chat history", () => {
    const history = buildChatHistory(
      [
        { id: "welcome", author: "assistant", text: "welcome" },
        { id: "guide", author: "assistant", text: "guide" },
        { id: "question-1", author: "learner", text: "one" },
        { id: "answer-1", author: "assistant", text: "two" },
      ],
      { id: "question-2", author: "learner", text: "three" },
    );

    expect(history).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
      { role: "user", content: "three" },
    ]);
  });

  it("renders the robot classroom controls in the first viewport", () => {
    renderRobotWorkspace();

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/preview");
    expect(screen.getByRole("heading", { name: "Mambo 机器人课堂" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始说话" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "手势视觉" })).toBeInTheDocument();
    expect(screen.getByText("张手移动 · 握拳确认")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "输入问题" })).toBeInTheDocument();
  });

  it("keeps shared dialogue central while the Starbao control dock switches focused tools", () => {
    renderRobotWorkspace();

    expect(screen.getByRole("heading", { name: "共享对话" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "星宝控制" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "语音对话" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "开始说话" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开启手势" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "手势视觉" }));

    expect(screen.getByRole("tab", { name: "手势视觉" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "开启手势" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开始说话" })).not.toBeInTheDocument();
  });

  it("keeps face enrollment reachable in its own control tab", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    renderRobotWorkspace();

    fireEvent.click(screen.getByRole("tab", { name: "人脸身份" }));

    expect(screen.getByRole("tab", { name: "人脸身份" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "人脸身份" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开启手势" })).not.toBeInTheDocument();
  });

  it("only exposes the face controls on the local device proxy and otherwise keeps the browser camera untouched", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(faceSnapshot()));
    vi.stubGlobal("fetch", fetch);

    const { rerender } = render(<FaceIdentityPanel localMode={false} />);
    expect(screen.getByText("人脸识别仅在开发板本地页面可用，当前浏览器不会打开摄像头。"))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开启人脸识别" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    rerender(<FaceIdentityPanel localMode />);

    expect(await screen.findByRole("button", { name: "开启人脸识别" })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/_mambo/face/status", { cache: "no-store" }));
  });

  it("starts face recognition through the board-local proxy", async () => {
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") return Promise.resolve(jsonResponse(faceSnapshot()));
      if (path === "/_mambo/face/identities") return Promise.resolve(jsonResponse({ count: 0, identities: [] }));
      if (path === "/_mambo/face/start") {
        return Promise.resolve(jsonResponse(faceSnapshot({ status: "running", state: "no_face", message: "等待人脸" })));
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<FaceIdentityPanel localMode />);
    fireEvent.click(await screen.findByRole("button", { name: "开启人脸识别" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/_mambo/face/start", expect.objectContaining({
      method: "POST",
      body: "{}",
    })));
  });

  it("sends the Chinese nickname for an explicit local face enrollment", async () => {
    const running = faceSnapshot({ status: "running", state: "no_face", message: "等待人脸" });
    const collecting = faceSnapshot({
      status: "running",
      state: "collecting",
      message: "正在采集",
      enrollment: { label: "小明", collected: 1, required: 5 },
    });
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") return Promise.resolve(jsonResponse(running));
      if (path === "/_mambo/face/identities") return Promise.resolve(jsonResponse({ count: 0, identities: [] }));
      if (path === "/_mambo/face/enroll") return Promise.resolve(jsonResponse(collecting));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<FaceIdentityPanel localMode />);

    const nickname = await screen.findByRole("textbox", { name: "录入昵称" });
    fireEvent.change(nickname, { target: { value: "小明" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "录入当前人脸" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "录入当前人脸" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/_mambo/face/enroll", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ label: "小明" }),
    })));
  });

  it("shows collection progress and a recognized public label in Chinese", () => {
    expect(getFaceIdentityStatusMessage(true, faceSnapshot({
      status: "running",
      state: "collecting",
      enrollment: { label: "小明", collected: 3, required: 5 },
    }))).toBe("正在录入小明：3/5");
    expect(getFaceIdentityStatusMessage(true, faceSnapshot({
      status: "running",
      state: "confirmed",
      identity: { ...faceIdentity, confirmed: true },
    }))).toBe("已识别：小明");
  });

  it("classifies face model, camera, visual input, and inference failures in Chinese", () => {
    expect(getFaceIdentityStatusMessage(true, faceSnapshot({
      status: "unavailable",
      error: { code: "face_models_missing", message: "models missing" },
    }))).toBe("人脸模型未安装，请安装模型后重试。");
    expect(getFaceIdentityStatusMessage(true, faceSnapshot({
      status: "unavailable",
      error: { code: "face_models_unavailable", message: "models unavailable" },
    }))).toBe("人脸模型未安装，请安装模型后重试。");
    expect(getFaceIdentityStatusMessage(true, faceSnapshot({
      status: "unavailable",
      error: { code: "camera_unavailable", message: "camera unavailable" },
    }))).toBe("摄像头不可用，请检查连接后重试。");
    expect(getFaceIdentityStatusMessage(true, faceSnapshot({
      status: "unavailable",
      error: { code: "vision_unavailable", message: "vision unavailable" },
    }))).toBe("视觉输入不可用，请检查摄像头画面后重试。");
    expect(getFaceIdentityStatusMessage(true, faceSnapshot({
      status: "error",
      error: { code: "face_engine_runtime_error", message: "engine runtime error" },
    }))).toBe("人脸推理出现问题，请稍后重试。");
  });

  it("does not let an old initial face status override a newer start result", async () => {
    const initialStatus = deferred<Response>();
    const running = faceSnapshot({ status: "running", state: "no_face", message: "等待人脸" });
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") return initialStatus.promise;
      if (path === "/_mambo/face/identities") return Promise.resolve(jsonResponse({ count: 0, identities: [] }));
      if (path === "/_mambo/face/start") return Promise.resolve(jsonResponse(running));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<FaceIdentityPanel localMode />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/_mambo/face/status", { cache: "no-store" }));
    fireEvent.click(screen.getByRole("button", { name: "开启人脸识别" }));
    await screen.findByText("未检测到人脸，请面向摄像头");

    await act(async () => {
      initialStatus.resolve(jsonResponse(faceSnapshot()));
      await Promise.resolve();
    });

    expect(screen.getByText("未检测到人脸，请面向摄像头")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭人脸识别" })).toBeInTheDocument();
  });

  it("never renders an embedding received from an invalid face response", async () => {
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") {
        return Promise.resolve(jsonResponse(faceSnapshot({
          status: "running",
          state: "confirmed",
          identity: { ...faceIdentity, confirmed: true, embedding: [0.13579, 0.2468] },
        })));
      }
      if (path === "/_mambo/face/identities") return Promise.resolve(jsonResponse({ count: 0, identities: [] }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { container } = render(<FaceIdentityPanel localMode />);

    await screen.findByText("板端人脸识别服务连接失败，请稍后重试。");
    expect(container.textContent).not.toContain("0.13579");
    expect(container.innerHTML).not.toContain("embedding");
  });

  it("deletes a locally enrolled public identity with an icon-only action", async () => {
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") return Promise.resolve(jsonResponse(faceSnapshot()));
      if (path === "/_mambo/face/identities") return Promise.resolve(jsonResponse({ count: 1, identities: [faceIdentity] }));
      if (path === "/_mambo/face/identities/delete") return Promise.resolve(jsonResponse({ count: 0, identities: [] }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<FaceIdentityPanel localMode />);
    const remove = await screen.findByRole("button", { name: "删除小明" });
    expect(remove).toHaveAttribute("title", "删除小明");
    expect(screen.getByText("已录入 1 人")).toBeInTheDocument();
    fireEvent.click(remove);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/_mambo/face/identities/delete", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ id: "student-1" }),
    })));
    await waitFor(() => expect(screen.queryByRole("button", { name: "删除小明" })).not.toBeInTheDocument());
    expect(screen.getByText("已录入 0 人")).toBeInTheDocument();
  });

  it("does not let a stale identity refresh overwrite a later local delete", async () => {
    const staleRefresh = deferred<Response>();
    let identityRequests = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") return Promise.resolve(jsonResponse(faceSnapshot()));
      if (path === "/_mambo/face/identities") {
        identityRequests += 1;
        return identityRequests === 1
          ? Promise.resolve(jsonResponse({ count: 1, identities: [faceIdentity] }))
          : staleRefresh.promise;
      }
      if (path === "/_mambo/face/identities/delete") return Promise.resolve(jsonResponse({ count: 0, identities: [] }));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = render(<FaceIdentityPanel localMode />);
    await screen.findByRole("button", { name: "删除小明" });
    rerender(<FaceIdentityPanel localMode={false} />);
    rerender(<FaceIdentityPanel localMode />);
    await waitFor(() => expect(identityRequests).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: "删除小明" }));
    await waitFor(() => expect(screen.getByText("已录入 0 人")).toBeInTheDocument());
    await act(async () => {
      staleRefresh.resolve(jsonResponse({ count: 1, identities: [faceIdentity] }));
      await Promise.resolve();
    });

    expect(screen.getByText("已录入 0 人")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除小明" })).not.toBeInTheDocument();
  });

  it("recovers controls after local-mode reentry while a stale start is pending", async () => {
    const pendingStart = deferred<Response>();
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") return Promise.resolve(jsonResponse(faceSnapshot()));
      if (path === "/_mambo/face/identities") return Promise.resolve(jsonResponse({ count: 0, identities: [] }));
      if (path === "/_mambo/face/start") return pendingStart.promise;
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = render(<FaceIdentityPanel localMode />);
    fireEvent.click(await screen.findByRole("button", { name: "开启人脸识别" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/_mambo/face/start", expect.anything()));
    rerender(<FaceIdentityPanel localMode={false} />);
    rerender(<FaceIdentityPanel localMode />);

    const start = await screen.findByRole("button", { name: "开启人脸识别" });
    await waitFor(() => expect(start).not.toBeDisabled());
    await act(async () => {
      pendingStart.resolve(jsonResponse(faceSnapshot({ status: "running", state: "no_face", message: "stale start" })));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "开启人脸识别" })).toBeEnabled();
    expect(screen.getByText("人脸识别已关闭")).toBeInTheDocument();
  });

  it("recovers controls after local-mode reentry while a stale enrollment is pending", async () => {
    const pendingEnrollment = deferred<Response>();
    const running = faceSnapshot({ status: "running", state: "no_face", message: "等待人脸" });
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") return Promise.resolve(jsonResponse(running));
      if (path === "/_mambo/face/identities") return Promise.resolve(jsonResponse({ count: 0, identities: [] }));
      if (path === "/_mambo/face/enroll") return pendingEnrollment.promise;
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = render(<FaceIdentityPanel localMode />);
    const nickname = await screen.findByRole("textbox", { name: "录入昵称" });
    await waitFor(() => expect(nickname).toBeEnabled());
    fireEvent.change(nickname, { target: { value: "小明" } });
    fireEvent.click(screen.getByRole("button", { name: "录入当前人脸" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/_mambo/face/enroll", expect.anything()));
    rerender(<FaceIdentityPanel localMode={false} />);
    rerender(<FaceIdentityPanel localMode />);

    const recoveredNickname = await screen.findByRole("textbox", { name: "录入昵称" });
    await waitFor(() => expect(recoveredNickname).toBeEnabled());
    await act(async () => {
      pendingEnrollment.resolve(jsonResponse(faceSnapshot({
        status: "running",
        state: "collecting",
        message: "stale enrollment",
        enrollment: { label: "小明", collected: 1, required: 5 },
      })));
      await Promise.resolve();
    });

    expect(screen.queryByRole("button", { name: "取消录入" })).not.toBeInTheDocument();
    expect(screen.getByText("未检测到人脸，请面向摄像头")).toBeInTheDocument();
  });

  it("recovers controls after local-mode reentry while a stale delete is pending", async () => {
    const pendingDelete = deferred<Response>();
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/face/status") return Promise.resolve(jsonResponse(faceSnapshot()));
      if (path === "/_mambo/face/identities") return Promise.resolve(jsonResponse({ count: 1, identities: [faceIdentity] }));
      if (path === "/_mambo/face/identities/delete") return pendingDelete.promise;
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender } = render(<FaceIdentityPanel localMode />);
    fireEvent.click(await screen.findByRole("button", { name: "删除小明" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/_mambo/face/identities/delete", expect.anything()));
    rerender(<FaceIdentityPanel localMode={false} />);
    rerender(<FaceIdentityPanel localMode />);

    const remove = await screen.findByRole("button", { name: "删除小明" });
    await waitFor(() => expect(remove).not.toBeDisabled());
    await act(async () => {
      pendingDelete.resolve(jsonResponse({ count: 0, identities: [] }));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "删除小明" })).toBeEnabled();
    expect(screen.getByText("已录入 1 人")).toBeInTheDocument();
  });

  it("sends a typed kiosk question through the canonical Starbao conversation", () => {
    renderRobotWorkspace();

    const input = screen.getByRole("textbox", { name: "输入问题" });
    fireEvent.change(input, { target: { value: "带我从第一步开始" } });
    fireEvent.submit(input.closest("form")!);

    expect(sendSharedTurn).toHaveBeenCalledWith({
      text: "带我从第一步开始",
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      origin: "orangepi",
    });
  });

  it("lets the local control dock set the shared web-to-OrangePi speech preference", () => {
    renderRobotWorkspace();

    const broadcast = screen.getByRole("checkbox", { name: "网页消息同步到香橙派播报" });
    expect(broadcast).not.toBeChecked();
    fireEvent.click(broadcast);

    expect(setSharedSpeakOnOrangePi).toHaveBeenCalledWith(true);
  });

  it("selects only unseen assistant events explicitly marked for local OrangePi playback", () => {
    const messages: StarbaoAnnouncementCandidate[] = [
      { messageId: "history", role: "assistant", announceOnOrangePi: true },
      { messageId: "remote-user", role: "user", announceOnOrangePi: true },
      { messageId: "new-reply", role: "assistant", announceOnOrangePi: true },
      { messageId: "silent-reply", role: "assistant", announceOnOrangePi: false },
    ];

    expect(selectNewStarbaoAnnouncements(messages, new Set(["history"]), true)).toEqual([messages[2]]);
    expect(selectNewStarbaoAnnouncements(messages, new Set(), false)).toEqual([]);
  });
});
