import { getCourseById, type CurriculumCourse } from "@/data/curriculum";
import { getCourseLesson, type CourseLesson } from "@/data/course-structure";
import type { LearningState } from "@/lib/domain";
import { createDefaultLearningState } from "@/lib/learning-store";
import type { TutorLessonPlan } from "@/lib/dify/tutor-lesson-plan";
import {
  createTutorProtocolStreamValidator,
  validateLearningContextV2,
  type LearningContextV2,
  type ProtocolResult,
  type TutorProtocolEvent,
  type TutorProtocolWhitelist,
} from "./tutor-protocol";

export type TutorSessionStatus =
  | "idle"
  | "planning"
  | "prebuffering"
  | "presenting"
  | "awaiting_interaction"
  | "summarizing"
  | "completed"
  | "degraded_static_lesson"
  | "text_only"
  | "paused_session";
export type TutorSlideType = "title" | "concept" | "process" | "checkpoint" | "summary";

export interface TutorSlide {
  id: string;
  type: TutorSlideType;
  title: string;
  blocks: string[];
  narration: string;
  interaction?: { prompt: string; options: string[]; correctIndex: number };
}

export interface TutorSeedLesson {
  schemaVersion: 1;
  courseId: string;
  lessonId: string;
  title: string;
  estimatedMinutes: number;
  slides: TutorSlide[];
}

/** Converts the server-validated Dify deck into the UI's deterministic lesson shape. */
export function applyTutorLessonPlan(seed: TutorSeedLesson, plan: TutorLessonPlan): TutorSeedLesson {
  if (plan.payload.courseId !== seed.courseId || plan.payload.lessonId !== seed.lessonId) return seed;
  const seedById = new Map(seed.slides.map((slide) => [slide.id, slide]));
  const slides = plan.payload.slides.flatMap((slide) => {
    const source = seedById.get(slide.slideId);
    if (!source) return [];
    return [{
      ...source,
      title: slide.title,
      blocks: slide.bulletPoints,
      narration: slide.narration,
      interaction: slide.knowledgeCheck
        ? {
          prompt: slide.knowledgeCheck.prompt,
          options: slide.knowledgeCheck.options,
          correctIndex: slide.knowledgeCheck.answerIndex,
        }
        : undefined,
    }];
  });
  return slides.length > 0 ? { ...seed, title: plan.payload.title, slides } : seed;
}

/** The UI consumes the same event envelope that the Dify BFF will provide. */
export type TutorStreamEvent = TutorProtocolEvent;

export interface TutorMockSessionState {
  schemaVersion: 1;
  sessionId: string | null;
  traceId: string | null;
  title: string | null;
  readySlideIds: string[];
  narrationBySlideId: Record<string, string>;
  interactionSlideIds: string[];
  completed: boolean;
  degradedReasonCode: string | null;
}

export const EMPTY_TUTOR_MOCK_SESSION: TutorMockSessionState = {
  schemaVersion: 1,
  sessionId: null,
  traceId: null,
  title: null,
  readySlideIds: [],
  narrationBySlideId: {},
  interactionSlideIds: [],
  completed: false,
  degradedReasonCode: null,
};

function appendUnique(items: string[], item: string): string[] {
  return items.includes(item) ? items : [...items, item];
}

export function reduceTutorMockEvent(
  state: TutorMockSessionState,
  event: TutorStreamEvent,
): TutorMockSessionState {
  switch (event.type) {
    case "session.started":
      return { ...state, sessionId: event.sessionId, traceId: event.traceId };
    case "plan.ready":
      return { ...state, title: event.plan.title };
    case "slide.ready":
      return { ...state, readySlideIds: appendUnique(state.readySlideIds, event.slide.slideId) };
    case "narration.delta":
      return {
        ...state,
        narrationBySlideId: {
          ...state.narrationBySlideId,
          [event.slideId]: `${state.narrationBySlideId[event.slideId] ?? ""}${event.text}`,
        },
      };
    case "narration.segment":
      return {
        ...state,
        narrationBySlideId: {
          ...state.narrationBySlideId,
          [event.segment.slideId]: event.segment.text,
        },
      };
    case "interaction.ready":
      return {
        ...state,
        interactionSlideIds: appendUnique(state.interactionSlideIds, event.interaction.slideId),
      };
    case "session.completed":
      return { ...state, completed: true };
    case "session.degraded":
      return { ...state, degradedReasonCode: event.reasonCode };
  }
}

