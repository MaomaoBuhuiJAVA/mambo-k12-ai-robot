import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendLocalStarbaoMessage,
  getLocalStarbaoSnapshot,
  isLocalStarbaoChatEnabled,
  resetLocalStarbaoChatForTests,
  updateLocalStarbaoSpeakerSetting,
} from "./local-starbao-chat";

describe("local Starbao chat store", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetLocalStarbaoChatForTests();
  });

  it("is enabled only outside production when explicitly requested", () => {
    vi.stubEnv("LOCAL_AI_CHAT", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(isLocalStarbaoChatEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalStarbaoChatEnabled()).toBe(false);
  });

  it("keeps an ordered idempotent local conversation", async () => {
    const first = await appendLocalStarbaoMessage({
      clientMessageId: "local-user-1",
      role: "user",
      origin: "web",
      content: "Hello Starbao",
      announceOnOrangePi: false,
    });
    const duplicate = await appendLocalStarbaoMessage({
      clientMessageId: "local-user-1",
      role: "user",
      origin: "web",
      content: "A different retry body",
      announceOnOrangePi: false,
    });
    const second = await appendLocalStarbaoMessage({
      clientMessageId: "local-assistant-1",
      role: "assistant",
      origin: "starbao",
      content: "Hello! What would you like to explore?",
      replyToMessageId: first.message_id,
      announceOnOrangePi: false,
    });

    expect(duplicate).toEqual(first);
    expect(second.sequence).toBe(2);

    const snapshot = await getLocalStarbaoSnapshot({ after: 1, limit: 10 });
    expect(snapshot.conversation.latest_sequence).toBe(2);
    expect(snapshot.latestSequence).toBe(2);
    expect(snapshot.messages).toEqual([second]);
  });

  it("updates the local speaker preference without involving an OrangePi", async () => {
    const conversation = await updateLocalStarbaoSpeakerSetting(true);

    expect(conversation).toMatchObject({
      conversation_id: "local-web-preview",
      device_id: "local-browser",
      speak_on_orangepi: true,
      latest_sequence: 0,
    });
  });
});