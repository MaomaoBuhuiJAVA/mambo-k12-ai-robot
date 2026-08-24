import { describe, expect, it } from "vitest";

import {
  calculateEvaluationMetrics,
  createEvaluationSplit,
  FIXED_EVALUATION_SAMPLES,
} from "./model-evaluation-experiment";

describe("model evaluation experiment", () => {
  it("uses a fixed source-held-out split and calculates reproducible metrics", () => {
    const split = createEvaluationSplit("backlit");

    expect(split.trainingSamples).toHaveLength(8);
    expect(split.testSamples).toHaveLength(4);
    expect(split.trainingSamples.some((sample) => sample.batchId === "backlit")).toBe(false);
    expect(split.metrics).toEqual({
      total: 4,
      correct: 2,
      incorrect: 2,
      accuracy: 0.5,
      errorRate: 0.5,
      confusionMatrix: {
        树叶: { 树叶: 1, 水杯: 1 },
        水杯: { 树叶: 1, 水杯: 1 },
      },
    });
  });

  it("keeps the test calculation deterministic for every fixed batch", () => {
    expect(createEvaluationSplit("indoor").metrics).toMatchObject({ accuracy: 1, errorRate: 0 });
    expect(createEvaluationSplit("shadow").metrics).toMatchObject({ accuracy: 0.75, errorRate: 0.25 });
    expect(calculateEvaluationMetrics(FIXED_EVALUATION_SAMPLES.slice(0, 2))).toMatchObject({
      total: 2,
      correct: 2,
      accuracy: 1,
    });
  });
});
