import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  getGoogleModel: vi.fn(),
}));

import { POST } from "./route";

function audioRequest(file?: File) {
  const formData = new FormData();
  if (file) formData.append("audio", file);
  return { formData: async () => formData } as Request;
}

describe("POST /api/transcribe", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a request with no audio file", async () => {
    const response = await POST(audioRequest());

    expect(response.status).toBe(400);
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
    await expect(response.json()).resolves.toEqual({ error: "AI_NOT_CONFIGURED" });
  });
});
