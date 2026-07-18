import { describe, expect, it } from "vitest";

import { classifyHandLandmarks, landmarksFromFlatOutput, observationFromLandmarks, type Landmark } from "./hand-tracker";

function point(x: number, y: number, z = 0): Landmark {
  return { x, y, z };
}

function handWithFingerTips(tips: number[]): Landmark[] {
  const landmarks = Array.from({ length: 21 }, () => point(0.5, 0.5));
  landmarks[0] = point(0.5, 0.75);
  const fingerChains = [
    [8, 6, 5],
    [12, 10, 9],
    [16, 14, 13],
    [20, 18, 17],
  ];
  fingerChains.forEach(([tip, pip, mcp], index) => {
    const x = 0.34 + index * 0.1;
    landmarks[mcp] = point(x, 0.62);
    landmarks[pip] = point(x, tips[index] === 1 ? 0.42 : 0.66);
    landmarks[tip] = point(x, tips[index] === 1 ? 0.18 : 0.7);
  });
  return landmarks;
}

describe("classifyHandLandmarks", () => {
  it("recognizes an open palm when most fingers extend", () => {
    const result = classifyHandLandmarks(handWithFingerTips([1, 1, 1, 1]));

    expect(result.gesture).toBe("open_palm");
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("recognizes a fist when fingers fold toward the palm", () => {
    const result = classifyHandLandmarks(handWithFingerTips([0, 0, 0, 0]));

    expect(result.gesture).toBe("fist");
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});

describe("observationFromLandmarks", () => {
  it("mirrors the hand center for a natural camera cursor", () => {
    const landmarks = handWithFingerTips([1, 1, 1, 1]);
    landmarks[0] = point(0.2, 0.4);
    landmarks[5] = point(0.2, 0.4);
    landmarks[9] = point(0.2, 0.4);
    landmarks[13] = point(0.2, 0.4);
    landmarks[17] = point(0.2, 0.4);

    expect(observationFromLandmarks([landmarks], 42)).toMatchObject({
      gesture: "open_palm",
      x: 0.8,
      y: 0.4,
      timestamp: 42,
    });
  });

  it("returns a lost observation when no hand is detected", () => {
    expect(observationFromLandmarks([], 42)).toEqual({
      gesture: "none",
      x: 0.5,
      y: 0.5,
      confidence: 0,
      timestamp: 42,
    });
  });
});

describe("landmarksFromFlatOutput", () => {
  it("decodes the 42-value output used by handpose_x", () => {
    const output = Array.from({ length: 42 }, (_, index) => index / 42);

    expect(landmarksFromFlatOutput(output)).toHaveLength(21);
    expect(landmarksFromFlatOutput(output)?.[3]).toEqual({ x: 6 / 42, y: 7 / 42 });
  });

  it("rejects incomplete or non-finite model output", () => {
    expect(landmarksFromFlatOutput(new Float32Array(41))).toBeNull();
    const output = new Float32Array(42);
    output[4] = Number.NaN;
    expect(landmarksFromFlatOutput(output)).toBeNull();
  });
});
