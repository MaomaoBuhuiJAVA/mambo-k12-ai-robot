import {
  BattleFeedbackResponseSchema,
  BattleQuestionResponseSchema,
  DIFY_CONTENT_VERSION,
  HighDefensePlanResponseSchema,
  PRIMARY_BATTLE_WORKFLOW_VERSION,
  RecommendationResponseSchema,
  type BattleFeedbackResponse,
  type BattleQuestionResponse,
  type HighDefensePlanResponse,
  type RecommendationResponse,
} from "./contracts";

const DEFAULT_DIFY_BASE_URL = "https://api.dify.ai/v1";
// The shared Chatflow currently needs about 6s for a blocking structured answer.
// Keep enough headroom for normal model variance while retaining a hard upper bound.
const BATTLE_QUESTION_TIMEOUT_MS = 30_000;
const BATTLE_FEEDBACK_TIMEOUT_MS = 15_000;
const STRUCTURED_BRANCH_TIMEOUT_MS = 30_000;

type DifyAppMode = "shared_chatflow" | "legacy_workflow";

function battleAppConfig(kind: "question" | "feedback"): { apiKey: string | undefined; mode: DifyAppMode } {
  const sharedKey = process.env.DIFY_TEACHING_AGENT_APP_KEY?.trim();
  if (sharedKey) return { apiKey: sharedKey, mode: "shared_chatflow" };
  const legacyKey = kind === "question"
    ? process.env.DIFY_PRIMARY_BATTLE_APP_KEY?.trim()
    : process.env.DIFY_PRIMARY_BATTLE_FEEDBACK_APP_KEY?.trim();
  return { apiKey: legacyKey, mode: "legacy_workflow" };
}

function battleChatflowQuery(input: Record<string, unknown>, action: "question" | "feedback"): string {
  const context = typeof input.context_json === "string" ? input.context_json : "{}";
  const parsedContext = parseOutput(context);
  const completedStorybooks = isRecord(parsedContext) && Array.isArray(parsedContext.completedActivityIds)
    ? parsedContext.completedActivityIds.filter((id): id is string => typeof id === "string" && /lesson|storybook/iu.test(id))
    : [];
  const fields = [
    `[网站上下文] teaching_mode=battle; battle_action=${action}`,
    `context_json=${context.slice(0, 6000)}`,
    completedStorybooks.length ? `[已完成绘本范围] ${completedStorybooks.join(",")}` : "",
    typeof input.knowledge_context === "string" && input.knowledge_context.trim()
      ? `[已审核逐页绘本证据]\n${input.knowledge_context.slice(0, 9000)}`
      : "[已审核逐页绘本证据] 未提供",
    action === "question"
      ? `[出题约束] question_index=${String(input.question_index ?? "0")}; difficulty=${String(input.difficulty ?? "standard")}; allowed_knowledge_point_ids=${String(input.allowed_knowledge_point_ids ?? "[]")}; excluded_question_ids=${String(input.excluded_question_ids ?? "[]")}`
      : `[判分事实] is_correct=${String(input.is_correct ?? "false")}; student_answer=${String(input.student_answer ?? "")}; correct_answer=${String(input.correct_answer ?? "")}; explanation=${String(input.explanation ?? "")}; knowledge_point_ids=${String(input.knowledge_point_ids ?? "[]")}`,
    action === "question"
      ? "[任务] 只输出符合 battle_question-v1 信封的 JSON，不输出 Markdown、解释或额外文字。只能根据已审核逐页绘本证据出题，必须返回 sourceStorybookId、sourcePageNumber、evidenceQuote；证据不足时只返回 insufficient_grounded_content，不得猜测或补造页码。"
      : "[任务] 只输出符合 battle_feedback-v1 信封的 JSON，不重新判题、不改变网站给出的判分事实。",
  ];
  return fields.join("\n");
}

export type DifyRecommendationResult =
  | { ok: true; value: RecommendationResponse; latencyMs: number }
  | { ok: false; reason: "DIFY_NOT_CONFIGURED" | "DIFY_TIMEOUT" | "DIFY_HTTP_ERROR" | "DIFY_INVALID_OUTPUT"; latencyMs: number };

