import { describe, expect, it } from "vitest";

import { getLearningPath } from "@/data/learning-paths";
import { createDefaultLearningState } from "@/lib/learning-store";
import { getCourseProgressSnapshots } from "./learning-hub-data";

describe("getCourseProgressSnapshots", () => {
  it("derives available and locked course states from the configured learning path", () => {
    const snapshots = getCourseProgressSnapshots(
      createDefaultLearningState(),
      "middle_school",
    );

    expect(snapshots).toHaveLength(8);
    expect(snapshots[0]).toMatchObject({
      course: { id: "middle-ai-foundations" },
      completedCount: 0,
      status: "available",
      action: {
        href: "/workspace?course=middle-ai-foundations",
        label: "开始学习",
      },
    });
    expect(snapshots[1]).toMatchObject({
      course: { id: "middle-data-and-algorithms" },
      status: "locked",
      action: null,
    });
  });

  it("changes the next course only after the configured predecessor tasks are completed", () => {
    const state = createDefaultLearningState();
    const foundations = getLearningPath("middle_school")
      .filter((activity) => activity.courseId === "middle-ai-foundations");
    state.stageProgressByStage.middle_school.completedActivityIds = foundations.map(
      (activity) => activity.id,
    );

    const snapshots = getCourseProgressSnapshots(state, "middle_school");
    expect(snapshots[0]).toMatchObject({
      completedCount: foundations.length,
      status: "completed",
      action: { label: "复习课程" },
    });
    expect(snapshots[1]).toMatchObject({
      course: { id: "middle-data-and-algorithms" },
      status: "available",
      action: {
        href: "/workspace?course=middle-data-and-algorithms",
        label: "开始学习",
      },
    });
  });

  it("marks a course as containing a lab only when its actual path has a lab template", () => {
    const snapshots = getCourseProgressSnapshots(
      createDefaultLearningState(),
      "high_school",
    );

    expect(snapshots.find((item) => item.course.id === "high-python-data-lab")?.hasLab).toBe(true);
    expect(snapshots.find((item) => item.course.id === "high-image-model-audit")?.hasLab).toBe(true);
  });

  it("returns only the selected grade courses while preserving locked predecessor state", () => {
    const snapshots = getCourseProgressSnapshots(
      createDefaultLearningState(),
      "middle_school",
      "middle_2",
    );

    expect(snapshots.map((item) => item.course.id)).toEqual([
      "middle-python-basics",
      "middle-neural-signals",
      "middle-model-evaluation",
      "middle-data-bias",
    ]);
    expect(snapshots[0]).toMatchObject({ status: "locked", action: null });
    expect(snapshots[0]?.activities[0]?.missingPrerequisites[0]).toMatchObject({
      id: "middle-data-and-algorithms-assessment",
    });
  });
});
