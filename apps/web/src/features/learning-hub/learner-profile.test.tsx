import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string; [key: string]: unknown }) => <a {...props}>{children}</a>,
}));

import { createDefaultLearningState } from "@/lib/learning-store";
import { createProject } from "@/features/projects/project-schema";
import { saveProject } from "@/features/projects/project-store";
import { LearnerProfile } from "./learner-profile";

describe("LearnerProfile", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows only stage-scoped evidence, samples, reviews, misconceptions, and experiments", () => {
    const state = createDefaultLearningState();
    state.lastCourseId = "middle-ai-foundations";
    state.interests = ["image"];
    state.masteryByKnowledgePoint["middle-ai-foundations:规则程序与机器学习"] = {
      knowledgePointId: "middle-ai-foundations:规则程序与机器学习",
      mastery: 0.7,
      confidence: 0.7,
      evidenceCount: 2,
      lastPracticedAt: "2026-08-20T08:00:00.000Z",
      nextReviewAt: "2026-08-21T08:00:00.000Z",
      misconceptionTags: ["needs-review:middle-foundations"],
    };
    state.masteryByKnowledgePoint["lower-bubble-sort:相邻比较"] = {
      knowledgePointId: "lower-bubble-sort:相邻比较",
      mastery: 1,
      confidence: 1,
      evidenceCount: 9,
      lastPracticedAt: "2026-08-20T08:00:00.000Z",
      nextReviewAt: null,
      misconceptionTags: [],
    };
    state.attempts = [
      { attemptId: "middle-1", knowledgePointId: "middle-ai-foundations:规则程序与机器学习", score: 1, hints: 0, mode: "quiz", completedAt: "2026-08-20T08:00:00.000Z" },
      { attemptId: "middle-2", knowledgePointId: "middle-ai-foundations:规则程序与机器学习", score: 0, hints: 1, mode: "quiz", completedAt: "2026-08-21T08:00:00.000Z" },
      { attemptId: "lower-1", knowledgePointId: "lower-bubble-sort:相邻比较", score: 1, hints: 0, mode: "quiz", completedAt: "2026-08-21T08:00:00.000Z" },
    ];
    state.stageProgressByStage.middle_school.experimentEvidence = [{
      runId: "middle-run-1",
      activityId: "middle-neural-signals-guided-lab",
      courseId: "middle-neural-signals",
      templateId: "image-classifier",
      mode: "guided",
      variables: { texture: "striped" },
      metrics: { passedTests: 3, totalTests: 3 },
      conclusion: "固定样本检查通过。",
      completedAt: "2026-08-21T09:00:00.000Z",
    }];

    render(<LearnerProfile now={new Date("2026-08-22T08:00:00.000Z")} stage="middle_school" state={state} />);

    expect(screen.getByText("人工智能基础：从规则到学习")).toBeVisible();
    expect(screen.getByText("知识点证据").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("已提交练习").previousElementSibling).toHaveTextContent("2");
    expect(screen.getByRole("progressbar", { name: "规则程序与机器学习掌握度 70%" })).toBeVisible();
    expect(screen.getByText("needs-review:middle-foundations")).toBeVisible();
    expect(screen.getByText("图像识别")).toBeVisible();
    expect(screen.getByText("1 条结构化实验")).toBeVisible();
    expect(screen.getByRole("link", { name: "打开实验记录" })).toHaveAttribute(
      "href",
      "/lab?stage=middle_school&template=image-classifier&mode=guided",
    );
    expect(screen.queryByText("相邻比较")).not.toBeInTheDocument();
    expect(screen.queryByText(/排名|天赋|智商/)).not.toBeInTheDocument();
  });

  it("keeps trend and project areas honest when no source evidence exists", () => {
    render(<LearnerProfile now={new Date("2026-08-22T08:00:00.000Z")} stage="high_school" state={createDefaultLearningState()} />);

    expect(screen.getByText("暂无可计算趋势")).toBeVisible();
    expect(screen.getByText("尚未保存高中综合项目内容。")).toBeVisible();
    expect(screen.getByText("尚未开始")).toBeVisible();
    expect(screen.getByText("尚无作答样本")).toBeVisible();
  });

  it("includes lab evidence and code attempts in the matching stage", () => {
    const state = createDefaultLearningState();
    state.masteryByKnowledgePoint["middle.python-basics"] = {
      knowledgePointId: "middle.python-basics",
      mastery: 0.8,
      confidence: 0.8,
      evidenceCount: 1,
      lastPracticedAt: "2026-08-21T08:00:00.000Z",
      nextReviewAt: null,
      misconceptionTags: [],
    };
    state.attempts = [{
      attemptId: "python-run-1",
      knowledgePointId: "middle.python-basics",
      score: 0.8,
      hints: 1,
      mode: "code",
      completedAt: "2026-08-21T08:00:00.000Z",
    }];

    render(<LearnerProfile stage="middle_school" state={state} />);

    expect(screen.getAllByText("middle.python-basics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1 次 Python 挑战记录")).toBeVisible();
    expect(screen.getByRole("link", { name: "打开挑战" })).toHaveAttribute(
      "href",
      "/lab?stage=middle_school&template=middle-python-basics&mode=independent",
    );
  });

  it("counts each submitted answer in the trend sample size", () => {
    const state = createDefaultLearningState();
    state.attempts = [
      { attemptId: "first~e1", knowledgePointId: "middle-ai-foundations:规则程序与机器学习", score: 0, hints: 1, mode: "quiz", completedAt: "2026-08-21T08:00:00.000Z" },
      { attemptId: "second~e1", knowledgePointId: "middle-ai-foundations:规则程序与机器学习", score: 1, hints: 0, mode: "quiz", completedAt: "2026-08-21T09:00:00.000Z" },
    ];

    render(<LearnerProfile stage="middle_school" state={state} />);

    expect(screen.getAllByText("样本 2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1 / 2 达标")).toBeVisible();
  });

  it("does not count knowledge-point evidence twice for one quiz submission", () => {
    const state = createDefaultLearningState();
    state.attempts = [
      { attemptId: "submission-1", knowledgePointId: "middle-ai-foundations:规则程序与机器学习", score: 1, hints: 0, mode: "quiz", completedAt: "2026-08-21T08:00:00.000Z" },
      { attemptId: "submission-1~e2", knowledgePointId: "middle-ai-foundations:数据与样本", score: 0, hints: 1, mode: "quiz", completedAt: "2026-08-21T08:00:00.000Z" },
    ];

    render(<LearnerProfile stage="middle_school" state={state} />);

    expect(screen.getByText("已提交练习").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("1 / 1 达标")).toBeVisible();
  });

  it("shows both high-school project entries and their saved status", async () => {
    const audit = createProject("model-audit");
    audit.currentStep = "data";
    const capstone = createProject("capstone");
    capstone.researchQuestion = "完成综合项目研究";
    saveProject(audit);
    saveProject(capstone);

    render(<LearnerProfile stage="high_school" state={createDefaultLearningState()} />);

    await waitFor(() => expect(screen.getAllByRole("link", { name: "打开项目工作台" })).toHaveLength(2));
    expect(screen.getAllByRole("link", { name: "打开项目工作台" }).map((link) => link.getAttribute("href"))).toEqual([
      "/learn/project/model-audit",
      "/learn/project/capstone",
    ]);
    expect(screen.getAllByText("草稿已保存")).toHaveLength(2);
  });
});