export type DifyDefensePlanResult =
  | { ok: true; value: HighDefensePlanResponse; latencyMs: number }
  | { ok: false; reason: "DIFY_NOT_CONFIGURED" | "DIFY_TIMEOUT" | "DIFY_HTTP_ERROR" | "DIFY_INVALID_OUTPUT"; latencyMs: number };

export type DifyBattleQuestionResult =
  | { ok: true; value: BattleQuestionResponse; latencyMs: number }
  | { ok: false; reason: "DIFY_NOT_CONFIGURED" | "DIFY_TIMEOUT" | "DIFY_HTTP_ERROR" | "DIFY_INVALID_OUTPUT"; latencyMs: number };

export type DifyBattleFeedbackResult =
  | { ok: true; value: BattleFeedbackResponse; latencyMs: number }
  | { ok: false; reason: "DIFY_NOT_CONFIGURED" | "DIFY_TIMEOUT" | "DIFY_HTTP_ERROR" | "DIFY_INVALID_OUTPUT"; latencyMs: number };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseOutput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.replace(/<think>[\s\S]*?<\/think>/giu, "").trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    : trimmed;
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function contextRecord(input: Record<string, unknown>): JsonRecord {
  if (typeof input.context_json !== "string") return {};
  const parsed = parseOutput(input.context_json);
  return isRecord(parsed) ? parsed : {};
}

function sourcePageDetails(value: string): { storybookId: string; pageNumber: number } | null {
  const match = value.trim().match(/^(?:storybook:)?([a-z0-9-]+):p?(\d+)$/i);
  if (!match) return null;
  const pageNumber = Number(match[2]);
  return Number.isInteger(pageNumber) && pageNumber > 0
    ? { storybookId: match[1]!, pageNumber }
    : null;
}

