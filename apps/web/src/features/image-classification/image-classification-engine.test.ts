import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_FEATURES,
  FIXED_IMAGE_SAMPLE,
  calculateClassificationScores,
  calculateFeatureValues,
  calculatePrediction,
  createImageClassificationFrame,
  nextImageClassificationFrame,
} from "./image-classification-engine";

describe("image classification engine", () => {
  it("derives the same fixed feature values and scores for the fixed sample", () => {
    const values = calculateFeatureValues(FIXED_IMAGE_SAMPLE);

    expect(values).toEqual({
      cap: 1,
      "tall-shape": 0.9,
      "visible-pages": 0,
      "rectangular-cover": 0.1,
    });
    expect(calculateClassificationScores(values)).toEqual([
      { label: "水杯", value: 4.33 },
      { label: "书本", value: -1.3 },
    ]);
  });

  it("only applies a feature after its deterministic step has been reached", () => {
    const input = createImageClassificationFrame(0);
    const cap = nextImageClassificationFrame(input);
    const shape = nextImageClassificationFrame(cap);

    expect(input.scores).toEqual([{ label: "水杯", value: 0 }, { label: "书本", value: 0 }]);
    expect(cap.scores).toEqual([{ label: "水杯", value: 3 }, { label: "书本", value: -1 }]);
    expect(shape.scores).toEqual([{ label: "水杯", value: 4.35 }, { label: "书本", value: -1.45 }]);
    expect(shape.processedFeatureIds).toEqual(["cap", "tall-shape"]);
  });

  it("produces a fixed completed prediction without an AI-generated label", () => {
    const frame = createImageClassificationFrame(4);
    const repeated = createImageClassificationFrame(4);

    expect(frame).toEqual(repeated);
    expect(frame.complete).toBe(true);
    expect(frame.prediction).toEqual({
      label: "水杯",
      scoreShare: 1,
      explanation: "水杯 分数 4.33，高于 书本 的 -1.3。",
    });
    expect(CLASSIFICATION_FEATURES).toHaveLength(4);
  });

  it("does not claim a prediction before there are usable scores", () => {
    expect(calculatePrediction([{ label: "水杯", value: 0 }, { label: "书本", value: 0 }], false)).toEqual({
      label: null,
      scoreShare: 0,
      explanation: "当前没有足够的特征分数，暂不作出预测。",
    });
  });

  it("keeps a supplied sample when advancing the deterministic frame", () => {
    const customSample = {
      ...FIXED_IMAGE_SAMPLE,
      id: "custom-sample",
      title: "测试样本",
      inputs: { ...FIXED_IMAGE_SAMPLE.inputs, hasCap: 0 },
    };
    const first = createImageClassificationFrame(0, customSample);
    const next = nextImageClassificationFrame(first);

    expect(next.sample).toBe(customSample);
    expect(next.featureValues.cap).toBe(0);
  });
});
