import { describe, expect, it, vi } from "vitest";

import { createRequestGuard, leaseReadableStream } from "./request-guard";

const limits = {
  minute: 2,
  day: 3,
  clientConcurrency: 1,
  globalConcurrency: 2,
};

function request(ip = "203.0.113.7") {
  return new Request("http://localhost/api/chat", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });
}

describe("request guard", () => {
  it("normalizes the forwarded client and enforces the per-minute quota", () => {
    let now = 60_000;
    const guard = createRequestGuard({ now: () => now, limitsByRoute: { chat: limits } });

    const first = guard.acquire(request(" 203.0.113.7 "), "chat");
    expect(first.ok).toBe(true);
    if (first.ok) first.lease.release();
    const second = guard.acquire(request(), "chat");
    expect(second.ok).toBe(true);
    if (second.ok) second.lease.release();

    const blocked = guard.acquire(request(), "chat");
    expect(blocked).toMatchObject({ ok: false, reason: "minute", retryAfter: 60 });

    now += 60_000;
    expect(guard.acquire(request(), "chat").ok).toBe(true);
  });

  it("enforces the daily quota across minute windows", () => {
    let now = 0;
    const guard = createRequestGuard({ now: () => now, limitsByRoute: { chat: limits } });

    for (let index = 0; index < 3; index += 1) {
      const result = guard.acquire(request(), "chat");
      expect(result.ok).toBe(true);
      if (result.ok) result.lease.release();
      now += 60_000;
    }

    expect(guard.acquire(request(), "chat")).toMatchObject({ ok: false, reason: "day" });
  });

  it("enforces client and global concurrency and releases leases idempotently", () => {
    const guard = createRequestGuard({ now: () => 0, limitsByRoute: { chat: limits } });
    const first = guard.acquire(request("203.0.113.1"), "chat");
    expect(first.ok).toBe(true);
    expect(guard.acquire(request("203.0.113.1"), "chat")).toMatchObject({ ok: false, reason: "client_concurrency" });

    const second = guard.acquire(request("203.0.113.2"), "chat");
    expect(second.ok).toBe(true);
    expect(guard.acquire(request("203.0.113.3"), "chat")).toMatchObject({ ok: false, reason: "global_concurrency" });

    if (first.ok) {
      first.lease.release();
      first.lease.release();
    }
    expect(guard.acquire(request("203.0.113.3"), "chat").ok).toBe(true);
    if (second.ok) second.lease.release();
  });

  it("forgets inactive client buckets after one day", () => {
    let now = 0;
    const guard = createRequestGuard({ now: () => now, limitsByRoute: { chat: limits } });
    const first = guard.acquire(request("203.0.113.1"), "chat");
    if (first.ok) first.lease.release();
    expect(guard.trackedClientCount()).toBe(1);

    now = 86_400_001;
    const second = guard.acquire(request("203.0.113.2"), "chat");
    if (second.ok) second.lease.release();

    expect(guard.trackedClientCount()).toBe(1);
  });

  it.each(["done", "cancel", "error"] as const)("releases a stream lease on %s", async (ending) => {
    const release = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        if (ending === "done") controller.close();
        if (ending === "error") controller.error(new Error("stream failed"));
      },
      cancel() {},
    });
    const guarded = leaseReadableStream(source, { release });
    const reader = guarded.getReader();

    if (ending === "cancel") await reader.cancel();
    else if (ending === "error") await expect(reader.read()).rejects.toThrow("stream failed");
    else {
      await reader.read();
      await reader.read();
    }

    expect(release).toHaveBeenCalledTimes(1);
  });
});
