import { describe, expect, it } from "vitest";

import {
  calculateNeuralSignalResult,
  DEFAULT_NEURAL_PIXELS,
  NEURAL_CONNECTIONS,
  normalizeNeuralPixels,
} from "./neural-signal-experiment";

describe("neural signal experiment", () => {
  it("normalizes pixel inputs and produces stable weighted category scores", () => {
    expect(normalizeNeuralPixels({ "top-edge": 4, "vertical-stroke": -1, "page-stripes": 0.456 }))
      .toEqual({ "top-edge": 1, "vertical-stroke": 0, "page-stripes": 0.46 });

    expect(calculateNeuralSignalResult(DEFAULT_NEURAL_PIXELS)).toEqual({
      pixels: { "top-edge": 0.9, "vertical-stroke": 0.9, "page-stripes": 0.1 },
      scores: [{ label: "铅笔", value: 2.65 }, { label: "书本", value: -0.26 }],
      prediction: "铅笔",
      explanation: "铅笔 当前分数 2.65，高于 书本 的 -0.26。这只是当前输入与权重计算出的预测，需要用真实标签或新证据核对。",
    });
    expect(NEURAL_CONNECTIONS).toHaveLength(6);
  });

  it("changes the deterministic leader when page-stripe pixels dominate", () => {
    const result = calculateNeuralSignalResult({ "top-edge": 0.2, "vertical-stroke": 0.1, "page-stripes": 0.9 });
    expect(result.scores).toEqual([{ label: "铅笔", value: -0.03 }, { label: "书本", value: 1.63 }]);
    expect(result.prediction).toBe("书本");
    expect(result.explanation).toContain("只是当前输入与权重计算出的预测");
  });
});
