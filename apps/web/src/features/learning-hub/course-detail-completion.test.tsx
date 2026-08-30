import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { getStructuredCourse } from "@/data/course-structure";
import { getLearningPath } from "@/data/learning-paths";
import { createDefaultLearningState, saveLearningState } from "@/lib/learning-store";
import { CourseDetail } from "./course-detail";

describe("CourseDetail completion state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows a completed course state while retaining individual review links", () => {
    const course = getStructuredCourse("middle-ai-foundations");
    if (!course) throw new Error("Expected structured middle-school course");
    const state = createDefaultLearningState();
    const courseActivityIds = getLearningPath("middle_school")
      .filter((activity) => activity.courseId === course.course.id)
      .map((activity) => activity.id);
    saveLearningState({
      ...state,
      stageProgressByStage: {
        ...state.stageProgressByStage,
        middle_school: {
          ...state.stageProgressByStage.middle_school,
          completedActivityIds: courseActivityIds,
        },
      },
    });

    render(<CourseDetail course={course} />);

    expect(screen.getByText("课程已完成")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "复习" }).length).toBeGreaterThan(0);
  });
});
