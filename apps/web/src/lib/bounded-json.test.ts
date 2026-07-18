import { afterEach, describe, expect, it, vi } from "vitest";

import { readBoundedJson } from "./bounded-json";

afterEach(() => {
  vi.useRealTimers();
});

describe("readBoundedJson", () => {
  it("cancels a pending reader when the supplied deadline aborts", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const controller = new AbortController();
    const pending = readBoundedJson(request, 1024, controller.signal);

    controller.abort(new DOMException("deadline", "TimeoutError"));

    await expect(pending).resolves.toBeUndefined();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
