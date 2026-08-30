import { PrimaryBattleQuestionRequestSchema } from "@/lib/dify/contracts";
import { IMPORTED_STORYBOOKS } from "@/data/storybooks";
import { acquireRequestLease, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import { requestDifyBattleQuestion } from "@/lib/dify/client";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function buildBattleEvidenceContext(completedStorybookIds: readonly string[]): string {
  const completed = new Set(completedStorybookIds);
  return IMPORTED_STORYBOOKS
    .filter((storybook) => completed.has(storybook.id))
    .flatMap((storybook) => storybook.pages.map((page) => {
      const dialogue = page.dialogue.map((cue) => `${cue.speaker}:${cue.text}`).join("；");
      const question = page.question ? `互动题：${page.question.prompt}；答案：${page.question.answer}` : "";
      return `[${storybook.id} 第${page.pageNumber}页]\n旁白：${page.narration}\n对白：${dialogue}\n${question}`;
    }))
    .join("\n")
    .slice(0, 9000);
}

export async function POST(request: Request): Promise<Response> {
  const access = await acquireRequestLease(request, "battle");
  if (!access.ok) return requestGuardRejectionResponse(access);
  try {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_BATTLE_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsed = PrimaryBattleQuestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_BATTLE_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const result = await requestDifyBattleQuestion({
    context_json: JSON.stringify(parsed.data.context),
    stage: parsed.data.context.stage,
    activity_id: parsed.data.context.activityId,
    course_id: parsed.data.context.courseId ?? "",
    module_id: parsed.data.context.moduleId,
    storybook_id: parsed.data.context.storybookId ?? "",
    page_number: parsed.data.context.pageNumber ?? "",
    knowledge_point_ids: JSON.stringify(parsed.data.context.knowledgePointIds),
    question_index: parsed.data.questionIndex,
    difficulty: parsed.data.difficulty,
    allowed_knowledge_point_ids: JSON.stringify(parsed.data.allowedKnowledgePointIds),
    knowledge_context: buildBattleEvidenceContext(parsed.data.context.completedActivityIds),
    excluded_question_ids: JSON.stringify(parsed.data.excludedQuestionIds),
    anonymous_learner_id: parsed.data.context.anonymousLearnerId,
  });

  if (!result.ok) {
    return Response.json(
      { degraded: true, reason: result.reason, traceId: parsed.data.context.traceId },
      { status: 503, headers: { ...NO_STORE_HEADERS, "Retry-After": "3" } },
    );
  }

  return Response.json({ degraded: false, data: result.value, latencyMs: result.latencyMs }, { headers: NO_STORE_HEADERS });
  } finally {
    await access.lease.release();
  }
}
