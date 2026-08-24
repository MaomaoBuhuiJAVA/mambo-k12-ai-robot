import { getActivity } from "@/data/learning-paths";
import { acquireRequestLease, leaseReadableStream, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import { MIDDLE_LAB_WORKFLOW_VERSION, MiddleLabCoachRequestSchema } from "@/lib/dify/contracts";
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
      controller.enqueue(event("start", { traceId, workflowVersion: MIDDLE_LAB_WORKFLOW_VERSION, degraded: true }));
      controller.enqueue(event("delta", { text: "我先根据这次实验中真实记录的数值来观察：把你的预测和结果逐项比较，再决定下一次只改变一个变量。" }));
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
    return Response.json({ error: "INVALID_LAB_COACH_REQUEST" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = MiddleLabCoachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_LAB_COACH_REQUEST" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const activity = getActivity(parsed.data.context.activityId);
  if (activity && activity.labTemplateId !== parsed.data.templateId) {
    return Response.json({ error: "LAB_TEMPLATE_CONTEXT_CONFLICT" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const access = await acquireRequestLease(request, "lab");
  if (!access.ok) return requestGuardRejectionResponse(access);
  let streamOwnsLease = false;
  try {
    const context = parsed.data.context;
    const result = await requestDifyDialogue({
      context_json: JSON.stringify(context),
      trace_id: context.traceId,
      anonymous_learner_id: context.anonymousLearnerId,
      stage: context.stage,
      teaching_mode: context.teachingMode,
      activity_id: context.activityId,
      course_id: context.courseId,
      template_id: parsed.data.templateId,
      run_id: parsed.data.runId,
      variables_json: JSON.stringify(parsed.data.variables),
      metrics_json: JSON.stringify(parsed.data.metrics),
      conclusion: parsed.data.conclusion,
      question: parsed.data.question,
    }, {
      apiKey: process.env.DIFY_TEACHING_AGENT_APP_KEY || process.env.DIFY_MIDDLE_LAB_APP_KEY,
      workflowVersion: MIDDLE_LAB_WORKFLOW_VERSION,
      allowedSourceIds: [],
      signal: request.signal,
    });
    const stream = result.ok ? result.stream : fallbackStream(context.traceId, result.reason);
    streamOwnsLease = true;
    return new Response(leaseReadableStream(stream, access.lease), { headers: STREAM_HEADERS });
  } finally {
    if (!streamOwnsLease) await access.lease.release();
  }
}
