import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  getGoogleModel: vi.fn(),
}));

import { generateText } from "ai";

import { POST } from "./route";

function audioRequest(file?: File) {
  const formData = new FormData();
  if (file) formData.append("audio", file);
  return { formData: async () => formData } as Request;
}

describe("POST /api/transcribe", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
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

  it("returns a stable error before contacting the provider when no key is configured", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

    const response = await POST(audioRequest(new File(["audio"], "clip.ogg", { type: "audio/ogg" })));

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "AI_NOT_CONFIGURED" });
  });

  it("accepts audio MIME parameters and sends the base MIME as an AI SDK file part", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    vi.mocked(generateText).mockResolvedValue({ text: "  transcript  " } as never);
    const response = await POST(audioRequest(new File(["audio"], "clip.webm", { type: "audio/webm;codecs=opus" })));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ transcript: "transcript" });
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{ role: "user", content: [expect.objectContaining({ type: "file", mediaType: "audio/webm", data: expect.any(Uint8Array) })] }],
    }));
  });

  it("fails closed when the provider returns only whitespace", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    vi.mocked(generateText).mockResolvedValue({ text: " \n " } as never);

    const response = await POST(audioRequest(new File(["audio"], "clip.ogg", { type: "audio/ogg; codecs=opus" })));

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "TRANSCRIPTION_FAILED" });
  });
});
