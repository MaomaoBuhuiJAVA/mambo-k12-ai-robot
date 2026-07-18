import { describe, expect, it } from "vitest";

import type { LearningState, MasteryRecord, Stage } from "@/lib/domain";
import { createDefaultLearningState } from "@/lib/learning-store";
import { recommendNextCourse } from "./recommendation";

const now = new Date("2026-07-18T08:00:00.000Z");

function state(stage: Stage = "lower_primary"): LearningState {
  const value = createDefaultLearningState();
  value.profile.stage = stage;
  return value;
}

function mastery(id: string, score: number, nextReviewAt: string, evidenceCount = 1): MasteryRecord {
  return {
    knowledgePointId: id,
    mastery: score,
    confidence: Math.min(1, evidenceCount / 5),
    evidenceCount,
    lastPracticedAt: "2026-07-17T08:00:00.000Z",
    nextReviewAt,
    misconceptionTags: score < 0.5 ? ["needs-review"] : [],
  };
}

describe("recommendNextCourse", () => {
  it("prioritizes overdue and weak knowledge in the learner stage", () => {
    const value = state();
    value.masteryByKnowledgePoint["lower-bubble-sort:相邻比较"] =
      mastery("lower-bubble-sort:相邻比较", 0.15, "2026-07-17T08:00:00.000Z");

    const recommendation = recommendNextCourse(value, now);
    expect(recommendation.course.id).toBe("lower-bubble-sort");
    expect(recommendation.reason).toMatch(/到期|薄弱/);
  });

  it("uses interests only to break otherwise equal candidates", () => {
    const value = state();
    value.interests = ["图片", "分类"];

    expect(recommendNextCourse(value, now).course.id).toBe("lower-picture-labels");
  });

  it("puts recently mastered future reviews into spacing instead of drilling them", () => {
    const value = state();
    value.masteryByKnowledgePoint["lower-bubble-sort:相邻比较"] =
      mastery("lower-bubble-sort:相邻比较", 0.95, "2026-08-18T08:00:00.000Z", 6);
    value.masteryByKnowledgePoint["lower-bubble-sort:交换"] =
      mastery("lower-bubble-sort:交换", 0.95, "2026-08-18T08:00:00.000Z", 6);
    value.masteryByKnowledgePoint["lower-bubble-sort:从小到大"] =
      mastery("lower-bubble-sort:从小到大", 0.95, "2026-08-18T08:00:00.000Z", 6);

    const recommendation = recommendNextCourse(value, now);
    expect(recommendation.course.id).toBe("lower-picture-labels");
    expect(recommendation.reason).toContain("间隔复习");
  });

  it("chooses a featured same-stage course with an explainable reason when history is empty", () => {
    const recommendation = recommendNextCourse(state("middle_school"), now);
    expect(recommendation.course.id).toBe("middle-neural-signals");
    expect(recommendation.reason).toContain("当前学段");
    expect(recommendation.reason).not.toContain("兴趣");
  });

  it("keeps same-stage courses ahead of tempting cross-stage interest matches", () => {
    const value = state("upper_primary");
    value.interests = ["模型审计", "交叉熵", "高中"];
    expect(recommendNextCourse(value, now).course.stage).toBe("upper_primary");
  });

  it("does not let overdue cross-stage work displace an available same-stage path", () => {
    const value = state("lower_primary");
    value.masteryByKnowledgePoint["high-bubble-analysis:循环不变量"] =
      mastery("high-bubble-analysis:循环不变量", 0.05, "2026-07-01T08:00:00.000Z");
    expect(recommendNextCourse(value, now).course.stage).toBe("lower_primary");
  });

  it("never crosses into an adjacent stage even when its evidence is very weak and overdue", () => {
    const value = state("lower_primary");
    for (const tag of ["顺序", "循环", "条件"]) {
      const id = `upper-loop-mission:${tag}`;
      value.masteryByKnowledgePoint[id] = mastery(id, 0, "2025-01-01T00:00:00.000Z");
    }
    expect(recommendNextCourse(value, now).course.stage).toBe("lower_primary");
  });

  it("ignores forged prefixed knowledge records that are not real course tags", () => {
    const value = state();
    value.interests = ["图片"];
    value.masteryByKnowledgePoint["lower-bubble-sort:forged-tag"] =
      mastery("lower-bubble-sort:forged-tag", 0, "2025-01-01T00:00:00.000Z");
    expect(recommendNextCourse(value, now).course.id).toBe("lower-picture-labels");
  });

  it("does not defer a course when only one of its knowledge points is mastered", () => {
    const value = state();
    value.masteryByKnowledgePoint["lower-bubble-sort:相邻比较"] =
      mastery("lower-bubble-sort:相邻比较", 0.95, "2026-08-18T08:00:00.000Z", 6);
    expect(recommendNextCourse(value, now).course.id).toBe("lower-bubble-sort");
  });
});
