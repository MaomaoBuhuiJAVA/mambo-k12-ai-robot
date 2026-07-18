import { describe, expect, it } from "vitest";

import {
  conversationStorageKey,
  loadConversation,
  saveConversation,
} from "./conversation-store";

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("conversation store", () => {
  it("round-trips only bounded text turns and strips image data", () => {
    const storage = memoryStorage();
    expect(saveConversation("lower-bubble-sort", [
      { id: "u-1", author: "learner", text: "看看这张图", image: "data:image/png;base64,AAAA" },
      { id: "a-1", author: "assistant", text: "我看到了相邻的数字。" },
    ], storage)).toBe(true);

    expect(loadConversation("lower-bubble-sort", storage)).toEqual([
      { id: "u-1", author: "learner", text: "看看这张图" },
      { id: "a-1", author: "assistant", text: "我看到了相邻的数字。" },
    ]);
    expect(storage.getItem(conversationStorageKey("lower-bubble-sort"))).not.toContain("data:image");
  });

  it("rejects malformed data and drops an incomplete trailing turn", () => {
    const key = conversationStorageKey("lower-bubble-sort");
    const malformed = memoryStorage({ [key]: JSON.stringify({ token: "leak" }) });
    expect(loadConversation("lower-bubble-sort", malformed)).toEqual([]);

    const incomplete = memoryStorage({
      [key]: JSON.stringify([
        { id: "u-1", author: "learner", text: "第一问" },
        { id: "a-1", author: "assistant", text: "第一答" },
        { id: "u-2", author: "learner", text: "尚未回答" },
      ]),
    });
    expect(loadConversation("lower-bubble-sort", incomplete)).toHaveLength(2);
  });

  it("isolates courses and fails safely when storage is blocked", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(loadConversation("lower-bubble-sort", blocked)).toEqual([]);
    expect(saveConversation("lower-bubble-sort", [], blocked)).toBe(false);
    expect(conversationStorageKey("lower-bubble-sort")).not.toBe(conversationStorageKey("middle-neural-network"));
  });
});
