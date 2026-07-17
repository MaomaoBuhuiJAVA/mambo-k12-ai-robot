import { describe, expect, it } from "vitest";

import { createDefaultLearningState } from "@/lib/learning-store";
import { recordLabCompletion } from "./lab-progress";

describe("recordLabCompletion", () => {
  it("records a code attempt and mastery without persisting source", () => {
    const state = createDefaultLearningState();
    const next = recordLabCompletion(state, {
      templateId: "bubble-sort",
      passed: true,
      completedAt: "2026-07-18T04:00:00.000Z",
      attemptId: "lab-attempt-1",
    });

    expect(next.attempts.at(-1)).toMatchObject({
      attemptId: "lab-attempt-1",
      knowledgePointId: "algorithm.bubble-sort",
      score: 1,
      hints: 0,
      mode: "code",
    });
    expect(next.attempts.at(-1)).not.toHaveProperty("answer");
    expect(next.masteryByKnowledgePoint["algorithm.bubble-sort"]).toMatchObject({
      evidenceCount: 1,
      lastPracticedAt: "2026-07-18T04:00:00.000Z",
    });
  });

  it("does not award completion for a failed deterministic check", () => {
    const state = createDefaultLearningState();
    const next = recordLabCompletion(state, {
      templateId: "image-classifier",
      passed: false,
      completedAt: "2026-07-18T04:00:00.000Z",
      attemptId: "lab-attempt-2",
    });

    expect(next).toBe(state);
  });
});
