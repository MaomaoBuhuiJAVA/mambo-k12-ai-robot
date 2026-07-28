import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/starbao-core", () => ({
  appendStarbaoMessage: vi.fn(),
}));

import { appendStarbaoMessage } from "@/lib/starbao-core";

import { POST } from "./route";

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

describe("POST /api/starbao/messages", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists a browser user message with its client idempotency key", async () => {
    vi.mocked(appendStarbaoMessage).mockResolvedValue(message);

    const response = await POST(new Request("http://localhost/api/starbao/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientMessageId: "web-message-4",
        content: "Explain the next step",
        origin: "web",
      }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      message: {
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
      },
    });
    expect(appendStarbaoMessage).toHaveBeenCalledWith({
      clientMessageId: "web-message-4",
      role: "user",
      origin: "web",
      content: "Explain the next step",
      announceOnOrangePi: false,
    });
  });

  it("does not let a browser write an assistant or system message", async () => {
    const response = await POST(new Request("http://localhost/api/starbao/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientMessageId: "web-message-4",
        role: "assistant",
        origin: "starbao",
        content: "Pretend this came from the assistant",
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_STARBAO_MESSAGE" });
    expect(appendStarbaoMessage).not.toHaveBeenCalled();
  });
});
