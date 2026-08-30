import { describe, expect, it } from "vitest";

import { createDefaultLearningState } from "@/lib/learning-store";
import { createProject } from "./project-schema";
import { collectProjectEvidence, importAllProjectEvidence, syncProjectEvidence } from "./project-evidence";

describe("project evidence", () => {
  it("turns saved high-school experiment metrics into attachable project evidence", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.experimentEvidence = [{
      runId: "experiment:audit:v1",
      activityId: "high-image-model-audit-project",
      courseId: "high-image-model-audit",
      templateId: "model-audit",
      mode: "project",
      variables: { evidenceType: "deterministic-challenge" },
      metrics: { groups: 2, totalSamples: 3, correctSamples: 2, failedGroups: 1 },
      conclusion: "固定测试通过",
      completedAt: "2026-08-22T00:00:00.000Z",
    }];

    const evidence = collectProjectEvidence(state);
    expect(evidence[0]?.metricText).toContain("分组数 2");
    expect(evidence[0]?.failureText).toContain("1 个分组");
    const synced = importAllProjectEvidence(createProject("capstone"), evidence);
    expect(synced.evidenceRefs).toEqual(["experiment:audit:v1"]);
    expect(synced.metrics).toContain("总样本数 3");
    expect(synced.failureCases).toContain("错误");
  });

  it("removes references that no longer exist in the current learning state", () => {
    const project = createProject("capstone");
    project.evidenceRefs = ["experiment:deleted:v1", "experiment:audit:v1"];
    const state = createDefaultLearningState();
    const evidence = collectProjectEvidence(state);

    expect(syncProjectEvidence(project, evidence).evidenceRefs).toEqual([]);
  });

  it("does not attach newly available experiments during a refresh", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.experimentEvidence = [{
      runId: "experiment:new:v1",
      activityId: "high-image-model-audit-project",
      courseId: "high-image-model-audit",
      templateId: "model-audit",
      mode: "project",
      variables: {},
      metrics: { groups: 1 },
      conclusion: "固定测试通过",
      completedAt: "2026-08-22T00:00:00.000Z",
    }];

    const evidence = collectProjectEvidence(state);
    const synced = syncProjectEvidence(createProject("capstone"), evidence);

    expect(synced.evidenceRefs).toEqual([]);
    expect(synced.metrics).toBe("");
    expect(synced.failureCases).toBe("");
  });

  it("preserves selected evidence while leaving newer records unselected", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.experimentEvidence = [{
      runId: "experiment:kept:v1",
      activityId: "high-image-model-audit-project",
      courseId: "high-image-model-audit",
      templateId: "model-audit",
      mode: "project",
      variables: {},
      metrics: { groups: 1 },
      conclusion: "固定测试通过",
      completedAt: "2026-08-22T00:00:00.000Z",
    }, {
      runId: "experiment:newer:v1",
      activityId: "high-python-data-lab-code",
      courseId: "high-python-data-lab",
      templateId: "python-data-basics",
      mode: "project",
      variables: {},
      metrics: { rowCount: 2 },
      conclusion: "固定测试通过",
      completedAt: "2026-08-23T00:00:00.000Z",
    }];
    const project = createProject("capstone");
    project.evidenceRefs = ["experiment:kept:v1"];

    const synced = syncProjectEvidence(project, collectProjectEvidence(state));

    expect(synced.evidenceRefs).toEqual(["experiment:kept:v1"]);
    expect(synced.metrics).toContain("分组数 1");
    expect(synced.metrics).not.toContain("记录数 2");
  });

  it("imports all available experiments only through the explicit import operation", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.experimentEvidence = [{
      runId: "experiment:first:v1",
      activityId: "high-image-model-audit-project",
      courseId: "high-image-model-audit",
      templateId: "model-audit",
      mode: "project",
      variables: {},
      metrics: { groups: 2 },
      conclusion: "固定测试通过",
      completedAt: "2026-08-22T00:00:00.000Z",
    }, {
      runId: "experiment:second:v1",
      activityId: "high-python-data-lab-code",
      courseId: "high-python-data-lab",
      templateId: "python-data-basics",
      mode: "project",
      variables: {},
      metrics: { rowCount: 4 },
      conclusion: "固定测试通过",
      completedAt: "2026-08-23T00:00:00.000Z",
    }];

    const imported = importAllProjectEvidence(createProject("capstone"), collectProjectEvidence(state));

    expect(imported.evidenceRefs).toEqual(["experiment:first:v1", "experiment:second:v1"]);
    expect(imported.metrics).toContain("分组数 2");
    expect(imported.metrics).toContain("记录数 4");
  });
});
