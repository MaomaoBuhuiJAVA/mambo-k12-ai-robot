import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acquireRequestLease,
  createRequestGuard,
  leaseReadableStream,
  requestGuardRejectionResponse,
  resetRequestGuardForTests,
} from "./request-guard";

const limits = {
  minute: 2,
  day: 3,
  clientConcurrency: 1,
  routeConcurrency: 2,
};

function request(ip = "203.0.113.7") {
  return new Request("http://localhost/api/chat", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetRequestGuardForTests();
});

describe("in-memory request guard", () => {
  it("normalizes a trusted proxy client and enforces the per-minute quota", async () => {
    let now = 60_000;
    const guard = createRequestGuard({
      now: () => now,
      limitsByRoute: { chat: { ...limits, day: 10 } },
      overallConcurrency: 2,
      trustProxyHeaders: true,
    });

    const first = await guard.acquire(request(" 203.0.113.7 "), "chat");
    expect(first.ok).toBe(true);
    if (first.ok) await first.lease.release();
    const second = await guard.acquire(request(), "chat");
    expect(second.ok).toBe(true);
    if (second.ok) await second.lease.release();

    const blocked = await guard.acquire(request(), "chat");
    expect(blocked).toMatchObject({ ok: false, reason: "minute", retryAfter: 60 });

    now += 60_000;
    expect((await guard.acquire(request(), "chat")).ok).toBe(true);
  });

  it("ignores spoofed forwarding headers outside Vercel unless proxy trust is explicit", async () => {
    const onePerMinute = { ...limits, minute: 1 };
    const guard = createRequestGuard({
      limitsByRoute: { chat: onePerMinute },
      overallConcurrency: 2,
      trustProxyHeaders: false,
    });

    const first = await guard.acquire(request("203.0.113.1"), "chat");
    if (first.ok) await first.lease.release();

    expect(await guard.acquire(request("203.0.113.200"), "chat")).toMatchObject({
      ok: false,
      reason: "minute",
    });
  });

  it("enforces the daily quota across minute windows", async () => {
    let now = 0;
    const guard = createRequestGuard({
      now: () => now,
      limitsByRoute: { chat: limits },
      overallConcurrency: 2,
    });

    for (let index = 0; index < 3; index += 1) {
      const result = await guard.acquire(request(), "chat");
      expect(result.ok).toBe(true);
      if (result.ok) await result.lease.release();
      now += 60_000;
    }

    expect(await guard.acquire(request(), "chat")).toMatchObject({ ok: false, reason: "day" });
  });

  it("keeps per-route concurrency separate from one consistent overall limit", async () => {
    const roomy = { ...limits, clientConcurrency: 5, routeConcurrency: 5 };
    const guard = createRequestGuard({
      limitsByRoute: { chat: roomy, transcribe: roomy, storybook: roomy },
      overallConcurrency: 2,
      trustProxyHeaders: true,
    });
    const chat = await guard.acquire(request("203.0.113.1"), "chat");
    const transcribe = await guard.acquire(request("203.0.113.2"), "transcribe");

    expect(chat.ok).toBe(true);
    expect(transcribe.ok).toBe(true);
    expect(await guard.acquire(request("203.0.113.3"), "storybook")).toMatchObject({
      ok: false,
      reason: "overall_concurrency",
    });

    if (chat.ok) await chat.lease.release();
    expect((await guard.acquire(request("203.0.113.3"), "storybook")).ok).toBe(true);
    if (transcribe.ok) await transcribe.lease.release();
  });

  it("enforces client and route concurrency and releases leases idempotently", async () => {
    const onePerRoute = { ...limits, routeConcurrency: 1 };
    const guard = createRequestGuard({
      limitsByRoute: { chat: onePerRoute },
      overallConcurrency: 3,
      trustProxyHeaders: true,
    });
    const first = await guard.acquire(request("203.0.113.1"), "chat");
    expect(first.ok).toBe(true);
    expect(await guard.acquire(request("203.0.113.1"), "chat")).toMatchObject({
      ok: false,
      reason: "client_concurrency",
    });
    expect(await guard.acquire(request("203.0.113.2"), "chat")).toMatchObject({
      ok: false,
      reason: "route_concurrency",
    });

    if (first.ok) {
      await first.lease.release();
      await first.lease.release();
    }
    expect((await guard.acquire(request("203.0.113.2"), "chat")).ok).toBe(true);
  });

  it("forgets inactive client buckets after one day", async () => {
    let now = 0;
    const guard = createRequestGuard({
      now: () => now,
      limitsByRoute: { chat: limits },
      overallConcurrency: 2,
    });
    const first = await guard.acquire(request("203.0.113.1"), "chat");
    if (first.ok) await first.lease.release();
    expect(guard.trackedClientCount()).toBe(1);

    now = 86_400_001;
    const second = await guard.acquire(request("203.0.113.2"), "chat");
    if (second.ok) await second.lease.release();

    expect(guard.trackedClientCount()).toBe(1);
  });
});

