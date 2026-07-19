import { describe, expect, it } from "vitest";

import { GestureController, type GestureObservation } from "./gesture-controller";

function observation(overrides: Partial<GestureObservation> = {}): GestureObservation {
  return {
    gesture: "open_palm",
    x: 0.5,
    y: 0.5,
    confidence: 0.95,
    timestamp: 0,
    ...overrides,
  };
}

describe("GestureController", () => {
  it("smooths an open palm into a normalized cursor position", () => {
    const controller = new GestureController({ smoothing: 1 });

    expect(controller.update(observation({ x: 0.2, y: 0.8 }))).toEqual([
      { type: "cursor_move", x: 0.2, y: 0.8 },
      { type: "progress", value: 0 },
    ]);
  });

  it("confirms one click after the fist dwell threshold", () => {
    const controller = new GestureController({ dwellMs: 1200, smoothing: 1 });
    controller.update(observation({ x: 0.4, y: 0.6, timestamp: 10 }));

    expect(controller.update(observation({ gesture: "fist", timestamp: 100 }))).toEqual([
      { type: "progress", value: 0 },
    ]);
    expect(controller.update(observation({ gesture: "fist", timestamp: 700 }))).toEqual([
      { type: "progress", value: 0.5 },
    ]);
    expect(controller.update(observation({ gesture: "fist", timestamp: 1300 }))).toEqual([
      { type: "progress", value: 1 },
      { type: "click", x: 0.4, y: 0.6 },
    ]);
    expect(controller.update(observation({ gesture: "fist", timestamp: 1800 }))).toEqual([]);
  });

  it("cancels a pending click when tracking is lost", () => {
    const controller = new GestureController({ dwellMs: 1200, smoothing: 1 });
    controller.update(observation({ timestamp: 0 }));
    controller.update(observation({ gesture: "fist", timestamp: 600 }));

    expect(controller.update(observation({ gesture: "none", confidence: 0.1, timestamp: 700 }))).toEqual([
      { type: "tracking_lost" },
      { type: "progress", value: 0 },
    ]);
    expect(controller.update(observation({ gesture: "fist", timestamp: 1300 }))).toEqual([
      { type: "progress", value: 0 },
    ]);
  });
});
