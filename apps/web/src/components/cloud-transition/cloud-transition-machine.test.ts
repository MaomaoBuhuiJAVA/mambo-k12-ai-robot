import { describe, expect, it } from "vitest";

import {
  initialCloudTransitionState,
  transitionCloudState,
} from "./cloud-transition-machine";

describe("cloud transition state machine", () => {
  it("requires a covered hold and map readiness before revealing", () => {
    const covering = transitionCloudState(initialCloudTransitionState, { type: "START" });
    const holding = transitionCloudState(covering, { type: "COVERED" });
    const readyButHolding = transitionCloudState(holding, { type: "MAP_READY" });
    const revealing = transitionCloudState(readyButHolding, { type: "MINIMUM_HOLD_ELAPSED" });

    expect(covering.phase).toBe("covering");
    expect(holding.phase).toBe("holding");
    expect(readyButHolding.phase).toBe("holding");
    expect(revealing.phase).toBe("revealing");
  });

  it("reveals after the maximum hold even when the map-ready signal never arrives", () => {
    const holding = transitionCloudState(
      transitionCloudState(initialCloudTransitionState, { type: "START" }),
      { type: "COVERED" },
    );

    expect(transitionCloudState(holding, { type: "MAXIMUM_HOLD_ELAPSED" }).phase).toBe("revealing");
  });

  it("ignores duplicate starts and returns to idle after the reveal", () => {
    const covering = transitionCloudState(initialCloudTransitionState, { type: "START" });

    expect(transitionCloudState(covering, { type: "START" })).toEqual(covering);
    expect(
      transitionCloudState(
        { phase: "revealing", mapReady: true, minimumHoldElapsed: true },
        { type: "REVEAL_FINISHED" },
      ),
    ).toEqual(initialCloudTransitionState);
  });
});