function normalizeBattleQuestionOutput(value: unknown, input: Record<string, unknown>): unknown {
  const parsed = parseOutput(value);
  if (!isRecord(parsed)) return null;
  const requiresGrounding = typeof input.knowledge_context === "string" && input.knowledge_context.trim().length > 0;
  const isEnvelope = parsed.workflowVersion === PRIMARY_BATTLE_WORKFLOW_VERSION && parsed.resultType === "battle_question";
  if (isEnvelope && !requiresGrounding) return parsed;
  const candidate = isEnvelope && isRecord(parsed.payload)
    ? parsed.payload
    : isRecord(parsed.payload) && isRecord(parsed.payload.question)
    ? parsed.payload.question
    : isRecord(parsed.battle_question)
      ? parsed.battle_question
      : isRecord(parsed.payload) && isRecord(parsed.payload.battle_question) ? parsed.payload.battle_question : parsed;

  const context = contextRecord(input);
  const completedActivities = Array.isArray(context.completedActivityIds)
    ? context.completedActivityIds.filter((id): id is string => typeof id === "string")
    : [];
  const explicitSourceStorybookId = stringField(candidate.sourceStorybookId) || stringField(candidate.storybookId);
  const sourceIdHint = explicitSourceStorybookId || stringField(input.storybook_id)
    || completedActivities.find((id) => /lesson|storybook/iu.test(id))
    || "";
  const reportedSourcePageIds = Array.isArray(candidate.sourcePageIds)
    ? candidate.sourcePageIds
      .map((id) => {
        if (typeof id === "string") return id;
        if (typeof id === "number" && Number.isInteger(id) && id > 0 && sourceIdHint) {
          return `${sourceIdHint}:p${String(id).padStart(2, "0")}`;
        }
        return "";
      })
      .filter((id): id is string => Boolean(id) && Boolean(sourcePageDetails(id)))
    : [];
  const reportedSource = reportedSourcePageIds.map(sourcePageDetails).find((source): source is { storybookId: string; pageNumber: number } => Boolean(source));
  const sourceStorybookId = explicitSourceStorybookId || reportedSource?.storybookId || stringField(input.storybook_id)
    || completedActivities.find((id) => /lesson|storybook/iu.test(id)) || "castle-lesson-01";
  const rawPageNumber = typeof candidate.sourcePageNumber === "number"
    ? candidate.sourcePageNumber
    : Number(candidate.pageNumber) || reportedSource?.pageNumber;
  const pageNumber = rawPageNumber !== undefined && Number.isInteger(rawPageNumber) && rawPageNumber > 0 ? rawPageNumber : null;
  const questionText = stringField(candidate.question) || stringField(candidate.stem) || stringField(candidate.prompt) || stringField(candidate.questionText);
  const options = Array.isArray(candidate.options)
    ? candidate.options
      .map((option) => typeof option === "string" ? option : isRecord(option) ? stringField(option.text) : "")
      .filter((option): option is string => Boolean(option))
    : [];
  const answer = stringField(candidate.answer);
  const answerIndex = Number.isInteger(candidate.answerIndex)
    ? Number(candidate.answerIndex)
    : options.indexOf(answer);
  const allowedKnowledgePointIds = typeof input.allowed_knowledge_point_ids === "string" ? parseOutput(input.allowed_knowledge_point_ids) : [];
  const knowledgePointId = stringField(candidate.knowledgePointId) || (Array.isArray(allowedKnowledgePointIds) && typeof allowedKnowledgePointIds[0] === "string" ? allowedKnowledgePointIds[0] : "");
  const knowledgePointIds = Array.isArray(candidate.knowledgePointIds)
    ? candidate.knowledgePointIds.filter((id): id is string => typeof id === "string")
    : knowledgePointId ? [knowledgePointId] : [];
  const sourcePageIds = reportedSourcePageIds.length > 0
    ? reportedSourcePageIds
    : sourceStorybookId && pageNumber
      ? [`${sourceStorybookId}:p${String(pageNumber).padStart(2, "0")}`]
      : [];
  const evidenceQuote = stringField(candidate.evidenceQuote) || stringField(candidate.evidence_quote);
  const moduleId = stringField(input.module_id) || stringField(context.moduleId) || "battle";
  const questionIndex = Number.isInteger(input.question_index) ? Number(input.question_index) : 0;
  const traceId = stringField(candidate.traceId) || stringField(context.traceId) || "trace:unknown";
  const allowedStorybookIds = completedActivities.filter((id) => /lesson|storybook/iu.test(id));
  const groundedSource = sourcePageIds.map(sourcePageDetails).find((source): source is { storybookId: string; pageNumber: number } => Boolean(source));
  if (!questionText || options.length !== 4 || answerIndex < 0 || answerIndex > 3 || !knowledgePointIds.length || !sourcePageIds.length) return null;
  if (requiresGrounding && (!evidenceQuote || !pageNumber || !groundedSource || !allowedStorybookIds.includes(groundedSource.storybookId) || groundedSource.pageNumber !== pageNumber)) return null;

  return {
    schemaVersion: 1,
    traceId,
    workflowVersion: PRIMARY_BATTLE_WORKFLOW_VERSION,
    resultType: "battle_question",
    contentVersion: DIFY_CONTENT_VERSION,
    sourceIds: sourcePageIds,
    payload: {
      questionId: stringField(candidate.questionId) || `generated:${moduleId}:${questionIndex}`,
      topic: stringField(candidate.topic) || knowledgePointIds[0],
      prompt: questionText,
      options,
      answerIndex,
      explanation: stringField(candidate.explanation) || "先依据看得见的特征作答。",
      knowledgePointIds,
      sourcePageIds,
      ...(evidenceQuote ? { evidenceQuote } : {}),
    },
  };
}

function normalizeBattleFeedbackOutput(value: unknown, input: Record<string, unknown>): unknown {
  const parsed = parseOutput(value);
  if (!isRecord(parsed)) return null;
  if (parsed.workflowVersion === "primary-battle-feedback-v1" && parsed.resultType === "battle_feedback") return parsed;

  const nested = isRecord(parsed.feedback)
    ? parsed.feedback
    : isRecord(parsed.payload) && isRecord(parsed.payload.feedback) ? parsed.payload.feedback : {};
  const feedback = stringField(parsed.feedback) || stringField(nested.feedback) || stringField(nested.explanation) || stringField(parsed.explanation);
  if (!feedback) return null;
  const context = contextRecord(input);
  const traceId = stringField(parsed.traceId) || stringField(context.traceId) || "trace:unknown";
  return {
    schemaVersion: 1,
    traceId,
    workflowVersion: "primary-battle-feedback-v1",
    resultType: "battle_feedback",
    contentVersion: DIFY_CONTENT_VERSION,
    sourceIds: ["website:graded-feedback"],
    payload: { feedback },
  };
}

