import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { createDefaultLearningState, saveLearningState } from "@/lib/learning-store";
import { createProject } from "./project-schema";
import { saveProject } from "./project-store";
import { ProjectWorkspace } from "./project-workspace";

describe("ProjectWorkspace", () => {
  beforeEach(() => window.localStorage.clear());

  it("restores a saved step and automatically surfaces high-school experiment evidence", async () => {
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
    saveLearningState(state, window.localStorage);

    const project = createProject("capstone");
    project.currentStep = "experiment";
    project.researchQuestion = "固定样本中的分组错误是什么";
    project.dataSource = "课程固定样本";
    project.authorization = "课程允许的固定样本";
    project.processingSteps = "按分组统计";
    project.modelVersion = "model-audit v1";
    saveProject(project, window.localStorage);

    render(<ProjectWorkspace projectId="capstone" />);

    expect(screen.getByRole("heading", { name: "研究问题" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "实验与指标" })).toBeVisible();
    expect((await screen.findAllByText(/总样本数 3/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /自动引用全部/ })).toBeVisible();
    const evidenceButton = screen.getByRole("button", { name: /model-audit/ });
    expect(evidenceButton).toHaveAttribute("aria-pressed", "false");

    await userEvent.setup().click(screen.getByRole("button", { name: /自动引用全部/ }));
    const metrics = screen.getByLabelText("实验运行与指标") as HTMLTextAreaElement;
    await waitFor(() => expect(metrics.value).toContain("总样本数 3"));
    expect(evidenceButton).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps an explicit removal after a learning-state refresh", async () => {
    const user = userEvent.setup();
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.experimentEvidence = [{
      runId: "experiment:audit:v1",
      activityId: "high-image-model-audit-project",
      courseId: "high-image-model-audit",
      templateId: "model-audit",
      mode: "project",
      variables: {},
      metrics: { groups: 2 },
      conclusion: "固定测试通过",
      completedAt: "2026-08-22T00:00:00.000Z",
    }];
    saveLearningState(state, window.localStorage);
    const project = createProject("capstone");
    project.currentStep = "experiment";
    project.evidenceRefs = ["experiment:audit:v1"];
    saveProject(project, window.localStorage);

    render(<ProjectWorkspace projectId="capstone" />);
    const evidenceButton = await screen.findByRole("button", { name: /model-audit/ });
    expect(evidenceButton).toHaveAttribute("aria-pressed", "true");
    await user.click(evidenceButton);
    expect(evidenceButton).toHaveAttribute("aria-pressed", "false");

    await waitFor(() => expect(window.localStorage.getItem("mambo.high-projects.v1")).not.toContain("experiment:audit:v1\"]"), { timeout: 2_000 });
    window.dispatchEvent(new Event("storage"));
    await waitFor(() => expect(evidenceButton).toHaveAttribute("aria-pressed", "false"));
  });

  it("auto-saves edited fields without requiring the save button", async () => {
    const user = userEvent.setup();
    render(<ProjectWorkspace projectId="capstone" />);

    const question = await screen.findByLabelText("研究问题");
    await user.type(question, "固定样本中的分组错误是什么");

    await waitFor(() => {
      const raw = window.localStorage.getItem("mambo.high-projects.v1");
      expect(raw).toContain("固定样本中的分组错误是什么");
    }, { timeout: 2_000 });
  });
});
