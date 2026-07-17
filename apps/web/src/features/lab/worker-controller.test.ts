import { describe, expect, it, vi } from "vitest";

import type { LabWorkerResponse } from "./lab-protocol";
import type {
  LabRuntimeTransport,
  RuntimeTransportHandlers,
} from "./runtime-transport";
import { PyodideWorkerController } from "./worker-controller";

class FakeTransport implements LabRuntimeTransport {
  static instances: FakeTransport[] = [];
  handlers: RuntimeTransportHandlers | null = null;
  posted: unknown[] = [];
  destroyed = false;

  constructor() {
    FakeTransport.instances.push(this);
  }

  start(handlers: RuntimeTransportHandlers) {
    this.handlers = handlers;
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  destroy() {
    this.destroyed = true;
  }

  emit(message: LabWorkerResponse) {
    this.handlers?.onMessage(message);
  }

  fail(message = "runtime unavailable") {
    this.handlers?.onError(message);
  }
}

function createController() {
  FakeTransport.instances = [];
  return new PyodideWorkerController(() => new FakeTransport());
}

const validInput = {
  templateId: "bubble-sort" as const,
  challengeVersion: 1,
  code: "print(1)",
  timeoutMs: 1_000,
};

describe("PyodideWorkerController", () => {
  it("resolves a matching result and reports status changes", async () => {
    const controller = createController();
    const statuses: string[] = [];
    controller.subscribe((status) => statuses.push(status));
    const runtime = FakeTransport.instances[0];
    runtime.emit({ type: "ready" });

    const promise = controller.run(validInput);
    const request = runtime.posted[0] as { id: string };
    runtime.emit({ type: "running", id: request.id });
    runtime.emit({
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

  it("destroys and rebuilds the isolated runtime after timeout", async () => {
    vi.useFakeTimers();
    const controller = createController();
    const promise = controller.run({ ...validInput, code: "while True: pass", timeoutMs: 500 });
    const first = FakeTransport.instances[0];

    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toMatchObject({ type: "error", category: "timeout" });
    expect(first.destroyed).toBe(true);
    expect(FakeTransport.instances).toHaveLength(2);
    vi.useRealTimers();
  });

  it("stops a running job and rebuilds the isolated runtime", async () => {
    const controller = createController();
    const promise = controller.run({ ...validInput, templateId: "image-classifier" });
    const first = FakeTransport.instances[0];

    controller.stop();

    await expect(promise).resolves.toMatchObject({ type: "error", category: "cancelled" });
    expect(first.destroyed).toBe(true);
    expect(FakeTransport.instances).toHaveLength(2);
  });

  it("ignores a stale response after rebuilding the runtime", async () => {
    const controller = createController();
    const firstPromise = controller.run(validInput);
    const firstRuntime = FakeTransport.instances[0];
    const firstRequest = firstRuntime.posted[0] as { id: string };
    controller.stop();
    await firstPromise;

    const secondPromise = controller.run({ ...validInput, code: "print(2)" });
    const secondRuntime = FakeTransport.instances[1];
    const secondRequest = secondRuntime.posted[0] as { id: string };

    firstRuntime.emit({
      type: "result",
      id: firstRequest.id,
      durationMs: 1,
      passed: true,
      output: [],
    });
    secondRuntime.emit({
      type: "result",
      id: secondRequest.id,
      durationMs: 2,
      passed: false,
      output: [],
    });

    await expect(secondPromise).resolves.toMatchObject({ passed: false });
  });

  it("does not loop after initialization failure and retries only on request", () => {
    const controller = createController();
    const first = FakeTransport.instances[0];

    first.emit({
      type: "error",
      id: null,
      category: "runtime",
      message: "CDN unavailable",
      output: [],
    });

    expect(first.destroyed).toBe(true);
    expect(controller.getStatus()).toBe("error");
    expect(FakeTransport.instances).toHaveLength(1);

    controller.initialize();
    expect(FakeTransport.instances).toHaveLength(2);
    expect(controller.getStatus()).toBe("loading");
  });

  it("stops a runtime that never becomes ready and waits for explicit retry", async () => {
    vi.useFakeTimers();
    const controller = createController();
    const first = FakeTransport.instances[0];

    await vi.advanceTimersByTimeAsync(30_000);

    expect(first.destroyed).toBe(true);
    expect(controller.getStatus()).toBe("error");
    expect(FakeTransport.instances).toHaveLength(1);

    controller.initialize();
    expect(FakeTransport.instances).toHaveLength(2);
    vi.useRealTimers();
  });

  it("stays stopped after a transport error without a pending run", () => {
    const controller = createController();
    const first = FakeTransport.instances[0];

    first.fail("network failure");

    expect(first.destroyed).toBe(true);
    expect(controller.getStatus()).toBe("error");
    expect(FakeTransport.instances).toHaveLength(1);
  });

  it("returns invalid code as a terminal validation response without entering running", async () => {
    const controller = createController();
    const runtime = FakeTransport.instances[0];
    runtime.emit({ type: "ready" });

    await expect(
      controller.run({ ...validInput, code: "x".repeat(20_001) }),
    ).resolves.toMatchObject({ type: "error", category: "validation" });

    expect(controller.getStatus()).toBe("ready");
    expect(runtime.posted).toHaveLength(0);
  });

  it("disposes the isolated runtime on teardown", () => {
    const controller = createController();
    const runtime = FakeTransport.instances[0];

    controller.dispose();

    expect(runtime.destroyed).toBe(true);
  });
});