function sharedTask(mode: string, input: Record<string, unknown>, question: string): string {
  if (mode === "recommendation") {
    return "只输出符合 learning_path_suggestion-v1 信封的单个 JSON 对象，不输出 Markdown 或额外文字。字段必须为 schemaVersion=1、traceId、workflowVersion=learning-path-suggestion-v1、resultType=learning_path_suggestion、contentVersion、sourceIds 和 payload.recommendations。recommendations 最多 3 项，只能使用 candidates_json 中的 actionId，每项包含 actionId、reason、priority(0 到 1)。";
  }
  if (mode === "defense" && typeof input.project_evidence_json === "string") {
    return "只输出符合 defense_plan-v1 信封的单个 JSON 对象，不输出 Markdown 或额外文字。字段必须为 schemaVersion=1、traceId、workflowVersion=high-project-defense-plan-v1、resultType=defense_plan、contentVersion、sourceIds 和 payload.questions。questions 生成 3 到 5 项，覆盖研究目标、数据授权、处理步骤、模型参数、指标、失败限制、证据结论中的至少三类；每项包含 questionId、category、prompt、requiredEvidenceIds，引用只能来自 evidence_ids_json 或 recent_evidence_json。";
  }
  return question || `请执行 ${mode} 工作流。`;
}

function sharedDetails(mode: string, input: Record<string, unknown>): string {
  const keys = mode === "recommendation"
    ? ["candidates_json", "allowed_action_ids", "mastery_summary", "misconception_tags"]
    : mode === "defense"
      ? ["project_id", "project_evidence_json", "evidence_ids_json", "recent_evidence_json"]
      : ["battle_action", "question_index", "difficulty", "allowed_knowledge_point_ids", "excluded_question_ids", "knowledge_context"];
  return keys
    .filter((key) => input[key] !== undefined && input[key] !== null)
    .map((key) => `${key}=${String(input[key]).slice(0, 4000)}`)
    .join("\n");
}

function sharedChatflowInputs(input: Record<string, unknown>, mode: string, action?: string): Record<string, string> {
  const defaults: Record<string, unknown> = {
    context_json: "{}",
    stage: "",
    teaching_mode: mode,
    activity_id: "",
    question: "请根据当前学习上下文提供引导。",
    course_id: "",
    module_id: "",
    storybook_id: "",
    page_number: "",
    knowledge_point_ids: "[]",
    knowledge_context: "",
    allowed_action_ids: "[]",
    battle_action: action ?? "",
    question_index: "0",
    difficulty: "standard",
    allowed_knowledge_point_ids: "[]",
    excluded_question_ids: "[]",
    candidates_json: "[]",
    mastery_summary: "[]",
    misconception_tags: "[]",
    template_id: "",
    run_id: "",
    variables_json: "{}",
    metrics_json: "{}",
    conclusion: "",
    trace_id: "",
    anonymous_learner_id: "anonymous",
    project_id: "",
    project_evidence_json: "{}",
    evidence_ids_json: "[]",
    recent_evidence_json: "[]",
    question_id: "",
    current_question: "",
    student_answer: "",
    referenced_evidence_ids: "[]",
  };
  const merged: Record<string, unknown> = { ...defaults, ...input, teaching_mode: mode, ...(action ? { battle_action: action } : {}) };
  const rawContext = typeof merged.context_json === "string" ? parseOutput(merged.context_json) : null;
  const compactContext = isRecord(rawContext)
    ? JSON.stringify({
      schemaVersion: rawContext.schemaVersion,
      traceId: rawContext.traceId,
      stage: rawContext.stage,
      activityId: rawContext.activityId,
      moduleId: rawContext.moduleId,
      storybookId: rawContext.storybookId,
      pageNumber: rawContext.pageNumber,
    })
    : "{}";
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => {
    if (key === "context_json") return [key, compactContext];
    if (typeof value === "string") return [key, value];
    if (value === null || value === undefined) return [key, ""];
    return [key, typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value)];
  }));
}

