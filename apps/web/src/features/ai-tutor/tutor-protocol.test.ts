import { describe, expect, it } from "vitest";

import {
  intersectAllowedActionIds,
  type TutorProtocolWhitelist,
  createTutorProtocolStreamValidator,
  validateLearningContextV2,
  validatePresentationPlanV1,
  validateSlideSpecV1,
  validateTutorInteractionV1,
  validateTutorProtocolEvent,
} from "./tutor-protocol";

const courseId = "middle-ai-foundations";
const lessonId = "middle-ai-foundations:concepts:rules-and-models";
const unitId = "middle-ai-foundations:concepts";
const activityId = "middle-ai-foundations-lesson";
const knowledgePointIds = ["middle-ai-foundations:规则程序与机器学习", "middle-ai-foundations:数据样本"];
const slideIds = ["slide-1", "slide-2", "slide-3", "slide-4"];
const sessionId = "session-local-001";
const traceId = "trace-local-001";

function validContext() {
  return {
    schemaVersion: 2,
    traceId,
    anonymousLearnerId: "learner-local-001",
    stage: "middle_school",
    grade: 8,
    courseId,
    unitId,
    lessonId,
    activityId,
    teachingMode: "ai_tutor",
    knowledgePointIds,
    masterySummary: [{ knowledgePointId: knowledgePointIds[0], level: 0.5, evidenceCount: 2 }],
    misconceptionTags: ["把预测当事实"],
    recentEvidenceSummary: [{ evidenceId: "evidence-1", kind: "quiz", resultCode: "passed", metricSummary: { score: 1 } }],
    allowedActionIds: ["tutor.next_slide", activityId],
  };
}

const contextWhitelist: TutorProtocolWhitelist = {
  actionIds: ["tutor.next_slide", activityId],
  knowledgePointIds,
};

function validPlan() {
  return {
    schemaVersion: 1,
    planId: "plan-1",
    courseId,
    lessonId,
    title: "规则、样本与模型",
    objectiveIds: ["middle-ai-foundations:objective:1"],
    estimatedMinutes: 18,
    slideOutline: [
      { slideId: "slide-1", type: "concept", knowledgePointIds: [knowledgePointIds[0]] },
      { slideId: "slide-2", type: "process", knowledgePointIds: [knowledgePointIds[0]] },
      { slideId: "slide-3", type: "checkpoint", knowledgePointIds: [knowledgePointIds[1]] },
      { slideId: "slide-4", type: "summary", knowledgePointIds: [knowledgePointIds[1]] },
    ],
  };
}

function validSlide(slideId = "slide-1") {
  const slideIndex = slideIds.indexOf(slideId);
  const slideTypes = ["concept", "process", "checkpoint", "summary"] as const;
  const knowledgePointId = slideIndex >= 2 ? knowledgePointIds[1] : knowledgePointIds[0];
  return {
    schemaVersion: 1,
    slideId,
    type: slideTypes[slideIndex >= 0 ? slideIndex : 0],
    title: "先抓住核心概念",
    blocks: [
      { kind: "bullets", items: ["先观察样本，再解释预测"] },
      { kind: "asset", assetId: "middle-ai-foundations:concept-map", alt: "概念关系图" },
    ],
    knowledgePointIds: [knowledgePointId],
    sourceIds: ["course:middle-ai-foundations:v1"],
  };
}

describe("Tutor protocol V2 context", () => {
  it("accepts a configured anonymous context and rejects cross-course IDs", () => {
    const accepted = validateLearningContextV2(validContext(), contextWhitelist);
    expect(accepted.ok).toBe(true);

    const invalid = validateLearningContextV2({ ...validContext(), lessonId: "high-ml-pipeline:data-splits:train-validate-test" }, contextWhitelist);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues.some((item) => item.path === "lessonId")).toBe(true);
  });

  it("rejects unknown action IDs and out-of-range mastery levels", () => {
    const invalid = validateLearningContextV2({
      ...validContext(),
      allowedActionIds: ["tutor.next_slide", "run-arbitrary-command"],
      masterySummary: [{ knowledgePointId: "规则程序与机器学习", level: 2, evidenceCount: 0 }],
    }, contextWhitelist);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues.some((item) => item.path === "allowedActionIds[1]")).toBe(true);
      expect(invalid.issues.some((item) => item.path === "masterySummary[0].level")).toBe(true);
    }
  });

  it("uses formal stage knowledge IDs and requires slide state whitelists", () => {
    const historical = validateLearningContextV2({
      ...validContext(),
      masterySummary: [{ knowledgePointId: "middle-data-and-algorithms:数据表示", level: 0.4, evidenceCount: 1 }],
    }, contextWhitelist);
    expect(historical.ok).toBe(true);

    const naked = validateLearningContextV2({
      ...validContext(),
      knowledgePointIds: ["规则程序与机器学习"],
    }, contextWhitelist);
    expect(naked.ok).toBe(false);

    const missingSlides = validateLearningContextV2({
      ...validContext(),
      presentationState: { sessionId, currentSlideId: "slide-1", completedSlideIds: [] },
    }, contextWhitelist);
    expect(missingSlides.ok).toBe(false);
    if (!missingSlides.ok) expect(missingSlides.issues.some((item) => item.path.startsWith("presentationState.currentSlideId"))).toBe(true);
  });
});

