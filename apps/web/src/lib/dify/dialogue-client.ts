import { DIALOGUE_WORKFLOW_VERSION } from "./contracts";

const DEFAULT_DIFY_BASE_URL = "https://api.dify.ai/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const encoder = new TextEncoder();

export type DifyDialogueResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; latencyMs: number }
  | { ok: false; reason: "DIFY_NOT_CONFIGURED" | "DIFY_TIMEOUT" | "DIFY_HTTP_ERROR"; latencyMs: number };

type DifySseEvent = {
  event?: string;
  answer?: unknown;
  metadata?: { retriever_resources?: Array<{ document_name?: unknown }> };
};

function compactContextJson(value: unknown): string {
  if (typeof value !== "string") return "{}";
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const compact = {
      schemaVersion: parsed.schemaVersion,
      traceId: parsed.traceId,
      stage: parsed.stage,
      teachingMode: parsed.teachingMode,
      activityId: parsed.activityId,
      courseId: parsed.courseId,
      lessonId: parsed.lessonId,
      moduleId: parsed.moduleId,
      storybookId: parsed.storybookId,
      pageNumber: parsed.pageNumber,
    };
    const result = JSON.stringify(compact);
    return result.length < 256 ? result : JSON.stringify({
      schemaVersion: compact.schemaVersion,
      traceId: compact.traceId,
      stage: compact.stage,
      teachingMode: compact.teachingMode,
      courseId: compact.courseId,
      lessonId: compact.lessonId,
      activityId: compact.activityId,
      moduleId: compact.moduleId,
    });
  } catch {
    return "{}";
  }
}

function serializeDifyInputs(input: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (key === "context_json") return [key, compactContextJson(value)];
    if (value === null || value === undefined) return [key, ""];
    if (typeof value === "string") return [key, value];
    if (typeof value === "number" || typeof value === "boolean") return [key, String(value)];
    return [key, JSON.stringify(value)];
  }));
}

