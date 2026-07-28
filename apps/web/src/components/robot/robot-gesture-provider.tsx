"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { GestureController, type GestureEvent } from "./gesture-controller";
import { GesturePointer, type GesturePointerMode } from "./gesture-pointer";
import { findGestureInteractiveTarget, normalizedPointToViewport } from "./gesture-screen-target";
import { fetchHandVisionAction, fetchHandVisionStatus, isUnexpectedHandVisionStop, snapshotToObservation, type HandVisionSnapshot } from "./hand-vision-client";
import { LatestPointerCommand } from "./latest-pointer-command";

export type GestureStatus = "off" | "loading" | "stopping" | "ready" | "error";
export type GestureNavigationDirection = "previous" | "next";

export const HAND_VISION_POLL_MS = 60;
export const GESTURE_NAVIGATE_EVENT = "mambo:gesture-navigate";
export const PHYSICAL_POINTER_INTERVAL_MS = 100;

export type RobotGestureContextValue = {
  localHandVisionMode: boolean;
  handVision: HandVisionSnapshot | null;
  gestureStatus: GestureStatus;
  gestureError: string;
  startGesture: () => Promise<boolean>;
  stopGesture: () => Promise<void>;
  resetGesture: () => void;
};

const RobotGestureContext = createContext<RobotGestureContextValue | null>(null);

export function usesLocalHandVisionService(location: Pick<Location, "hostname" | "port">): boolean {
  return location.hostname === "127.0.0.1" && location.port === "3010";
}

function shouldApplyHandVisionSnapshot(requestLifecycle: number, currentLifecycle: number): boolean {
  return requestLifecycle === currentLifecycle;
}

function issueDeviceCommand(name: string, args: Record<string, unknown>): Promise<boolean> {
  return fetch("/api/device/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, arguments: args }),
  }).then((response) => response.ok).catch(() => false);
}

export function findGestureScrollTarget(documentRef: Document): HTMLElement | null {
  const candidates = [
    ...documentRef.querySelectorAll<HTMLElement>("[data-gesture-scroll-container='true']"),
    ...documentRef.querySelectorAll<HTMLElement>("main"),
  ];
  for (const candidate of candidates) {
    const overflowY = window.getComputedStyle(candidate).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && candidate.scrollHeight > candidate.clientHeight) {
      return candidate;
    }
  }
  return null;
}

export function scrollGesturePage(deltaY: number): void {
  const options = { top: deltaY * window.innerHeight * 2.4, behavior: "auto" as const };
  const scrollTarget = findGestureScrollTarget(document);
  if (scrollTarget) {
    scrollTarget.scrollBy(options);
    return;
  }
  window.scrollBy(options);
}

function getInitialLocalHandVisionMode(): boolean {
  return typeof window !== "undefined" && usesLocalHandVisionService(window.location);
}