describe("durable Vercel request guard", () => {
  it("uses one atomic Redis EVAL to increment and expire minute/day tickets", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ result: ["ok", 1] }))
      .mockResolvedValueOnce(Response.json({ result: 1 }));

    const result = await acquireRequestLease(request(), "chat");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://redis.example.com");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer redis-token");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const command = JSON.parse(String(init?.body)) as string[];
    expect(command[0]).toBe("EVAL");
    expect(command[1]).toContain("redis.call('INCR'");
    expect(command[1]).toContain("redis.call('EXPIRE'");
    expect(command[2]).toBe("5");

    if (result.ok) await result.lease.release();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts the Vercel KV REST aliases", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("KV_REST_API_URL", "https://kv.example.com");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ result: ["minute", 27] }));

    const result = await acquireRequestLease(request(), "storybook");

    expect(result).toMatchObject({ ok: false, reason: "minute", retryAfter: 27 });
    expect(fetchMock).toHaveBeenCalledWith("https://kv.example.com", expect.objectContaining({ method: "POST" }));
  });

  it("uses Vercel's canonical client header instead of a replaceable forwarded header", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ result: ["minute", 5] }));
    const platformRequest = (claimedIp: string) => new Request("http://localhost/api/chat", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.10",
        "x-forwarded-for": claimedIp,
      },
    });

    await acquireRequestLease(platformRequest("203.0.113.1"), "chat");
    await acquireRequestLease(platformRequest("203.0.113.200"), "chat");

    const commands = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as string[]);
    expect(commands[0][3]).toBe(commands[1][3]);
  });

  it("uses Vercel's overwritten forwarded header as a compatibility fallback", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ result: ["minute", 5] }));

    await acquireRequestLease(request("203.0.113.1"), "chat");
    await acquireRequestLease(request("203.0.113.2"), "chat");

    const commands = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as string[]);
    expect(commands[0][3]).not.toBe(commands[1][3]);
  });

  it("never mixes a partial Upstash pair with complete KV credentials", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://incomplete.example.com");
    vi.stubEnv("KV_REST_API_URL", "https://kv.example.com");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ result: ["minute", 5] }));

    await acquireRequestLease(request(), "chat");

    expect(fetchMock).toHaveBeenCalledWith("https://kv.example.com", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer kv-token" }),
    }));
  });

  it("fails closed when Vercel Redis credentials are missing", async () => {
    vi.stubEnv("VERCEL", "1");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await acquireRequestLease(request(), "chat");

    expect(result).toMatchObject({ ok: false, reason: "unavailable", retryAfter: 30 });
    expect(fetchMock).not.toHaveBeenCalled();
    if (result.ok) throw new Error("expected guard rejection");
    const response = requestGuardRejectionResponse(result);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("30");
    await expect(response.json()).resolves.toEqual({ error: "AI_GUARD_UNAVAILABLE" });
  });

  it("fails closed on Redis network and protocol errors", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await acquireRequestLease(request(), "chat")).toMatchObject({ ok: false, reason: "unavailable" });

    fetchMock.mockResolvedValueOnce(Response.json({ error: "ERR bad script" }));
    expect(await acquireRequestLease(request(), "chat")).toMatchObject({ ok: false, reason: "unavailable" });
  });
});

describe("leased streams", () => {
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
