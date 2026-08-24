import { describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";
import { getLearningPath } from "@/data/learning-paths";
import { createDefaultLearningState } from "@/lib/learning-store";
import { recordQuizAttempt } from "@/features/quiz/quiz-progress";
import {
  getPracticeSet,
  getPracticeSetSummaries,
  isKnownPracticeSetId,
  practiceSetIdForCourse,
} from "./practice-data";

describe("practice data", () => {
  it("builds a stable five-question daily set from configured course exercises", () => {
    const state = createDefaultLearningState();
    const date = new Date("2026-08-22T09:00:00.000Z");
    const first = getPracticeSet("middle_school", "daily-middle_school", state, date)!;
    const second = getPracticeSet("middle_school", "daily-middle_school", state, date)!;

    expect(first.questions).toHaveLength(5);
    expect(first.questions.map((question) => question.key)).toEqual(second.questions.map((question) => question.key));
    expect(first.questions.every((question) => question.course.stage === "middle_school")).toBe(true);
  });

  it("rotates the daily question fingerprint with the UTC date", () => {
    const state = createDefaultLearningState();
    const today = getPracticeSet("middle_school", "daily-middle_school", state, new Date("2026-08-22T09:00:00.000Z"))!;
    const tomorrow = getPracticeSet("middle_school", "daily-middle_school", state, new Date("2026-08-23T09:00:00.000Z"))!;

    expect(today.questions.map((question) => question.key)).not.toEqual(
      tomorrow.questions.map((question) => question.key),
    );
  });

  it("uses the selected grade focus when building daily practice", () => {
    const state = createDefaultLearningState();
    const practice = getPracticeSet(
      "middle_school",
      "daily-middle_school",
      state,
      new Date("2026-08-22T09:00:00.000Z"),
      undefined,
      "middle_2",
    )!;

    expect(practice.title).toBe("初二每日 5 题");
    expect(practice.questions.every((question) => [
      "middle-python-basics",
      "middle-neural-signals",
      "middle-model-evaluation",
    ].includes(question.course.id))).toBe(true);
  });

  it("starts current-course practice from the selected grade focus", () => {
    const summary = getPracticeSetSummaries("middle_school", createDefaultLearningState(), new Date(), "middle_2")
      .find((item) => item.kind === "course");

    expect(summary?.id).toBe("course--middle-python-basics");
    expect(summary?.title).toBe("当前课程练习");
    expect(summary?.description).toContain("Python 编程入门");
    expect(summary?.formats).toEqual(expect.arrayContaining(["单选", "步骤排序", "代码追踪", "代码填空"]));
    expect(summary?.estimatedMinutes).toBeGreaterThanOrEqual(10);
  });

  it("keeps assessment and remediation questions inside the selected grade", () => {
    const state = createDefaultLearningState();
    const assessment = getPracticeSet(
      "middle_school",
      "assessment-middle_school",
      state,
      new Date("2026-08-22T09:00:00.000Z"),
      undefined,
      "middle_2",
    )!;
    expect(assessment.questions).toHaveLength(4);
    expect(assessment.questions.every((question) => [
      "middle-python-basics",
      "middle-neural-signals",
      "middle-model-evaluation",
      "middle-data-bias",
    ].includes(question.course.id))).toBe(true);

    const course = getCourseById("middle-python-basics")!;
    const exercise = course.exercises.find((item) => item.id === "middle-python-basics-choice")!;
    const stateWithError = recordQuizAttempt(state, {
      course,
      exercise,
      score: 0,
      hints: 0,
      completedAt: "2026-08-22T09:00:00.000Z",
      attemptId: "practice-data-grade-remediation",
    });
    const remediation = getPracticeSet(
      "middle_school",
      "remediation-middle_school",
      stateWithError,
      new Date("2026-08-22T09:00:00.000Z"),
      undefined,
      "middle_2",
    )!;
    expect(remediation.questions.every((question) => [
      "middle-python-basics",
      "middle-neural-signals",
      "middle-model-evaluation",
      "middle-data-bias",
    ].includes(question.course.id))).toBe(true);
  });

  it("does not open a course practice set outside the selected grade", () => {
    const state = createDefaultLearningState();

    expect(getPracticeSet(
      "middle_school",
      practiceSetIdForCourse("middle-ai-foundations"),
      state,
      new Date("2026-08-23T00:00:00.000Z"),
      undefined,
      "middle_2",
    )).toBeUndefined();
  });

  it("rejects a practice set when the grade belongs to another stage", () => {
    const state = createDefaultLearningState();

    expect(getPracticeSet(
      "middle_school",
      "daily-middle_school",
      state,
      new Date("2026-08-23T00:00:00.000Z"),
      undefined,
      "high_1",
    )).toBeUndefined();
  });

  it("does not expose a remediation set until the learning record contains a real incorrect evidence", () => {
    const base = createDefaultLearningState();
    const foundations = getCourseById("middle-ai-foundations")!;
    const exercise = foundations.exercises.find((item) => item.id === "middle-ai-foundations-result")!;
    const before = getPracticeSet("middle_school", "remediation-middle_school", base)!;
    const afterState = recordQuizAttempt(base, {
      course: foundations,
      exercise,
      score: 0,
      hints: 0,
      completedAt: "2026-08-22T09:00:00.000Z",
      attemptId: "practice-data-remediation",
    });
    const after = getPracticeSet("middle_school", "remediation-middle_school", afterState)!;

    expect(before.questions).toHaveLength(0);
    expect(after.questions.map((question) => question.exercise.id)).toContain(exercise.id);
    expect(getPracticeSetSummaries("middle_school", base).find((item) => item.kind === "remediation"))
      .toMatchObject({ disabled: true, questionCount: 0, formats: ["针对性复测"], estimatedMinutes: 8 });
  });

  it("only accepts configured stage-scoped and course-scoped practice routes", () => {
    expect(isKnownPracticeSetId("high_school", "daily-high_school")).toBe(true);
    expect(isKnownPracticeSetId("high_school", practiceSetIdForCourse("high-python-data-lab"))).toBe(true);
    expect(isKnownPracticeSetId("middle_school", practiceSetIdForCourse("high-python-data-lab"))).toBe(false);
    expect(isKnownPracticeSetId("middle_school", "course--untrusted")).toBe(false);
  });

  it("follows the active learning-path course instead of a stale last-course record", () => {
    const state = createDefaultLearningState();
    const next = getLearningPath("middle_school").find(
      (activity) => activity.courseId === "middle-data-and-algorithms",
    );
    if (!next) throw new Error("Expected the data-and-algorithms activity");
    state.stageProgressByStage.middle_school.completedActivityIds = [...next.prerequisites];
    state.stageProgressByStage.middle_school.activeActivityId = next.id;
    state.lastCourseId = "middle-ai-safety";

    const summary = getPracticeSetSummaries("middle_school", state)
      .find((item) => item.kind === "course");

    expect(summary?.description).toContain("数据与算法：让信息可以计算");
    expect(summary?.id).toBe("course--middle-data-and-algorithms");
  });

  it("opens only the configured retest questions for a high-school remediation activity", () => {
    const state = createDefaultLearningState();
    const practice = getPracticeSet(
      "high_school",
      "course--high-generative-ai-rag",
      state,
      new Date("2026-08-23T00:00:00.000Z"),
      "high-generative-ai-rag-remediation",
    );

    expect(practice).toMatchObject({
      title: "生成式 AI、大语言模型与 RAG补救练习",
      remediationActivityId: "high-generative-ai-rag-remediation",
    });
    expect(practice?.questions.map((question) => question.exercise.id)).toEqual([
      "high-generative-ai-rag-order",
      "high-generative-ai-rag-result",
    ]);
    expect(getPracticeSet(
      "high_school",
      "course--high-generative-ai-rag",
      state,
      new Date("2026-08-23T00:00:00.000Z"),
      "high-python-data-lab-remediation",
    )).toBeUndefined();
  });
});
