import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./core-proxy", () => ({
  proxyCore: vi.fn(),
}));

import { proxyCore } from "./core-proxy";
import {
  appendStarbaoMessage,
  getStarbaoSnapshot,
  updateStarbaoSpeakerSetting,
} from "./starbao-core";

const conversation = {
  conversation_id: "conv-1",
  device_id: "orangepi4pro-dev-01",
  speak_on_orangepi: false,
  latest_sequence: 4,
};

const message = {
  message_id: "message-4",
  conversation_id: "conv-1",
  sequence: 4,
  client_message_id: "web-message-4",
  role: "user",
  origin: "web",
  content: "Explain the next step",
  reply_to_message_id: null,
  announce_on_orangepi: false,
  created_at: "2026-07-19T09:00:00Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("starbao Core adapter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("loads a configured device conversation and only the requested canonical cursor", async () => {
    vi.stubEnv("CORE_DEVICE_ID", "orangepi4pro-dev-01");
    vi.mocked(proxyCore)
      .mockResolvedValueOnce(jsonResponse(conversation))
      .mockResolvedValueOnce(jsonResponse({ messages: [message], latest_sequence: 4 }));

    await expect(getStarbaoSnapshot({ after: 3, limit: 25 })).resolves.toEqual({
      conversation,
      messages: [message],
      latestSequence: 4,
    });

    expect(proxyCore).toHaveBeenNthCalledWith(
      1,
      "/api/v1/starbao/conversations/orangepi4pro-dev-01",
      { method: "GET" },
      expect.anything(),
    );
    expect(proxyCore).toHaveBeenNthCalledWith(
      2,
      "/api/v1/starbao/conversations/orangepi4pro-dev-01/messages?after=3&limit=25",
      { method: "GET" },
      expect.anything(),
    );
  });

  it("maps browser-safe message data to the Core idempotency contract", async () => {
    vi.stubEnv("CORE_DEVICE_ID", "orangepi4pro-dev-01");
    vi.mocked(proxyCore).mockResolvedValue(jsonResponse(message, 201));

    await expect(appendStarbaoMessage({
      clientMessageId: "web-message-4",
      role: "user",
      origin: "web",
      content: "Explain the next step",
    })).resolves.toEqual(message);

    expect(proxyCore).toHaveBeenCalledWith(
      "/api/v1/starbao/conversations/orangepi4pro-dev-01/messages",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_message_id: "web-message-4",
          role: "user",
          origin: "web",
          content: "Explain the next step",
          reply_to_message_id: undefined,
          announce_on_orangepi: false,
        }),
      }),
      expect.anything(),
    );
  });

  it("updates only the OrangePi speech setting", async () => {
    vi.stubEnv("CORE_DEVICE_ID", "orangepi4pro-dev-01");
    vi.mocked(proxyCore).mockResolvedValue(jsonResponse({ ...conversation, speak_on_orangepi: true }));

    await expect(updateStarbaoSpeakerSetting(true)).resolves.toEqual({
      ...conversation,
      speak_on_orangepi: true,
    });

    expect(proxyCore).toHaveBeenCalledWith(
      "/api/v1/starbao/conversations/orangepi4pro-dev-01/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ speak_on_orangepi: true }),
      }),
      expect.anything(),
    );
  });
});
