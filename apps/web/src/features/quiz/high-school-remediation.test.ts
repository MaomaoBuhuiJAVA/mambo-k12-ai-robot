import { describe, expect, it } from "vitest";

import {
  getHighSchoolRemediation,
  getHighSchoolRemediationActivity,
  getHighSchoolRemediationForCourse,
  getHighSchoolRemediationForExercise,
  getHighSchoolRemediations,
} from "./high-school-remediation";

describe("high-school remediation activities", () => {
  it("covers every H-01 to H-08 course with a stable retest route", () => {
    const activities = getHighSchoolRemediations();
    expect(activities).toHaveLength(8);
    expect(new Set(activities.map((activity) => activity.courseId)).size).toBe(8);

    for (const activity of activities) {
      expect(activity.activityId).toMatch(/^high-[a-z-]+-remediation$/);
      expect(activity.route).toContain(`course--${activity.courseId}`);
      expect(activity.triggerExerciseIds.length).toBeGreaterThanOrEqual(activity.retestExerciseIds.length);
      expect(activity.retestExerciseIds.length).toBeGreaterThanOrEqual(2);
      expect(activity.nextStep.length).toBeGreaterThan(10);
    }
  });

  it("maps failed exercise evidence to the matching course activity", () => {
    const remediation = getHighSchoolRemediationForExercise("high-neural-network-training-trace");
    expect(remediation).toMatchObject({
      courseId: "high-neural-network-training",
      activityId: "high-neural-network-training-remediation",
      tag: "训练曲线证据不完整",
    });
    expect(getHighSchoolRemediationForCourse("high-generative-ai-rag")?.route).toContain("high-generative-ai-rag");
    expect(getHighSchoolRemediation("引用与工具权限未核对")?.courseId).toBe("high-generative-ai-rag");
    expect(getHighSchoolRemediationActivity("unknown-remediation")).toBeUndefined();
  });
});