export function createTutorSeedLesson(course: CurriculumCourse, lesson: CourseLesson): TutorSeedLesson {
  const concept = course.explanation.keyIdeas.slice(0, 3);
  return {
    schemaVersion: 1,
    courseId: course.id,
    lessonId: lesson.id,
    title: lesson.title,
    estimatedMinutes: lesson.estimatedMinutes,
    slides: [
      { id: "title", type: "title", title: lesson.title, blocks: [lesson.summary, `本节将围绕 ${lesson.knowledgePointTags.join("、")} 展开。`], narration: `欢迎来到${lesson.title}。这节课预计需要${lesson.estimatedMinutes}分钟，我们先建立问题，再用证据验证。` },
      { id: "concept", type: "concept", title: "先抓住核心概念", blocks: concept, narration: course.explanation.overview },
      { id: "process", type: "process", title: "用步骤核对结论", blocks: [course.explanation.workedExample, "先预测，再观察结果，最后说明证据。"], narration: `请注意这个例子。${course.explanation.workedExample}` },
      { id: "checkpoint", type: "checkpoint", title: "停下来做一次预测", blocks: ["先根据已经出现的证据作答，再查看下一步。"], narration: "现在轮到你了。请先选择最能帮助你验证结论的做法。", interaction: { prompt: "遇到模型输出时，下一步最可靠的做法是什么？", options: ["核对输入、证据和结果限制", "直接把输出当作最终结论", "忽略与任务有关的数据"], correctIndex: 0 } },
      { id: "summary", type: "summary", title: "本节小结", blocks: [...concept.slice(0, 2), "下一步：完成本节对应练习或实验，形成可追溯证据。"], narration: `本节到这里结束。请记住，${concept[0] ?? "结论必须回到可核对的证据"}。接下来回到课程工作台完成下一项任务。` },
    ],
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function knowledgePointIds(course: CurriculumCourse, lesson: CourseLesson): string[] {
  return unique((lesson.knowledgePointTags.length > 0 ? lesson.knowledgePointTags : course.knowledgePointTags)
    .map((tag) => `${course.id}:${tag}`));
}

export function createTutorLearningContext(
  course: CurriculumCourse,
  lesson: CourseLesson,
  state: LearningState = createDefaultLearningState(),
  traceId = `local:${lesson.id}`,
): LearningContextV2 {
  const pointIds = knowledgePointIds(course, lesson);
  const stage = course.stage === "high_school" ? "high_school" : "middle_school";
  const relevantRecords = pointIds
    .map((id) => state.masteryByKnowledgePoint[id])
    .filter((record): record is NonNullable<typeof record> => Boolean(record));
  const misconceptionTags = unique(relevantRecords.flatMap((record) => record.misconceptionTags));
  const recentEvidenceSummary = state.attempts
    .filter((attempt) => pointIds.includes(attempt.knowledgePointId))
    .slice(-8)
    .map((attempt) => ({
      evidenceId: attempt.attemptId,
      kind: "quiz" as const,
      resultCode: attempt.score === 1 ? "passed" : "needs_review",
      metricSummary: { score: attempt.score, hints: attempt.hints },
    }));
  const activityId = lesson.activityIds[0] ?? "";
  return {
    schemaVersion: 2,
    traceId,
    anonymousLearnerId: `anon:${state.profile.studentId}`,
    stage,
    grade: state.profile.grade,
    courseId: course.id,
    unitId: lesson.unitId,
    lessonId: lesson.id,
    activityId,
    teachingMode: "ai_tutor",
    knowledgePointIds: pointIds,
    masterySummary: pointIds.map((knowledgePointId) => {
      const record = state.masteryByKnowledgePoint[knowledgePointId];
      return {
        knowledgePointId,
        level: record?.mastery ?? 0,
        evidenceCount: record?.evidenceCount ?? 0,
      };
    }),
    misconceptionTags,
    recentEvidenceSummary,
    allowedActionIds: unique([
      "tutor.next_slide",
      "tutor.repeat_slide",
      "tutor.answer_checkpoint",
      "lesson.open_practice",
      activityId,
    ]),
  };
}

export function createTutorProtocolWhitelist(
  course: CurriculumCourse,
  lesson: CourseLesson,
  seed: TutorSeedLesson,
  context: LearningContextV2,
): TutorProtocolWhitelist {
  return {
    courseIds: [course.id],
    lessonIds: [lesson.id],
    objectiveIds: course.objectives.map((_, index) => `${course.id}:objective:${index + 1}`),
    knowledgePointIds: context.knowledgePointIds,
    sourceIds: [`course:${course.id}:seed-v1`],
    actionIds: context.allowedActionIds,
    slideIds: seed.slides.map((slide) => slide.id),
    interactionIds: seed.slides
      .filter((slide) => slide.interaction)
      .map((slide) => `interaction:${lesson.id}:${slide.id}`),
    evaluationPolicyIds: ["single-choice-v1"],
  };
}

function createProtocolEvents(
  seed: TutorSeedLesson,
  context: LearningContextV2,
): TutorStreamEvent[] {
  const objectiveId = `${seed.courseId}:objective:1`;
  const sourceId = `course:${seed.courseId}:seed-v1`;
  const sessionId = `seed:${seed.lessonId}`;
  const slideOutline = seed.slides.map((slide, index) => ({
    slideId: slide.id,
    type: slide.type,
    knowledgePointIds: [context.knowledgePointIds[index % Math.max(context.knowledgePointIds.length, 1)] ?? context.knowledgePointIds[0] ?? `${seed.courseId}:overview`],
  }));
  const plan = {
    schemaVersion: 1 as const,
    planId: `plan:${seed.lessonId}`,
    courseId: seed.courseId,
    lessonId: seed.lessonId,
    title: seed.title,
    objectiveIds: [objectiveId],
    estimatedMinutes: seed.estimatedMinutes,
    slideOutline,
  };

  return [
    {
      schemaVersion: 1,
      type: "session.started",
      sessionId,
      traceId: context.traceId,
    },
    { schemaVersion: 1, type: "plan.ready", sessionId, traceId: context.traceId, plan },
    ...seed.slides.flatMap((slide, index) => [
      {
        schemaVersion: 1 as const,
        type: "slide.ready" as const,
        sessionId,
        traceId: context.traceId,
        slide: {
          schemaVersion: 1 as const,
          slideId: slide.id,
          type: slide.type,
          title: slide.title,
          blocks: slide.blocks.map((text) => ({ kind: "text" as const, text })),
          knowledgePointIds: slideOutline[index]?.knowledgePointIds ?? [],
          sourceIds: [sourceId],
        },
      },
      {
        schemaVersion: 1 as const,
        type: "narration.segment" as const,
        sessionId,
        traceId: context.traceId,
        segment: {
          schemaVersion: 1 as const,
          segmentId: `narration:${seed.lessonId}:${slide.id}`,
          slideId: slide.id,
          text: slide.narration,
          order: index,
        },
      },
      ...(slide.interaction
        ? [{
          schemaVersion: 1 as const,
          type: "interaction.ready" as const,
          sessionId,
          traceId: context.traceId,
          interaction: {
            schemaVersion: 1 as const,
            interactionId: `interaction:${seed.lessonId}:${slide.id}`,
            slideId: slide.id,
            kind: "single_choice" as const,
            prompt: slide.interaction.prompt,
            allowedResponseFormat: "option_id" as const,
            evaluationPolicyId: "single-choice-v1" as const,
          },
        }]
        : []),
    ]),
    {
      schemaVersion: 1,
      type: "session.completed",
      sessionId,
      traceId: context.traceId,
      summary: {
        schemaVersion: 1,
        summaryId: `summary:${seed.lessonId}`,
        highlights: seed.slides.slice(0, 2).map((slide) => slide.title),
        nextActivityId: null,
      },
    },
  ];
}

export function validateTutorStream(
  events: readonly TutorStreamEvent[],
  context: LearningContextV2,
  whitelist: TutorProtocolWhitelist,
): ProtocolResult<TutorStreamEvent[]> {
  const contextResult = validateLearningContextV2(context, whitelist);
  if (!contextResult.ok) return { ok: false, issues: contextResult.issues };
  const validator = createTutorProtocolStreamValidator({
    expected: {
      traceId: context.traceId,
      stage: context.stage,
      courseId: context.courseId,
      lessonId: context.lessonId,
    },
    whitelist,
  });
  const accepted: TutorStreamEvent[] = [];
  for (const event of events) {
    const result = validator.accept(event);
    if (!result.ok) return { ok: false, issues: result.issues };
    accepted.push(result.value);
  }
  return { ok: true, value: accepted };
}

export function createMockTutorEvents(
  seed: TutorSeedLesson,
  state: LearningState = createDefaultLearningState(),
): TutorStreamEvent[] {
  const course = getCourseById(seed.courseId);
  const lesson = getCourseLesson(seed.lessonId);
  if (!course || !lesson) return [];
  const context = createTutorLearningContext(course, lesson, state);
  const whitelist = createTutorProtocolWhitelist(course, lesson, seed, context);
  const result = validateTutorStream(createProtocolEvents(seed, context), context, whitelist);
  return result.ok ? result.value : [];
}

export function getMockEventsForSlide(
  events: TutorStreamEvent[],
  slideId: string,
): TutorStreamEvent[] {
  return events.filter((event) => {
    if (event.type === "slide.ready") return event.slide.slideId === slideId;
    if (event.type === "narration.delta") return event.slideId === slideId;
    if (event.type === "narration.segment") return event.segment.slideId === slideId;
    if (event.type === "interaction.ready") return event.interaction.slideId === slideId;
    return false;
  });
}
