// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core-proxy", () => ({
  proxyCore: vi.fn(),
}));

import { proxyCore } from "@/lib/core-proxy";

import { POST } from "./route";

describe("POST /api/voice/tts", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns Core audio without exposing upstream headers", async () => {
    vi.mocked(proxyCore).mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "audio/mpeg", "x-access-token": "secret" },
      }),
    );

    const response = await POST(new Request("http://localhost/api/voice/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "你好" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("audio/mpeg");
    expect(response.headers.get("x-access-token")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects blank text before contacting Core", async () => {
    const response = await POST(new Request("http://localhost/api/voice/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "" }),
    }));

    expect(response.status).toBe(400);
    expect(proxyCore).not.toHaveBeenCalled();
  });
});
