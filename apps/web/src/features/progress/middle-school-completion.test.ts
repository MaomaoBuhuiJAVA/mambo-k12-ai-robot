import { describe, expect, it } from "vitest";
import { getCourseById } from "@/data/curriculum";
import { createDefaultLearningState } from "@/lib/learning-store";
import { getMiddleSchoolCompletionRequirements, hasCompletedMiddleSchool } from "./middle-school-completion";

describe("middle-school completion", () => {
  it("requires mastery, research evidence, conclusion and safety assessment before high school", () => {
    const state = createDefaultLearningState();
    expect(hasCompletedMiddleSchool(state)).toBe(false);
    for (const courseId of ["middle-ai-foundations", "middle-data-and-algorithms", "middle-python-basics", "middle-neural-signals", "middle-model-evaluation", "middle-data-bias", "middle-generative-ai", "middle-ai-safety"]) {
      for (const tag of getCourseById(courseId)!.knowledgePointTags) state.masteryByKnowledgePoint[`${courseId}:${tag}`] = { knowledgePointId: `${courseId}:${tag}`, mastery: .7, confidence: 1, evidenceCount: 1, lastPracticedAt: null, nextReviewAt: null, misconceptionTags: [] };
    }
    state.stageProgressByStage.middle_school.completedActivityIds = ["middle-data-bias-research", "middle-ai-safety-assessment"];
    state.stageProgressByStage.middle_school.experimentEvidence = [{ runId: "research", activityId: "middle-data-bias-research", courseId: "middle-data-bias", templateId: "image-classifier", mode: "research", variables: {}, metrics: { accuracy: .7 }, conclusion: "补充逆光样本后重新评价。", completedAt: "2026-08-22T00:00:00.000Z" }];
    expect(getMiddleSchoolCompletionRequirements(state).every((item) => item.met)).toBe(true);
    expect(hasCompletedMiddleSchool(state)).toBe(true);
  });
});
