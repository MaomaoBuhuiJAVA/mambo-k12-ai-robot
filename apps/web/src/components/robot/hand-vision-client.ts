import type { GestureName, GestureObservation } from "./gesture-controller";
import type { Landmark } from "./hand-tracker";

export type HandVisionStatus = "idle" | "loading" | "running" | "error";

export type HandVisionSnapshot = {
  status: HandVisionStatus;
  sequence: number;
  gesture: GestureName;
  confidence: number;
  cursor: { x: number; y: number } | null;
  landmarks: Landmark[];
  fps: number;
  latencyMs: number;
  width: number;
  height: number;
  brightness?: number;
  frameAgeMs?: number;
  error: { code: string; message: string } | null;
};

const STATUSES = new Set<HandVisionStatus>(["idle", "loading", "running", "error"]);
const GESTURES = new Set<GestureName>(["open_palm", "fist", "v_sign", "pinky_up", "thumb_up", "none"]);
const HAND_VISION_ACTION_TIMEOUT_MS = 8_000;
export const HAND_VISION_STATUS_TIMEOUT_MS = 2_000;
export const HAND_VISION_DARKNESS_THRESHOLD = 18;
export const HAND_VISION_STALE_FRAME_MS = 2_500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedNumber(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

function parseLandmarks(value: unknown): Landmark[] | null {
  if (!Array.isArray(value) || (value.length !== 0 && value.length !== 21)) return null;
  const landmarks: Landmark[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const x = boundedNumber(item.x, 0, 1);
    const y = boundedNumber(item.y, 0, 1);
    if (x === null || y === null) return null;
    landmarks.push({ x, y });
  }
  return landmarks;
}

function parseCursor(value: unknown): { x: number; y: number } | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const x = boundedNumber(value.x, 0, 1);
  const y = boundedNumber(value.y, 0, 1);
  return x === null || y === null ? undefined : { x, y };
}

function parseError(value: unknown): { code: string; message: string } | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.code !== "string" || typeof value.message !== "string") return undefined;
  return { code: value.code, message: value.message };
}

function parseBrightness(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  return boundedNumber(value, 0, 255);
}

function parseFrameAge(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return undefined;
  return boundedNumber(value, 0, 1_000_000);
}

export function parseHandVisionSnapshot(value: unknown): HandVisionSnapshot | null {
  if (!isRecord(value) || typeof value.status !== "string" || !STATUSES.has(value.status as HandVisionStatus)) return null;
  if (!Number.isInteger(value.sequence) || (value.sequence as number) < 0) return null;
  if (typeof value.gesture !== "string" || !GESTURES.has(value.gesture as GestureName)) return null;

  const confidence = boundedNumber(value.confidence, 0, 1);
  const cursor = parseCursor(value.cursor);
  const landmarks = parseLandmarks(value.landmarks);
  const fps = boundedNumber(value.fps, 0, 30);
  const latencyMs = boundedNumber(value.latency_ms, 0, 10_000);
  const width = boundedNumber(value.width, 0, 4_096);
  const height = boundedNumber(value.height, 0, 4_096);
  const brightness = parseBrightness(value.brightness);
  const frameAgeMs = parseFrameAge(value.frame_age_ms);
  const error = parseError(value.error);
  if (confidence === null || cursor === undefined || landmarks === null || fps === null || latencyMs === null || width === null || height === null || brightness === null || frameAgeMs === null || error === undefined) return null;

  const gesture = value.gesture as GestureName;
  if (gesture !== "none" && (cursor === null || landmarks.length !== 21)) return null;
  if (gesture === "none" && cursor !== null) return null;

  return {
    status: value.status as HandVisionStatus,
    sequence: value.sequence as number,
    gesture,
    confidence,
    cursor,
    landmarks,
    fps,
    latencyMs,
    width,
    height,
    brightness,
    frameAgeMs,
    error,
  };
}

export function snapshotToObservation(snapshot: HandVisionSnapshot, timestamp: number): GestureObservation {
  return {
    gesture: snapshot.gesture,
    confidence: snapshot.confidence,
    x: snapshot.cursor?.x ?? 0.5,
    y: snapshot.cursor?.y ?? 0.5,
    timestamp,
  };
}

export function isUnexpectedHandVisionStop(
  visionStatus: HandVisionStatus,
  gestureStatus: "off" | "loading" | "stopping" | "ready" | "error",
): boolean {
  return visionStatus === "idle" && (gestureStatus === "loading" || gestureStatus === "ready");
}

export function shouldUpdateHandVisionUi(
  previous: HandVisionSnapshot | null,
  next: HandVisionSnapshot,
): boolean {
  return previous === null
    || previous.status !== next.status
    || previous.gesture !== next.gesture
    || previous.landmarks.length !== next.landmarks.length
    || isHandVisionPreviewTooDark(previous) !== isHandVisionPreviewTooDark(next)
    || isHandVisionFrameStale(previous) !== isHandVisionFrameStale(next)
    || previous.error?.code !== next.error?.code
    || previous.error?.message !== next.error?.message;
}

export function isHandVisionPreviewTooDark(snapshot: HandVisionSnapshot | null): boolean {
  return snapshot?.brightness !== undefined && snapshot.brightness < HAND_VISION_DARKNESS_THRESHOLD;
}

export function isHandVisionFrameStale(snapshot: HandVisionSnapshot | null): boolean {
  return snapshot?.frameAgeMs !== undefined && snapshot.frameAgeMs > HAND_VISION_STALE_FRAME_MS;
}

export async function fetchHandVisionStatus(): Promise<HandVisionSnapshot> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HAND_VISION_STATUS_TIMEOUT_MS);
  try {
    const response = await fetch("/_mambo/hand/status", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("hand_vision_unavailable");
    const snapshot = parseHandVisionSnapshot(await response.json());
    if (!snapshot) throw new Error("hand_vision_unavailable");
    return snapshot;
  } catch {
    throw new Error("hand_vision_unavailable");
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchHandVisionAction(action: "start" | "stop"): Promise<HandVisionSnapshot> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HAND_VISION_ACTION_TIMEOUT_MS);
  try {
    const response = await fetch(`/_mambo/hand/${action}`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("hand_vision_unavailable");
    const snapshot = parseHandVisionSnapshot(await response.json());
    if (!snapshot) throw new Error("hand_vision_invalid_response");
    return snapshot;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("hand_vision_timeout");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