async function requestSharedBlocking(
  input: Record<string, unknown>,
  mode: string,
  options: { fetchImpl: typeof fetch; timeoutMs: number; apiKey: string; appMode?: DifyAppMode },
): Promise<{ ok: true; output: unknown } | { ok: false; reason: "DIFY_TIMEOUT" | "DIFY_HTTP_ERROR" }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const isShared = options.appMode !== "legacy_workflow";
    const context = typeof input.context_json === "string" ? input.context_json : "{}";
    const question = typeof input.question === "string" ? input.question : "";
    const sharedInputs = isShared
      ? sharedChatflowInputs(input, mode)
      : input;
    const response = await options.fetchImpl(`${process.env.DIFY_BASE_URL?.trim() || DEFAULT_DIFY_BASE_URL}${isShared ? "/chat-messages" : "/workflows/run"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(isShared
        ? { inputs: { ...sharedInputs, teaching_mode: mode }, query: `[网站上下文] teaching_mode=${mode}\ncontext_json=${context.slice(0, 6000)}\n[分支输入]\n${sharedDetails(mode, input)}\n[任务] ${sharedTask(mode, input, question)}`, response_mode: "blocking", user: String(input.anonymous_learner_id || "anonymous") }
        : { inputs: input, response_mode: "blocking", user: String(input.anonymous_learner_id || "anonymous") }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "DIFY_HTTP_ERROR" };
    const body = await response.json() as { answer?: unknown; data?: { outputs?: Record<string, unknown> } };
    return { ok: true, output: isShared ? body.answer : body.data?.outputs?.output ?? body.data?.outputs?.result };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, reason: "DIFY_TIMEOUT" };
    return { ok: false, reason: "DIFY_HTTP_ERROR" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestDifyBattleQuestion(
  input: Record<string, unknown>,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<DifyBattleQuestionResult> {
  const started = Date.now();
  const config = battleAppConfig("question");
  const apiKey = config.apiKey;
  if (!apiKey) return { ok: false, reason: "DIFY_NOT_CONFIGURED", latencyMs: Date.now() - started };

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? BATTLE_QUESTION_TIMEOUT_MS);
  try {
    const endpoint = config.mode === "shared_chatflow" ? "/chat-messages" : "/workflows/run";
    const body = config.mode === "shared_chatflow"
      ? { inputs: sharedChatflowInputs({ ...input, question: String(input.question ?? "请根据已完成绘本和知识点生成一道题。") }, "battle", "question"), query: battleChatflowQuery(input, "question"), response_mode: "blocking", user: String(input.anonymous_learner_id || "anonymous") }
      : { inputs: input, response_mode: "blocking", user: String(input.anonymous_learner_id || "anonymous") };
    const response = await fetchImpl(`${process.env.DIFY_BASE_URL?.trim() || DEFAULT_DIFY_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "DIFY_HTTP_ERROR", latencyMs: Date.now() - started };
    const responseBody = await response.json() as { answer?: unknown; data?: { outputs?: Record<string, unknown> } };
    const output = config.mode === "shared_chatflow"
      ? responseBody.answer
      : responseBody.data?.outputs?.output ?? responseBody.data?.outputs?.result;
    const normalized = normalizeBattleQuestionOutput(output, input);
    const parsed = BattleQuestionResponseSchema.safeParse(normalized);
    if (!parsed.success) return { ok: false, reason: "DIFY_INVALID_OUTPUT", latencyMs: Date.now() - started };
    return { ok: true, value: parsed.data, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, reason: "DIFY_TIMEOUT", latencyMs: Date.now() - started };
    }
    return { ok: false, reason: "DIFY_HTTP_ERROR", latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestDifyBattleFeedback(
  input: Record<string, unknown>,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<DifyBattleFeedbackResult> {
  const started = Date.now();
  const config = battleAppConfig("feedback");
  const apiKey = config.apiKey;
  if (!apiKey) return { ok: false, reason: "DIFY_NOT_CONFIGURED", latencyMs: Date.now() - started };

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? BATTLE_FEEDBACK_TIMEOUT_MS);
  try {
    const endpoint = config.mode === "shared_chatflow" ? "/chat-messages" : "/workflows/run";
    const body = config.mode === "shared_chatflow"
      ? { inputs: sharedChatflowInputs({ ...input, question: String(input.question ?? "请根据网站已经确定的判分事实给出适龄反馈。") }, "battle", "feedback"), query: battleChatflowQuery(input, "feedback"), response_mode: "blocking", user: String(input.anonymous_learner_id || "anonymous") }
      : { inputs: input, response_mode: "blocking", user: String(input.anonymous_learner_id || "anonymous") };
    const response = await fetchImpl(`${process.env.DIFY_BASE_URL?.trim() || DEFAULT_DIFY_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "DIFY_HTTP_ERROR", latencyMs: Date.now() - started };
    const responseBody = await response.json() as { answer?: unknown; data?: { outputs?: Record<string, unknown> } };
    const output = config.mode === "shared_chatflow"
      ? responseBody.answer
      : responseBody.data?.outputs?.output ?? responseBody.data?.outputs?.result;
    const parsed = BattleFeedbackResponseSchema.safeParse(normalizeBattleFeedbackOutput(output, input));
    if (!parsed.success) return { ok: false, reason: "DIFY_INVALID_OUTPUT", latencyMs: Date.now() - started };
    return { ok: true, value: parsed.data, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, reason: "DIFY_TIMEOUT", latencyMs: Date.now() - started };
    }
    return { ok: false, reason: "DIFY_HTTP_ERROR", latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestDifyRecommendation(
  input: Record<string, unknown>,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<DifyRecommendationResult> {
  const started = Date.now();
  const sharedKey = process.env.DIFY_TEACHING_AGENT_APP_KEY?.trim();
  const apiKey = sharedKey || process.env.DIFY_RECOMMENDATION_APP_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "DIFY_NOT_CONFIGURED", latencyMs: Date.now() - started };
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? STRUCTURED_BRANCH_TIMEOUT_MS;
  const shared = await requestSharedBlocking(input, "recommendation", { fetchImpl, timeoutMs, apiKey, appMode: sharedKey ? "shared_chatflow" : "legacy_workflow" });
  if (!shared.ok) return { ok: false, reason: shared.reason, latencyMs: Date.now() - started };
  const parsed = RecommendationResponseSchema.safeParse(parseOutput(shared.output));
  if (!parsed.success) return { ok: false, reason: "DIFY_INVALID_OUTPUT", latencyMs: Date.now() - started };
  return { ok: true, value: parsed.data, latencyMs: Date.now() - started };
}

export async function requestDifyDefensePlan(
  input: Record<string, unknown>,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<DifyDefensePlanResult> {
  const started = Date.now();
  const sharedKey = process.env.DIFY_TEACHING_AGENT_APP_KEY?.trim();
  const apiKey = sharedKey || process.env.DIFY_HIGH_DEFENSE_PLAN_APP_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "DIFY_NOT_CONFIGURED", latencyMs: Date.now() - started };
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? STRUCTURED_BRANCH_TIMEOUT_MS;
  const shared = await requestSharedBlocking(input, "defense", { fetchImpl, timeoutMs, apiKey, appMode: sharedKey ? "shared_chatflow" : "legacy_workflow" });
  if (!shared.ok) return { ok: false, reason: shared.reason, latencyMs: Date.now() - started };
  const parsed = HighDefensePlanResponseSchema.safeParse(parseOutput(shared.output));
  if (!parsed.success) return { ok: false, reason: "DIFY_INVALID_OUTPUT", latencyMs: Date.now() - started };
  return { ok: true, value: parsed.data, latencyMs: Date.now() - started };
}
