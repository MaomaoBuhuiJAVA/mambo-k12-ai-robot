import { describe, expect, it } from "vitest";

import { POST } from "./route";

const context = {
  schemaVersion: 1,
  traceId: "trace:feedback-route-test",
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

describe("POST /api/ai/battle/feedback", () => {
  it("rejects a website grading conflict", async () => {
    const response = await POST(new Request("http://localhost/api/ai/battle/feedback", {
      method: "POST",
      body: JSON.stringify({ context, isCorrect: true, studentAnswer: "错", correctAnswer: "对", explanation: "固定解释", knowledgePointIds: [] }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(response.status).toBe(400);
  });

  it("returns a controlled degradation without a feedback key", async () => {
    const previous = process.env.DIFY_PRIMARY_BATTLE_FEEDBACK_APP_KEY;
    delete process.env.DIFY_PRIMARY_BATTLE_FEEDBACK_APP_KEY;
    const response = await POST(new Request("http://localhost/api/ai/battle/feedback", {
      method: "POST",
      body: JSON.stringify({ context, isCorrect: true, studentAnswer: "对", correctAnswer: "对", explanation: "固定解释", knowledgePointIds: [] }),
      headers: { "Content-Type": "application/json" },
    }));
    if (previous) process.env.DIFY_PRIMARY_BATTLE_FEEDBACK_APP_KEY = previous;
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ degraded: true, reason: "DIFY_NOT_CONFIGURED" });
  });
});
