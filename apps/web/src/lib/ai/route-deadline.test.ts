import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_LEASE_DURATION_MS } from "./request-guard";
import { AI_ROUTE_DEADLINE_MS, createRouteDeadline } from "./route-deadline";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createRouteDeadline", () => {
  it("aborts at the fixed route deadline and cleans up idempotently", async () => {
    vi.useFakeTimers();
    const requestController = new AbortController();
    const deadline = createRouteDeadline(requestController.signal, 1_000);

    expect(deadline.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(999);
    expect(deadline.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.signal.reason).toBeInstanceOf(DOMException);
    expect((deadline.signal.reason as DOMException).name).toBe("TimeoutError");

    deadline.cleanup();
    deadline.cleanup();
  });

  it("propagates request cancellation immediately", () => {
    const requestController = new AbortController();
    const deadline = createRouteDeadline(requestController.signal, 1_000);
    const reason = new DOMException("client left", "AbortError");

    requestController.abort(reason);

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.signal.reason).toBe(reason);
    deadline.cleanup();
  });

  it("keeps every route deadline below the Redis lease lifetime", () => {
    expect(AI_ROUTE_DEADLINE_MS.chat).toBe(90_000);
    expect(AI_ROUTE_DEADLINE_MS.transcribe).toBe(60_000);
    expect(AI_ROUTE_DEADLINE_MS.storybook).toBe(90_000);
    expect(Math.max(...Object.values(AI_ROUTE_DEADLINE_MS))).toBeLessThan(AI_LEASE_DURATION_MS);
  });
});
