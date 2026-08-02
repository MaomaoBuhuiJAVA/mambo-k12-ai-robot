import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchHandVisionAction, fetchHandVisionStatus, HAND_VISION_STATUS_TIMEOUT_MS, isUnexpectedHandVisionStop, parseHandVisionSnapshot, shouldUpdateHandVisionUi, snapshotToObservation } from "./hand-vision-client";

const landmarks = Array.from({ length: 21 }, (_, index) => ({ x: index / 40, y: index / 42 }));

describe("parseHandVisionSnapshot", () => {
  it("accepts the complete local hand-vision payload", () => {
    const snapshot = parseHandVisionSnapshot({
      status: "running",
      sequence: 12,
      gesture: "open_palm",
      confidence: 0.89,
      cursor: { x: 0.72, y: 0.36 },
      landmarks,
      fps: 7.8,
      latency_ms: 31.4,
      width: 320,
      height: 240,
      brightness: 11.5,
      frame_age_ms: 12.4,
      error: null,
    });

    expect(snapshot).toMatchObject({
      status: "running",
      sequence: 12,
      gesture: "open_palm",
      cursor: { x: 0.72, y: 0.36 },
      landmarks,
      width: 320,
      height: 240,
      brightness: 11.5,
      frameAgeMs: 12.4,
    });
  });

  it("rejects malformed coordinates instead of sending them to the gesture controller", () => {
    expect(parseHandVisionSnapshot({
      status: "running",
      sequence: 2,
      gesture: "fist",
      confidence: 0.8,
      cursor: { x: 2, y: 0.4 },
      landmarks,
      fps: 8,
      latency_ms: 20,
      width: 320,
      height: 240,
      brightness: 11.5,
      error: null,
    })).toBeNull();
  });

  it("rejects an unknown gesture instead of treating it as a recognized hand pose", () => {
    expect(parseHandVisionSnapshot({
      status: "running",
      sequence: 2,
      gesture: "wave",
      confidence: 0.8,
      cursor: { x: 0.4, y: 0.6 },
      landmarks,
      fps: 8,
      latency_ms: 20,
      width: 320,
      height: 240,
      error: null,
    })).toBeNull();
  });

  it("accepts each navigation gesture only when it includes a valid cursor and all landmarks", () => {
    for (const gesture of ["v_sign", "pinky_up", "thumb_up"] as const) {
      expect(parseHandVisionSnapshot({
        status: "running",
        sequence: 3,
        gesture,
        confidence: 0.8,
        cursor: { x: 0.4, y: 0.6 },
        landmarks,
        fps: 8,
        latency_ms: 20,
        width: 320,
        height: 240,
        error: null,
      })?.gesture).toBe(gesture);

      expect(parseHandVisionSnapshot({
        status: "running",
        sequence: 3,
        gesture,
        confidence: 0.8,
        cursor: null,
        landmarks: [],
        fps: 8,
        latency_ms: 20,
        width: 320,
        height: 240,
        error: null,
      })).toBeNull();
    }
  });
});

describe("snapshotToObservation", () => {
  it("uses the page clock for the dwell-to-click controller", () => {
    const snapshot = parseHandVisionSnapshot({
      status: "running",
      sequence: 12,
      gesture: "fist",
      confidence: 0.89,
      cursor: { x: 0.72, y: 0.36 },
      landmarks,
      fps: 7.8,
      latency_ms: 31.4,
      width: 320,
      height: 240,
      brightness: 11.5,
      error: null,
    });
    if (!snapshot) throw new Error("expected a valid snapshot");

    expect(snapshotToObservation(snapshot, 2_400)).toEqual({
      gesture: "fist",
      confidence: 0.89,
      x: 0.72,
      y: 0.36,
      timestamp: 2_400,
    });
  });
});

describe("fetchHandVisionAction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("starts the isolated board service through the local proxy route", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "loading",
      sequence: 0,
      gesture: "none",
      confidence: 0,
      cursor: null,
      landmarks: [],
      fps: 0,
      latency_ms: 0,
      width: 0,
      height: 0,
      error: null,
    })));
    vi.stubGlobal("fetch", fetch);

    await expect(fetchHandVisionAction("start")).resolves.toMatchObject({ status: "loading" });
    expect(fetch).toHaveBeenCalledWith("/_mambo/hand/start", expect.objectContaining({
      method: "POST",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    }));
  });

  it("cancels a stalled board action before the gesture control can remain loading", async () => {
    vi.useFakeTimers();
    let abortSignal: AbortSignal | undefined;
    const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      abortSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        abortSignal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetch);

    const action = fetchHandVisionAction("start");
    const rejection = action.then(
      () => null,
      (error: unknown) => error,
    );

    expect(abortSignal).toBeDefined();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(abortSignal?.aborted).toBe(true);
    await expect(rejection).resolves.toMatchObject({ message: "hand_vision_timeout" });
  });
});

describe("fetchHandVisionStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("abandons a board status request that never responds", async () => {
    vi.useFakeTimers();
    let abortSignal: AbortSignal | undefined;
    const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      abortSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        abortSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetch);

    const pending = fetchHandVisionStatus();
    const rejection = pending.then(
      () => null,
      (error: unknown) => error,
    );

    expect(fetch).toHaveBeenCalledWith("/_mambo/hand/status", expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
    }));
    await vi.advanceTimersByTimeAsync(HAND_VISION_STATUS_TIMEOUT_MS);
    expect(abortSignal?.aborted).toBe(true);
    await expect(rejection).resolves.toMatchObject({ message: "hand_vision_unavailable" });
  });
});

describe("isUnexpectedHandVisionStop", () => {
  it("returns the UI to an error state when a running hand service disappears", () => {
    expect(isUnexpectedHandVisionStop("idle", "ready")).toBe(true);
    expect(isUnexpectedHandVisionStop("idle", "loading")).toBe(true);
    expect(isUnexpectedHandVisionStop("idle", "off")).toBe(false);
    expect(isUnexpectedHandVisionStop("running", "ready")).toBe(false);
  });
});

describe("shouldUpdateHandVisionUi", () => {
  it("does not redraw the whole page for a new native frame with the same visible hand state", () => {
    const previous = {
      status: "running" as const,
      sequence: 10,
      gesture: "none" as const,
      confidence: 0,
      cursor: null,
      landmarks: [],
      fps: 8,
      latencyMs: 50,
      width: 320,
      height: 240,
      error: null,
    };

    expect(shouldUpdateHandVisionUi(previous, { ...previous, sequence: 11, fps: 7.8, latencyMs: 52 })).toBe(false);
    expect(shouldUpdateHandVisionUi({ ...previous, brightness: 30 }, {
      ...previous,
      sequence: 11,
      brightness: 8,
    })).toBe(true);
    expect(shouldUpdateHandVisionUi({ ...previous, frameAgeMs: 10 }, {
      ...previous,
      sequence: 11,
      frameAgeMs: 2_600,
    })).toBe(true);
    expect(shouldUpdateHandVisionUi(previous, {
      ...previous,
      sequence: 11,
      gesture: "open_palm",
      confidence: 0.9,
      cursor: { x: 0.5, y: 0.5 },
      landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 })),
    })).toBe(true);
  });
});
