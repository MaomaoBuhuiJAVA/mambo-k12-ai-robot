import { describe, expect, it } from "vitest";

import {
  initialCloudTransitionState,
  transitionCloudState,
} from "./cloud-transition-machine";

describe("cloud transition state machine", () => {
  it("requires a covered hold and map readiness before revealing", () => {
    const covering = transitionCloudState(initialCloudTransitionState, { type: "START", destination: "map" });
    const holding = transitionCloudState(covering, { type: "COVERED" });
    const readyButHolding = transitionCloudState(holding, { type: "PAGE_READY", destination: "map" });
    const revealing = transitionCloudState(readyButHolding, { type: "MINIMUM_HOLD_ELAPSED" });

    expect(covering.phase).toBe("covering");
    expect(holding.phase).toBe("holding");
    expect(readyButHolding.phase).toBe("holding");
    expect(revealing.phase).toBe("revealing");
  });

  it("reveals after the maximum hold even when the map-ready signal never arrives", () => {
    const holding = transitionCloudState(
      transitionCloudState(initialCloudTransitionState, { type: "START", destination: "map" }),
      { type: "COVERED" },
    );

    expect(transitionCloudState(holding, { type: "MAXIMUM_HOLD_ELAPSED" }).phase).toBe("revealing");
  });

  it("ignores duplicate starts and returns to idle after the reveal", () => {
    const covering = transitionCloudState(initialCloudTransitionState, { type: "START", destination: "map" });

    expect(transitionCloudState(covering, { type: "START", destination: "home" })).toEqual(covering);
    expect(
      transitionCloudState(
        { phase: "revealing", destination: "home", pageReady: true, minimumHoldElapsed: true },
        { type: "REVEAL_FINISHED" },
      ),
    ).toEqual(initialCloudTransitionState);
  });

  it("routes the reverse transition to the home page after it is covered", () => {
    const covering = transitionCloudState(initialCloudTransitionState, { type: "START", destination: "home" });
    const holding = transitionCloudState(covering, { type: "COVERED" });
    const readyButHolding = transitionCloudState(holding, { type: "PAGE_READY", destination: "home" });
    const revealing = transitionCloudState(readyButHolding, { type: "MINIMUM_HOLD_ELAPSED" });

    expect(covering.destination).toBe("home");
    expect(holding.phase).toBe("holding");
    expect(readyButHolding.phase).toBe("holding");
    expect(revealing.phase).toBe("revealing");
  });
});
