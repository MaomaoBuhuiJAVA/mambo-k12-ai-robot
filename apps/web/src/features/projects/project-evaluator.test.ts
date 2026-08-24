import { describe, expect, it } from "vitest";
import { createProject, PROJECT_FIELDS } from "./project-schema";
import { defenseQuestions, evaluateProject, evaluateProjectStep } from "./project-evaluator";

describe("project evaluator", () => {
  it("does not pass a report without numeric evidence and limitations", () => {
    const p = createProject("p");
    for (const f of PROJECT_FIELDS) p[f] = "有实验依据";
    expect(evaluateProject(p).passed).toBe(false);
    p.metrics = "accuracy 0.75";
    p.failureCases = "失败案例：逆光错误";
    p.limitations = "限制：样本不足";
    p.evidenceRefs = ["experiment:high-image-model-audit-project:v1"];
    expect(evaluateProject(p, ["experiment:high-image-model-audit-project:v1"]).passed).toBe(true);
    expect(defenseQuestions(p)).toHaveLength(4);
  });

  it("rejects evidence references that are not in the current learning state", () => {
    const p = createProject("p");
    for (const f of PROJECT_FIELDS) p[f] = "有实验依据";
    p.metrics = "accuracy 0.75";
    p.failureCases = "失败案例：逆光错误";
    p.limitations = "限制：样本不足";
    p.evidenceRefs = ["experiment:forged:v1"];

    expect(evaluateProject(p, new Set(["experiment:real:v1"])).passed).toBe(false);
    expect(evaluateProjectStep(p, "experiment", ["experiment:real:v1"]).missing).toContain(
      "evidenceRefs（只能引用当前学习状态中已保存的实验记录）",
    );
  });
});
