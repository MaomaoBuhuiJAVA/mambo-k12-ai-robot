import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string; [key: string]: unknown }) => <a {...props}>{children}</a>,
}));

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { LearningPlatformShell } from "./learning-platform-shell";
import { getCourseById } from "@/data/curriculum";
import { getLearningPath } from "@/data/learning-paths";
import { hasCompletedMiddleSchool } from "@/features/progress/middle-school-completion";
import { createDefaultLearningState } from "@/lib/learning-store";

describe("LearningPlatformShell", () => {
  beforeEach(() => {
    push.mockReset();
    window.localStorage.clear();
    delete document.body.dataset.learningHub;
  });

  it("enables document scrolling only while the learning shell is mounted", async () => {
    const { unmount } = render(<LearningPlatformShell initialView="courses" />);

    await waitFor(() => {
      expect(document.body).toHaveAttribute("data-learning-hub", "true");
    });

    unmount();
    expect(document.body).not.toHaveAttribute("data-learning-hub");
  });

  it("does not let an old shell cleanup remove the next shell scroll owner", async () => {
    const first = render(<LearningPlatformShell initialStage="middle_school" initialView="courses" />);
    await waitFor(() => expect(document.body).toHaveAttribute("data-learning-hub", "true"));

    first.unmount();
    const second = render(<LearningPlatformShell initialStage="middle_school" initialView="courses" />);
    await waitFor(() => expect(document.body).toHaveAttribute("data-learning-hub", "true"));

    expect(document.body).toHaveAttribute("data-learning-hub", "true");
    second.unmount();
  });

  it("uses middle school and the learning path when no stage query is supplied", () => {
    render(<LearningPlatformShell initialView="path" />);

    expect(screen.getByRole("button", { name: "年级 · 初一" })).toBeVisible();
    expect(screen.getByRole("button", { name: "学习路径" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "学习路径" })).toBeVisible();
    expect(screen.getByLabelText("初中学习路径完成度 0%")).toBeVisible();
    expect(screen.getByRole("link", { name: "搜索课程" })).toHaveAttribute(
      "href",
      "/learn?stage=middle_school&grade=middle_1&view=courses",
    );
    expect(screen.getByRole("link", { name: "查看学习进度" })).toHaveAttribute(
      "href",
      "/learn?stage=middle_school&grade=middle_1&view=profile",
    );
  });

  it("renders the requested stage and selected sidebar view", () => {
    render(<LearningPlatformShell initialStage="high_school" initialView="practice" />);

    expect(screen.getByRole("button", { name: "年级 · 高一" })).toBeVisible();
    expect(screen.getByRole("button", { name: "练习" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "先完成初中阶段，再进入高中项目" })).toBeVisible();
    expect(screen.getByRole("link", { name: "返回初中学习路径" })).toHaveAttribute("href", "/learn?stage=middle_school&grade=middle_1&view=courses");
  });

  it("does not call a locked grade path completed when its predecessor is missing", () => {
    render(<LearningPlatformShell initialStage="middle_school" initialGrade="middle_2" initialView="path" />);

    expect(screen.getByRole("heading", { name: "等待前置课程" })).toBeVisible();
    expect(screen.queryByText("本年级任务已完成")).not.toBeInTheDocument();
    expect(screen.getByText("先完成：数据与算法评价")).toBeVisible();
  });

  it("shows the high-school workspace after middle-school completion evidence is present", () => {
    const completed = createDefaultLearningState();
    const coreCourseIds = ["middle-ai-foundations", "middle-data-and-algorithms", "middle-python-basics", "middle-neural-signals", "middle-model-evaluation", "middle-data-bias", "middle-generative-ai", "middle-ai-safety"];
    for (const courseId of coreCourseIds) {
      for (const tag of getCourseById(courseId)!.knowledgePointTags) {
        completed.masteryByKnowledgePoint[`${courseId}:${tag}`] = {
          knowledgePointId: `${courseId}:${tag}`,
          mastery: 0.7,
          confidence: 1,
          evidenceCount: 1,
          lastPracticedAt: null,
          nextReviewAt: null,
          misconceptionTags: [],
        };
      }
    }
    completed.stageProgressByStage.middle_school.completedActivityIds = getLearningPath("middle_school")
      .map((activity) => activity.id);
    completed.stageProgressByStage.middle_school.experimentEvidence = [{
      runId: "research",
      activityId: "middle-data-bias-research",
      courseId: "middle-data-bias",
      templateId: "image-classifier",
      mode: "research",
      variables: {},
      metrics: { accuracy: 0.8 },
      conclusion: "补充逆光样本后重新评价。",
      completedAt: "2026-08-22T00:00:00.000Z",
    }];
    expect(hasCompletedMiddleSchool(completed)).toBe(true);
    window.localStorage.setItem("mambo.learning-state", JSON.stringify(completed));

    render(<LearningPlatformShell initialStage="high_school" initialView="path" />);

    return waitFor(() => {
      expect(screen.getByRole("heading", { name: "学习路径" })).toBeVisible();
      expect(screen.queryByRole("heading", { name: "先完成初中阶段，再进入高中项目" })).not.toBeInTheDocument();
    });
  });

  it("keeps the shared navigation while rendering an embedded learning tool", () => {
    render(
      <LearningPlatformShell
        contentEyebrow="初中 / 课程实验"
        contentTitle="Python 编程实验室"
        initialStage="middle_school"
        initialView="courses"
      >
        <div>实验室工具内容</div>
      </LearningPlatformShell>,
    );

    expect(screen.getByRole("heading", { name: "Python 编程实验室" })).toBeVisible();
    expect(screen.getByText("实验室工具内容")).toBeVisible();
    expect(screen.getByRole("button", { name: "课程" })).toHaveAttribute("aria-current", "page");
  });

  it("persists a stage switch and routes to its default learning path", async () => {
    const user = userEvent.setup();
    render(<LearningPlatformShell initialView="path" />);

    await user.click(screen.getByRole("button", { name: "年级 · 初一" }));
    await user.click(screen.getByRole("menuitem", { name: "高一" }));

    expect(push).toHaveBeenCalledWith("/learn?stage=high_school&grade=high_1&view=path");
    expect(JSON.parse(window.localStorage.getItem("mambo.learning-state") ?? "{}").profile.stage).toBe("high_school");
  });

  it("returns primary-school learners to the existing map", async () => {
    const user = userEvent.setup();
    render(<LearningPlatformShell initialStage="middle_school" initialView="path" />);

    await user.click(screen.getByRole("button", { name: "年级 · 初一" }));
    await user.click(screen.getByRole("menuitem", { name: "小学" }));

    expect(push).toHaveBeenCalledWith("/map");
    expect(JSON.parse(window.localStorage.getItem("mambo.learning-state") ?? "{}").profile.stage).toBe("upper_primary");
  });

  it.each([
    ["课程", "courses"],
    ["练习", "practice"],
    ["个人画像", "profile"],
  ] as const)("changes to the %s view with keyboard-accessible navigation", async (label, view) => {
    const user = userEvent.setup();
    render(<LearningPlatformShell initialStage="middle_school" initialView="path" />);

    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");

    const selected = screen.getByRole("button", { name: label });
    if (!selected.hasAttribute("aria-current")) {
      await user.click(selected);
    }
    expect(selected).toHaveAttribute("aria-current", "page");
    expect(push).toHaveBeenLastCalledWith(`/learn?stage=middle_school&grade=middle_1&view=${view}`);
  });
});
