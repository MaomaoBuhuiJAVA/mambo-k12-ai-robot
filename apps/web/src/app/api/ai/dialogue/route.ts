import { DialogueRequestSchema } from "@/lib/dify/contracts";
import { requestDifyDialogue } from "@/lib/dify/dialogue-client";
import { acquireRequestLease, leaseReadableStream, requestGuardRejectionResponse } from "@/lib/ai/request-guard";

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
      controller.enqueue(event("start", { traceId, degraded: true }));
      controller.enqueue(event("delta", { text: "我暂时无法连接学习助手。我们先根据当前绘本和课程内容一步一步观察吧。" }));
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
    return Response.json({ error: "INVALID_DIALOGUE_REQUEST" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = DialogueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_DIALOGUE_REQUEST" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const route = parsed.data.context.teachingMode === "storybook" ? "storybook" : "chat";
  const access = await acquireRequestLease(request, route);
  if (!access.ok) return requestGuardRejectionResponse(access);

  let streamOwnsLease = false;
  try {
    const context = parsed.data.context;
    const allowedSourceIds = context.teachingMode === "storybook" || context.teachingMode === "dialogue"
      ? context.storybookId ? [`${context.storybookId}.txt`] : undefined
      : [];
    const difyTeachingMode = context.teachingMode === "dialogue" ? "storybook" : context.teachingMode;
    const result = await requestDifyDialogue({
      context_json: JSON.stringify({
        ...context,
        teachingMode: difyTeachingMode,
      }),
      trace_id: context.traceId,
      anonymous_learner_id: context.anonymousLearnerId,
      stage: context.stage,
      // The shared Chatflow uses `storybook` as the common reading/dialogue
      // branch; preserve the original mode inside context_json for auditing.
      teaching_mode: difyTeachingMode,
      activity_id: context.activityId,
      storybook_id: context.storybookId,
      page_number: context.pageNumber,
      question: parsed.data.question,
      messages_json: JSON.stringify(parsed.data.messages),
      allowed_action_ids: JSON.stringify(context.allowedActionIds),
    }, { signal: request.signal, allowedSourceIds });

    const stream = result.ok
      ? result.stream
      : fallbackStream(context.traceId, result.reason);
    const guarded = leaseReadableStream(stream, access.lease);
    streamOwnsLease = true;
    return new Response(guarded, { headers: STREAM_HEADERS });
  } finally {
    if (!streamOwnsLease) await access.lease.release();
  }
}
