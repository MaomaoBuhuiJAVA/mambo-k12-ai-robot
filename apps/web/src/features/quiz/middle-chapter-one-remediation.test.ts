import { describe, expect, it } from "vitest";

import {
  getMisconceptionForExercise,
  getMisconceptionRemediation,
} from "./middle-chapter-one-remediation";

describe("middle chapter one remediation", () => {
  it("maps only configured assessment mistakes to stable misconception tags", () => {
    expect(getMisconceptionForExercise("middle-ai-foundations-result")).toMatchObject({
      tag: "预测等于事实",
      title: "预测还需要核对",
    });
    expect(getMisconceptionForExercise("middle-data-bias-choice")).toMatchObject({
      tag: "只看总体准确率",
    });
    expect(getMisconceptionForExercise("other-course-choice")).toBeUndefined();
  });

  it("also exposes course-specific high-school remediation through the shared lookup", () => {
    expect(getMisconceptionForExercise("high-generative-ai-rag-result")).toMatchObject({
      tag: "引用与工具权限未核对",
      activityId: "high-generative-ai-rag-remediation",
      route: expect.stringContaining("high-generative-ai-rag"),
    });
    expect(getMisconceptionRemediation("总体指标掩盖分组失败")).toMatchObject({
      activityId: "high-image-model-audit-remediation",
    });
  });

  it("provides a concise explanation and example for each stored tag", () => {
    expect(getMisconceptionRemediation("标签和特征混淆")).toMatchObject({
      explanation: expect.any(String),
      example: expect.any(String),
    });
  });
});
