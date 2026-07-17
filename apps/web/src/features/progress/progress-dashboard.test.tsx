import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { createDefaultLearningState, saveLearningState } from "@/lib/learning-store";
import { getCourseById } from "@/data/curriculum";
import { createSeedStorybook } from "@/features/storybook/storybook";
import { STORYBOOK_STORAGE_KEY } from "@/features/storybook/storybook-storage";
import { ProgressDashboard } from "./progress-dashboard";

describe("ProgressDashboard", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders honest empty states and a same-stage recommendation", async () => {
    render(<ProgressDashboard now={new Date("2026-07-18T08:00:00.000Z")} />);

    expect(await screen.findByText("还没有练习记录")).toBeVisible();
    expect(screen.getByText("还没有保存的作品")).toBeVisible();
    expect(screen.getByText(/当前学段/)).toBeVisible();
    expect(screen.getByRole("link", { name: /去学习推荐课程/ })).toHaveAttribute("href", expect.stringContaining("course="));
  });

  it("shows persisted mastery, due review, and recent attempts without fabricated totals", async () => {
    const state = createDefaultLearningState();
    state.profile.stage = "lower_primary";
    state.masteryByKnowledgePoint["lower-bubble-sort:相邻比较"] = {
      knowledgePointId: "lower-bubble-sort:相邻比较",
      mastery: 0.42,
      confidence: 0.4,
      evidenceCount: 2,
      lastPracticedAt: "2026-07-17T08:00:00.000Z",
      nextReviewAt: "2026-07-18T07:00:00.000Z",
      misconceptionTags: ["needs-review:choice"],
    };
    state.attempts = [{
      attemptId: "a-1",
      knowledgePointId: "lower-bubble-sort:相邻比较",
      score: 0,
      hints: 0,
      mode: "quiz",
      completedAt: "2026-07-17T08:00:00.000Z",
    }];
    state.updatedAt = "2026-07-17T08:00:00.000Z";
    saveLearningState(state);

    render(<ProgressDashboard now={new Date("2026-07-18T08:00:00.000Z")} />);

    expect((await screen.findAllByText("相邻比较"))[0]).toBeVisible();
    expect(screen.getByText("42%")) .toBeVisible();
    expect(screen.getByText("1 个知识点待复习")).toBeVisible();
    expect(screen.getByText(/未通过/)).toBeVisible();
  });

  it("refreshes from storage after the learning-state event", async () => {
    render(<ProgressDashboard now={new Date("2026-07-18T08:00:00.000Z")} />);
    expect(await screen.findByText("还没有练习记录")).toBeVisible();

    const state = createDefaultLearningState();
    state.masteryByKnowledgePoint["lower-picture-labels:图片标签"] = {
      knowledgePointId: "lower-picture-labels:图片标签",
      mastery: 0.75,
      confidence: 0.6,
      evidenceCount: 3,
      lastPracticedAt: "2026-07-18T08:00:00.000Z",
      nextReviewAt: "2026-07-21T08:00:00.000Z",
      misconceptionTags: [],
    };
    state.updatedAt = "2026-07-18T08:00:00.000Z";
    saveLearningState(state);
    window.dispatchEvent(new Event("mambo:learning-state-changed"));

    await waitFor(() => expect(screen.getByText("图片标签")).toBeVisible());
  });

  it("shows real saved storybooks as recent works", async () => {
    const course = getCourseById("lower-bubble-sort")!;
    localStorage.setItem(STORYBOOK_STORAGE_KEY, JSON.stringify([{
      id: "storybook-1",
      courseId: course.id,
      savedAt: "2026-07-18T07:30:00.000Z",
      storybook: createSeedStorybook(course),
    }]));
    render(<ProgressDashboard now={new Date("2026-07-18T08:00:00.000Z")} />);
    expect(await screen.findByText("冒泡排序探险记")).toBeVisible();
    expect(screen.getByText(/保存于/)).toBeVisible();
    expect(screen.queryByText(/功能启用后/)).not.toBeInTheDocument();
  });
});
