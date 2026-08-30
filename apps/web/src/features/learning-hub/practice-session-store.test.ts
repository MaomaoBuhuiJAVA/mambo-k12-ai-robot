import { describe, expect, it } from "vitest";

import {
  loadPracticeSessionProgress,
  parsePracticeSessionProgress,
  savePracticeSessionProgress,
  type SessionStorageAdapter,
} from "./practice-session-store";

class MemoryStorage implements SessionStorageAdapter {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe("practice session store", () => {
  const allowed = new Set(["course-a:q1", "course-a:q2"]);

  it("drops unknown, duplicate, and inconsistent restored question keys", () => {
    const progress = parsePracticeSessionProgress(JSON.stringify({
      schemaVersion: 1,
      handledQuestionKeys: ["course-a:q1", "unknown", "course-a:q1"],
      correctQuestionKeys: ["course-a:q1", "course-a:q2"],
      skippedQuestionKeys: ["course-a:q1", "unknown"],
    }), allowed);

    expect(progress).toEqual({
      schemaVersion: 1,
      handledQuestionKeys: ["course-a:q1"],
      correctQuestionKeys: ["course-a:q1"],
      skippedQuestionKeys: [],
    });
  });

  it("saves and restores only valid session progress", () => {
    const storage = new MemoryStorage();
    const saved = savePracticeSessionProgress("daily-middle_school", {
      schemaVersion: 1,
      handledQuestionKeys: ["course-a:q1"],
      correctQuestionKeys: ["course-a:q1"],
      skippedQuestionKeys: [],
    }, allowed, storage);

    expect(saved).toBe(true);
    expect(loadPracticeSessionProgress("daily-middle_school", allowed, storage)).toMatchObject({
      handledQuestionKeys: ["course-a:q1"],
      correctQuestionKeys: ["course-a:q1"],
    });
  });

  it("bounds and restores draft answers, submitted answer history, results, and hints", () => {
    const storage = new MemoryStorage();
    savePracticeSessionProgress("course-a", {
      schemaVersion: 1,
      handledQuestionKeys: [],
      correctQuestionKeys: [],
      skippedQuestionKeys: [],
      answersByQuestionKey: { "course-a:q1": "draft" },
      submittedAnswerHistoryByQuestionKey: { "course-a:q1": ["first", "second"] },
      resultsByQuestionKey: {
        "course-a:q1": { correct: false, score: 0, feedback: "请回到依据", knowledgePointIds: ["point-a"] },
      },
      hintsByQuestionKey: { "course-a:q1": 99 },
    }, allowed, storage);

    expect(loadPracticeSessionProgress("course-a", allowed, storage)).toMatchObject({
      answersByQuestionKey: { "course-a:q1": "draft" },
      submittedAnswerHistoryByQuestionKey: { "course-a:q1": ["first", "second"] },
      resultsByQuestionKey: { "course-a:q1": { correct: false, score: 0 } },
      hintsByQuestionKey: { "course-a:q1": 20 },
    });
  });
});
