import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { getCourseLesson, getStructuredCourse } from "@/data/course-structure";
import { createDefaultLearningState, loadLearningState, saveLearningState } from "@/lib/learning-store";
import { LessonWorkspace } from "./lesson-workspace";

describe("LessonWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("records a reviewed lesson through the existing deterministic activity state", async () => {
    const user = userEvent.setup();
    const course = getStructuredCourse("middle-ai-foundations");
    const lesson = getCourseLesson("middle-ai-foundations:concepts:rules-and-models");
    if (!course || !lesson) throw new Error("Expected structured lesson");

    render(<LessonWorkspace course={course} lesson={lesson} />);

    expect(screen.getByRole("heading", { name: "规则、样本与模型" })).toBeVisible();
    const complete = screen.getByRole("button", { name: "记录本活动完成" });
    expect(complete).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(complete).toBeEnabled();
    await user.click(complete);

    expect(loadLearningState().stageProgressByStage.middle_school.completedActivityIds)
      .toContain("middle-ai-foundations-lesson");
    expect(screen.getByRole("status")).toHaveTextContent("当前活动已记录");
  });

  it("shows the assessment lock reason instead of rendering a blank direct link", () => {
    const course = getStructuredCourse("middle-ai-foundations");
    const lesson = getCourseLesson("middle-ai-foundations:evidence:prediction-is-not-fact");
    if (!course || !lesson) throw new Error("Expected structured lesson");

    render(
      <LessonWorkspace
        course={course}
        initialActivityId="middle-ai-foundations-assessment"
        lesson={lesson}
      />,
    );

    expect(screen.getByRole("heading", { name: "人工智能基础评价" })).toBeVisible();
    expect(screen.getByText("活动已锁定")).toBeVisible();
    expect(screen.getByRole("list", { name: "需要先完成的活动" })).toHaveTextContent("规则与样本演示");
    expect(screen.getAllByRole("link", { name: /返回课程详情/ }).at(-1)).toHaveAttribute(
      "href",
      "/learn/course/middle-ai-foundations",
    );
  });

  it("opens the same configured lesson in the offline AI tutor", () => {
    const course = getStructuredCourse("middle-ai-foundations");
    const lesson = getCourseLesson("middle-ai-foundations:concepts:rules-and-models");
    if (!course || !lesson) throw new Error("Expected structured lesson");

    render(<LessonWorkspace course={course} lesson={lesson} />);

    expect(screen.getByRole("link", { name: "开启 AI 导师" }))
      .toHaveAttribute("href", "/learn/tutor/middle-ai-foundations:concepts:rules-and-models");
  });

  it("uses the unified practice session for an unlocked lesson assessment", async () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.completedActivityIds = [
      "middle-ai-foundations-lesson",
      "middle-ai-foundations-demonstration",
    ];
    saveLearningState(state);
    const course = getStructuredCourse("middle-ai-foundations");
    const lesson = getCourseLesson("middle-ai-foundations:evidence:prediction-is-not-fact");
    if (!course || !lesson) throw new Error("Expected structured lesson");

    render(<LessonWorkspace course={course} initialActivityId="middle-ai-foundations-assessment" lesson={lesson} />);

    await screen.findByRole("button", { name: "提交答案" });
    expect(screen.getByRole("button", { name: "提示" })).toBeVisible();
    expect(screen.getByRole("button", { name: "提交答案" })).toBeVisible();
  });
});
