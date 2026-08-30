import { describe, expect, it } from "vitest";

import { POST } from "./route";

const context = {
  schemaVersion: 1,
  traceId: "trace:route-test",
  anonymousLearnerId: "anon:test",
  stage: "lower_primary",
  grade: 2,
  teachingMode: "battle",
  activityId: "primary-battle:castle-1",
  courseId: null,
  moduleId: "castle-1",
  storybookId: null,
  pageNumber: null,
  knowledgePointIds: ["castle:ordered-observation"],
  completedActivityIds: ["castle-lesson-01"],
  masterySummary: [],
  misconceptionTags: [],
  recentEvidenceSummary: [],
  allowedActionIds: [],
} as const;

describe("POST /api/ai/battle/question", () => {
  it("rejects malformed requests before any Dify call", async () => {
    const response = await POST(new Request("http://localhost/api/ai/battle/question", {
      method: "POST",
      body: JSON.stringify({ context }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_BATTLE_REQUEST" });
  });

  it("returns a controlled degradation when Dify is not configured", async () => {
    const previous = process.env.DIFY_PRIMARY_BATTLE_APP_KEY;
    delete process.env.DIFY_PRIMARY_BATTLE_APP_KEY;
    const response = await POST(new Request("http://localhost/api/ai/battle/question", {
      method: "POST",
      body: JSON.stringify({
        context,
        questionIndex: 0,
        difficulty: "introductory",
        excludedQuestionIds: [],
        allowedKnowledgePointIds: ["castle:ordered-observation"],
      }),
      headers: { "Content-Type": "application/json" },
    }));
    if (previous) process.env.DIFY_PRIMARY_BATTLE_APP_KEY = previous;
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ degraded: true, reason: "DIFY_NOT_CONFIGURED", traceId: context.traceId });
  });
});
