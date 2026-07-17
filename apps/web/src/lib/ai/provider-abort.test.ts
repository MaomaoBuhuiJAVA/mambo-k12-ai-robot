import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_PROVIDER_TIMEOUT_MS, createProviderAbort } from "./provider-abort";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createProviderAbort", () => {
  it("aborts at the fixed server deadline and cleans up idempotently", async () => {
    vi.useFakeTimers();
    const requestController = new AbortController();
    const provider = createProviderAbort(requestController.signal, 1_000);

    expect(provider.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(999);
    expect(provider.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(provider.signal.aborted).toBe(true);
    expect(provider.signal.reason).toBeInstanceOf(DOMException);
    expect((provider.signal.reason as DOMException).name).toBe("TimeoutError");

    provider.cleanup();
    provider.cleanup();
  });

  it("propagates request cancellation immediately", () => {
    const requestController = new AbortController();
    const provider = createProviderAbort(requestController.signal, 1_000);
    const reason = new DOMException("client left", "AbortError");

    requestController.abort(reason);

    expect(provider.signal.aborted).toBe(true);
    expect(provider.signal.reason).toBe(reason);
    provider.cleanup();
  });

  it("keeps every provider deadline below the Redis lease lifetime", () => {
    expect(AI_PROVIDER_TIMEOUT_MS.chat).toBe(90_000);
    expect(AI_PROVIDER_TIMEOUT_MS.transcribe).toBe(60_000);
    expect(AI_PROVIDER_TIMEOUT_MS.storybook).toBe(90_000);
    expect(Math.max(...Object.values(AI_PROVIDER_TIMEOUT_MS))).toBeLessThan(180_000);
  });
});
