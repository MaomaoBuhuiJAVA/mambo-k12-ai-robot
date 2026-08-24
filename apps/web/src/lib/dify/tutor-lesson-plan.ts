import { z } from "zod";

import { DIFY_CONTENT_VERSION } from "./contracts";

const DEFAULT_DIFY_BASE_URL = "https://api.dify.ai/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

export const TUTOR_LESSON_PLAN_WORKFLOW_VERSION = "ai-tutor-lesson-plan-v1" as const;

const identifier = z.string().trim().min(1).max(160).regex(/^[\w:-]+$/u);
const shortText = (max: number) => z.string().trim().min(1).max(max);

const knowledgeCheckSchema = z.object({
  kind: z.literal("single_choice"),
  prompt: shortText(280),
  options: z.array(shortText(160)).min(2).max(4).refine((options) => new Set(options).size === options.length, "options must be unique"),
  answerIndex: z.number().int().min(0).max(3),
  explanation: shortText(280),
}).strict().superRefine((value, ctx) => {
  if (value.answerIndex >= value.options.length) {
    ctx.addIssue({ code: "custom", path: ["answerIndex"], message: "must reference an option" });
  }
});

export const TutorLessonPlanRequestSchema = z.object({
  schemaVersion: z.literal(1),
  traceId: identifier.max(120),
  courseId: identifier,
  lessonId: identifier,
  context: z.object({
    stage: z.enum(["middle_school", "high_school"]),
    learnerSummary: z.string().trim().max(480),
  }).strict(),
}).strict();

export const TutorLessonPlanSlideSchema = z.object({
  slideId: identifier,
  title: shortText(100),
  bulletPoints: z.array(shortText(180)).min(1).max(4),
  narration: shortText(700),
  knowledgeCheck: knowledgeCheckSchema,
}).strict();

export const TutorLessonPlanPayloadSchema = z.object({
  courseId: identifier,
  lessonId: identifier,
  title: shortText(160),
  slides: z.array(TutorLessonPlanSlideSchema).min(1).max(6),
}).strict().superRefine((value, ctx) => {
  const slideIds = value.slides.map((slide) => slide.slideId);
  if (new Set(slideIds).size !== slideIds.length) {
    ctx.addIssue({ code: "custom", path: ["slides"], message: "slide IDs must be unique" });
  }
});

export const TutorLessonPlanSchema = z.object({
  schemaVersion: z.literal(1),
  traceId: identifier.max(120),
  workflowVersion: z.literal(TUTOR_LESSON_PLAN_WORKFLOW_VERSION),
  resultType: z.literal("tutor_lesson_plan"),
  contentVersion: shortText(40),
  sourceIds: z.array(identifier).min(1).max(6),
  payload: TutorLessonPlanPayloadSchema,
}).strict();

export type TutorLessonPlanRequest = z.infer<typeof TutorLessonPlanRequestSchema>;
export type TutorLessonPlan = z.infer<typeof TutorLessonPlanSchema>;
export type TutorLessonPlanSeedSlide = {
  id: string;
  title: string;
  blocks: string[];
  narration: string;
  interaction?: {
    prompt: string;
    options: string[];
    correctIndex: number;
  };
};

export type DifyTutorLessonPlanResult =
  | { ok: true; value: TutorLessonPlan; latencyMs: number }
  | { ok: false; reason: "DIFY_NOT_CONFIGURED" | "DIFY_TIMEOUT" | "DIFY_HTTP_ERROR" | "DIFY_INVALID_OUTPUT"; latencyMs: number };

