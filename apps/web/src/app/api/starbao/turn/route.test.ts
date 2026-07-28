import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  getChatModel: vi.fn(),
}));

vi.mock("@/lib/starbao-core", () => ({
  appendStarbaoMessage: vi.fn(),
  getStarbaoSnapshot: vi.fn(),
}));

import { generateText } from "ai";
import { getChatModel } from "@/lib/ai/provider";
import { appendStarbaoMessage, getStarbaoSnapshot } from "@/lib/starbao-core";

import { POST } from "./route";

const conversation = {
  conversation_id: "conv-1",
  device_id: "orangepi4pro-dev-01",
  speak_on_orangepi: true,
  latest_sequence: 7,
};

const earlierMessage = {
  message_id: "message-7",
  conversation_id: "conv-1",
  sequence: 7,
  client_message_id: "older-assistant-message",
  role: "assistant" as const,
  origin: "starbao" as const,
  content: "Let's keep exploring.",
  reply_to_message_id: "message-6",
  announce_on_orangepi: false,
  created_at: "2026-07-19T09:00:00Z",
};

const userMessage = {
  message_id: "message-8",
  conversation_id: "conv-1",
  sequence: 8,
  client_message_id: "web-turn-1",
  role: "user" as const,
  origin: "web" as const,
  content: "What should I try next?",
  reply_to_message_id: null,
  announce_on_orangepi: false,
  created_at: "2026-07-19T09:01:00Z",
};

const assistantMessage = {
  message_id: "message-9",
  conversation_id: "conv-1",
  sequence: 9,
  client_message_id: "web-turn-1:assistant",
  role: "assistant" as const,
  origin: "starbao" as const,
  content: "Start by comparing two nearby numbers.",
  reply_to_message_id: "message-8",
  announce_on_orangepi: true,
  created_at: "2026-07-19T09:01:03Z",
};

function turnRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/starbao/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/starbao/turn", () => {
  beforeEach(() => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("persists a canonical user turn, generates a reply, and marks it for OrangePi speech", async () => {
    vi.mocked(getChatModel).mockReturnValue("deepseek-model" as never);
    vi.mocked(getStarbaoSnapshot).mockResolvedValue({
      conversation,
      messages: [earlierMessage],
      latestSequence: 7,
    });
    vi.mocked(appendStarbaoMessage)
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantMessage);
    vi.mocked(generateText).mockResolvedValue({ text: assistantMessage.content } as never);

    const response = await POST(turnRequest({
      clientMessageId: "web-turn-1",
      text: userMessage.content,
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      conversation: {
        conversationId: "conv-1",
        speakOnOrangePi: true,
      },
      userMessage: {
        messageId: "message-8",
        clientMessageId: "web-turn-1",
      },
      assistantMessage: {
        messageId: "message-9",
        announceOnOrangePi: true,
      },
      latestSequence: 9,
    });
    expect(appendStarbaoMessage).toHaveBeenNthCalledWith(1, {
      clientMessageId: "web-turn-1",
      role: "user",
      origin: "web",
      content: "What should I try next?",
      announceOnOrangePi: false,
    });
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: "deepseek-model",
      instructions: expect.stringContaining("Mambo"),
      messages: expect.arrayContaining([
        { role: "assistant", content: "Let's keep exploring." },
        { role: "user", content: "What should I try next?" },
      ]),
      maxOutputTokens: 120,
      maxRetries: 0,
      providerOptions: { deepseek: { thinking: { type: "disabled" } } },
    }));
    expect(appendStarbaoMessage).toHaveBeenNthCalledWith(2, {
      clientMessageId: "web-turn-1:assistant",
      role: "assistant",
      origin: "starbao",
      content: assistantMessage.content,
      replyToMessageId: "message-8",
      announceOnOrangePi: true,
    });
  });

  it("returns an already persisted assistant reply without calling the model again", async () => {
    vi.mocked(getStarbaoSnapshot).mockResolvedValue({
      conversation,
      messages: [userMessage, assistantMessage],
      latestSequence: 9,
    });
    vi.mocked(appendStarbaoMessage).mockResolvedValue(userMessage);

    const response = await POST(turnRequest({
      clientMessageId: "web-turn-1",
      text: userMessage.content,
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ assistantMessage: { messageId: "message-9" } });
    expect(generateText).not.toHaveBeenCalled();
    expect(appendStarbaoMessage).toHaveBeenCalledTimes(1);
  });

  it("preserves an OrangePi microphone origin in the canonical user event", async () => {
    vi.mocked(getChatModel).mockReturnValue("deepseek-model" as never);
    vi.mocked(getStarbaoSnapshot).mockResolvedValue({
      conversation,
      messages: [],
      latestSequence: 7,
    });
    vi.mocked(appendStarbaoMessage)
      .mockResolvedValueOnce({ ...userMessage, origin: "asr" })
      .mockResolvedValueOnce(assistantMessage);
    vi.mocked(generateText).mockResolvedValue({ text: assistantMessage.content } as never);

    const response = await POST(turnRequest({
      clientMessageId: "web-turn-1",
      text: userMessage.content,
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      origin: "asr",
    }));

    expect(response.status).toBe(200);
    expect(appendStarbaoMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ origin: "asr" }));
  });

  it("keeps a reply to an OrangePi-originated turn playable even when remote broadcast is off", async () => {
    vi.mocked(getChatModel).mockReturnValue("deepseek-model" as never);
    vi.mocked(getStarbaoSnapshot).mockResolvedValue({
      conversation: { ...conversation, speak_on_orangepi: false },
      messages: [],
      latestSequence: 7,
    });
    vi.mocked(appendStarbaoMessage)
      .mockResolvedValueOnce({ ...userMessage, origin: "orangepi" })
      .mockResolvedValueOnce(assistantMessage);
    vi.mocked(generateText).mockResolvedValue({ text: assistantMessage.content } as never);

    const response = await POST(turnRequest({
      clientMessageId: "orangepi-turn-1",
      text: userMessage.content,
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      origin: "orangepi",
    }));

    expect(response.status).toBe(200);
    expect(appendStarbaoMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      announceOnOrangePi: true,
    }));
  });

  it("starts the idempotent user write while the snapshot loads without duplicating it in model history", async () => {
    vi.mocked(getChatModel).mockReturnValue("deepseek-model" as never);
    let resolveSnapshot: ((value: {
      conversation: typeof conversation;
      messages: typeof userMessage[];
      latestSequence: number;
    }) => void) | undefined;
    let notifyUserWriteStarted: (() => void) | undefined;
    const snapshot = new Promise<{
      conversation: typeof conversation;
      messages: typeof userMessage[];
      latestSequence: number;
    }>((resolve) => {
      resolveSnapshot = resolve;
    });
    const userWriteStarted = new Promise<void>((resolve) => {
      notifyUserWriteStarted = resolve;
    });
    vi.mocked(getStarbaoSnapshot).mockReturnValue(snapshot);
    vi.mocked(appendStarbaoMessage)
      .mockImplementationOnce(async () => {
        notifyUserWriteStarted?.();
        return userMessage;
      })
      .mockResolvedValueOnce(assistantMessage);
    vi.mocked(generateText).mockResolvedValue({ text: assistantMessage.content } as never);

    const pending = POST(turnRequest({
      clientMessageId: "web-turn-1",
      text: userMessage.content,
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
    }));
    await userWriteStarted;

    expect(appendStarbaoMessage).toHaveBeenCalledWith(expect.objectContaining({
      clientMessageId: "web-turn-1",
      role: "user",
    }));

    resolveSnapshot?.({
      conversation,
      messages: [userMessage],
      latestSequence: userMessage.sequence,
    });

    const response = await pending;

    expect(response.status).toBe(200);
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{ role: "user", content: userMessage.content }],
    }));
  });

  it("rejects an invalid course-stage pairing before writing a message", async () => {
    const response = await POST(turnRequest({
      clientMessageId: "web-turn-1",
      text: userMessage.content,
      stage: "high_school",
      courseId: "lower-bubble-sort",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_STARBAO_TURN" });
    expect(getStarbaoSnapshot).not.toHaveBeenCalled();
    expect(appendStarbaoMessage).not.toHaveBeenCalled();
  });
});
