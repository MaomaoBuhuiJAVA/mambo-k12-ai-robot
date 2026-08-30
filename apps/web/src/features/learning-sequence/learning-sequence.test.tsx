import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";
import { getLearningPath } from "@/data/learning-paths";
import { createDefaultLearningState, loadLearningState, saveLearningState } from "@/lib/learning-store";
import {
  recordIndependentImageClassificationConclusion,
  recordIndependentImageClassificationRun,
  recordResearchImageClassificationAttempt,
  recordResearchImageClassificationConclusion,
  recordLabCompletion,
} from "@/features/lab/lab-progress";
import { calculateIndependentImageClassificationRun } from "@/features/lab/independent-image-classification";
import { calculateResearchImageClassificationAttempt } from "@/features/lab/research-image-classification";
import { getLabTemplate } from "@/features/lab/lab-templates";
import { PROJECT_FIELDS, createProject } from "@/features/projects/project-schema";
import { saveProject } from "@/features/projects/project-store";
import {
  checkCompletionPolicy,
  completeCurrentLearningActivity,
  getCurrentLearningActivity,
  getNextIncompleteActivity,
  LearningSequence,
} from "./learning-sequence";

const completedThroughPython = [
  "middle-ai-foundations-lesson",
  "middle-ai-foundations-demonstration",
  "middle-ai-foundations-assessment",
  "middle-data-and-algorithms-lesson",
  "middle-data-and-algorithms-demonstration",
  "middle-data-and-algorithms-lab",
  "middle-data-and-algorithms-assessment",
  "middle-python-basics-lesson",
  "middle-python-basics-demonstration",
  "middle-python-basics-lab",
  "middle-python-basics-assessment",
];

const completedThroughNeuralSignals = [
  ...completedThroughPython,
  "middle-neural-signals-lesson",
  "middle-neural-signals-demonstration",
  "middle-neural-signals-guided-lab",
  "middle-neural-signals-independent-lab",
  "middle-neural-signals-assessment",
];

const completedThroughModelEvaluation = [
  ...completedThroughNeuralSignals,
  "middle-model-evaluation-lesson",
  "middle-model-evaluation-demonstration",
  "middle-model-evaluation-assessment",
];

