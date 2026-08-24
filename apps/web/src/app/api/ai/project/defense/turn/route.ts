import { acquireRequestLease, leaseReadableStream, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import { HIGH_DEFENSE_TURN_WORKFLOW_VERSION, HighDefenseTurnRequestSchema } from "@/lib/dify/contracts";
import { requestDifyDialogue } from "@/lib/dify/dialogue-client";

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

function fallbackStream(traceId: string, reason: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(event("start", { traceId, workflowVersion: HIGH_DEFENSE_TURN_WORKFLOW_VERSION, degraded: true }));
      controller.enqueue(event("delta", { text: "先只依据你已经提交的项目证据回答：指出一个证据支持的事实，再说明目前还不能推出什么。如果证据不足，请补充对应记录。" }));
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
    return Response.json({ error: "INVALID_DEFENSE_TURN_REQUEST" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = HighDefenseTurnRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_DEFENSE_TURN_REQUEST" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const access = await acquireRequestLease(request, "defense");
  if (!access.ok) return requestGuardRejectionResponse(access);
  let streamOwnsLease = false;
  try {
    const { context, projectId, questionId, question, studentAnswer, referencedEvidenceIds } = parsed.data;
    const result = await requestDifyDialogue({
      context_json: JSON.stringify(context),
      trace_id: context.traceId,
      anonymous_learner_id: context.anonymousLearnerId,
      stage: context.stage,
      teaching_mode: context.teachingMode,
      activity_id: context.activityId,
      course_id: context.courseId,
      project_id: projectId,
      question_id: questionId,
      question,
      current_question: question,
      student_answer: studentAnswer,
      referenced_evidence_ids: JSON.stringify(referencedEvidenceIds),
      recent_evidence_json: JSON.stringify(context.recentEvidenceSummary),
    }, {
      apiKey: process.env.DIFY_TEACHING_AGENT_APP_KEY || process.env.DIFY_HIGH_DEFENSE_TURN_APP_KEY,
      workflowVersion: HIGH_DEFENSE_TURN_WORKFLOW_VERSION,
      allowedSourceIds: [],
      timeoutMs: 30_000,
      signal: request.signal,
    });
    const stream = result.ok ? result.stream : fallbackStream(context.traceId, result.reason);
    streamOwnsLease = true;
    return new Response(leaseReadableStream(stream, access.lease), { headers: STREAM_HEADERS });
  } finally {
    if (!streamOwnsLease) await access.lease.release();
  }
}
