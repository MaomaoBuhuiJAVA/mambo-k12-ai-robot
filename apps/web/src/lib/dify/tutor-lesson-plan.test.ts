import { afterEach, describe, expect, it } from "vitest";

import {
  createTutorLessonPlanFallback,
  parseTutorLessonPlanOutput,
  requestDifyTutorLessonPlan,
  type TutorLessonPlanRequestInput,
} from "./tutor-lesson-plan";

const input: TutorLessonPlanRequestInput = {
  request: {
    schemaVersion: 1,
    traceId: "trace:tutor-plan-test",
    courseId: "middle-ai-foundations",
    lessonId: "middle-ai-foundations:concepts:rules-and-models",
    context: { stage: "middle_school", learnerSummary: "已完成上一页观察练习。" },
  },
  title: "规则、样本与模型",
  activityId: "middle-ai-foundations-lesson",
  sourceId: "course:middle-ai-foundations:seed-v1",
  seedSlides: [
    { id: "title", title: "规则、样本与模型", blocks: ["认识规则和样本"], narration: "先认识本节课。" },
    { id: "checkpoint", title: "做一次预测", blocks: ["根据证据作答"], narration: "请根据证据判断。", interaction: { prompt: "下一步做什么？", options: ["核对证据", "直接猜"], correctIndex: 0 } },
  ],
};

afterEach(() => {
  delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
  delete process.env.DIFY_BASE_URL;
});

describe("tutor lesson plan contract", () => {
  it("creates a deterministic fallback from the configured seed slides", () => {
    const result = createTutorLessonPlanFallback(input);
    expect(result.payload.slides).toHaveLength(2);
    expect(result.payload.slides[1]?.knowledgeCheck?.answerIndex).toBe(0);
    expect(result.sourceIds).toEqual([input.sourceId]);
  });

  it("accepts only seed slide IDs and a bounded structured plan", () => {
    const output = {
      payload: {
        courseId: input.request.courseId,
        lessonId: input.request.lessonId,
        title: input.title,
        slides: [
          { slideId: "title", title: "规则", bulletPoints: ["样本"], narration: "讲解。", knowledgeCheck: { kind: "single_choice", prompt: "哪项正确？", options: ["样本", "猜测"], answerIndex: 0, explanation: "依据本页。" } },
        ],
      },
    };
    expect(parseTutorLessonPlanOutput(JSON.stringify(output), input)?.payload.title).toBe(input.title);
    expect(parseTutorLessonPlanOutput(JSON.stringify({ ...output, payload: { ...output.payload, slides: [{ ...output.payload.slides[0], slideId: "unknown" }] } }), input)).toBeNull();
  });

  it("uses the shared teaching agent and parses a fenced JSON answer without network access", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "test-key";
    const fetchImpl: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.inputs).toMatchObject({ teaching_mode: "ai_tutor", course_id: input.request.courseId });
      expect(body.query).toContain("已有种子课件");
      return new Response(JSON.stringify({ answer: `\`\`\`json\n${JSON.stringify({
        courseId: input.request.courseId,
        lessonId: input.request.lessonId,
        title: input.title,
        slides: [{ slideId: "title", title: "规则", bulletPoints: ["样本"], narration: "讲解。", knowledgeCheck: { kind: "single_choice", prompt: "哪项正确？", options: ["样本", "猜测"], answerIndex: 0, explanation: "依据本页。" } }],
      })}\n\`\`\`` }), { status: 200 });
    };
    const result = await requestDifyTutorLessonPlan(input, { fetchImpl });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload.slides[0]?.slideId).toBe("title");
  });

  it("returns a controlled reason for malformed Dify output", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "test-key";
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ answer: "{}" }), { status: 200 });
    await expect(requestDifyTutorLessonPlan(input, { fetchImpl })).resolves.toMatchObject({ ok: false, reason: "DIFY_INVALID_OUTPUT" });
  });
});
