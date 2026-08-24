import { getCourseLesson, getStructuredCourse } from "@/data/course-structure";
import { acquireRequestLease, leaseReadableStream, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import { AI_TUTOR_GUIDE_WORKFLOW_VERSION, TutorGuideRequestSchema, type AgentContextV1 } from "@/lib/dify/contracts";
import { requestDifyDialogue } from "@/lib/dify/dialogue-client";

const JSON_HEADERS = { "Cache-Control": "no-store" };
const STREAM_HEADERS = {
  "Cache-Control": "no-store, no-transform",
  "Content-Type": "text/event-stream; charset=utf-8",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
const encoder = new TextEncoder();

function event(type: string, payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function lessonKnowledgePointIds(courseId: string, tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => `${courseId}:${tag}`))];
}

function hasValidTutorContext(
  context: AgentContextV1,
  course: ReturnType<typeof getStructuredCourse>,
  lesson: NonNullable<ReturnType<typeof getCourseLesson>>,
): boolean {
  if (!course || context.courseId !== course.course.id || context.stage !== course.stage) return false;
  if (!lesson.activityIds.includes(context.activityId)) return false;
  const allowedKnowledgePointIds = new Set(lessonKnowledgePointIds(course.course.id, lesson.knowledgePointTags));
  return context.knowledgePointIds.length > 0
    && context.knowledgePointIds.every((knowledgePointId) => allowedKnowledgePointIds.has(knowledgePointId));
}

function fallbackStream(
  traceId: string,
  courseTitle: string,
  lessonTitle: string,
  lessonSummary: string,
  knowledgePointTags: readonly string[],
  reason: string,
): ReadableStream<Uint8Array> {
  const focus = knowledgePointTags.join("、");
  const firstPoint = knowledgePointTags[0] ?? "本节概念";
  const text = `现在先使用本地课程引导。《${courseTitle}》的“${lessonTitle}”重点是${focus}。${lessonSummary} 请先用自己的话说一说：${firstPoint}指什么？`;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(event("start", { traceId, workflowVersion: AI_TUTOR_GUIDE_WORKFLOW_VERSION, degraded: true }));
      controller.enqueue(event("delta", { text }));
      controller.enqueue(event("complete", { traceId, degraded: true, reason }));
      controller.close();
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_TUTOR_GUIDE_REQUEST" }, { status: 400, headers: JSON_HEADERS });
  }
  const parsed = TutorGuideRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_TUTOR_GUIDE_REQUEST" }, { status: 400, headers: JSON_HEADERS });
  }

  const lesson = getCourseLesson(parsed.data.lessonId);
  const course = lesson ? getStructuredCourse(lesson.courseId) : undefined;
  if (!lesson || !course || !hasValidTutorContext(parsed.data.context, course, lesson)) {
    return Response.json({ error: "TUTOR_CONTEXT_CONFLICT" }, { status: 400, headers: JSON_HEADERS });
  }

  const access = await acquireRequestLease(request, "chat");
  if (!access.ok) return requestGuardRejectionResponse(access);

  let streamOwnsLease = false;
  try {
    const { context } = parsed.data;
    const knowledgePointIds = lessonKnowledgePointIds(course.course.id, lesson.knowledgePointTags);
    const result = await requestDifyDialogue({
      context_json: JSON.stringify({ ...context, lessonId: lesson.id, knowledgePointIds }),
      trace_id: context.traceId,
      anonymous_learner_id: context.anonymousLearnerId,
      stage: context.stage,
      // The shared Chatflow routes its reading and course-help conversation
      // through the established storybook/dialogue branch. `context_json`
      // retains the browser-facing `dialogue` mode for auditability.
      teaching_mode: "storybook",
      activity_id: context.activityId,
      course_id: course.course.id,
      course_title: course.course.title,
      course_overview: course.course.explanation.overview,
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      lesson_summary: lesson.summary,
      knowledge_point_ids: JSON.stringify(knowledgePointIds),
      question: parsed.data.question,
      messages_json: JSON.stringify(parsed.data.messages),
    }, {
      workflowVersion: AI_TUTOR_GUIDE_WORKFLOW_VERSION,
      allowedSourceIds: [],
      signal: request.signal,
    });
    const stream = result.ok
      ? result.stream
      : fallbackStream(
        context.traceId,
        course.course.title,
        lesson.title,
        lesson.summary,
        lesson.knowledgePointTags,
        result.reason,
      );
    streamOwnsLease = true;
    return new Response(leaseReadableStream(stream, access.lease), { headers: STREAM_HEADERS });
  } finally {
    if (!streamOwnsLease) await access.lease.release();
  }
}