describe("learning sequence", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts with AI foundations and keeps neural-network work locked", () => {
    const state = createDefaultLearningState();

    expect(getCurrentLearningActivity(state, "middle_school")?.id).toBe(
      "middle-ai-foundations-lesson",
    );
    expect(getNextIncompleteActivity(state, "middle_school")?.id).toBe(
      "middle-ai-foundations-lesson",
    );
  });

  it("requires a lesson review confirmation before recording completion and activating the next step", () => {
    const state = createDefaultLearningState();
    const activity = getCurrentLearningActivity(state, "middle_school")!;

    expect(checkCompletionPolicy(state, activity, false).met).toBe(false);
    expect(completeCurrentLearningActivity(state, activity.id, false, "2026-08-22T00:00:00.000Z"))
      .toBe(state);

    const completed = completeCurrentLearningActivity(
      state,
      activity.id,
      true,
      "2026-08-22T00:00:00.000Z",
    );
    expect(completed.stageProgressByStage.middle_school).toMatchObject({
      completedActivityIds: ["middle-ai-foundations-lesson"],
      activeActivityId: "middle-ai-foundations-demonstration",
    });
  });

  it("requires deterministic correct assessment evidence instead of allowing a direct jump", () => {
    const course = getCourseById("middle-ai-foundations")!;
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.completedActivityIds = [
      "middle-ai-foundations-lesson",
      "middle-ai-foundations-demonstration",
    ];
    const assessment = getNextIncompleteActivity(state, "middle_school")!;

    expect(assessment.id).toBe("middle-ai-foundations-assessment");
    expect(checkCompletionPolicy(state, assessment, false).met).toBe(false);

    state.attempts = course.knowledgePointTags.map((tag, index) => ({
      attemptId: `assessment-${index}`,
      knowledgePointId: `${course.id}:${tag}`,
      score: 1,
      hints: 0,
      mode: "quiz" as const,
      completedAt: "2026-08-22T00:00:00.000Z",
    }));
    expect(checkCompletionPolicy(state, assessment, false).met).toBe(true);
  });

  it("unlocks every high-school lab after its fixed challenge passes", () => {
    const highPath = getLearningPath("high_school");
    const labActivities = highPath.filter((activity) => activity.kind === "independent_lab");

    for (const activity of labActivities) {
      const index = highPath.findIndex((candidate) => candidate.id === activity.id);
      const state = createDefaultLearningState();
      state.stageProgressByStage.high_school.completedActivityIds = highPath
        .slice(0, index)
        .map((candidate) => candidate.id);
      state.stageProgressByStage.high_school.activeActivityId = activity.id;

      const completed = recordLabCompletion(state, {
        templateId: activity.labTemplateId!,
        challengeVersion: getLabTemplate(activity.labTemplateId!).challengeVersion,
        passed: true,
        completedAt: "2026-08-22T00:00:00.000Z",
        hintsUsed: 0,
      });

      expect(checkCompletionPolicy(completed, activity, false).met, activity.id).toBe(true);
    }
  });

  it("keeps the H-08 audit project connected to the capstone path", () => {
    const highPath = getLearningPath("high_school");
    const auditProject = highPath.find((activity) => activity.id === "high-image-model-audit-project")!;
    const index = highPath.findIndex((activity) => activity.id === auditProject.id);
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.completedActivityIds = highPath
      .slice(0, index)
      .map((activity) => activity.id);
    state.stageProgressByStage.high_school.activeActivityId = auditProject.id;

    const withAudit = recordLabCompletion(state, {
      templateId: "model-audit",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-08-22T00:00:00.000Z",
      hintsUsed: 1,
    });
    const auditDraft = createProject("model-audit");
    for (const field of PROJECT_FIELDS) auditDraft[field] = "有实验依据";
    auditDraft.metrics = "accuracy 0.67";
    auditDraft.failureCases = "失败案例：逆光分组错误";
    auditDraft.limitations = "限制：固定样本范围有限";
    auditDraft.evidenceRefs = ["experiment:high-image-model-audit-project:v1"];
    auditDraft.defenseAnswers = ["回答一：引用分组指标", "回答二：说明失败样本", "回答三：提出下一步证据"];
    saveProject(auditDraft, window.localStorage);
    expect(auditProject.route).toBe("/learn/project/model-audit");
    expect(checkCompletionPolicy(withAudit, auditProject, false).met).toBe(true);

    const advanced = completeCurrentLearningActivity(
      withAudit,
      auditProject.id,
      false,
      "2026-08-22T00:01:00.000Z",
    );
    expect(advanced.stageProgressByStage.high_school.completedActivityIds).toContain(auditProject.id);
    expect(advanced.stageProgressByStage.high_school.activeActivityId).toBe("high-image-model-audit-defense");

    const defense = getLearningPath("high_school").find((activity) => activity.id === "high-image-model-audit-defense")!;
    expect(defense.route).toBe("/learn/project/model-audit");
    expect(checkCompletionPolicy(advanced, defense, false).met).toBe(true);
    const capstone = completeCurrentLearningActivity(
      advanced,
      defense.id,
      false,
      "2026-08-22T00:02:00.000Z",
    );
    expect(capstone.stageProgressByStage.high_school.activeActivityId).toBe("high-capstone-project");
  });

  it("does not complete the H-08 defense from a lab run alone", () => {
    const highPath = getLearningPath("high_school");
    const defense = highPath.find((activity) => activity.id === "high-image-model-audit-defense")!;
    const index = highPath.findIndex((activity) => activity.id === defense.id);
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.completedActivityIds = highPath
      .slice(0, index)
      .map((activity) => activity.id);
    state.stageProgressByStage.high_school.activeActivityId = defense.id;
    const withLab = recordLabCompletion(state, {
      templateId: "model-audit",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-08-22T00:00:00.000Z",
      hintsUsed: 0,
    });

    expect(checkCompletionPolicy(withLab, defense, false).met).toBe(false);
  });

  it("renders the pixel-to-score experiment when the neural-network demonstration is active", async () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.completedActivityIds = [
      ...completedThroughPython,
      "middle-neural-signals-lesson",
    ];
    state.stageProgressByStage.middle_school.activeActivityId = "middle-neural-signals-demonstration";
    saveLearningState(state, window.localStorage);

    render(<LearningSequence stage="middle_school" />);
    expect(await screen.findByRole("heading", { name: "像素如何穿过加权连接变成类别分数" })).toBeVisible();
    expect(screen.getByText("星宝前向传播示范")).toBeVisible();
  });

  it("renders the fixed split and confusion-matrix experiment for the model-evaluation demonstration", async () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.completedActivityIds = [
      ...completedThroughNeuralSignals,
      "middle-model-evaluation-lesson",
    ];
    state.stageProgressByStage.middle_school.activeActivityId = "middle-model-evaluation-demonstration";
    saveLearningState(state, window.localStorage);

    render(<LearningSequence stage="middle_school" />);
    expect(await screen.findByRole("heading", { name: "先留出测试集，再让指标解释模型表现" })).toBeVisible();
    expect(screen.getByRole("table", { name: "测试集混淆矩阵" })).toBeVisible();
  });

  it("does not unlock the independent lab after one run, or after two runs without a metric-grounded conclusion", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.completedActivityIds = [
      ...completedThroughPython,
      "middle-neural-signals-lesson",
      "middle-neural-signals-demonstration",
      "middle-neural-signals-guided-lab",
    ];
    state.stageProgressByStage.middle_school.activeActivityId = "middle-neural-signals-independent-lab";
    const independent = getCurrentLearningActivity(state, "middle_school")!;
    const first = calculateIndependentImageClassificationRun({ runId: "run-1", variableId: "texture", value: "striped", hintsUsed: 0, completedAt: "2026-08-22T00:00:00.000Z" })!;
    const second = calculateIndependentImageClassificationRun({ runId: "run-2", variableId: "texture", value: "handle", hintsUsed: 0, completedAt: "2026-08-22T00:01:00.000Z" })!;
    const oneRun = recordIndependentImageClassificationRun(state, first);
    const twoRuns = recordIndependentImageClassificationRun(oneRun, second);

    expect(independent.id).toBe("middle-neural-signals-independent-lab");
    expect(checkCompletionPolicy(oneRun, independent, false).met).toBe(false);
    expect(checkCompletionPolicy(twoRuns, independent, false).met).toBe(false);

    const completed = recordIndependentImageClassificationConclusion(twoRuns, {
      changed: "我改变了纹理线索，从条纹改为把手。",
      result: "两次固定检查都是 3/3，cup 分数从 3 增到 5。",
      reason: "把手是杯子的明显线索，因此得分会提高。",
      completedAt: "2026-08-22T00:02:00.000Z",
    });
    expect(checkCompletionPolicy(completed, independent, false).met).toBe(true);
  });

  it("does not unlock the data-bias assessment from a raw research run", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.completedActivityIds = [
      ...completedThroughModelEvaluation,
      "middle-data-bias-lesson",
      "middle-data-bias-demonstration",
    ];
    state.stageProgressByStage.middle_school.activeActivityId = "middle-data-bias-research";
    const challenge = getCurrentLearningActivity(state, "middle_school")!;
    const control = calculateResearchImageClassificationAttempt({ runId: "control", selectedSampleIds: [], completedAt: "2026-08-22T00:00:00.000Z" })!;
    const improved = calculateResearchImageClassificationAttempt({ runId: "improved", selectedSampleIds: ["backlit-leaf", "backlit-ball", "backlit-cup"], completedAt: "2026-08-22T00:01:00.000Z" })!;
    const withRuns = recordResearchImageClassificationAttempt(
      recordResearchImageClassificationAttempt(state, control),
      improved,
    );

    expect(challenge.id).toBe("middle-data-bias-research");
    expect(checkCompletionPolicy(withRuns, challenge, false).met).toBe(false);
    const completed = recordResearchImageClassificationConclusion(
      withRuns,
      "我补充了逆光叶子、球和杯子样本，逆光组从 4/10 提升到 7/10，说明应补充逆光场景的样本。",
      "2026-08-22T00:02:00.000Z",
    );
    expect(checkCompletionPolicy(completed, challenge, false).met).toBe(true);
  });

  it("renders the overall and group-metric comparison before the data-bias research challenge", async () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.completedActivityIds = [
      ...completedThroughModelEvaluation,
      "middle-data-bias-lesson",
    ];
    state.stageProgressByStage.middle_school.activeActivityId = "middle-data-bias-demonstration";
    saveLearningState(state, window.localStorage);

    render(<LearningSequence stage="middle_school" />);
    expect(await screen.findByRole("heading", { name: "总体分数不错，也要看谁被模型持续认错" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("总体是 65%，但逆光组只有 4/10");
  });

  it("persists and restores the current activity after an acknowledged lesson", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<LearningSequence stage="middle_school" />);

    expect(await screen.findByRole("heading", { name: "当前步骤" })).toBeVisible();
    expect(screen.getByText("人工智能基础小课")).toBeVisible();
    const continueButton = screen.getByRole("button", { name: "继续到下一步" });
    expect(continueButton).toBeDisabled();
    expect(screen.getByRole("link", { name: /前往完成当前步骤/ })).toHaveAttribute(
      "href",
      "/workspace?course=middle-ai-foundations",
    );

    await user.click(screen.getByRole("checkbox"));
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

    await waitFor(() => expect(loadLearningState().stageProgressByStage.middle_school)
      .toMatchObject({
        completedActivityIds: ["middle-ai-foundations-lesson"],
        activeActivityId: "middle-ai-foundations-demonstration",
      }));
    unmount();

    render(<LearningSequence stage="middle_school" />);
    expect(await screen.findByText("规则与样本演示")).toBeVisible();
  });
});
