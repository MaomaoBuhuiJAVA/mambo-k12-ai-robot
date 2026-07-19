// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core-proxy", () => ({
  proxyCore: vi.fn(),
}));

import { proxyCore } from "@/lib/core-proxy";

import { POST } from "./route";

describe("POST /api/voice/asr", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("proxies WAV audio and returns the structured transcript", async () => {
    vi.mocked(proxyCore).mockResolvedValue(
      new Response(JSON.stringify({ text: "你好", duration_ms: 600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await POST(new Request("http://localhost/api/voice/asr", {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: new Uint8Array([1, 2, 3]),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "你好", duration_ms: 600 });
    expect(vi.mocked(proxyCore).mock.calls[0][0]).toBe("/api/v1/voice/asr");
  });

  it("returns a stable unavailable response when Core is not configured", async () => {
    vi.mocked(proxyCore).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/voice/asr", {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: new Uint8Array([1]),
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "VOICE_NOT_CONFIGURED" });
  });

  it("rejects unsupported audio types without contacting Core", async () => {
    const response = await POST(new Request("http://localhost/api/voice/asr", {
      method: "POST",
      headers: { "content-type": "audio/webm" },
      body: new Uint8Array([1]),
    }));

    expect(response.status).toBe(415);
    expect(proxyCore).not.toHaveBeenCalled();
  });
});
