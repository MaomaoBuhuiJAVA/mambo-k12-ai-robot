import { describe, expect, it } from "vitest";

import {
  calculateIndependentImageClassificationRun,
  formatIndependentRunMetric,
  getComparableIndependentRuns,
} from "./independent-image-classification";

const completedAt = "2026-08-22T04:00:00.000Z";

describe("independent image classification", () => {
  it("calculates fixed scores for an independently selected variable value", () => {
    const run = calculateIndependentImageClassificationRun({
      runId: "run-1",
      variableId: "texture",
      value: "striped",
      hintsUsed: 1,
      completedAt,
    });

    expect(run).toMatchObject({
      variableLabel: "纹理",
      valueLabel: "条纹",
      prediction: "cup",
      selectedScore: 3,
      scores: { leaf: 0, ball: 1, cup: 3 },
      passedTests: 3,
      totalTests: 3,
      hintsUsed: 1,
    });
  });

  it("requires two different values of the same variable to compare runs", () => {
    const striped = calculateIndependentImageClassificationRun({ runId: "run-1", variableId: "texture", value: "striped", hintsUsed: 0, completedAt })!;
    const handle = calculateIndependentImageClassificationRun({ runId: "run-2", variableId: "texture", value: "handle", hintsUsed: 2, completedAt })!;
    const green = calculateIndependentImageClassificationRun({ runId: "run-3", variableId: "color", value: "green", hintsUsed: 0, completedAt })!;

    expect(getComparableIndependentRuns([striped])).toBeNull();
    expect(getComparableIndependentRuns([striped, green])).toBeNull();
    expect(getComparableIndependentRuns([striped, handle])).toEqual([striped, handle]);
    expect(formatIndependentRunMetric(handle)).toBe("cup 分数 5，检查 3/3");
  });
});
