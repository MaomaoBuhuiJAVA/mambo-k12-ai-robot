// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://127.0.0.1:3010/"}

import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GESTURE_NAVIGATE_EVENT,
  findGestureScrollTarget,
  HAND_VISION_POLL_MS,
  RobotGestureProvider,
  useRobotGesture,
  usesLocalHandVisionService,
} from "./robot-gesture-provider";

const landmarks = Array.from({ length: 21 }, (_, index) => ({ x: index / 40, y: index / 42 }));

function handSnapshot(overrides: Record<string, unknown> = {}) {
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

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
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

function GestureState() {
  const { gestureStatus, handVision, localHandVisionMode } = useRobotGesture();
  return <output data-testid="gesture-state">{`${localHandVisionMode}:${gestureStatus}:${handVision?.sequence ?? "none"}`}</output>;
}

function GestureActions() {
  const { startGesture, stopGesture } = useRobotGesture();
  return (
    <>
      <button type="button" onClick={() => void startGesture()}>start gesture</button>
      <button type="button" onClick={() => void stopGesture()}>stop gesture</button>
    </>
  );
}

describe("RobotGestureProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("uses the board hand proxy only for the exact robot loopback address", () => {
    expect(usesLocalHandVisionService({ hostname: "127.0.0.1", port: "3010" })).toBe(true);
    expect(usesLocalHandVisionService({ hostname: "localhost", port: "3010" })).toBe(false);
    expect(usesLocalHandVisionService({ hostname: "127.0.0.1", port: "3011" })).toBe(false);
    expect(usesLocalHandVisionService({ hostname: "192.168.1.18", port: "3010" })).toBe(false);
  });

  it("prefers an explicit scroll container over the page main element", () => {
    const main = document.createElement("main");
    main.style.overflowY = "auto";
    Object.defineProperties(main, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 800 },
    });
    const explicit = document.createElement("section");
    explicit.dataset.gestureScrollContainer = "true";
    explicit.style.overflowY = "auto";
    Object.defineProperties(explicit, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 900 },
    });
    document.body.append(main, explicit);

    expect(findGestureScrollTarget(document)).toBe(explicit);

    main.remove();
    explicit.remove();
  });

  it("starts and continues polling across child rerenders without stopping the board service", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handSnapshot({ sequence: 2 })));
      throw new Error(`unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    const { rerender, unmount } = render(
      <RobotGestureProvider><GestureState /><span>first screen</span></RobotGestureProvider>,
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(fetch).toHaveBeenCalledWith("/_mambo/hand/start", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenCalledWith("/_mambo/hand/status", expect.anything());
    expect(screen.getByTestId("gesture-state")).toHaveTextContent("true:ready:2");

    fetch.mockClear();
    rerender(<RobotGestureProvider><GestureState /><span>second screen</span></RobotGestureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(HAND_VISION_POLL_MS); });

    expect(fetch).toHaveBeenCalledWith("/_mambo/hand/status", expect.anything());
    expect(fetch).not.toHaveBeenCalledWith("/_mambo/hand/stop", expect.anything());

    unmount();
    expect(fetch).not.toHaveBeenCalledWith("/_mambo/hand/stop", expect.anything());
  });

  it("keeps viewport-scaled page scrolling at a fixed speed for a stable upper V sign", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
    const windowScrollBy = vi.fn();
    Object.defineProperty(window, "scrollBy", { configurable: true, value: windowScrollBy });
    const pageScroller = document.createElement("main");
    pageScroller.style.overflowY = "auto";
    Object.defineProperties(pageScroller, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1_500 },
      scrollBy: { configurable: true, value: vi.fn() },
    });
    document.body.append(pageScroller);
    let sequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handSnapshot({ status: "loading" })));
      sequence += 1;
      return Promise.resolve(jsonResponse(handSnapshot({
        sequence,
        gesture: "v_sign",
        confidence: 0.9,
        cursor: { x: 0.4, y: 0.35 },
        landmarks,
      })));
    });
    vi.stubGlobal("fetch", fetch);

    render(<RobotGestureProvider><GestureState /></RobotGestureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(HAND_VISION_POLL_MS * 5); });

    const scrollCalls = (pageScroller.scrollBy as unknown as {
      mock: { calls: Array<[{ top: number; behavior: ScrollBehavior }]> };
    }).mock.calls;
    expect(scrollCalls).toHaveLength(2);
    expect(scrollCalls[0][0]).toMatchObject({ behavior: "auto" });
    expect(scrollCalls[0][0].top).toBeCloseTo(-21.6);
    expect(scrollCalls[1][0]).toMatchObject({ behavior: "auto" });
    expect(scrollCalls[1][0].top).toBeCloseTo(-21.6);
    expect(windowScrollBy).not.toHaveBeenCalled();
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-mode", "scroll_up");
    pageScroller.remove();
  });

  it("dispatches a semantic navigation event for a held thumb gesture", async () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    window.addEventListener(GESTURE_NAVIGATE_EVENT, onNavigate);
    let sequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handSnapshot({ status: "loading" })));
      sequence += 1;
      return Promise.resolve(jsonResponse(handSnapshot({
        sequence,
        gesture: "thumb_up",
        confidence: 0.9,
        cursor: { x: 0.4, y: 0.6 },
        landmarks,
      })));
    });
    vi.stubGlobal("fetch", fetch);

    render(<RobotGestureProvider><GestureState /></RobotGestureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(HAND_VISION_POLL_MS * 6); });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
    expect((onNavigate.mock.calls[0][0] as CustomEvent).detail).toEqual({ direction: "next" });
    window.removeEventListener(GESTURE_NAVIGATE_EVENT, onNavigate);
  });

  it("reaches ready state from a Strict Mode local mount", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handSnapshot({ sequence: 3 })));
      throw new Error(`unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<StrictMode><RobotGestureProvider><GestureState /></RobotGestureProvider></StrictMode>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(fetch.mock.calls.filter(([path]) => path === "/_mambo/hand/start")).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith("/_mambo/hand/status", expect.anything());
    expect(screen.getByTestId("gesture-state")).toHaveTextContent("true:ready:3");
  });

  it("limits physical pointer updates while keeping the visual cursor current", async () => {
    vi.useFakeTimers();
    let sequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") {
        sequence += 1;
        return Promise.resolve(jsonResponse(handSnapshot({
          sequence,
          gesture: "open_palm",
          confidence: 0.9,
          cursor: { x: 0.1 + sequence * 0.1, y: 0.5 },
          landmarks,
        })));
      }
      if (path === "/api/device/command") {
        expect(JSON.parse(String(init?.body))).toMatchObject({ name: "move_mouse" });
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      throw new Error(`unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<RobotGestureProvider><GestureState /></RobotGestureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(HAND_VISION_POLL_MS * 4); });

    const physicalMoves = fetch.mock.calls.filter(([path, init]) => (
      path === "/api/device/command" && JSON.parse(String((init as RequestInit).body)).name === "move_mouse"
    ));
    expect(physicalMoves).toHaveLength(3);
    expect(screen.getByRole("progressbar")).toHaveStyle({ left: "44.74368749999999%" });
  });

  it("supports a manual stop followed by a new start", async () => {
    vi.useFakeTimers();
    let sequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/stop") return Promise.resolve(jsonResponse(handSnapshot({ status: "idle", sequence: 0 })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handSnapshot({ sequence: ++sequence })));
      throw new Error(`unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<RobotGestureProvider><GestureState /><GestureActions /></RobotGestureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId("gesture-state")).toHaveTextContent("true:ready:1");

    fireEvent.click(screen.getByRole("button", { name: "stop gesture" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("gesture-state")).toHaveTextContent("true:off:0");

    fireEvent.click(screen.getByRole("button", { name: "start gesture" }));
    await act(async () => { await Promise.resolve(); });
    expect(fetch.mock.calls.filter(([path]) => path === "/_mambo/hand/start")).toHaveLength(2);
    expect(screen.getByTestId("gesture-state")).toHaveTextContent("true:ready:2");
  });

  it("ignores a start response that arrives after a manual stop", async () => {
    vi.useFakeTimers();
    const pendingStart = deferred<Response>();
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return pendingStart.promise;
      if (path === "/_mambo/hand/stop") return Promise.resolve(jsonResponse(handSnapshot({ status: "idle", sequence: 0 })));
      if (path === "/_mambo/hand/status") return Promise.resolve(jsonResponse(handSnapshot({ sequence: 9 })));
      throw new Error(`unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<RobotGestureProvider><GestureState /><GestureActions /></RobotGestureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId("gesture-state")).toHaveTextContent("true:loading:none");

    fireEvent.click(screen.getByRole("button", { name: "stop gesture" }));
    await act(async () => { await Promise.resolve(); });
    pendingStart.resolve(jsonResponse(handSnapshot({ status: "loading" })));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId("gesture-state")).toHaveTextContent("true:off:0");
    expect(fetch).not.toHaveBeenCalledWith("/_mambo/hand/status", expect.anything());
  });

  it("uses a DOM target for gesture clicks before falling back to a physical click", async () => {
    vi.useFakeTimers();
    const target = document.createElement("button");
    const onClick = vi.fn();
    target.addEventListener("click", onClick);
    document.body.append(target);
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => target) });
    let sequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") {
        sequence += 1;
        return Promise.resolve(jsonResponse(handSnapshot(sequence === 1 ? {
          sequence,
          gesture: "open_palm",
          confidence: 0.9,
          cursor: { x: 0.5, y: 0.5 },
          landmarks,
        } : {
          sequence,
          gesture: "fist",
          confidence: 0.9,
          cursor: { x: 0.5, y: 0.5 },
          landmarks,
        })));
      }
      if (path === "/api/device/command") {
        expect(init?.method).toBe("POST");
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      throw new Error(`unexpected request: ${path} ${init?.body ?? ""}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<RobotGestureProvider><GestureState /></RobotGestureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_700); });

    expect(onClick).toHaveBeenCalledTimes(1);
    const physicalClicks = fetch.mock.calls.filter(([path, init]) => (
      path === "/api/device/command" && JSON.parse(String((init as RequestInit).body)).name === "click_mouse"
    ));
    expect(physicalClicks).toHaveLength(0);
    target.remove();
  });

  it("falls back to a physical click when no interactive DOM target is present", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => null) });
    let sequence = 0;
    const fetch = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const path = String(input);
      if (path === "/_mambo/hand/start") return Promise.resolve(jsonResponse(handSnapshot({ status: "loading" })));
      if (path === "/_mambo/hand/status") {
        sequence += 1;
        return Promise.resolve(jsonResponse(handSnapshot(sequence === 1 ? {
          sequence,
          gesture: "open_palm",
          confidence: 0.9,
          cursor: { x: 0.5, y: 0.5 },
          landmarks,
        } : {
          sequence,
          gesture: "fist",
          confidence: 0.9,
          cursor: { x: 0.5, y: 0.5 },
          landmarks,
        })));
      }
      if (path === "/api/device/command") {
        expect(_init?.method).toBe("POST");
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      throw new Error(`unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetch);

    render(<RobotGestureProvider><GestureState /></RobotGestureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_700); });

    const physicalClicks = fetch.mock.calls.filter(([path, init]) => (
      path === "/api/device/command" && JSON.parse(String((init as RequestInit).body)).name === "click_mouse"
    ));
    expect(physicalClicks).toHaveLength(1);
  });
});
