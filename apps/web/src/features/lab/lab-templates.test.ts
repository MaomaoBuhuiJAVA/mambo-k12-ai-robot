import { describe, expect, it } from "vitest";

import {
  getLabGuidance,
  getLabTemplate,
  H06_MODALITY_ORDER,
  H06_MULTIMODAL_DATASET_VERSION,
  H06_MULTIMODAL_INPUT_VERSION,
} from "./lab-templates";

describe("lab templates", () => {
  it("adapts tasks and hints to the selected learning stage", () => {
    const child = getLabGuidance("bubble-sort", "lower_primary");
    const highSchool = getLabGuidance("bubble-sort", "high_school");

    expect(child.task).not.toBe(highSchool.task);
    expect(child.hints[0]).not.toBe(highSchool.hints[0]);
    expect(highSchool.task).toContain("不修改输入");
  });

  it("provides a dedicated deterministic middle-school Python exercise", () => {
    const template = getLabTemplate("middle-python-basics");
    const guidance = getLabGuidance("middle-python-basics", "middle_school");

    expect(template.knowledgePointId).toBe("middle.python-basics");
    expect(template.starterCode).toContain("choose_ready_tools");
    expect(guidance.task).toContain("变量、条件、循环和函数");
  });

  it("makes the high-school data challenge explicit about CSV, JSON and missing values", () => {
    const template = getLabTemplate("python-data-basics");
    const guidance = getLabGuidance("python-data-basics", "high_school");

    expect(template.challengeVersion).toBe(3);
    expect(template.dataFormats).toEqual(["json", "csv"]);
    expect(template.starterCode).toContain("import json");
    expect(template.starterCode).toContain("import csv");
    expect(template.starterCode).toContain("scores-json-v1");
    expect(template.starterCode).toContain("scores-csv-v1");
    expect(template.task).toContain("缺失");
    expect(template.task).toContain("CSV");
    expect(guidance.task).toContain("CSV");
  });

  it("defines the high-school sorting challenge around measurable comparison complexity", () => {
    const template = getLabTemplate("bubble-sort-analysis");

    expect(template.knowledgePointId).toBe("high.bubble-sort-analysis");
    expect(template.task).toContain("比较次数");
    expect(template.hints.join(" ")).toContain("外层 end");
  });

  it("makes the machine-learning pipeline challenge expose a baseline and leakage check", () => {
    const template = getLabTemplate("dataset-split");

    expect(template.challengeVersion).toBe(3);
    expect(template.starterCode).toContain("build_pipeline");
    expect(template.task).toContain("基线");
    expect(template.hints.join(" ")).toContain("validation/test");
    expect(template.hints.join(" ")).toContain("leakage_detected");
  });

  it("covers classification, regression and error-cost metric selection", () => {
    const template = getLabTemplate("classification-metrics");

    expect(template.challengeVersion).toBe(3);
    expect(template.starterCode).toContain("evaluate_metrics");
    expect(template.task).toContain("F1");
    expect(template.task).toContain("MSE");
    expect(template.task).toContain("混淆矩阵");
    expect(template.hints.join(" ")).toContain("漏检代价");
    expect(template.hints.join(" ")).toContain("误报代价");
  });

  it("makes the training-curve challenge expose validation loss and overfit state", () => {
    const template = getLabTemplate("gradient-descent-demo");

    expect(template.challengeVersion).toBe(3);
    expect(template.starterCode).toContain("analyze_training_curve");
    expect(template.task).toContain("过拟合");
    expect(template.task).toContain("参数集版本");
    expect(template.hints.join(" ")).toContain("sample_count");
    expect(template.hints.join(" ")).toContain("best_step");
  });

  it("makes the multimodal challenge reproducible across four inputs and privacy boundaries", () => {
    const template = getLabTemplate("multimodal-input-audit");
    const guidance = getLabGuidance("multimodal-input-audit", "high_school");

    expect(template.challengeVersion).toBe(2);
    expect(template.starterCode).toContain(H06_MULTIMODAL_DATASET_VERSION);
    expect(template.starterCode).toContain(H06_MULTIMODAL_INPUT_VERSION);
    expect(H06_MODALITY_ORDER).toEqual(["text", "image", "structured", "combined"]);
    expect(template.starterCode).toContain("structured");
    expect(template.starterCode).toContain("combined");
    expect(template.task).toContain("未授权");
    expect(guidance.task).toContain("组合输入");
    expect(guidance.hints.join(" ")).toContain("authorized");
  });

  it("makes the RAG challenge compare versions, failed claims and fixed tool permissions", () => {
    const template = getLabTemplate("rag-citation-check");

    expect(template.challengeVersion).toBe(3);
    expect(template.starterCode).toContain("compare_retrieval");
    expect(template.starterCode).toContain("fixed-kb-v2");
    expect(template.starterCode).toContain("rag-query-v2");
    expect(template.starterCode).toContain("unsupported_claims");
    expect(template.task).toContain("无检索");
    expect(template.task).toContain("失败回答");
    expect(template.hints.join(" ")).toContain("blocked");
  });
});
