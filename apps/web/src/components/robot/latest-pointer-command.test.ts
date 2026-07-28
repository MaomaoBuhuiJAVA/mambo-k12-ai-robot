import { describe, expect, it, vi } from "vitest";

import { LatestPointerCommand, type PointerPoint } from "./latest-pointer-command";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe("LatestPointerCommand", () => {
  it("sends the first point and then only the newest point received while it is in flight", async () => {
    const firstSend = deferred<void>();
    const sent: PointerPoint[] = [];
    const queue = new LatestPointerCommand(async (point) => {
      sent.push(point);
      if (sent.length === 1) {
        await firstSend.promise;
      }
    });
    const a = { x: 0.1, y: 0.2 };
    const b = { x: 0.3, y: 0.4 };
    const c = { x: 0.5, y: 0.6 };

    queue.submit(a);
    queue.submit(b);
    queue.submit(c);

    expect(sent).toEqual([a]);

    firstSend.resolve();
    await queue.idle();

    expect(sent).toEqual([a, c]);
  });

  it("drains the newest pending point after a sender rejection", async () => {
    const firstSend = deferred<void>();
    const sent: PointerPoint[] = [];
    const queue = new LatestPointerCommand((point) => {
      sent.push(point);
      return sent.length === 1 ? firstSend.promise : Promise.resolve();
    });
    const a = { x: 0.1, y: 0.2 };
    const b = { x: 0.3, y: 0.4 };

    queue.submit(a);
    queue.submit(b);
    firstSend.reject(new Error("sender unavailable"));

    await Promise.resolve();

    expect(sent).toEqual([a, b]);
    await queue.idle();
  });

  it("discards an unsent pending point when disposed", async () => {
    const firstSend = deferred<void>();
    const sent: PointerPoint[] = [];
    const queue = new LatestPointerCommand(async (point) => {
      sent.push(point);
      if (sent.length === 1) {
        await firstSend.promise;
      }
    });
    const a = { x: 0.1, y: 0.2 };
    const b = { x: 0.3, y: 0.4 };

    queue.submit(a);
    queue.submit(b);
    queue.dispose();
    firstSend.resolve();

    await queue.idle();

    expect(sent).toEqual([a]);
  });

  it("moves to the final click point before clicking and drops stale moves during the barrier", async () => {
    const firstMove = deferred<void>();
    const finalMove = deferred<void>();
    const events: string[] = [];
    const queue = new LatestPointerCommand(async (point) => {
      events.push(`move:${point.x}`);
      if (point.x === 0.1) await firstMove.promise;
      if (point.x === 0.5) await finalMove.promise;
    });

    queue.submit({ x: 0.1, y: 0.1 });
    queue.submit({ x: 0.3, y: 0.3 });
    const click = queue.moveThenRun({ x: 0.5, y: 0.5 }, async () => {
      events.push("click");
    });
    queue.submit({ x: 0.8, y: 0.8 });

    expect(events).toEqual(["move:0.1"]);

    firstMove.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toEqual(["move:0.1", "move:0.5"]);

    finalMove.resolve();
    await click;

    expect(events).toEqual(["move:0.1", "move:0.5", "click"]);
  });

  it("does not click when the final physical move fails", async () => {
    const click = vi.fn(async () => undefined);
    const queue = new LatestPointerCommand(async () => false);

    await expect(queue.moveThenRun({ x: 0.5, y: 0.5 }, click)).resolves.toBe(false);

    expect(click).not.toHaveBeenCalled();
  });

  it("does not click after reset or stop cancels an in-flight final move", async () => {
    const finalMove = deferred<void>();
    const click = vi.fn(async () => undefined);
    const queue = new LatestPointerCommand(async () => {
      await finalMove.promise;
      return true;
    });

    const run = queue.moveThenRun({ x: 0.5, y: 0.5 }, click);
    queue.cancelBarrier();
    finalMove.resolve();

    await expect(run).resolves.toBe(false);
    expect(click).not.toHaveBeenCalled();
  });
});
