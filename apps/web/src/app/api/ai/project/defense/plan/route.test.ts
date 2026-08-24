import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRequestGuardForTests } from "@/lib/ai/request-guard";

const context = {
  schemaVersion: 1 as const,
  traceId: "trace:defense-plan",
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
  completedActivityIds: ["high-project-prep"],
  masterySummary: [],
  misconceptionTags: [],
  recentEvidenceSummary: [{ evidenceId: "experiment:audit:v1", kind: "lab", resultCode: "complete", metrics: { accuracy: 0.8 } }],
  allowedActionIds: [],
};

const project = {
  researchQuestion: "模型在不同分组上的表现是否一致",
  dataSource: "课程提供的匿名样本",
  authorization: "仅用于课程实验",
  processingSteps: "清洗并按标签分组",
  modelVersion: "baseline-v1",
  metrics: "准确率 0.8",
  failureCases: "少数样本分类错误",
  conclusion: "当前证据支持继续扩大样本",
  limitations: "样本量有限",
  evidenceRefs: ["experiment:audit:v1"],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetRequestGuardForTests();
});

describe("POST /api/ai/project/defense/plan", () => {
  it("returns a deterministic degraded response without a Dify key", async () => {
    const response = await POST(new Request("http://localhost/api/ai/project/defense/plan", {
      method: "POST",
      body: JSON.stringify({ context, projectId: "capstone", project }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).reason).toBe("DIFY_NOT_CONFIGURED");
  });

  it("rejects evidence references not present in recent website evidence", async () => {
    const response = await POST(new Request("http://localhost/api/ai/project/defense/plan", {
      method: "POST",
      body: JSON.stringify({ context, projectId: "capstone", project: { ...project, evidenceRefs: ["forged:evidence"] } }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
  });
});
