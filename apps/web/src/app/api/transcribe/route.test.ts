// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  getGoogleModel: vi.fn(),
}));

import { generateText } from "ai";
import { resetRequestGuardForTests } from "@/lib/ai/request-guard";

import { POST } from "./route";

function audioRequest(file?: File, signal?: AbortSignal) {
  const boundary = "vitest-audio-boundary";
  const encoder = new TextEncoder();
  const prefix = file
    ? encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`)
    : new Uint8Array();
  const payload = file ? new Uint8Array(file.size).fill(97) : new Uint8Array();
  const suffix = encoder.encode(`${file ? "\r\n" : ""}--${boundary}--\r\n`);
  const body = new Uint8Array(prefix.byteLength + payload.byteLength + suffix.byteLength);
  body.set(prefix);
  body.set(payload, prefix.byteLength);
  body.set(suffix, prefix.byteLength + payload.byteLength);

  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body,
    signal,
  });
}

function oversizedStreamRequest(contentLength?: string) {
  const cancel = vi.fn();
  const chunk = new Uint8Array(1024 * 1024);
  let emitted = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk);
      emitted += chunk.byteLength;
      if (emitted >= 11 * 1024 * 1024) controller.close();
    },
    cancel,
  });
  const headers = new Headers({ "content-type": "multipart/form-data; boundary=test-boundary" });
  if (contentLength) headers.set("content-length", contentLength);

  const request = new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  return { request, cancel };
}

function unreadRequest() {
  const getReader = vi.fn();
  return {
    getReader,
    request: {
      headers: new Headers({ "content-type": "multipart/form-data; boundary=unread" }),
      body: { getReader },
    } as unknown as Request,
  };
}

function stalledRequest() {
  const cancel = vi.fn();
  const request = new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=stalled" },
    body: new ReadableStream<Uint8Array>({ cancel }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { cancel, request };
}

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    resetRequestGuardForTests();
  });

  it("rejects a request with no audio file", async () => {
    const response = await POST(audioRequest());

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "TRANSCRIPTION_FILE_INVALID" });
  });

  it("rejects audio with an unsupported MIME type", async () => {
    const response = await POST(audioRequest(new File(["audio"], "clip.txt", { type: "text/plain" })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "TRANSCRIPTION_FILE_INVALID" });
  });

  it("rejects audio larger than eight MiB", async () => {
    const response = await POST(audioRequest(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "clip.webm", { type: "audio/webm" })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "TRANSCRIPTION_FILE_INVALID" });
  });

  it("rejects an oversized Content-Length before reading or contacting the provider", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    const { request, cancel } = oversizedStreamRequest(String(9 * 1024 * 1024 + 1));

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "TRANSCRIPTION_BODY_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(generateText).not.toHaveBeenCalled();
  });

  it.each([undefined, "1"])("streams and cancels an oversized multipart body with Content-Length %s", async (contentLength) => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    const { request, cancel } = oversizedStreamRequest(contentLength);

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "TRANSCRIPTION_BODY_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns a stable error before contacting the provider when no key is configured", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

    const response = await POST(audioRequest(new File(["audio"], "clip.ogg", { type: "audio/ogg" })));

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "AI_NOT_CONFIGURED" });
  });

  it("cancels a stalled multipart body at the route deadline and releases its lease", async () => {
    vi.useFakeTimers();
    const stalled = stalledRequest();
    const pending = POST(stalled.request);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    const response = await pending;

    expect(response.status).toBe(408);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "AI_REQUEST_TIMEOUT" });
    expect(stalled.cancel).toHaveBeenCalledTimes(1);
    expect(generateText).not.toHaveBeenCalled();

    vi.mocked(generateText).mockResolvedValueOnce({ text: "next" } as never);
    expect((await POST(audioRequest(new File(["audio"], "clip.ogg", { type: "audio/ogg" })))).status).toBe(200);
  });

  it("accepts audio MIME parameters and sends the base MIME as an AI SDK file part", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    vi.mocked(generateText).mockResolvedValue({ text: "  transcript  " } as never);
    const response = await POST(audioRequest(new File(["audio"], "clip.webm", { type: "audio/webm;codecs=opus" })));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ transcript: "transcript" });
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      abortSignal: expect.any(AbortSignal),
      maxRetries: 0,
      messages: [{ role: "user", content: [expect.objectContaining({ type: "file", mediaType: "audio/webm", data: expect.any(Uint8Array) })] }],
    }));
  });

  it("returns a stable timeout when the client aborts before body parsing", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("client left", "AbortError"));

    const response = await POST(audioRequest(
      new File(["audio"], "clip.ogg", { type: "audio/ogg" }),
      controller.signal,
    ));

    expect(response.status).toBe(408);
    await expect(response.json()).resolves.toEqual({ error: "AI_REQUEST_TIMEOUT" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns a stable failure and releases the lease at the transcription deadline", async () => {
    vi.useFakeTimers();
    vi.mocked(generateText).mockImplementation((options) => new Promise((_resolve, reject) => {
      options.abortSignal?.addEventListener("abort", () => reject(options.abortSignal?.reason), { once: true });
    }) as never);

    const pending = POST(audioRequest(new File(["audio"], "clip.ogg", { type: "audio/ogg" })));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    const response = await pending;

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "TRANSCRIPTION_FAILED" });
  });

  it("fails closed when the provider returns only whitespace", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    vi.mocked(generateText).mockResolvedValue({ text: " \n " } as never);

    const response = await POST(audioRequest(new File(["audio"], "clip.ogg", { type: "audio/ogg; codecs=opus" })));

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "TRANSCRIPTION_FAILED" });
  });

  it("releases transcription concurrency only after provider work settles", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    let resolveGeneration: ((value: { text: string }) => void) | undefined;
    vi.mocked(generateText).mockImplementationOnce(() => new Promise((resolve) => {
      resolveGeneration = resolve as (value: { text: string }) => void;
    }) as never);
    const file = new File(["audio"], "clip.ogg", { type: "audio/ogg" });

    const firstPromise = POST(audioRequest(file));
    await vi.waitFor(() => expect(generateText).toHaveBeenCalledTimes(1));
    const blocked = await POST(audioRequest(file));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("1");
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");

    resolveGeneration?.({ text: "first" });
    expect((await firstPromise).status).toBe(200);
    vi.mocked(generateText).mockResolvedValueOnce({ text: "second" } as never);
    expect((await POST(audioRequest(file))).status).toBe(200);
  });

  it("does not read multipart data when concurrency is already exhausted", async () => {
    let resolveGeneration: ((value: { text: string }) => void) | undefined;
    vi.mocked(generateText).mockImplementationOnce(() => new Promise((resolve) => {
      resolveGeneration = resolve as (value: { text: string }) => void;
    }) as never);
    const firstPromise = POST(audioRequest(new File(["audio"], "clip.ogg", { type: "audio/ogg" })));
    await vi.waitFor(() => expect(generateText).toHaveBeenCalledTimes(1));
    const unread = unreadRequest();

    const blocked = await POST(unread.request);

    expect(blocked.status).toBe(429);
    expect(unread.getReader).not.toHaveBeenCalled();
    resolveGeneration?.({ text: "done" });
    await firstPromise;
  });
});
