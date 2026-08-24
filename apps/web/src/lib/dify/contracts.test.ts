import { describe, expect, it } from "vitest";

import {
  BattleQuestionResponseSchema,
  PrimaryBattleQuestionRequestSchema,
  parseBattleQuestionResponse,
} from "./contracts";

const context = {
  schemaVersion: 1 as const,
  traceId: "trace:test-castle-001",
  anonymousLearnerId: "anon:test",
  stage: "lower_primary" as const,
  grade: 2,
  teachingMode: "battle" as const,
  activityId: "primary-battle:castle-1",
  courseId: null,
  moduleId: "castle-1",
  storybookId: null,
  pageNumber: null,
  knowledgePointIds: ["castle:ordered-observation"],
  completedActivityIds: ["castle-lesson-01"],
  masterySummary: [],
  misconceptionTags: [],
  recentEvidenceSummary: [],
  allowedActionIds: [],
};

const response = {
  schemaVersion: 1 as const,
  traceId: context.traceId,
  workflowVersion: "primary-battle-question-v1" as const,
  resultType: "battle_question" as const,
  contentVersion: "2026-08-24",
  sourceIds: ["storybook:castle-lesson-01:p04"],
  payload: {
    questionId: "generated:castle-1:observation:001",
    topic: "有序观察",
    prompt: "观察城门时，哪种做法更可靠？",
    options: ["按颜色、形状、数量记录", "凭感觉猜魔法", "只看一眼就下结论", "把传闻当事实"],
    answerIndex: 0,
    explanation: "先记录看得见、数得出的特征，再进行判断。",
    knowledgePointIds: ["castle:ordered-observation"],
    sourcePageIds: ["castle-lesson-01:p04"],
  },
};

describe("Dify contracts", () => {
  it("accepts a validated primary battle request", () => {
    expect(PrimaryBattleQuestionRequestSchema.safeParse({
      context,
      questionIndex: 0,
      difficulty: "introductory",
      excludedQuestionIds: [],
      allowedKnowledgePointIds: ["castle:ordered-observation"],
    }).success).toBe(true);
  });

  it("rejects middle-school context on the primary battle workflow", () => {
    const result = PrimaryBattleQuestionRequestSchema.safeParse({
      context: { ...context, stage: "middle_school", teachingMode: "battle" },
      questionIndex: 0,
      difficulty: "standard",
      excludedQuestionIds: [],
      allowedKnowledgePointIds: ["castle:ordered-observation"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate options and invalid source-free responses", () => {
    const duplicate = {
      ...response,
      payload: { ...response.payload, options: ["A", "A", "C", "D"] },
    };
    expect(BattleQuestionResponseSchema.safeParse(duplicate).success).toBe(false);
    expect(parseBattleQuestionResponse({ ...response, sourceIds: [] }).ok).toBe(false);
  });

  it("returns a stable degradation reason for malformed Dify output", () => {
    const result = parseBattleQuestionResponse({ ...response, payload: { ...response.payload, answerIndex: 8 } });
    expect(result).toMatchObject({ ok: false, reason: "DIFY_INVALID_STRUCTURED_OUTPUT" });
  });
});
