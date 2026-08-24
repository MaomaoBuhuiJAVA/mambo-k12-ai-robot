import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRequestGuardForTests } from "@/lib/ai/request-guard";

const context = {
  schemaVersion: 1 as const,
  traceId: "trace:lab-route",
  anonymousLearnerId: "anon:lab",
  stage: "middle_school" as const,
  grade: 7,
  teachingMode: "lab" as const,
  activityId: "middle-neural-signals-guided-lab",
  courseId: "middle-neural-signals",
  moduleId: null,
  storybookId: null,
  pageNumber: null,
  knowledgePointIds: ["middle-neural-signals:features"],
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

describe("POST /api/ai/lab/coach", () => {
  it("keeps the experiment deterministic when Dify is unavailable", async () => {
    const response = await POST(new Request("http://localhost/api/ai/lab/coach", {
      method: "POST",
      body: JSON.stringify({ context, templateId: "image-classifier", runId: "run:1", variables: { color: "green" }, metrics: { accuracy: 0.5 }, conclusion: "看起来更准", question: "下一次改什么？" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"degraded":true');
  });

  it("rejects a template that does not belong to the activity", async () => {
    const response = await POST(new Request("http://localhost/api/ai/lab/coach", {
      method: "POST",
      body: JSON.stringify({ context, templateId: "bubble-sort", runId: null, variables: {}, metrics: {}, conclusion: null, question: "为什么？" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
  });
});

