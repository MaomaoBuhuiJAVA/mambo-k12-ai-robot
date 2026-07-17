import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  getGoogleModel: vi.fn(),
}));

import { POST } from "./route";

const request = (body: string) => new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body,
});

describe("POST /api/chat", () => {
  afterEach(() => vi.unstubAllEnvs());

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
});
