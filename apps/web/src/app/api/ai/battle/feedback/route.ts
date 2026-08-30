import { PrimaryBattleFeedbackRequestSchema } from "@/lib/dify/contracts";
import { acquireRequestLease, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import { requestDifyBattleFeedback } from "@/lib/dify/client";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const access = await acquireRequestLease(request, "battle");
  if (!access.ok) return requestGuardRejectionResponse(access);
  try {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_BATTLE_FEEDBACK_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const parsed = PrimaryBattleFeedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_BATTLE_FEEDBACK_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const result = await requestDifyBattleFeedback({
    context_json: JSON.stringify(parsed.data.context),
    stage: parsed.data.context.stage,
    is_correct: String(parsed.data.isCorrect),
    activity_id: parsed.data.context.activityId,
    course_id: parsed.data.context.courseId ?? "",
    module_id: parsed.data.context.moduleId,
    storybook_id: parsed.data.context.storybookId ?? "",
    page_number: parsed.data.context.pageNumber ?? "",
    student_answer: parsed.data.studentAnswer,
    correct_answer: parsed.data.correctAnswer,
    explanation: parsed.data.explanation,
    knowledge_point_ids: JSON.stringify(parsed.data.knowledgePointIds),
    allowed_knowledge_point_ids: JSON.stringify(parsed.data.knowledgePointIds),
    anonymous_learner_id: parsed.data.context.anonymousLearnerId,
  });
  if (!result.ok) {
    return Response.json(
      { degraded: true, reason: result.reason, traceId: parsed.data.context.traceId },
      { status: 503, headers: { ...NO_STORE_HEADERS, "Retry-After": "2" } },
    );
  }
  return Response.json({ degraded: false, data: result.value, latencyMs: result.latencyMs }, { headers: NO_STORE_HEADERS });
  } finally {
    await access.lease.release();
  }
}
