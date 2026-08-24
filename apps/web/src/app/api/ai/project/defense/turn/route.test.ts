import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRequestGuardForTests } from "@/lib/ai/request-guard";

const context = {
  schemaVersion: 1 as const,
  traceId: "trace:defense-turn",
  anonymousLearnerId: "anon:defense",
  stage: "high_school" as const,
  grade: 10,
  teachingMode: "defense" as const,
  activityId: "high-capstone-project",
  courseId: "high-project",
  moduleId: null,
  storybookId: null,
  pageNumber: null,
  knowledgePointIds: ["high:evidence"],
  completedActivityIds: [],
  masterySummary: [],
  misconceptionTags: [],
  recentEvidenceSummary: [{ evidenceId: "experiment:audit:v1", kind: "lab", resultCode: "complete" }],
  allowedActionIds: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetRequestGuardForTests();
});

describe("POST /api/ai/project/defense/turn", () => {
  it("returns the bounded evidence-first fallback stream without a Dify key", async () => {
    const response = await POST(new Request("http://localhost/api/ai/project/defense/turn", {
      method: "POST",
      body: JSON.stringify({
        context,
        projectId: "capstone",
        questionId: "q-1",
        question: "你的指标说明了什么？",
        studentAnswer: "目前只能说明这批样本的准确率。",
        referencedEvidenceIds: ["experiment:audit:v1"],
      }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("event: start");
    expect(text).toContain("证据");
    expect(text).toContain("DIFY_NOT_CONFIGURED");
  });

  it("rejects cross-stage defense turns", async () => {
    const response = await POST(new Request("http://localhost/api/ai/project/defense/turn", {
      method: "POST",
      body: JSON.stringify({
        context: { ...context, stage: "middle_school", teachingMode: "lab" },
        projectId: "capstone",
        questionId: "q-1",
        question: "问题",
        studentAnswer: "回答",
        referencedEvidenceIds: [],
      }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
  });
});