export function RobotGestureProvider({ children }: { children: ReactNode }) {
  const [localHandVisionMode] = useState(getInitialLocalHandVisionMode);
  const [handVision, setHandVision] = useState<HandVisionSnapshot | null>(null);
  const [gestureStatus, setGestureStatus] = useState<GestureStatus>("off");
  const [gestureError, setGestureError] = useState("");
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [gestureProgress, setGestureProgress] = useState(0);
  const [pointerMode, setPointerMode] = useState<GesturePointerMode>("pointer");
  const [pollingCycle, setPollingCycle] = useState(0);
  const localHandVisionModeRef = useRef(localHandVisionMode);
  const gestureStatusRef = useRef<GestureStatus>("off");
  const handVisionSequenceRef = useRef(-1);
  const handVisionLifecycleRef = useRef(0);
  const gestureControllerRef = useRef(new GestureController());
  const gestureClickTimerRef = useRef<number | null>(null);
  const gestureClickLifecycleRef = useRef(0);
  const pointerCommandRef = useRef<LatestPointerCommand | null>(null);
  const autoStartTimerRef = useRef<number | null>(null);
  const physicalPointerTimerRef = useRef<number | null>(null);
  const physicalPointerPendingRef = useRef<{ x: number; y: number } | null>(null);
  const physicalPointerLastSentAtRef = useRef(Number.NEGATIVE_INFINITY);

  const updateGestureStatus = useCallback((status: GestureStatus) => {
    gestureStatusRef.current = status;
    setGestureStatus(status);
  }, []);

  const cancelScheduledPhysicalPointerMove = useCallback(() => {
    if (physicalPointerTimerRef.current !== null) {
      window.clearTimeout(physicalPointerTimerRef.current);
      physicalPointerTimerRef.current = null;
    }
    physicalPointerPendingRef.current = null;
    physicalPointerLastSentAtRef.current = Number.NEGATIVE_INFINITY;
  }, []);

  const invalidateGestureInteraction = useCallback(() => {
    gestureClickLifecycleRef.current += 1;
    if (gestureClickTimerRef.current !== null) {
      window.clearTimeout(gestureClickTimerRef.current);
      gestureClickTimerRef.current = null;
    }
    cancelScheduledPhysicalPointerMove();
    pointerCommandRef.current?.cancelBarrier();
  }, [cancelScheduledPhysicalPointerMove]);

  const resetGesture = useCallback(() => {
    invalidateGestureInteraction();
    gestureControllerRef.current.reset();
    setCursor(null);
    setGestureProgress(0);
    setPointerMode("pointer");
  }, [invalidateGestureInteraction]);

  const getPointerCommand = useCallback(() => {
    if (!pointerCommandRef.current) {
      pointerCommandRef.current = new LatestPointerCommand((point) => (
        issueDeviceCommand("move_mouse", point)
      ));
    }
    return pointerCommandRef.current;
  }, []);

  const submitPhysicalPointerMove = useCallback((point: { x: number; y: number }) => {
    if (!localHandVisionModeRef.current) return;

    const now = performance.now();
    const elapsed = now - physicalPointerLastSentAtRef.current;
    if (elapsed >= PHYSICAL_POINTER_INTERVAL_MS) {
      physicalPointerLastSentAtRef.current = now;
      getPointerCommand().submit(point);
      return;
    }

    physicalPointerPendingRef.current = point;
    if (physicalPointerTimerRef.current !== null) return;
    physicalPointerTimerRef.current = window.setTimeout(() => {
      physicalPointerTimerRef.current = null;
      const pending = physicalPointerPendingRef.current;
      physicalPointerPendingRef.current = null;
      if (!pending || !localHandVisionModeRef.current) return;
      physicalPointerLastSentAtRef.current = performance.now();
      getPointerCommand().submit(pending);
    }, PHYSICAL_POINTER_INTERVAL_MS - elapsed);
  }, [getPointerCommand]);

  const handleGestureEvent = useCallback((event: GestureEvent) => {
    if (event.type === "cursor_move") {
      setCursor({ x: event.x, y: event.y });
      setPointerMode("pointer");
      submitPhysicalPointerMove({ x: event.x, y: event.y });
      return;
    }
    if (event.type === "progress") {
      setGestureProgress(event.value);
      return;
    }
    if (event.type === "tracking_lost") {
      setCursor(null);
      setGestureProgress(0);
      setPointerMode("pointer");
      return;
    }
    if (event.type === "scroll") {
      setPointerMode(event.deltaY < 0 ? "scroll_up" : "scroll_down");
      scrollGesturePage(event.deltaY);
      return;
    }
    if (event.type === "navigate") {
      window.dispatchEvent(new CustomEvent(GESTURE_NAVIGATE_EVENT, { detail: { direction: event.direction } }));
      return;
    }

    const point = normalizedPointToViewport(
      { x: event.x, y: event.y },
      { width: window.innerWidth, height: window.innerHeight },
    );
    const interactive = findGestureInteractiveTarget(document.elementFromPoint(point.x, point.y));
    if (interactive) {
      if (gestureClickTimerRef.current !== null) window.clearTimeout(gestureClickTimerRef.current);
      const lifecycle = gestureClickLifecycleRef.current;
      gestureClickTimerRef.current = window.setTimeout(() => {
        gestureClickTimerRef.current = null;
        if (lifecycle === gestureClickLifecycleRef.current) interactive.click();
      }, 160);
      return;
    }

    if (!localHandVisionModeRef.current) return;
    cancelScheduledPhysicalPointerMove();
    void getPointerCommand().moveThenRun({ x: event.x, y: event.y }, async () => {
      const clicked = await issueDeviceCommand("click_mouse", {});
      if (!clicked) throw new Error("physical_click_failed");
    });
  }, [cancelScheduledPhysicalPointerMove, getPointerCommand, submitPhysicalPointerMove]);

  const applyLocalHandVisionSnapshot = useCallback((snapshot: HandVisionSnapshot, requestLifecycle: number) => {
    if (!shouldApplyHandVisionSnapshot(requestLifecycle, handVisionLifecycleRef.current)) return;

    setHandVision(snapshot);
    if (snapshot.gesture === "v_sign" && snapshot.cursor) {
      setCursor(snapshot.cursor);
      setPointerMode("scroll");
    } else if (snapshot.gesture !== "v_sign") {
      setPointerMode("pointer");
    }

    if (snapshot.status === "loading") {
      updateGestureStatus("loading");
      return;
    }
    if (snapshot.status === "error") {
      resetGesture();
      setGestureError("板端手势视觉服务暂时不可用，可以继续使用鼠标和键盘。");
      updateGestureStatus("error");
      return;
    }
    if (isUnexpectedHandVisionStop(snapshot.status, gestureStatusRef.current)) {
      resetGesture();
      setGestureError("板端手势视觉服务已停止，请重新开启手势控制。");
      updateGestureStatus("error");
      return;
    }
    if (snapshot.status !== "running") return;

    setGestureError("");
    updateGestureStatus("ready");
    if (snapshot.sequence <= handVisionSequenceRef.current) return;
    handVisionSequenceRef.current = snapshot.sequence;
    const events = gestureControllerRef.current.update(snapshotToObservation(snapshot, performance.now()));
    events.forEach(handleGestureEvent);
  }, [handleGestureEvent, resetGesture, updateGestureStatus]);

  const startGesture = useCallback(async (): Promise<boolean> => {
    if (!localHandVisionModeRef.current) return false;
    if (gestureStatusRef.current === "ready") return true;
    if (gestureStatusRef.current === "loading" || gestureStatusRef.current === "stopping") return false;

    const lifecycle = handVisionLifecycleRef.current + 1;
    handVisionLifecycleRef.current = lifecycle;
    handVisionSequenceRef.current = -1;
    setGestureError("");
    updateGestureStatus("loading");
    try {
      const snapshot = await fetchHandVisionAction("start");
      if (!shouldApplyHandVisionSnapshot(lifecycle, handVisionLifecycleRef.current)) return false;
      applyLocalHandVisionSnapshot(snapshot, lifecycle);
      if (snapshot.status === "error") return false;
      setPollingCycle(lifecycle);
      return true;
    } catch {
      if (!shouldApplyHandVisionSnapshot(lifecycle, handVisionLifecycleRef.current)) return false;
      resetGesture();
      setGestureError("板端手势视觉服务暂时不可用，可以继续使用鼠标和键盘。");
      updateGestureStatus("error");
      return false;
    }
  }, [applyLocalHandVisionSnapshot, resetGesture, updateGestureStatus]);

  const stopGesture = useCallback(async (): Promise<void> => {
    invalidateGestureInteraction();
    if (!localHandVisionModeRef.current) {
      resetGesture();
      updateGestureStatus("off");
      return;
    }
    if (gestureStatusRef.current === "off" || gestureStatusRef.current === "stopping") return;

    const lifecycle = handVisionLifecycleRef.current + 1;
    handVisionLifecycleRef.current = lifecycle;
    setPollingCycle(0);
    handVisionSequenceRef.current = -1;
    resetGesture();
    setHandVision(null);
    setGestureError("");
    updateGestureStatus("stopping");
    try {
      const snapshot = await fetchHandVisionAction("stop");
      if (!shouldApplyHandVisionSnapshot(lifecycle, handVisionLifecycleRef.current)) return;
      setHandVision(snapshot);
      updateGestureStatus("off");
    } catch {
      if (!shouldApplyHandVisionSnapshot(lifecycle, handVisionLifecycleRef.current)) return;
      setGestureError("板端手势视觉服务未能停止，请稍后重试。");
      updateGestureStatus("error");
    }
  }, [invalidateGestureInteraction, resetGesture, updateGestureStatus]);

  useEffect(() => {
    if (localHandVisionMode) {
      autoStartTimerRef.current = window.setTimeout(() => {
        autoStartTimerRef.current = null;
        if (localHandVisionModeRef.current) void startGesture();
      }, 0);
    }

    return () => {
      if (autoStartTimerRef.current !== null) {
        window.clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      handVisionLifecycleRef.current += 1;
      invalidateGestureInteraction();
      pointerCommandRef.current?.dispose();
      pointerCommandRef.current = null;
    };
  }, [invalidateGestureInteraction, localHandVisionMode, startGesture]);

  useEffect(() => {
    if (!localHandVisionMode || pollingCycle === 0) return;
    let active = true;
    let inFlight = false;
    let timer: number | undefined;

    const pollHandVision = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      const requestLifecycle = handVisionLifecycleRef.current;
      try {
        const snapshot = await fetchHandVisionStatus();
        if (active) applyLocalHandVisionSnapshot(snapshot, requestLifecycle);
      } catch {
        if (
          active
          && shouldApplyHandVisionSnapshot(requestLifecycle, handVisionLifecycleRef.current)
          && (gestureStatusRef.current === "loading" || gestureStatusRef.current === "ready")
        ) {
          resetGesture();
          setGestureError("板端手势视觉服务连接中断，可以继续使用鼠标和键盘。");
          updateGestureStatus("error");
        }
      } finally {
        inFlight = false;
        if (active) timer = window.setTimeout(() => void pollHandVision(), HAND_VISION_POLL_MS);
      }
    };

    void pollHandVision();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [applyLocalHandVisionSnapshot, localHandVisionMode, pollingCycle, resetGesture, updateGestureStatus]);

  const contextValue = useMemo<RobotGestureContextValue>(() => ({
    localHandVisionMode,
    handVision,
    gestureStatus,
    gestureError,
    startGesture,
    stopGesture,
    resetGesture,
  }), [gestureError, gestureStatus, handVision, localHandVisionMode, resetGesture, startGesture, stopGesture]);

  return (
    <RobotGestureContext.Provider value={contextValue}>
      {children}
      <GesturePointer cursor={cursor} progress={gestureProgress} mode={pointerMode} />
    </RobotGestureContext.Provider>
  );
}

export function useRobotGesture(): RobotGestureContextValue {
  const context = useContext(RobotGestureContext);
  if (!context) throw new Error("useRobotGesture must be used within RobotGestureProvider");
  return context;
}
