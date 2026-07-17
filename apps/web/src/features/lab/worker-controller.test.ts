import { describe, expect, it, vi } from "vitest";

import type { LabWorkerResponse } from "./lab-protocol";
import { PyodideWorkerController } from "./worker-controller";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(message: LabWorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }
}

function createController() {
  FakeWorker.instances = [];
  return new PyodideWorkerController(() => new FakeWorker() as unknown as Worker);
}

describe("PyodideWorkerController", () => {
  it("resolves a matching result and reports status changes", async () => {
    const controller = createController();
    const statuses: string[] = [];
    controller.subscribe((status) => statuses.push(status));

    const promise = controller.run({
      templateId: "bubble-sort",
      code: "print(1)",
      timeoutMs: 1_000,
    });
    const worker = FakeWorker.instances[0];
    const request = worker.posted[0] as { id: string };
    worker.emit({ type: "running", id: request.id });
    worker.emit({
      type: "result",
      id: request.id,
      durationMs: 10,
      passed: true,
      output: [{ stream: "stdout", text: "1" }],
    });

    await expect(promise).resolves.toMatchObject({ type: "result", passed: true });
    expect(statuses).toContain("running");
    expect(controller.getStatus()).toBe("ready");
  });

  it("terminates and rebuilds the worker after timeout", async () => {
    vi.useFakeTimers();
    const controller = createController();
    const promise = controller.run({
      templateId: "bubble-sort",
      code: "while True: pass",
      timeoutMs: 500,
    });
    const first = FakeWorker.instances[0];

    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toMatchObject({
      type: "error",
      category: "timeout",
    });
    expect(first.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
    vi.useRealTimers();
  });

  it("stops a running job, clears it and rebuilds the worker", async () => {
    const controller = createController();
    const promise = controller.run({
      templateId: "image-classifier",
      code: "print(1)",
      timeoutMs: 2_000,
    });
    const first = FakeWorker.instances[0];

    controller.stop();

    await expect(promise).resolves.toMatchObject({
      type: "error",
      category: "cancelled",
    });
    expect(first.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("ignores a stale response after a worker rebuild", async () => {
    const controller = createController();
    const firstPromise = controller.run({
      templateId: "bubble-sort",
      code: "print(1)",
      timeoutMs: 2_000,
    });
    const firstWorker = FakeWorker.instances[0];
    const firstRequest = firstWorker.posted[0] as { id: string };
    controller.stop();
    await firstPromise;

    const secondPromise = controller.run({
      templateId: "bubble-sort",
      code: "print(2)",
      timeoutMs: 2_000,
    });
    const secondWorker = FakeWorker.instances[1];
    const secondRequest = secondWorker.posted[0] as { id: string };

    secondWorker.emit({
      type: "result",
      id: firstRequest.id,
      durationMs: 1,
      passed: true,
      output: [],
    });
    secondWorker.emit({
      type: "result",
      id: secondRequest.id,
      durationMs: 2,
      passed: false,
      output: [],
    });

    await expect(secondPromise).resolves.toMatchObject({ passed: false });
  });

  it("does not loop when initialization fails and retries only on request", () => {
    const controller = createController();
    const first = FakeWorker.instances[0];

    first.emit({
      type: "error",
      id: null,
      category: "runtime",
      message: "CDN unavailable",
      output: [],
    });

    expect(first.terminated).toBe(true);
    expect(controller.getStatus()).toBe("error");
    expect(FakeWorker.instances).toHaveLength(1);

    controller.initialize();
    expect(FakeWorker.instances).toHaveLength(2);
    expect(controller.getStatus()).toBe("loading");
  });

  it("stays stopped after a worker error without a pending run", () => {
    const controller = createController();
    const first = FakeWorker.instances[0];

    first.onerror?.({ message: "network failure" } as ErrorEvent);

    expect(first.terminated).toBe(true);
    expect(controller.getStatus()).toBe("error");
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("tells the learner to retry after a worker crash during a run", async () => {
    const controller = createController();
    const promise = controller.run({
      templateId: "bubble-sort",
      code: "print(1)",
      timeoutMs: 2_000,
    });

    FakeWorker.instances[0].onerror?.({ message: "crash" } as ErrorEvent);

    await expect(promise).resolves.toMatchObject({
      type: "error",
      category: "runtime",
      message: expect.stringContaining("点击重试"),
    });
    expect(controller.getStatus()).toBe("error");
  });
});
