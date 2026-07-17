import { describe, expect, it } from "vitest";

import { createDefaultLearningState } from "@/lib/learning-store";
import { recordLabCompletion } from "./lab-progress";

describe("recordLabCompletion", () => {
  it("records a code attempt and mastery without persisting source", () => {
    const state = createDefaultLearningState();
    const next = recordLabCompletion(state, {
      templateId: "bubble-sort",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-07-18T04:00:00.000Z",
      hintsUsed: 2,
    });

    expect(next.attempts.at(-1)).toMatchObject({
      attemptId: "lab:bubble-sort:v1",
      knowledgePointId: "algorithm.bubble-sort",
      score: 0.7,
      hints: 2,
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
      challengeVersion: 1,
      passed: false,
      completedAt: "2026-07-18T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next).toBe(state);
  });

  it("does not add evidence twice for the same challenge version", () => {
    const first = recordLabCompletion(createDefaultLearningState(), {
      templateId: "bubble-sort",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-07-18T04:00:00.000Z",
      hintsUsed: 0,
    });
    const repeated = recordLabCompletion(first, {
      templateId: "bubble-sort",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-07-19T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(repeated).toBe(first);
    expect(repeated.attempts).toHaveLength(1);
    expect(repeated.masteryByKnowledgePoint["algorithm.bubble-sort"].evidenceCount).toBe(1);
  });

  it("records a new deterministic attempt after a challenge version changes", () => {
    const first = recordLabCompletion(createDefaultLearningState(), {
      templateId: "bubble-sort",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-07-18T04:00:00.000Z",
      hintsUsed: 0,
    });
    const upgraded = recordLabCompletion(first, {
      templateId: "bubble-sort",
      challengeVersion: 2,
      passed: true,
      completedAt: "2026-07-19T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(upgraded.attempts.map((attempt) => attempt.attemptId)).toEqual([
      "lab:bubble-sort:v1",
      "lab:bubble-sort:v2",
    ]);
  });
});