export interface TutorLessonPlanRequestInput {
  request: TutorLessonPlanRequest;
  title: string;
  activityId: string;
  sourceId: string;
  seedSlides: readonly TutorLessonPlanSeedSlide[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: string, max: number, fallback: string): string {
  const text = value.trim().slice(0, max);
  return text || fallback;
}

function parseOutput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.replace(/<think>[\s\S]*?<\/think>/giu, "").trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim()
    : trimmed;
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function seedSlideForPrompt(slide: TutorLessonPlanSeedSlide) {
  const bulletPoints = slide.blocks.slice(0, 4).map((block) => boundedText(block, 180, "请观察本页内容。"));
  return {
    slideId: boundedText(slide.id, 160, "slide"),
    title: boundedText(slide.title, 100, "学习要点"),
    bulletPoints,
    narration: boundedText(slide.narration, 700, "请结合本页要点进行学习。"),
    knowledgeCheck: slide.interaction ? {
      kind: "single_choice" as const,
      prompt: boundedText(slide.interaction.prompt, 280, "请选择最符合本页内容的一项。"),
      options: slide.interaction.options.slice(0, 4).map((option) => boundedText(option, 160, "请根据本页内容作答。")),
      answerIndex: slide.interaction.correctIndex,
      explanation: "回到本页讲解和要点，找出最符合证据的一项。",
    } : {
      kind: "single_choice" as const,
      prompt: `关于“${boundedText(slide.title, 60, "本页内容")}”，下列哪项最符合本页要点？`,
      options: [boundedText(bulletPoints[0] ?? "本页要点", 160, "本页要点"), "与本页无关的猜测"],
      answerIndex: 0,
      explanation: "先回到本页要点，再选择有内容依据的一项。",
    },
  };
}

function promptFor(input: TutorLessonPlanRequestInput): string {
  const seedSlides = input.seedSlides.slice(0, 6).map(seedSlideForPrompt);
  return [
    "[网站上下文] teaching_mode=ai_tutor",
    `course_id=${input.request.courseId}; lesson_id=${input.request.lessonId}; stage=${input.request.context.stage}`,
    input.request.context.learnerSummary ? `[学习者摘要] ${input.request.context.learnerSummary}` : "",
    "[已有种子课件]",
    JSON.stringify(seedSlides),
    "[任务] 基于已有种子课件，输出一个 JSON 对象。不得添加外部事实、链接、HTML、Markdown、代码或图片 URL。",
    "JSON 必须包含 courseId、lessonId、title、slides。slides 为 1 到 6 页；每页必须包含 slideId（仅可使用已有种子课件 slideId）、title、bulletPoints（1 到 4 条）、narration 和一个 single_choice knowledgeCheck。题目必须有 2 到 4 个唯一选项、answerIndex 和 explanation，不允许省略或返回 null。",
  ].filter(Boolean).join("\n");
}

function compactContext(input: TutorLessonPlanRequestInput): string {
  return JSON.stringify({
    schemaVersion: 1,
    traceId: input.request.traceId,
    stage: input.request.context.stage,
    courseId: input.request.courseId,
    lessonId: input.request.lessonId,
    activityId: input.activityId,
  });
}

function candidatePayload(output: unknown): unknown {
  const parsed = parseOutput(output);
  if (!isRecord(parsed)) return null;
  if (isRecord(parsed.payload)) return parsed.payload;
  if (isRecord(parsed.lessonPlan)) return parsed.lessonPlan;
  if (isRecord(parsed.lesson_plan)) return parsed.lesson_plan;
  return parsed;
}

export function parseTutorLessonPlanOutput(
  output: unknown,
  input: TutorLessonPlanRequestInput,
): TutorLessonPlan | null {
  const payloadResult = TutorLessonPlanPayloadSchema.safeParse(candidatePayload(output));
  if (!payloadResult.success) return null;
  const payload = payloadResult.data;
  if (payload.courseId !== input.request.courseId || payload.lessonId !== input.request.lessonId) return null;
  const allowedSlideIds = new Set(input.seedSlides.slice(0, 6).map((slide) => slide.id));
  if (payload.slides.some((slide) => !allowedSlideIds.has(slide.slideId))) return null;
  const result = TutorLessonPlanSchema.safeParse({
    schemaVersion: 1,
    traceId: input.request.traceId,
    workflowVersion: TUTOR_LESSON_PLAN_WORKFLOW_VERSION,
    resultType: "tutor_lesson_plan",
    contentVersion: DIFY_CONTENT_VERSION,
    sourceIds: [input.sourceId],
    payload,
  });
  return result.success ? result.data : null;
}

export function createTutorLessonPlanFallback(input: TutorLessonPlanRequestInput): TutorLessonPlan {
  const slides = input.seedSlides.slice(0, 6).map((slide) => {
    const bulletPoints = slide.blocks.slice(0, 4).map((block) => boundedText(block, 180, "请观察本页内容。"));
    return {
      slideId: boundedText(slide.id, 160, "slide"),
      title: boundedText(slide.title, 100, "学习要点"),
      bulletPoints,
      narration: boundedText(slide.narration, 700, "请结合本页要点进行学习。"),
      knowledgeCheck: slide.interaction ? {
      kind: "single_choice" as const,
      prompt: boundedText(slide.interaction.prompt, 280, "请选择最符合本页内容的一项。"),
      options: slide.interaction.options.slice(0, 4).map((option) => boundedText(option, 160, "请根据本页内容作答。")),
      answerIndex: slide.interaction.correctIndex,
      explanation: "回到本页讲解和要点，找出最符合证据的一项。",
      } : {
        kind: "single_choice" as const,
        prompt: `关于“${boundedText(slide.title, 60, "本页内容")}”，下列哪项最符合本页要点？`,
        options: [boundedText(bulletPoints[0] ?? "本页要点", 160, "本页要点"), "与本页无关的猜测"],
        answerIndex: 0,
        explanation: "先回到本页要点，再选择有内容依据的一项。",
      },
    };
  });
  return TutorLessonPlanSchema.parse({
    schemaVersion: 1,
    traceId: input.request.traceId,
    workflowVersion: TUTOR_LESSON_PLAN_WORKFLOW_VERSION,
    resultType: "tutor_lesson_plan",
    contentVersion: DIFY_CONTENT_VERSION,
    sourceIds: [input.sourceId],
    payload: {
      courseId: input.request.courseId,
      lessonId: input.request.lessonId,
      title: boundedText(input.title, 160, "AI 导师课件"),
      slides,
    },
  });
}

export async function requestDifyTutorLessonPlan(
  input: TutorLessonPlanRequestInput,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<DifyTutorLessonPlanResult> {
  const started = Date.now();
  const apiKey = process.env.DIFY_TEACHING_AGENT_APP_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "DIFY_NOT_CONFIGURED", latencyMs: Date.now() - started };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const abortFromRequest = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortFromRequest, { once: true });
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${process.env.DIFY_BASE_URL?.trim() || DEFAULT_DIFY_BASE_URL}/chat-messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: {
            context_json: compactContext(input),
            stage: input.request.context.stage,
            teaching_mode: "ai_tutor",
            activity_id: input.activityId,
            course_id: input.request.courseId,
            trace_id: input.request.traceId,
            anonymous_learner_id: `tutor:${input.request.traceId}`,
          },
          query: promptFor(input),
          response_mode: "blocking",
          user: `tutor:${input.request.traceId}`,
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok) return { ok: false, reason: "DIFY_HTTP_ERROR", latencyMs: Date.now() - started };
    const body = await response.json() as { answer?: unknown; data?: { outputs?: Record<string, unknown> } };
    const output = body.answer ?? body.data?.outputs?.output ?? body.data?.outputs?.result;
    const value = parseTutorLessonPlanOutput(output, input);
    if (!value) return { ok: false, reason: "DIFY_INVALID_OUTPUT", latencyMs: Date.now() - started };
    return { ok: true, value, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, reason: "DIFY_TIMEOUT", latencyMs: Date.now() - started };
    }
    return { ok: false, reason: "DIFY_HTTP_ERROR", latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromRequest);
  }
}
