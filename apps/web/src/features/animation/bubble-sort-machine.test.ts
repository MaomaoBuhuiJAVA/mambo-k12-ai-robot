import { describe, expect, it } from "vitest";

import {
  createBubbleSortMachine,
  nextBubbleSortFrame,
  resetBubbleSortMachine,
} from "./bubble-sort-machine";

describe("bubble-sort animation machine", () => {
  it("moves the largest item to the final position after one complete pass", () => {
    let state = createBubbleSortMachine([4, 1, 3, 2]);

    for (let index = 0; index < 3; index += 1) {
      state = nextBubbleSortFrame(state);
    }

    expect(state.values).toEqual([1, 3, 2, 4]);
    expect(state.pass).toBe(1);
    expect(state.sortedFrom).toBe(3);
    expect(state.comparisons).toBe(3);
    expect(state.swaps).toBe(3);
    expect(state.lastComparedIndexes).toEqual([2, 3]);
  });

  it("replays deterministically and resets to its original values", () => {
    const first = createBubbleSortMachine([3, 2, 1]);
    const second = createBubbleSortMachine([3, 2, 1]);

    expect(nextBubbleSortFrame(first)).toEqual(nextBubbleSortFrame(second));

    const progressed = nextBubbleSortFrame(nextBubbleSortFrame(first));
    expect(resetBubbleSortMachine(progressed)).toEqual(first);
  });
});