describe("Tutor presentation protocol", () => {
  it("validates plans, slides and event envelopes", () => {
    expect(validatePresentationPlanV1(validPlan(), { courseId, lessonId }, {
      ...contextWhitelist,
      objectiveIds: ["middle-ai-foundations:objective:1"],
    }).ok).toBe(true);
    expect(validateSlideSpecV1(validSlide(), {
      slideIds,
      knowledgePointIds,
      sourceIds: ["course:middle-ai-foundations:v1"],
      assetIds: ["middle-ai-foundations:concept-map"],
    }).ok).toBe(true);
    const event = validateTutorProtocolEvent({
      schemaVersion: 1,
      type: "slide.ready",
      sessionId,
      traceId,
      slide: validSlide(),
    }, { slideIds, knowledgePointIds, sourceIds: ["course:middle-ai-foundations:v1"], assetIds: ["middle-ai-foundations:concept-map"] });
    expect(event.ok).toBe(true);
  });

  it("rejects executable or untrusted presentation resources", () => {
    const result = validateSlideSpecV1({
      ...validSlide(),
      blocks: [{ kind: "asset", assetId: "https://example.com/script.js", alt: "external" }],
    }, { slideIds, knowledgePointIds, sourceIds: ["course:middle-ai-foundations:v1"], assetIds: ["middle-ai-foundations:concept-map"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((item) => item.path === "blocks[0].assetId[0]")).toBe(true);
  });

  it("fails closed when provenance or objective whitelists are omitted", () => {
    const plan = validatePresentationPlanV1(validPlan(), { courseId, lessonId }, { knowledgePointIds });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.issues.some((item) => item.path === "objectiveIds")).toBe(true);

    const slide = validateSlideSpecV1(validSlide(), { slideIds, knowledgePointIds });
    expect(slide.ok).toBe(false);
    if (!slide.ok) expect(slide.issues.some((item) => item.path === "sourceIds")).toBe(true);
  });

  it("binds interaction policy to its interaction kind", () => {
    const result = validateTutorInteractionV1({
      schemaVersion: 1,
      interactionId: "interaction-1",
      slideId: "slide-3",
      kind: "single_choice",
      prompt: "选择一个答案",
      allowedResponseFormat: "option_id",
      evaluationPolicyId: "short-answer-required-v1",
    }, { slideIds, evaluationPolicyIds: ["single-choice-v1", "short-answer-required-v1"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((item) => item.path === "evaluationPolicyId")).toBe(true);
  });
});

describe("Tutor protocol stream", () => {
  it("enforces session, plan and slide associations", () => {
    const stream = createTutorProtocolStreamValidator({
      expected: { traceId, stage: "middle_school", courseId, lessonId },
      whitelist: {
        ...contextWhitelist,
        objectiveIds: ["middle-ai-foundations:objective:1"],
        sourceIds: ["course:middle-ai-foundations:v1"],
        assetIds: ["middle-ai-foundations:concept-map"],
      },
    });
    expect(stream.accept({ schemaVersion: 1, type: "session.started", sessionId, traceId }).ok).toBe(true);
    expect(stream.accept({
      schemaVersion: 1,
      type: "plan.ready",
      sessionId,
      traceId,
      plan: validPlan(),
    }).ok).toBe(true);

    const forged = stream.accept({
      schemaVersion: 1,
      type: "slide.ready",
      sessionId,
      traceId,
      slide: validSlide("slide-forged"),
    });
    expect(forged.ok).toBe(false);
    if (!forged.ok) expect(forged.issues.some((item) => item.path === "slideId[0]")).toBe(true);

    for (const id of slideIds) {
      expect(stream.accept({
        schemaVersion: 1,
        type: "slide.ready",
        sessionId,
        traceId,
        slide: validSlide(id),
      }).ok).toBe(true);
      expect(stream.accept({ schemaVersion: 1, type: "narration.delta", sessionId, traceId, slideId: id, text: "讲解" }).ok).toBe(true);
    }

    expect(stream.accept({
      schemaVersion: 1,
      type: "session.completed",
      sessionId,
      traceId,
      summary: { schemaVersion: 1, summaryId: "summary-1", highlights: ["完成"], nextActivityId: activityId },
    }).ok).toBe(true);
    expect(stream.state).toMatchObject({ phase: "completed", planId: "plan-1", slideIds, readySlideIds: slideIds });
  });
});

describe("Tutor action boundary", () => {
  it("intersects suggestions with the deterministic action allowlist and de-duplicates them", () => {
    expect(intersectAllowedActionIds(
      ["tutor.next_slide", "run-arbitrary-command", "tutor.next_slide"],
      ["tutor.next_slide", "lesson.open_practice"],
    )).toEqual(["tutor.next_slide"]);
  });
});
