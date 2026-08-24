import { describe, expect, it } from "vitest";

import type { LearningState, MasteryRecord, Stage } from "@/lib/domain";
import { createDefaultLearningState } from "@/lib/learning-store";
import {
  getStageActivityStatuses,
  recommendNextActivity,
  recommendNextCourse,
} from "./recommendation";

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
    expect(recommendation.course.id).toBe("middle-ai-foundations");
    expect(recommendation.reason).toContain("当前学段");
    expect(recommendation.reason).not.toContain("兴趣");
  });

  it("limits middle-school recommendations to the learner profile grade", () => {
    const value = state("middle_school");
    value.profile.grade = 8;

    const recommendation = recommendNextCourse(value, now);

    expect([
      "middle-python-basics",
      "middle-neural-signals",
      "middle-model-evaluation",
      "middle-data-bias",
    ]).toContain(recommendation.course.id);
  });

  it("lets an explicit grade override the saved profile grade", () => {
    const value = state("high_school");
    value.profile.grade = 10;

    const recommendation = recommendNextCourse(value, now, "high_3");

    expect([
      "high-neural-network-training",
      "high-generative-ai-rag",
      "high-image-model-audit",
      "high-multimodal-ai",
    ]).toContain(recommendation.course.id);
  });

  it("ignores a cross-stage grade instead of recommending outside the learner stage", () => {
    const value = state("middle_school");

    expect(recommendNextCourse(value, now, "high_1").course.stage).toBe("middle_school");
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

describe("stage activity progress", () => {
  it("keeps the overview inside the requested stage and identifies missing prerequisites", () => {
    const value = state("lower_primary");
    const statuses = getStageActivityStatuses(value, "middle_school");

    expect(statuses).toHaveLength(29);
    expect(statuses.every((item) => item.activity.stage === "middle_school")).toBe(true);
    expect(statuses[0]).toMatchObject({
      activity: { id: "middle-ai-foundations-lesson" },
      status: "available",
    });
    expect(statuses.find((item) => item.activity.id === "middle-neural-signals-guided-lab"))
      .toMatchObject({
        status: "locked",
        missingPrerequisites: [{ id: "middle-neural-signals-demonstration" }],
      });
  });

  it("filters a grade view without losing prerequisites from the full stage path", () => {
    const value = state("middle_school");
    const statuses = getStageActivityStatuses(value, "middle_school", "middle_2");

    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((item) => [
      "middle-python-basics",
      "middle-neural-signals",
      "middle-model-evaluation",
      "middle-data-bias",
    ].includes(item.activity.courseId))).toBe(true);
    expect(statuses[0]).toMatchObject({
      activity: { id: "middle-python-basics-lesson" },
      status: "locked",
      missingPrerequisites: [{ id: "middle-data-and-algorithms-assessment" }],
    });

    value.stageProgressByStage.middle_school.completedActivityIds.push(
      "middle-data-and-algorithms-assessment",
    );
    expect(getStageActivityStatuses(value, "middle_school", "middle_2")[0]).toMatchObject({
      activity: { id: "middle-python-basics-lesson" },
      status: "available",
    });
  });

  it("includes deterministic Python lab evidence when ranking a middle-school course", () => {
    const value = state("middle_school");
    value.masteryByKnowledgePoint["middle.python-basics"] = mastery(
      "middle.python-basics",
      0.1,
      "2026-07-17T08:00:00.000Z",
    );

    expect(recommendNextCourse(value, now)).toMatchObject({
      course: { id: "middle-python-basics" },
      kind: "review",
    });
  });

  it("recommends a mapped misconception remediation after a failed first-chapter result interpretation", () => {
    const value = state("middle_school");
    value.masteryByKnowledgePoint["middle-ai-foundations:模型预测与误差"] = mastery(
      "middle-ai-foundations:模型预测与误差",
      0.1,
      "2026-08-18T08:00:00.000Z",
      1,
    );
    value.masteryByKnowledgePoint["middle-ai-foundations:模型预测与误差"].misconceptionTags = ["预测等于事实"];

    expect(recommendNextCourse(value, now)).toMatchObject({
      course: { id: "middle-ai-foundations" },
      kind: "remediate",
      reason: expect.stringContaining("预测等于事实"),
    });
  });

  it("returns a deterministic resume recommendation before another available task", () => {
    const value = state("middle_school");
    value.stageProgressByStage.middle_school = {
      completedActivityIds: [
        "middle-ai-foundations-lesson",
        "middle-ai-foundations-demonstration",
        "middle-ai-foundations-assessment",
        "middle-neural-signals-lesson",
      ],
      experimentEvidence: [],
      activeActivityId: "middle-neural-signals-demonstration",
    };

    expect(recommendNextActivity(value, "middle_school")).toMatchObject({
      activity: { id: "middle-neural-signals-demonstration" },
      kind: "resume",
      reason: expect.stringContaining("上次保存"),
    });
  });

  it("recommends the first unlocked activity with an explainable reason", () => {
    const value = state("high_school");

    expect(recommendNextActivity(value, "high_school")).toMatchObject({
      activity: { id: "high-python-data-lab-lesson" },
      kind: "next",
      reason: expect.stringContaining("起始任务"),
    });
  });

  it("reports no next activity after every activity in the stage is complete", () => {
    const value = state("middle_school");
    value.stageProgressByStage.middle_school.completedActivityIds = getStageActivityStatuses(
      value,
      "middle_school",
    ).map((item) => item.activity.id);

    expect(recommendNextActivity(value, "middle_school")).toBeNull();
  });
});
