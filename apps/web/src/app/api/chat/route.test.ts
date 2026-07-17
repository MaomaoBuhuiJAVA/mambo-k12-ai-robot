import { afterEach, describe, expect, it, vi } from "vitest";

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

import { POST } from "./route";

const request = (body: string) => new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body,
});

describe("POST /api/chat", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
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

  it("rejects request bodies larger than six MiB before parsing JSON", async () => {
    const response = await POST(request(`{"padding":"${"a".repeat(6 * 1024 * 1024)}"}`));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "INVALID_CHAT_REQUEST" });
  });

  it("streams a valid request with AI SDK 7 adapters and no-store headers", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
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
    }));
    expect(toTextStream).toHaveBeenCalledWith({ stream: providerStream });
    expect(createTextStreamResponse).toHaveBeenCalledWith({ stream: textStream, headers: { "Cache-Control": "no-store" } });
  });
});
