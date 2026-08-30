import { acquireRequestLease, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import {
  HIGH_DEFENSE_PLAN_WORKFLOW_VERSION,
  HighDefensePlanRequestSchema,
  HighDefensePlanResponseSchema,
} from "@/lib/dify/contracts";
import { requestDifyDefensePlan } from "@/lib/dify/client";

const JSON_HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json" };

function degraded(traceId: string, reason: string) {
  return Response.json({
    degraded: true,
    reason,
    traceId,
    data: null,
  }, { headers: JSON_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_DEFENSE_PLAN_REQUEST" }, { status: 400, headers: JSON_HEADERS });
  }
  const parsed = HighDefensePlanRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_DEFENSE_PLAN_REQUEST" }, { status: 400, headers: JSON_HEADERS });

  const access = await acquireRequestLease(request, "defense");
  if (!access.ok) return requestGuardRejectionResponse(access);
  try {
    const { context, projectId, project } = parsed.data;
    const result = await requestDifyDefensePlan({
      context_json: JSON.stringify(context),
      trace_id: context.traceId,
      anonymous_learner_id: context.anonymousLearnerId,
      stage: context.stage,
      teaching_mode: context.teachingMode,
      activity_id: context.activityId,
      course_id: context.courseId,
      project_id: projectId,
      project_evidence_json: JSON.stringify(project),
      evidence_ids_json: JSON.stringify(project.evidenceRefs),
      recent_evidence_json: JSON.stringify(context.recentEvidenceSummary),
    });
    if (!result.ok) return degraded(context.traceId, result.reason);

    const available = new Set(context.recentEvidenceSummary.map((item) => item.evidenceId));
    const questions = result.value.payload.questions
      .map((question) => ({
        ...question,
        requiredEvidenceIds: question.requiredEvidenceIds.filter((id) => available.has(id)),
      }))
      .filter((question) => question.prompt.trim().length > 0);
    if (questions.length < 3) return degraded(context.traceId, "DIFY_INVALID_EVIDENCE_REFERENCE");
    const safeValue = HighDefensePlanResponseSchema.parse({
      ...result.value,
      traceId: context.traceId,
      workflowVersion: HIGH_DEFENSE_PLAN_WORKFLOW_VERSION,
      payload: { questions },
    });
    return Response.json({ degraded: false, data: safeValue, latencyMs: result.latencyMs }, { headers: JSON_HEADERS });
  } finally {
    await access.lease.release();
  }
}
