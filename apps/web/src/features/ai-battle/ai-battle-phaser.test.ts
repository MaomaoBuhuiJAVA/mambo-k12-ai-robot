import { describe, expect, it, vi } from "vitest";

import {
  calculateStarbaoEntranceX,
  createArenaEventQueue,
  createEntranceCompletionTracker,
} from "./ai-battle-phaser";

describe("calculateStarbaoEntranceX", () => {
  it("keeps Starbao's padded entrance source off the left edge until its travel begins", () => {
    const displayWidth = 336;
    const targetX = 307;
    const duration = 4.69;

    expect(calculateStarbaoEntranceX({ currentTime: 0.72, duration, displayWidth, targetX })).toBeLessThan(0);
    expect(calculateStarbaoEntranceX({ currentTime: duration, duration, displayWidth, targetX })).toBe(targetX);
  });
});

describe("createArenaEventQueue", () => {
  it("delivers a queued entrance request when the Phaser scene becomes ready", () => {
    const queue = createArenaEventQueue();
    const emit = vi.fn();

    queue.emit("begin");
    queue.ready(emit);

    expect(emit).toHaveBeenCalledWith("begin");
  });
});

describe("createEntranceCompletionTracker", () => {
  it("notifies only after both character entrances finish", () => {
    const onComplete = vi.fn();
    const tracker = createEntranceCompletionTracker(onComplete);

    tracker.playerFinished();

    expect(onComplete).not.toHaveBeenCalled();

    tracker.enemyFinished();
    tracker.playerFinished();

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("discards a partial entrance when a new round resets the arena", () => {
    const onComplete = vi.fn();
    const tracker = createEntranceCompletionTracker(onComplete);

    tracker.playerFinished();
    tracker.reset();
    tracker.enemyFinished();

    expect(onComplete).not.toHaveBeenCalled();

    tracker.playerFinished();

    expect(onComplete).toHaveBeenCalledOnce();
  });
});
