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

  it("preserves the default smoothing factor for live board tracking", () => {
    const controller = new GestureController();
    controller.update(observation({ x: 0, y: 0, timestamp: 0 }));

    expect(controller.update(observation({ x: 1, y: 1, timestamp: 80 }))).toEqual([
      { type: "cursor_move", x: 0.35, y: 0.35 },
      { type: "progress", value: 0 },
    ]);
  });

  it("scrolls upward at the slower default speed while a stable V sign stays in the upper zone", () => {
    const controller = new GestureController();

    expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 0 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 200 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 350 }))).toEqual([
      { type: "scroll", deltaY: -0.045 },
    ]);
    expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 500 }))).toEqual([
      { type: "scroll", deltaY: -0.045 },
    ]);
  });

  it("skips a delayed V-sign frame instead of catching up after tracking stalls", () => {
    const controller = new GestureController({ scrollVelocity: 0.5 });

    controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 0 }));
    controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 200 }));
    expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 300 }))).toEqual([
      { type: "scroll", deltaY: -0.05 },
    ]);
    expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 600 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 700 }))).toEqual([
      { type: "scroll", deltaY: -0.05 },
    ]);
  });

  it("scrolls downward below the lower zone and pauses in the center zone", () => {
    const controller = new GestureController({ scrollVelocity: 0.5 });

    controller.update(observation({ gesture: "v_sign", y: 0.8, timestamp: 0 }));
    controller.update(observation({ gesture: "v_sign", y: 0.8, timestamp: 200 }));
    expect(controller.update(observation({ gesture: "v_sign", y: 0.8, timestamp: 260 }))).toEqual([
      { type: "scroll", deltaY: 0.03 },
    ]);
    expect(controller.update(observation({ gesture: "v_sign", y: 0.5, timestamp: 320 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "v_sign", y: 0.8, timestamp: 380 }))).toEqual([
      { type: "scroll", deltaY: 0.03 },
    ]);
  });

  it("stops V-sign auto scrolling immediately when tracking is lost", () => {
    const controller = new GestureController({ scrollVelocity: 0.5 });

    controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 0 }));
    controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 200 }));
    controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 260 }));
    expect(controller.update(observation({ gesture: "none", confidence: 0.1, timestamp: 320 }))).toEqual([
      { type: "tracking_lost" },
    ]);
    expect(controller.update(observation({ gesture: "v_sign", y: 0.2, timestamp: 380 }))).toEqual([]);
  });

  it("requires an open-palm release after a V sign before another fist can click", () => {
    const controller = new GestureController({ dwellMs: 1, smoothing: 1 });
    controller.update(observation({ x: 0.4, y: 0.6, timestamp: 0 }));
    controller.update(observation({ gesture: "fist", timestamp: 10 }));
    controller.update(observation({ gesture: "v_sign", timestamp: 20 }));
    controller.update(observation({ gesture: "v_sign", timestamp: 220 }));

    expect(controller.update(observation({ gesture: "fist", timestamp: 230 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "fist", timestamp: 240 }))).toEqual([]);
    expect(controller.update(observation({ x: 0.4, y: 0.6, timestamp: 250 }))).toEqual([
      { type: "cursor_move", x: 0.4, y: 0.6 },
      { type: "progress", value: 0 },
    ]);
    controller.update(observation({ gesture: "fist", timestamp: 260 }));
    expect(controller.update(observation({ gesture: "fist", timestamp: 261 }))).toEqual([
      { type: "progress", value: 1 },
      { type: "click", x: 0.4, y: 0.6 },
    ]);
  });

  it("emits one navigation event after a held finger and requires a release to repeat", () => {
    const controller = new GestureController();

    expect(controller.update(observation({ gesture: "pinky_up", timestamp: 0 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "pinky_up", timestamp: 349 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "pinky_up", timestamp: 350 }))).toEqual([
      { type: "navigate", direction: "previous" },
    ]);
    expect(controller.update(observation({ gesture: "pinky_up", timestamp: 800 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "thumb_up", timestamp: 900 }))).toEqual([]);

    controller.update(observation({ timestamp: 950 }));
    controller.update(observation({ timestamp: 1_070 }));
    expect(controller.update(observation({ gesture: "pinky_up", timestamp: 1_080 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "pinky_up", timestamp: 1_430 }))).toEqual([
      { type: "navigate", direction: "previous" },
    ]);
  });

  it("keeps a navigation hold locked across one lost frame until a stable open-palm release", () => {
    const controller = new GestureController();

    controller.update(observation({ gesture: "pinky_up", timestamp: 0 }));
    expect(controller.update(observation({ gesture: "pinky_up", timestamp: 350 }))).toEqual([
      { type: "navigate", direction: "previous" },
    ]);

    controller.update(observation({ gesture: "none", confidence: 0.1, timestamp: 360 }));
    controller.update(observation({ gesture: "pinky_up", timestamp: 370 }));
    expect(controller.update(observation({ gesture: "pinky_up", timestamp: 720 }))).toEqual([]);

    controller.update(observation({ timestamp: 800 }));
    controller.update(observation({ confidence: 0.1, timestamp: 850 }));
    controller.update(observation({ timestamp: 860 }));
    expect(controller.update(observation({ timestamp: 979 }))).toEqual([
      { type: "cursor_move", x: 0.5, y: 0.5 },
      { type: "progress", value: 0 },
    ]);
    controller.update(observation({ timestamp: 980 }));

    expect(controller.update(observation({ gesture: "thumb_up", timestamp: 990 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "thumb_up", timestamp: 1_340 }))).toEqual([
      { type: "navigate", direction: "next" },
    ]);
  });

  it("maps a held thumb gesture to the next navigation event", () => {
    const controller = new GestureController();

    controller.update(observation({ gesture: "thumb_up", timestamp: 10 }));
    expect(controller.update(observation({ gesture: "thumb_up", timestamp: 360 }))).toEqual([
      { type: "navigate", direction: "next" },
    ]);
  });

  it("requires an open palm before a fresh fist dwell", () => {
    const controller = new GestureController({ dwellMs: 1, smoothing: 1 });

    expect(controller.update(observation({ gesture: "fist", x: 0.4, y: 0.6, timestamp: 0 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "fist", x: 0.4, y: 0.6, timestamp: 2 }))).toEqual([]);
  });

  it("requires an open palm after reset before a fist dwell", () => {
    const controller = new GestureController({ dwellMs: 1, smoothing: 1 });
    controller.update(observation({ timestamp: 0 }));
    controller.update(observation({ gesture: "none", confidence: 0.1, timestamp: 2 }));
    controller.reset();

    expect(controller.update(observation({ gesture: "fist", x: 0.4, y: 0.6, timestamp: 4 }))).toEqual([]);
    expect(controller.update(observation({ gesture: "fist", x: 0.4, y: 0.6, timestamp: 6 }))).toEqual([]);
    expect(controller.update(observation({ x: 0.4, y: 0.6, timestamp: 8 }))).toEqual([
      { type: "cursor_move", x: 0.4, y: 0.6 },
      { type: "progress", value: 0 },
    ]);
    expect(controller.update(observation({ gesture: "fist", timestamp: 10 }))).toEqual([
      { type: "progress", value: 0 },
    ]);
    expect(controller.update(observation({ gesture: "fist", timestamp: 12 }))).toEqual([
      { type: "progress", value: 1 },
      { type: "click", x: 0.4, y: 0.6 },
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
    expect(controller.update(observation({ gesture: "fist", timestamp: 1300 }))).toEqual([]);
  });

  it("requires a new open palm after tracking is lost before a fist can click", () => {
    const controller = new GestureController({ dwellMs: 1, smoothing: 1 });
    controller.update(observation({ x: 0.2, y: 0.8, timestamp: 0 }));
    controller.update(observation({ gesture: "none", confidence: 0.1, timestamp: 2 }));

    const fistEvents = [
      ...controller.update(observation({ gesture: "fist", x: 0.7, y: 0.3, timestamp: 4 })),
      ...controller.update(observation({ gesture: "fist", x: 0.7, y: 0.3, timestamp: 6 })),
    ];
    expect(fistEvents.some((event) => event.type === "click")).toBe(false);
    expect(fistEvents).toEqual([]);

    expect(controller.update(observation({ x: 0.4, y: 0.6, timestamp: 8 }))).toEqual([
      { type: "cursor_move", x: 0.4, y: 0.6 },
      { type: "progress", value: 0 },
    ]);
    controller.update(observation({ gesture: "fist", timestamp: 10 }));
    expect(controller.update(observation({ gesture: "fist", timestamp: 12 }))).toEqual([
      { type: "progress", value: 1 },
      { type: "click", x: 0.4, y: 0.6 },
    ]);
  });
});
