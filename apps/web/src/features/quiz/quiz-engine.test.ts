import { describe, expect, it } from "vitest";

import { getCourseById, type CourseExercise } from "@/data/curriculum";
import type { Stage } from "@/lib/domain";
import { gradeExercise } from "./quiz-engine";

const course = getCourseById("lower-bubble-sort")!;

function exercise(type: CourseExercise["type"]) {
  return course.exercises.find((item) => item.type === type)!;
}

describe("gradeExercise", () => {
  it("grades single choice deterministically and trims the selected value", () => {
    const question = exercise("single_choice");
    const correct = gradeExercise(question, `  ${question.answer}  `, "lower_primary");
    const wrong = gradeExercise(question, "不是答案", "lower_primary");

    expect(correct).toMatchObject({
      correct: true,
      score: 1,
      knowledgePointIds: question.knowledgePointTags,
      nextAction: "next",
    });
    expect(correct.feedback).toContain(question.feedback.correct);
    expect(wrong).toMatchObject({ correct: false, score: 0, nextAction: "retry" });
    expect(wrong.feedback).toContain(question.feedback.incorrect);
  });

  it("grades an ordered answer without accepting malformed or duplicate arrays", () => {
    const question = exercise("order");

    expect(gradeExercise(question, [...question.answer], "upper_primary").correct).toBe(true);
    expect(gradeExercise(question, [...question.answer].reverse(), "upper_primary").correct).toBe(false);
    expect(gradeExercise(question, [question.answer[0], question.answer[0]], "upper_primary").correct).toBe(false);
    expect(gradeExercise(question, "not-an-array", "upper_primary").correct).toBe(false);
  });

  it("grades code traces with conservative whitespace normalization", () => {
    const question = exercise("code_trace");

    expect(gradeExercise(question, `\n ${question.answer}\r\n`, "middle_school").correct).toBe(true);
    expect(gradeExercise(question, [question.answer], "middle_school").correct).toBe(false);
    expect(gradeExercise(question, "", "middle_school")).toMatchObject({
      correct: false,
      score: 0,
      nextAction: "retry",
    });
    expect(gradeExercise(question, "x".repeat(501), "middle_school").correct).toBe(false);
  });

  it.each([
    ["lower_primary", "小侦探"],
    ["upper_primary", "规则"],
    ["middle_school", "依据"],
    ["high_school", "边界"],
  ] satisfies Array<[Stage, string]>)
  ("adapts feedback for %s", (stage, expectedLanguage) => {
    const result = gradeExercise(exercise("single_choice"), "wrong", stage);
    expect(result.feedback).toContain(expectedLanguage);
  });

  it("does not mutate exercise answer data", () => {
    const question = exercise("order");
    const snapshot = structuredClone(question.answer);
    gradeExercise(question, [...question.answer].reverse(), "high_school");
    expect(question.answer).toEqual(snapshot);
  });
});