function eventLine(type: "start" | "delta" | "sources" | "complete", payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function sourceIds(event: DifySseEvent, allowedSourceIds?: ReadonlySet<string>): string[] {
  return (event.metadata?.retriever_resources ?? [])
    .map((resource) => typeof resource.document_name === "string" ? resource.document_name : "")
    .filter((value) => allowedSourceIds === undefined || allowedSourceIds.has(value))
    .filter((value) => /^[\w.:-]{1,160}$/u.test(value));
}

function parseData(line: string): DifySseEvent | null {
  if (!line.startsWith("data:")) return null;
  try {
    const parsed: unknown = JSON.parse(line.slice(5).trim());
    return parsed && typeof parsed === "object" ? parsed as DifySseEvent : null;
  } catch {
    return null;
  }
}

function createThinkFilter() {
  let hidden = false;
  let pending = "";

  function consume(value: string, flush = false): string {
    pending += value;
    let visible = "";
    for (;;) {
      if (hidden) {
        const end = pending.indexOf("</think>");
        if (end < 0) {
          if (!flush) return visible;
          pending = "";
          return visible;
        }
        pending = pending.slice(end + "</think>".length);
        hidden = false;
        continue;
      }
      const start = pending.indexOf("<think>");
      if (start >= 0) {
        visible += pending.slice(0, start);
        pending = pending.slice(start + "<think>".length);
        hidden = true;
        continue;
      }
      if (flush) {
        visible += pending;
        pending = "";
        return visible;
      }
      const hold = Math.min(pending.length, "<think>".length - 1);
      visible += pending.slice(0, pending.length - hold);
      pending = pending.slice(pending.length - hold);
      return visible;
    }
  }

  return { consume, flush: () => consume("", true) };
}

function buildDifyQuery(input: Record<string, unknown>): string {
  const question = String(input.question ?? input.current_question ?? "请根据当前学习上下文提供引导。").trim();
  const stringValue = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  const scalarValue = (key: string) => typeof input[key] === "number" || typeof input[key] === "string"
    ? String(input[key]).trim()
    : "";
  const stage = stringValue("stage");
  const teachingMode = stringValue("teaching_mode");
  const activityId = stringValue("activity_id");
  const storybookId = stringValue("storybook_id");
  const pageNumber = scalarValue("page_number");
  const courseId = stringValue("course_id");
  const courseTitle = stringValue("course_title");
  const courseOverview = stringValue("course_overview");
  const lessonId = stringValue("lesson_id");
  const lessonTitle = stringValue("lesson_title");
  const lessonSummary = stringValue("lesson_summary");
  const knowledgePointIds = stringValue("knowledge_point_ids");
  const scope = [
    `[网站上下文] stage=${stage || "unknown"}; teaching_mode=${teachingMode || "unknown"}; activity_id=${activityId || "unknown"}`,
    storybookId ? `storybook_id=${storybookId}; page_number=${pageNumber || "unknown"}` : "",
    courseId ? `course_id=${courseId}` : "",
    courseTitle ? `course_title=${courseTitle.slice(0, 240)}` : "",
    courseOverview ? `course_overview=${courseOverview.slice(0, 800)}` : "",
    lessonId ? `lesson_id=${lessonId}` : "",
    lessonTitle ? `lesson_title=${lessonTitle.slice(0, 240)}` : "",
    lessonSummary ? `lesson_summary=${lessonSummary.slice(0, 800)}` : "",
    knowledgePointIds ? `knowledge_point_ids=${knowledgePointIds.slice(0, 800)}` : "",
    stringValue("template_id") ? `template_id=${stringValue("template_id")}` : "",
    stringValue("run_id") ? `run_id=${stringValue("run_id")}` : "",
    stringValue("variables_json") ? `variables=${stringValue("variables_json").slice(0, 1200)}` : "",
    stringValue("metrics_json") ? `metrics=${stringValue("metrics_json").slice(0, 1200)}` : "",
    stringValue("conclusion") ? `conclusion=${stringValue("conclusion").slice(0, 1200)}` : "",
    stringValue("project_id") ? `project_id=${stringValue("project_id")}` : "",
    stringValue("question_id") ? `question_id=${stringValue("question_id")}` : "",
    stringValue("student_answer") ? `student_answer=${stringValue("student_answer").slice(0, 1600)}` : "",
    stringValue("referenced_evidence_ids") ? `referenced_evidence_ids=${stringValue("referenced_evidence_ids").slice(0, 800)}` : "",
  ].filter(Boolean).join("; ");
  return `${scope}\n[学生问题] ${question}`;
}

export function transformDifyDialogueStream(
  body: ReadableStream<Uint8Array>,
  traceId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  workflowVersion: string = DIALOGUE_WORKFLOW_VERSION,
  allowedSourceIds?: readonly string[],
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;
  let completed = false;
  const emittedSources = new Set<string>();
  const sourceAllowList = allowedSourceIds === undefined ? undefined : new Set(allowedSourceIds);
  const thinkFilter = createThinkFilter();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const clearStreamTimeout = () => {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        timeout = setTimeout(() => {
          void reader.cancel("dialogue stream timeout");
          if (completed) return;
          completed = true;
          controller.enqueue(eventLine("complete", { traceId, degraded: true, reason: "DIFY_TIMEOUT" }));
          controller.close();
        }, timeoutMs);
        controller.enqueue(eventLine("start", { traceId, workflowVersion }));
        return;
      }
      if (completed) return;
      try {
        for (;;) {
          const newline = buffer.indexOf("\n");
          if (newline < 0) {
            const next = await reader.read();
            if (completed) return;
            if (next.done) {
              completed = true;
              clearStreamTimeout();
              const tail = buffer.trim();
              const parsed = tail ? parseData(tail) : null;
              const tailAnswer = typeof parsed?.answer === "string" ? parsed.answer : "";
              const tailText = thinkFilter.consume(tailAnswer) + thinkFilter.flush();
              if (tailText) controller.enqueue(eventLine("delta", { text: tailText }));
              controller.enqueue(eventLine("complete", { traceId, degraded: false }));
              controller.close();
              return;
            }
            buffer += decoder.decode(next.value, { stream: true });
            continue;
          }

          const line = buffer.slice(0, newline).replace(/\r$/u, "");
          buffer = buffer.slice(newline + 1);
          const parsed = parseData(line);
          if (!parsed) continue;
          const answer = typeof parsed.answer === "string" ? parsed.answer : "";
          const sources = [...new Set(sourceIds(parsed, sourceAllowList))].filter((id) => !emittedSources.has(id));
          if (sources.length) {
            sources.forEach((id) => emittedSources.add(id));
            controller.enqueue(eventLine("sources", { sourceIds: sources }));
          }
          if (answer) {
            const text = thinkFilter.consume(answer);
            if (text) {
              controller.enqueue(eventLine("delta", { text }));
              return;
            }
            continue;
          }
          if (parsed.event === "error") {
            completed = true;
            clearStreamTimeout();
            controller.enqueue(eventLine("complete", { traceId, degraded: true, reason: "DIFY_STREAM_ERROR" }));
            controller.close();
            return;
          }
        }
      } catch {
        if (completed) return;
        completed = true;
        clearStreamTimeout();
        controller.enqueue(eventLine("complete", { traceId, degraded: true, reason: "DIFY_STREAM_ERROR" }));
        controller.close();
      }
    },
    async cancel(reason) {
      completed = true;
      clearStreamTimeout();
      await reader.cancel(reason);
    },
  });
}

export async function requestDifyDialogue(
  input: Record<string, unknown>,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal; apiKey?: string; workflowVersion?: string; allowedSourceIds?: readonly string[] } = {},
): Promise<DifyDialogueResult> {
  const started = Date.now();
  const apiKey = options.apiKey?.trim()
    || process.env.DIFY_TEACHING_AGENT_APP_KEY?.trim()
    || process.env.DIFY_DIALOGUE_APP_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "DIFY_NOT_CONFIGURED", latencyMs: Date.now() - started };

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const abortFromRequest = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortFromRequest, { once: true });
  try {
    const requestBody = {
      inputs: serializeDifyInputs(input),
      query: buildDifyQuery(input),
      response_mode: "streaming",
      user: String(input.anonymous_learner_id || "anonymous"),
    };
    const response = await fetchImpl(`${process.env.DIFY_BASE_URL?.trim() || DEFAULT_DIFY_BASE_URL}/chat-messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok || !response.body) return { ok: false, reason: "DIFY_HTTP_ERROR", latencyMs: Date.now() - started };
    return {
      ok: true,
      stream: transformDifyDialogueStream(
        response.body,
        String(input.trace_id || "trace:unknown"),
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        options.workflowVersion ?? DIALOGUE_WORKFLOW_VERSION,
        options.allowedSourceIds,
      ),
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, reason: "DIFY_TIMEOUT", latencyMs: Date.now() - started };
    return { ok: false, reason: "DIFY_HTTP_ERROR", latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromRequest);
  }
}
