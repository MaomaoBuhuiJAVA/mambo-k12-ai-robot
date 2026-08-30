import { acquireRequestLease, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import { RecommendationRequestSchema, RecommendationResponseSchema, RECOMMENDATION_WORKFLOW_VERSION } from "@/lib/dify/contracts";
import { requestDifyRecommendation } from "@/lib/dify/client";

const JSON_HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json" };

function degraded(traceId: string, reason: string, actionId?: string): Response {
  return Response.json({
    degraded: true,
    reason,
    traceId,
    data: actionId ? {
      schemaVersion: 1,
      traceId,
      workflowVersion: RECOMMENDATION_WORKFLOW_VERSION,
      resultType: "learning_path_suggestion",
      contentVersion: "2026-08-24",
      sourceIds: ["website:deterministic-candidate"],
      payload: { recommendations: [{ actionId, reason: "先完成网站已确定的下一项学习活动。", priority: 1 }] },
    } : null,
  }, { headers: JSON_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_RECOMMENDATION_REQUEST" }, { status: 400, headers: JSON_HEADERS });
  }
  const parsed = RecommendationRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_RECOMMENDATION_REQUEST" }, { status: 400, headers: JSON_HEADERS });

  const allowed = new Set(parsed.data.context.allowedActionIds);
  if (parsed.data.candidates.some((candidate) => !allowed.has(candidate.actionId))) {
    return Response.json({ error: "CANDIDATE_ACTION_NOT_ALLOWED" }, { status: 400, headers: JSON_HEADERS });
  }
  const access = await acquireRequestLease(request, "recommendation");
  if (!access.ok) return requestGuardRejectionResponse(access);
  try {
    const context = parsed.data.context;
    const result = await requestDifyRecommendation({
      context_json: JSON.stringify(context),
      trace_id: context.traceId,
      anonymous_learner_id: context.anonymousLearnerId,
      stage: context.stage,
      activity_id: context.activityId,
      course_id: context.courseId ?? "",
      module_id: context.moduleId ?? "",
      storybook_id: context.storybookId ?? "",
      page_number: context.pageNumber ?? "",
      knowledge_point_ids: JSON.stringify(context.knowledgePointIds),
      candidates_json: JSON.stringify(parsed.data.candidates),
      allowed_action_ids: JSON.stringify(context.allowedActionIds),
      mastery_summary: JSON.stringify(context.masterySummary),
      misconception_tags: JSON.stringify(context.misconceptionTags),
    });
    if (!result.ok) return degraded(context.traceId, result.reason, parsed.data.candidates[0]?.actionId);

    const candidates = new Set(parsed.data.candidates.map((candidate) => candidate.actionId));
    const recommendations = result.value.payload.recommendations
      .filter((item) => allowed.has(item.actionId) && candidates.has(item.actionId))
      .slice(0, 3);
    if (!recommendations.length) return degraded(context.traceId, "DIFY_INVALID_ACTION", parsed.data.candidates[0]?.actionId);
    const safeValue = RecommendationResponseSchema.parse({
      ...result.value,
      traceId: context.traceId,
      payload: { recommendations },
    });
    return Response.json({ degraded: false, data: safeValue, latencyMs: result.latencyMs }, { headers: JSON_HEADERS });
  } finally {
    await access.lease.release();
  }
}
