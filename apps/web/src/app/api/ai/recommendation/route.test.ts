import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRequestGuardForTests } from "@/lib/ai/request-guard";

const context = {
  schemaVersion: 1 as const,
  traceId: "trace:recommend-route",
  anonymousLearnerId: "anon:recommend",
  stage: "middle_school" as const,
  grade: 7,
  teachingMode: "recommendation" as const,
  activityId: "progress:next",
  courseId: null,
  moduleId: null,
  storybookId: null,
  pageNumber: null,
  knowledgePointIds: [],
  completedActivityIds: [],
  masterySummary: [],
  misconceptionTags: [],
  recentEvidenceSummary: [],
  allowedActionIds: ["middle-next"],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetRequestGuardForTests();
});

describe("POST /api/ai/recommendation", () => {
  it("returns a deterministic candidate when Dify is unavailable", async () => {
    const response = await POST(new Request("http://localhost/api/ai/recommendation", {
      method: "POST",
      body: JSON.stringify({ context, candidates: [{ actionId: "middle-next", title: "下一课", summary: "继续学习", courseId: null }] }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.degraded).toBe(true);
    expect(body.data.payload.recommendations[0].actionId).toBe("middle-next");
  });

  it("rejects candidates outside the website action allowlist", async () => {
    const response = await POST(new Request("http://localhost/api/ai/recommendation", {
      method: "POST",
      body: JSON.stringify({ context, candidates: [{ actionId: "unknown-action", title: "越权", summary: "不允许", courseId: null }] }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
  });
});

