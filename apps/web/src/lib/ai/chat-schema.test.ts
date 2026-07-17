import { describe, expect, it } from "vitest";

import { chatRequestSchema, toModelMessages } from "./chat-schema";

const validRequest = {
  stage: "lower_primary",
  courseId: "lower-bubble-sort",
  messages: [{ role: "user", content: "我想学排序" }],
};

describe("chatRequestSchema", () => {
  it("accepts a matching curriculum course", () => {
    expect(chatRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects missing courses and courses from another stage", () => {
    expect(chatRequestSchema.safeParse({ ...validRequest, courseId: "missing" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...validRequest, stage: "high_school" }).success).toBe(false);
  });

  it("enforces message count, per-message content, and aggregate content limits", () => {
    expect(chatRequestSchema.safeParse({ ...validRequest, messages: [] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...validRequest, messages: Array.from({ length: 21 }, () => validRequest.messages[0]) }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...validRequest, messages: [{ role: "user", content: "" }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...validRequest, messages: [{ role: "user", content: "a".repeat(4001) }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...validRequest, messages: Array.from({ length: 20 }, () => ({ role: "user", content: "a".repeat(1001) })) }).success).toBe(false);
  });

  it("allows supported images up to four MiB and converts them to AI SDK file parts", () => {
    const image = "data:image/png;base64,aGVsbG8=";
    const parsed = chatRequestSchema.parse({ ...validRequest, messages: [{ role: "user", content: "看图", image }] });

    expect(toModelMessages(parsed)).toEqual([{ role: "user", content: [{ type: "text", text: "看图" }, { type: "file", mediaType: "image/png", data: image }] }]);
  });

  it("rejects unsupported, malformed, and oversized image data URLs", () => {
    expect(chatRequestSchema.safeParse({ ...validRequest, messages: [{ role: "user", content: "x", image: "data:image/gif;base64,aGVsbG8=" }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...validRequest, messages: [{ role: "user", content: "x", image: "data:image/png;base64,%%%" }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...validRequest, messages: [{ role: "user", content: "x", image: `data:image/jpeg;base64,${"A".repeat(4 * 1024 * 1024 * 2)}` }] }).success).toBe(false);
  });
});
