import { describe, expect, it } from "vitest";

import {
  MAX_CODE_LENGTH,
  parseRunRequest,
  parseWorkerResponse,
  toSafeLabError,
} from "./lab-protocol";

const validRequest = {
  type: "run" as const,
  id: "550e8400-e29b-41d4-a716-446655440000",
  templateId: "bubble-sort" as const,
  challengeVersion: 1,
  code: "print(1)",
  timeoutMs: 4_000,
};

describe("lab worker protocol", () => {
  it("accepts a bounded run request", () => {
    expect(parseRunRequest(validRequest)).toEqual(validRequest);
  });

  it("rejects a request above the execution limit", () => {
    expect(() =>
      parseRunRequest({ ...validRequest, timeoutMs: 30_000 }),
    ).toThrow();
  });

  it("rejects empty or oversized code and unknown templates", () => {
    expect(() => parseRunRequest({ ...validRequest, code: "" })).toThrow();
    expect(() =>
      parseRunRequest({ ...validRequest, code: "x".repeat(MAX_CODE_LENGTH + 1) }),
    ).toThrow();
    expect(() =>
      parseRunRequest({ ...validRequest, templateId: "shell" }),
    ).toThrow();
  });

  it("parses ready, running, result and error responses", () => {
    expect(parseWorkerResponse({ type: "ready" }).type).toBe("ready");
    expect(
      parseWorkerResponse({ type: "running", id: validRequest.id }).type,
    ).toBe("running");
    expect(
      parseWorkerResponse({
        type: "result",
        id: validRequest.id,
        durationMs: 24,
        passed: true,
        output: [{ stream: "stdout", text: "ok" }],
      }).type,
    ).toBe("result");
    expect(
      parseWorkerResponse({
        type: "error",
        id: validRequest.id,
        category: "python",
        message: "NameError",
        line: 3,
        output: [],
      }).type,
    ).toBe("error");
    expect(
      parseWorkerResponse({
        type: "error",
        id: null,
        category: "runtime",
        message: "Python 初始化失败",
        output: [],
      }).type,
    ).toBe("error");
  });

  it("sanitizes long exceptions and extracts a Python line number", () => {
    const error = toSafeLabError(
      new Error(`Traceback (most recent call last):\n  File \"<exec>\", line 12\n${"x".repeat(4_000)}`),
    );

    expect(error.message.length).toBeLessThanOrEqual(1_000);
    expect(error.line).toBe(12);
  });
});
