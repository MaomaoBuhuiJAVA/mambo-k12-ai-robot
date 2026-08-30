import { describe, expect, it } from "vitest";

import {
  LEARNING_GRADES,
  gradeIdForProfile,
  getLearningGrades,
  getLearningGrade,
  parseLearningGrade,
  validateLearningGrades,
} from "./learning-grades";

describe("learning grades", () => {
  it("keeps three grades under each application stage", () => {
    expect(getLearningGrades("middle_school").map((grade) => grade.id)).toEqual([
      "middle_1",
      "middle_2",
      "middle_3",
    ]);
    expect(getLearningGrades("high_school").map((grade) => grade.id)).toEqual([
      "high_1",
      "high_2",
      "high_3",
    ]);
  });

  it("gives every grade four or more real courses from its own stage", () => {
    expect(() => validateLearningGrades()).not.toThrow();

    for (const grade of LEARNING_GRADES) {
      expect(grade.courseIds.length, grade.id).toBeGreaterThanOrEqual(4);
      expect(new Set(grade.courseIds).size, grade.id).toBe(grade.courseIds.length);
    }
  });

  it("maps an existing profile grade to a stable view", () => {
    expect(gradeIdForProfile("middle_school", 8)).toBe("middle_2");
    expect(gradeIdForProfile("high_school", 12)).toBe("high_3");
    expect(gradeIdForProfile("middle_school", null)).toBe("middle_1");
  });

  it("rejects unknown grade IDs without inventing a route", () => {
    expect(parseLearningGrade("middle_2")).toBe("middle_2");
    expect(parseLearningGrade("middle_4")).toBeUndefined();
    expect(getLearningGrade("high_2").focus).toContain("RAG");
  });

  it("rejects incomplete, duplicate, unknown, and cross-stage course assignments", () => {
    const incomplete = LEARNING_GRADES.map((grade) => ({ ...grade, courseIds: [...grade.courseIds] }));
    incomplete[0]!.courseIds = incomplete[0]!.courseIds.slice(0, 3);
    expect(() => validateLearningGrades(incomplete)).toThrow("at least 4 courses");

    const duplicate = LEARNING_GRADES.map((grade) => ({ ...grade, courseIds: [...grade.courseIds] }));
    duplicate[0]!.courseIds = [
      duplicate[0]!.courseIds[0]!,
      duplicate[0]!.courseIds[0]!,
      ...duplicate[0]!.courseIds.slice(2),
    ];
    expect(() => validateLearningGrades(duplicate)).toThrow("Duplicate grade course ID");

    const unknown = LEARNING_GRADES.map((grade) => ({ ...grade, courseIds: [...grade.courseIds] }));
    unknown[0]!.courseIds[0] = "missing-course";
    expect(() => validateLearningGrades(unknown)).toThrow("Unknown grade course ID");

    const crossStage = LEARNING_GRADES.map((grade) => ({ ...grade, courseIds: [...grade.courseIds] }));
    crossStage[0]!.courseIds[0] = "high-python-data-lab";
    expect(() => validateLearningGrades(crossStage)).toThrow("Cross-stage grade course");
  });
});
