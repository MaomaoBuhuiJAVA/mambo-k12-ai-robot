import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRequestGuardForTests } from "@/lib/ai/request-guard";

const context = {
  schemaVersion: 1 as const,
  traceId: "trace:dialogue-route",
  anonymousLearnerId: "anon:dialogue",
  stage: "lower_primary" as const,
  grade: 2,
  teachingMode: "storybook" as const,
  activityId: "storybook:castle-lesson-01",
  courseId: null,
  moduleId: "castle-1",
  storybookId: "castle-lesson-01",
  pageNumber: 4,
  knowledgePointIds: ["castle:ordered-observation"],
  completedActivityIds: [],
  masterySummary: [],
  misconceptionTags: [],
  recentEvidenceSummary: [],
  allowedActionIds: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetRequestGuardForTests();
});

describe("POST /api/ai/dialogue", () => {
  it("returns an SSE fallback when Dify is not configured", async () => {
    const response = await POST(new Request("http://localhost/api/ai/dialogue", {
      method: "POST",
      body: JSON.stringify({ context, messages: [{ role: "user", content: "你好" }], question: "这一页讲了什么？" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await response.text();
    expect(text).toContain('"degraded":true');
    expect(text).toContain("我暂时无法连接学习助手");
  });

  it("rejects a dialogue history that ends with an assistant message", async () => {
    const response = await POST(new Request("http://localhost/api/ai/dialogue", {
      method: "POST",
      body: JSON.stringify({ context, messages: [{ role: "assistant", content: "你好" }], question: "继续" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
  });
});

