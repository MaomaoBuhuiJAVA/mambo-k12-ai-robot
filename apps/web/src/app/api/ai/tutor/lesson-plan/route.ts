import { getCourseLesson, getStructuredCourse } from "@/data/course-structure";
import { createTutorSeedLesson } from "@/features/ai-tutor/tutor-data";
import { acquireRequestLease, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import {
  createTutorLessonPlanFallback,
  requestDifyTutorLessonPlan,
  TutorLessonPlanRequestSchema,
  type TutorLessonPlanRequestInput,
} from "@/lib/dify/tutor-lesson-plan";

const JSON_HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json" };

function resolveInput(value: unknown): TutorLessonPlanRequestInput | null {
  const parsed = TutorLessonPlanRequestSchema.safeParse(value);
  if (!parsed.success) return null;
  const lesson = getCourseLesson(parsed.data.lessonId);
  const course = getStructuredCourse(parsed.data.courseId);
  if (!lesson || !course || lesson.courseId !== course.course.id || course.stage !== parsed.data.context.stage) return null;

  const seed = createTutorSeedLesson(course.course, lesson);
  const activityId = lesson.activityIds[0];
  if (!activityId || seed.slides.length === 0) return null;
  return {
    request: parsed.data,
    title: seed.title,
    activityId,
    sourceId: `course:${course.course.id}:seed-v1`,
    seedSlides: seed.slides,
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_TUTOR_LESSON_PLAN_REQUEST" }, { status: 400, headers: JSON_HEADERS });
  }
  const input = resolveInput(body);
  if (!input) {
    return Response.json({ error: "INVALID_TUTOR_LESSON_PLAN_REQUEST" }, { status: 400, headers: JSON_HEADERS });
  }

  const access = await acquireRequestLease(request, "tutor");
  if (!access.ok) return requestGuardRejectionResponse(access);
  try {
    const result = await requestDifyTutorLessonPlan(input, { signal: request.signal });
    if (!result.ok) {
      return Response.json({
        degraded: true,
        reason: result.reason,
        traceId: input.request.traceId,
        data: createTutorLessonPlanFallback(input),
      }, { headers: JSON_HEADERS });
    }
    return Response.json({ degraded: false, data: result.value, latencyMs: result.latencyMs }, { headers: JSON_HEADERS });
  } finally {
    await access.lease.release();
  }
}
