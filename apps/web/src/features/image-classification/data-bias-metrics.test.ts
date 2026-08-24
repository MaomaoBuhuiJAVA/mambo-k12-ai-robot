import { describe, expect, it } from "vitest";

import {
  getDataBiasMetricScenario,
  summarizeDataBiasMetrics,
} from "./data-bias-metrics";

describe("data bias metrics", () => {
  it("keeps the overall baseline separate from the weaker backlit group", () => {
    const baseline = getDataBiasMetricScenario();
    const overall = summarizeDataBiasMetrics(baseline.groupMetrics);

    expect(overall).toEqual({ correct: 13, total: 20, accuracy: 0.65 });
    expect(baseline.groupMetrics).toContainEqual({ group: "逆光组", correct: 4, total: 10 });
  });

  it("shows the deterministic effect of targeted resampling without changing the indoor group", () => {
    const baseline = getDataBiasMetricScenario("baseline");
    const improved = getDataBiasMetricScenario("targeted-resampling");

    expect(summarizeDataBiasMetrics(improved.groupMetrics)).toEqual({ correct: 16, total: 20, accuracy: 0.8 });
    expect(improved.groupMetrics[0]).toEqual(baseline.groupMetrics[0]);
    expect(improved.groupMetrics[1]).toEqual({ group: "逆光组", correct: 7, total: 10 });
  });
});
