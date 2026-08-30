import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRequestGuardForTests } from "@/lib/ai/request-guard";

const lessonId = "middle-ai-foundations:concepts:rules-and-models";
const context = {
  schemaVersion: 1 as const,
  traceId: "trace:tutor-guide",
  anonymousLearnerId: "anon:tutor-guide",
  stage: "middle_school" as const,
  grade: 7,
  teachingMode: "dialogue" as const,
  activityId: "middle-ai-foundations-lesson",
  courseId: "middle-ai-foundations",
  moduleId: null,
  storybookId: null,
  pageNumber: null,
  knowledgePointIds: [
    "middle-ai-foundations:规则程序与机器学习",
    "middle-ai-foundations:数据样本",
  ],
  completedActivityIds: [],
  masterySummary: [],
  misconceptionTags: [],
  recentEvidenceSummary: [],
  allowedActionIds: ["tutor.next_slide"],
};

function guideBody(overrides: Record<string, unknown> = {}) {
  return {
    context,
    lessonId,
    messages: [{ role: "user", content: "规则程序和机器学习有什么区别？" }],
    question: "规则程序和机器学习有什么区别？",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetRequestGuardForTests();
});

beforeEach(() => {
  vi.stubEnv("DIFY_TEACHING_AGENT_APP_KEY", "");
  vi.stubEnv("DIFY_DIALOGUE_APP_KEY", "");
});

describe("POST /api/ai/tutor/guide", () => {
  it("returns a deterministic lesson-specific SSE fallback when Dify is unavailable", async () => {
    const response = await POST(new Request("http://localhost/api/ai/tutor/guide", {
      method: "POST",
      body: JSON.stringify(guideBody()),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await response.text();
    expect(text).toContain(`"workflowVersion":"ai-tutor-guide-v1"`);
    expect(text).toContain("规则、样本与模型");
    expect(text).toContain("DIFY_NOT_CONFIGURED");
    expect(text).toContain('"degraded":true');
  });

  it("streams the shared Chatflow response with server-resolved course and lesson context", async () => {
    vi.stubEnv("DIFY_TEACHING_AGENT_APP_KEY", "server-only-test-key");
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: message\ndata: {"answer":"先比较规则来自哪里。"}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(upstream));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/ai/tutor/guide", {
      method: "POST",
      body: JSON.stringify(guideBody()),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"text":"先比较规"');
    expect(text).toContain('"text":"则来自哪里。"');
    expect(text).toContain('"degraded":false');
    expect(text).not.toContain("server-only-test-key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const sent = JSON.parse(String(init?.body));
    expect(sent.inputs).toMatchObject({
      course_id: "middle-ai-foundations",
      lesson_id: lessonId,
      lesson_title: "规则、样本与模型",
    });
    expect(sent.inputs.context_json).toContain(`"lessonId":"${lessonId}"`);
    expect(sent.inputs.context_json).toContain('"teachingMode":"storybook"');
    expect(sent.inputs.teaching_mode).toBe("storybook");
    expect(sent.query).toContain("course_id=middle-ai-foundations");
    expect(sent.query).toContain(`lesson_id=${lessonId}`);
  });

  it("rejects a client context that conflicts with the registered lesson", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost/api/ai/tutor/guide", {
      method: "POST",
      body: JSON.stringify(guideBody({
        context: { ...context, courseId: "middle-data-and-algorithms" },
      })),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "TUTOR_CONTEXT_CONFLICT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
