import { afterEach, describe, expect, it, vi } from "vitest";

import { resetRequestGuardForTests } from "@/lib/ai/request-guard";
import { POST } from "./route";

const validBody = {
  schemaVersion: 1,
  traceId: "trace:tutor-route",
  courseId: "middle-ai-foundations",
  lessonId: "middle-ai-foundations:concepts:rules-and-models",
  context: { stage: "middle_school", learnerSummary: "" },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetRequestGuardForTests();
});

describe("POST /api/ai/tutor/lesson-plan", () => {
  it("returns the deterministic fallback when Dify is unavailable", async () => {
    const response = await POST(new Request("http://localhost/api/ai/tutor/lesson-plan", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.degraded).toBe(true);
    expect(body.data.payload.slides.length).toBeLessThanOrEqual(6);
    expect(body.data.payload.courseId).toBe(validBody.courseId);
  });

  it("rejects an unknown course/lesson pair before any Dify call", async () => {
    const response = await POST(new Request("http://localhost/api/ai/tutor/lesson-plan", {
      method: "POST",
      body: JSON.stringify({ ...validBody, lessonId: "unknown" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_TUTOR_LESSON_PLAN_REQUEST" });
  });
});
