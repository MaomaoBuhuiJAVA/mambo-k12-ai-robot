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

  it("grades multi-select answers as an exact set", () => {
    const question = exercise("multi_select");
    if (question.type !== "multi_select") throw new Error("Expected multi-select exercise");
    expect(gradeExercise(question, [...question.answers].reverse(), "middle_school").correct).toBe(true);
    expect(gradeExercise(question, [question.answers[0]], "middle_school").correct).toBe(false);
    expect(gradeExercise(question, [...question.answers, question.answers[0]], "middle_school").correct).toBe(false);
  });

  it("normalizes whitespace for code-fill answers", () => {
    const question = exercise("code_fill");
    if (question.type !== "code_fill") throw new Error("Expected code-fill exercise");
    expect(gradeExercise(question, `  ${question.answer.replace(/ /g, "   ")}  `, "high_school").correct).toBe(true);
    expect(gradeExercise(question, "different output", "high_school").correct).toBe(false);
  });

  it("grades configured result interpretation with the same deterministic answer contract", () => {
    const interpretation = getCourseById("middle-ai-foundations")!.exercises
      .find((item) => item.type === "result_interpretation")!;
    expect(gradeExercise(interpretation, interpretation.answer, "middle_school")).toMatchObject({
      correct: true,
      nextAction: "next",
    });
    expect(gradeExercise(interpretation, "预测就是事实，不需要再核对图片", "middle_school"))
      .toMatchObject({ correct: false, nextAction: "retry" });
  });

  it("grades training-sample classification with an exact normalized label", () => {
    const middle = getCourseById("middle-ai-foundations")!;
    const question = middle.exercises.find((item) => item.type === "classification");
    if (!question || question.type !== "classification") throw new Error("Expected classification exercise");

    expect(gradeExercise(question, `  ${question.answer}  `, "middle_school")).toMatchObject({
      correct: true,
      score: 1,
      nextAction: "next",
    });
    expect(gradeExercise(question, "书本", "middle_school")).toMatchObject({
      correct: false,
      score: 0,
      nextAction: "retry",
    });
    expect(gradeExercise(question, [question.answer], "middle_school").correct).toBe(false);
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
