import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/starbao-core", () => ({
  getStarbaoSnapshot: vi.fn(),
  updateStarbaoSpeakerSetting: vi.fn(),
}));

import {
  getStarbaoSnapshot,
  updateStarbaoSpeakerSetting,
} from "@/lib/starbao-core";
import { resetLocalStarbaoChatForTests } from "@/lib/local-starbao-chat";

import { GET, PATCH } from "./route";

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
  role: "user" as const,
  origin: "web" as const,
  content: "Explain the next step",
  reply_to_message_id: null,
  announce_on_orangepi: false,
  created_at: "2026-07-19T09:00:00Z",
};

describe("/api/starbao", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetLocalStarbaoChatForTests();
  });

  it("returns the canonical conversation cursor without exposing Core field names", async () => {
    vi.mocked(getStarbaoSnapshot).mockResolvedValue({
      conversation,
      messages: [message],
      latestSequence: 4,
    });

    const response = await GET(new Request("http://localhost/api/starbao?after=3&limit=25"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      conversation: {
        conversationId: "conv-1",
        deviceId: "orangepi4pro-dev-01",
        speakOnOrangePi: false,
        latestSequence: 4,
      },
      messages: [{
        messageId: "message-4",
        conversationId: "conv-1",
        sequence: 4,
        clientMessageId: "web-message-4",
        role: "user",
        origin: "web",
        content: "Explain the next step",
        replyToMessageId: null,
        announceOnOrangePi: false,
        createdAt: "2026-07-19T09:00:00Z",
      }],
      latestSequence: 4,
    });
    expect(getStarbaoSnapshot).toHaveBeenCalledWith({ after: 3, limit: 25 });
  });

  it("rejects an invalid cursor before contacting Core", async () => {
    const response = await GET(new Request("http://localhost/api/starbao?after=-1"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_STARBAO_QUERY" });
    expect(getStarbaoSnapshot).not.toHaveBeenCalled();
  });

  it("stores the OrangePi speech toggle through the server-side adapter", async () => {
    vi.mocked(updateStarbaoSpeakerSetting).mockResolvedValue({ ...conversation, speak_on_orangepi: true });

    const response = await PATCH(new Request("http://localhost/api/starbao", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ speakOnOrangePi: true }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      conversation: {
        conversationId: "conv-1",
        deviceId: "orangepi4pro-dev-01",
        speakOnOrangePi: true,
        latestSequence: 4,
      },
    });
    expect(updateStarbaoSpeakerSetting).toHaveBeenCalledWith(true);
  });

  it("uses an empty in-process conversation for an explicitly local browser test", async () => {
    vi.stubEnv("LOCAL_AI_CHAT", "true");
    vi.stubEnv("NODE_ENV", "development");

    const response = await GET(new Request("http://localhost/api/starbao?after=0&limit=100"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      conversation: {
        conversationId: "local-web-preview",
        deviceId: "local-browser",
        latestSequence: 0,
      },
      messages: [],
      latestSequence: 0,
    });
    expect(getStarbaoSnapshot).not.toHaveBeenCalled();
  });
});
