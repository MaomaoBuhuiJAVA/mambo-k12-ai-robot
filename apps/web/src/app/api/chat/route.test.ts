import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  streamText: vi.fn(),
  toTextStream: vi.fn(),
  createTextStreamResponse: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  getGoogleModel: vi.fn(),
}));

import { createTextStreamResponse, streamText, toTextStream } from "ai";
import { getGoogleModel } from "@/lib/ai/provider";
import { resetRequestGuardForTests } from "@/lib/ai/request-guard";

import { POST } from "./route";

const request = (body: string) => new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body,
});

function oversizedRequest(contentLength?: string) {
  const cancel = vi.fn();
  const chunk = new Uint8Array(1024 * 1024);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk);
    },
    cancel,
  });
  const headers = new Headers({ "content-type": "application/json" });
  if (contentLength) headers.set("content-length", contentLength);
  return {
    cancel,
    request: new Request("http://localhost/api/chat", {
      method: "POST",
      headers,
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
  };
}

function unreadRequest() {
  const getReader = vi.fn();
  return {
    getReader,
    request: {
      headers: new Headers({ "content-type": "application/json" }),
      body: { getReader },
    } as unknown as Request,
  };
}

function stalledRequest() {
  const cancel = vi.fn();
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new ReadableStream<Uint8Array>({ cancel }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { cancel, request };
}

function delayedChatRequest(delayMs: number) {
  const payload = JSON.stringify({
    stage: "lower_primary",
    courseId: "lower-bubble-sort",
    messages: [{ role: "user", content: "help" }],
  });
  const midpoint = Math.floor(payload.length / 2);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload.slice(0, midpoint)));
      setTimeout(() => {
        controller.enqueue(encoder.encode(payload.slice(midpoint)));
        controller.close();
      }, delayMs);
    },
  });
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    resetRequestGuardForTests();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_CHAT_REQUEST" });
  });

  it("rejects a request that does not match the chat schema", async () => {
    const response = await POST(request(JSON.stringify({ stage: "lower_primary", courseId: "lower-bubble-sort", messages: [] })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_CHAT_REQUEST" });
  });

  it("returns a stable error before contacting the provider when no key is configured", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

    const response = await POST(request(JSON.stringify({
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      messages: [{ role: "user", content: "help" }],
    })));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "AI_NOT_CONFIGURED" });
  });

  it("fails closed before reading the body when Vercel Redis is unavailable", async () => {
    vi.stubEnv("VERCEL", "1");
    const unread = unreadRequest();

    const response = await POST(unread.request);

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("30");
    await expect(response.json()).resolves.toEqual({ error: "AI_GUARD_UNAVAILABLE" });
    expect(unread.getReader).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });

  it("cancels a stalled body at the total route deadline and releases its lease", async () => {
    vi.useFakeTimers();
    const stalled = stalledRequest();
    const pending = POST(stalled.request);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(90_000);
    const response = await pending;

    expect(response.status).toBe(408);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "AI_REQUEST_TIMEOUT" });
    expect(stalled.cancel).toHaveBeenCalledTimes(1);
    expect(streamText).not.toHaveBeenCalled();

    vi.mocked(streamText).mockReturnValue({ stream: new ReadableStream() } as never);
    vi.mocked(toTextStream).mockImplementation(() => new ReadableStream());
    vi.mocked(createTextStreamResponse).mockImplementation(({ stream, headers }) => new Response(stream, { headers }));
    const body = JSON.stringify({
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      messages: [{ role: "user", content: "help" }],
    });
    const first = await POST(request(body));
    const second = await POST(request(body));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await first.body?.cancel();
    await second.body?.cancel();
  });

  it("does not reset the deadline after a slow body finishes", async () => {
    vi.useFakeTimers();
    let providerSignal: AbortSignal | undefined;
    vi.mocked(streamText).mockImplementation((options) => {
      providerSignal = options.abortSignal;
      return { stream: new ReadableStream() } as never;
    });
    vi.mocked(toTextStream).mockImplementation(() => new ReadableStream());
    vi.mocked(createTextStreamResponse).mockImplementation(({ stream, headers }) => new Response(stream, { headers }));

    const pending = POST(delayedChatRequest(30_000));
    await vi.advanceTimersByTimeAsync(30_000);
    const response = await pending;
    expect(providerSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(providerSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(providerSignal?.aborted).toBe(true);
    await response.body?.cancel();
  });

  it("charges invalid requests and stops reading bodies after the minute quota", async () => {
    for (let index = 0; index < 12; index += 1) {
      expect((await POST(request("{"))).status).toBe(400);
    }
    const unread = unreadRequest();

    const blocked = await POST(unread.request);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(unread.getReader).not.toHaveBeenCalled();
  });

  it("rejects request bodies larger than six MiB before parsing JSON", async () => {
    const response = await POST(request(`{"padding":"${"a".repeat(6 * 1024 * 1024)}"}`));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "INVALID_CHAT_REQUEST" });
  });

  it.each([undefined, String(6 * 1024 * 1024 + 1)])("cancels an oversized chat body with Content-Length %s", async (contentLength) => {
    const oversized = oversizedRequest(contentLength);

    const response = await POST(oversized.request);

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(oversized.cancel).toHaveBeenCalledTimes(1);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("streams a valid request with AI SDK 7 adapters and no-store headers", async () => {
    vi.mocked(getGoogleModel).mockReturnValue("google-model" as never);
    const providerStream = new ReadableStream();
    const textStream = new ReadableStream();
    const expectedResponse = new Response("streamed", { headers: { "Cache-Control": "no-store" } });
    vi.mocked(streamText).mockReturnValue({ stream: providerStream } as never);
    vi.mocked(toTextStream).mockReturnValue(textStream as never);
    vi.mocked(createTextStreamResponse).mockReturnValue(expectedResponse);

    const response = await POST(request(JSON.stringify({
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      messages: [{ role: "user", content: "help" }],
    })));

    expect(response).toBe(expectedResponse);
    expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
      model: "google-model",
      instructions: expect.stringContaining("Mambo"),
      messages: [{ role: "user", content: "help" }],
      abortSignal: expect.any(AbortSignal),
    }));
    expect(toTextStream).toHaveBeenCalledWith({ stream: providerStream });
    expect(createTextStreamResponse).toHaveBeenCalledWith({ stream: expect.any(ReadableStream), headers: { "Cache-Control": "no-store" } });
  });

  it("passes request cancellation through to the streaming provider", async () => {
    const controller = new AbortController();
    let providerSignal: AbortSignal | undefined;
    vi.mocked(streamText).mockImplementation((options) => {
      providerSignal = options.abortSignal;
      return { stream: new ReadableStream() } as never;
    });
    vi.mocked(toTextStream).mockImplementation(({ stream }) => stream as unknown as ReadableStream<string>);
    vi.mocked(createTextStreamResponse).mockImplementation(({ stream, headers }) => new Response(stream, { headers }));
    const chatRequest = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
        messages: [{ role: "user", content: "help" }],
      }),
      signal: controller.signal,
    });
    const response = await POST(chatRequest);

    controller.abort(new DOMException("client left", "AbortError"));

    expect(providerSignal?.aborted).toBe(true);
    await response.body?.cancel();
  });

  it("aborts a stalled chat stream at the server deadline", async () => {
    vi.useFakeTimers();
    vi.mocked(streamText).mockImplementation((options) => ({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          options.abortSignal?.addEventListener("abort", () => controller.error(options.abortSignal?.reason), { once: true });
        },
      }),
    }) as never);
    vi.mocked(toTextStream).mockImplementation(({ stream }) => stream as never);
    vi.mocked(createTextStreamResponse).mockImplementation(({ stream, headers }) => new Response(stream as unknown as ReadableStream<Uint8Array>, { headers }));

    const response = await POST(request(JSON.stringify({
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      messages: [{ role: "user", content: "help" }],
    })));
    const reader = response.body?.getReader();
    const read = reader?.read();
    await vi.advanceTimersByTimeAsync(90_000);

    await expect(read).resolves.toMatchObject({ done: false, value: expect.stringContaining("AI 服务暂时不可用") });
    await expect(reader?.read()).resolves.toEqual({ done: true, value: undefined });
  });

  it("holds concurrency until a chat response stream is cancelled", async () => {
    vi.mocked(getGoogleModel).mockReturnValue("google-model" as never);
    vi.mocked(streamText).mockReturnValue({ stream: new ReadableStream() } as never);
    vi.mocked(toTextStream).mockImplementation(() => new ReadableStream());
    vi.mocked(createTextStreamResponse).mockImplementation(({ stream, headers }) => new Response(stream, { headers }));
    const body = JSON.stringify({
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      messages: [{ role: "user", content: "help" }],
    });

    const first = await POST(request(body));
    const second = await POST(request(body));
    const blocked = await POST(request(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("1");
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");

    await first.body?.cancel();
    expect((await POST(request(body))).status).toBe(200);
    await second.body?.cancel();
  });
});
