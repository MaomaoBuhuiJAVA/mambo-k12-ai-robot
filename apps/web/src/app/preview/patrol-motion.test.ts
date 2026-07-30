import { describe, expect, it } from "vitest";

import { PATROL_CYCLE_MS, resolvePatrolMotionState } from "./patrol-motion";

describe("resolvePatrolMotionState", () => {
  it("shows the walk sheet for both moving legs and mirrors only the return leg", () => {
    expect(resolvePatrolMotionState(0)).toEqual({ state: "idle", direction: "right" });
    expect(resolvePatrolMotionState(4_319)).toEqual({ state: "idle", direction: "right" });

    expect(resolvePatrolMotionState(4_320)).toEqual({ state: "moving", direction: "right" });
    expect(resolvePatrolMotionState(6_479)).toEqual({ state: "moving", direction: "right" });

    expect(resolvePatrolMotionState(6_480)).toEqual({ state: "idle", direction: "right" });
    expect(resolvePatrolMotionState(9_719)).toEqual({ state: "idle", direction: "right" });

    expect(resolvePatrolMotionState(9_720)).toEqual({ state: "moving", direction: "left" });
    expect(resolvePatrolMotionState(11_879)).toEqual({ state: "moving", direction: "left" });

    expect(resolvePatrolMotionState(11_880)).toEqual({ state: "idle", direction: "right" });
  });

  it("keeps its state transitions aligned across repeat cycles", () => {
    expect(resolvePatrolMotionState(PATROL_CYCLE_MS + 4_320)).toEqual({ state: "moving", direction: "right" });
    expect(resolvePatrolMotionState(PATROL_CYCLE_MS + 9_720)).toEqual({ state: "moving", direction: "left" });
  });
});
