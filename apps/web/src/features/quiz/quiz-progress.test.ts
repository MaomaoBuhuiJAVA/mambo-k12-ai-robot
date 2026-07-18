import { describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";
import { createDefaultLearningState, MAX_PERSISTED_ATTEMPTS } from "@/lib/learning-store";
import { recordQuizAttempt } from "./quiz-progress";

const course = getCourseById("lower-bubble-sort")!;
const exercise = course.exercises[0];
const now = "2026-07-18T08:00:00.000Z";

describe("recordQuizAttempt", () => {
  it("records failed evidence for every knowledge tag without retaining raw answers", () => {
    const state = createDefaultLearningState();
    const next = recordQuizAttempt(state, {
      course,
      exercise,
      score: 0,
      hints: 1,
      completedAt: now,
      attemptId: "attempt-1",
      answer: "private answer",
    });

    expect(next.attempts).toHaveLength(1);
    expect(next.attempts[0]).not.toHaveProperty("answer");
    expect(next.attempts[0]).toMatchObject({ score: 0, hints: 1, mode: "quiz" });
    expect(next.masteryByKnowledgePoint[`${course.id}:${exercise.knowledgePointTags[0]}`]).toMatchObject({
      evidenceCount: 1,
      lastPracticedAt: now,
      misconceptionTags: [`needs-review:${exercise.id}`],
    });
    expect(Date.parse(next.masteryByKnowledgePoint[`${course.id}:${exercise.knowledgePointTags[0]}`].nextReviewAt!))
      .toBe(Date.parse(now) + 6 * 60 * 60 * 1000);
  });

  it("records evidence for every tagged knowledge point", () => {
    const orderExercise = course.exercises[1];
    const next = recordQuizAttempt(createDefaultLearningState(), {
      course,
      exercise: orderExercise,
      score: 1,
      hints: 0,
      completedAt: now,
      attemptId: "order-attempt",
    });

    expect(next.attempts).toHaveLength(orderExercise.knowledgePointTags.length);
    expect(next.attempts.map((attempt) => attempt.knowledgePointId)).toEqual(
      orderExercise.knowledgePointTags.map((tag) => `${course.id}:${tag}`),
    );
    expect(Object.keys(next.masteryByKnowledgePoint)).toEqual(
      orderExercise.knowledgePointTags.map((tag) => `${course.id}:${tag}`),
    );
  });

  it("raises mastery and expands review spacing after repeated correct evidence", () => {
    let state = createDefaultLearningState();
    for (let index = 0; index < 4; index += 1) {
      state = recordQuizAttempt(state, {
        course,
        exercise,
        score: 1,
        hints: 0,
        completedAt: new Date(Date.parse(now) + index * 1_000).toISOString(),
        attemptId: `pass-${index}`,
      });
    }

    const record = state.masteryByKnowledgePoint[`${course.id}:${exercise.knowledgePointTags[0]}`];
    expect(record.mastery).toBeGreaterThan(0.6);
    expect(record.confidence).toBeGreaterThan(0.4);
    expect(record.evidenceCount).toBe(4);
    expect(Date.parse(record.nextReviewAt!) - Date.parse(record.lastPracticedAt!))
      .toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it("uses hints to reduce positive mastery evidence and bounds malformed values", () => {
    const base = createDefaultLearningState();
    const withoutHints = recordQuizAttempt(base, {
      course, exercise, score: 1, hints: 0, completedAt: now, attemptId: "plain",
    });
    const withHints = recordQuizAttempt(base, {
      course, exercise, score: 2, hints: 999, completedAt: now, attemptId: "hinted",
    });

    const id = `${course.id}:${exercise.knowledgePointTags[0]}`;
    expect(withHints.masteryByKnowledgePoint[id].mastery).toBeLessThan(withoutHints.masteryByKnowledgePoint[id].mastery);
    expect(withHints.attempts[0].score).toBe(1);
    expect(withHints.attempts[0].hints).toBe(20);
  });

  it("limits attempts, recent topics, identifiers, and misconception strings", () => {
    let state = createDefaultLearningState();
    for (let index = 0; index < MAX_PERSISTED_ATTEMPTS + 5; index += 1) {
      state = recordQuizAttempt(state, {
        course,
        exercise,
        score: 0,
        hints: 0,
        completedAt: new Date(Date.parse(now) + index * 1_000).toISOString(),
        attemptId: `attempt-${index}${"x".repeat(300)}`,
      });
    }

    expect(state.attempts).toHaveLength(MAX_PERSISTED_ATTEMPTS);
    expect(state.attempts.every((attempt) => attempt.attemptId.length <= 160)).toBe(true);
    expect(state.recentTopics.length).toBeLessThanOrEqual(20);
    expect(Object.values(state.masteryByKnowledgePoint).every((record) =>
      record.misconceptionTags.length <= 20 && record.misconceptionTags.every((tag) => tag.length <= 160),
    )).toBe(true);
  });

  it("only expands spacing for consecutive correct evidence", () => {
    let state = createDefaultLearningState();
    for (let index = 0; index < 3; index += 1) {
      state = recordQuizAttempt(state, {
        course, exercise, score: 0, hints: 0,
        completedAt: new Date(Date.parse(now) + index * 1_000).toISOString(),
        attemptId: `fail-${index}`,
      });
    }
    state = recordQuizAttempt(state, {
      course, exercise, score: 1, hints: 0,
      completedAt: new Date(Date.parse(now) + 4_000).toISOString(),
      attemptId: "first-pass",
    });
    const record = state.masteryByKnowledgePoint[`${course.id}:${exercise.knowledgePointTags[0]}`];
    expect(Date.parse(record.nextReviewAt!) - Date.parse(record.lastPracticedAt!))
      .toBe(24 * 60 * 60 * 1000);
  });

  it("calculates review streaks independently for every tagged knowledge point", () => {
    const orderExercise = course.exercises[1];
    const ids = orderExercise.knowledgePointTags.map((tag) => `${course.id}:${tag}`);
    const state = createDefaultLearningState();
    state.attempts = [
      ...Array.from({ length: 3 }, (_, index) => ({
        attemptId: `primary-${index}`,
        knowledgePointId: ids[0],
        score: 1,
        hints: 0,
        mode: "quiz" as const,
        completedAt: new Date(Date.parse(now) - (index + 1) * 1000).toISOString(),
      })),
      {
        attemptId: "secondary-1",
        knowledgePointId: ids[1],
        score: 1,
        hints: 0,
        mode: "quiz",
        completedAt: new Date(Date.parse(now) - 500).toISOString(),
      },
    ];

    const next = recordQuizAttempt(state, {
      course, exercise: orderExercise, score: 1, hints: 0,
      completedAt: now, attemptId: "independent-streaks",
    });
    const delay = (id: string) => Date.parse(next.masteryByKnowledgePoint[id].nextReviewAt!) - Date.parse(now);
    expect(delay(ids[0])).toBe(14 * 24 * 60 * 60 * 1000);
    expect(delay(ids[1])).toBe(3 * 24 * 60 * 60 * 1000);
    expect(delay(ids[2])).toBe(24 * 60 * 60 * 1000);
  });

  it("carries each tagged knowledge streak into the next submission", () => {
    const orderExercise = course.exercises[1];
    const first = recordQuizAttempt(createDefaultLearningState(), {
      course, exercise: orderExercise, score: 1, hints: 0,
      completedAt: now, attemptId: "order-first",
    });
    const secondAt = "2026-07-19T08:00:00.000Z";
    const second = recordQuizAttempt(first, {
      course, exercise: orderExercise, score: 1, hints: 0,
      completedAt: secondAt, attemptId: "order-second",
    });
    for (const tag of orderExercise.knowledgePointTags) {
      const record = second.masteryByKnowledgePoint[`${course.id}:${tag}`];
      expect(Date.parse(record.nextReviewAt!) - Date.parse(secondAt))
        .toBe(3 * 24 * 60 * 60 * 1000);
    }
  });

  it("is idempotent for an existing bounded attempt id", () => {
    const first = recordQuizAttempt(createDefaultLearningState(), {
      course, exercise, score: 1, hints: 0, completedAt: now,
      attemptId: `same-${"x".repeat(300)}`,
    });
    const repeated = recordQuizAttempt(first, {
      course, exercise, score: 0, hints: 4,
      completedAt: "2026-07-19T08:00:00.000Z",
      attemptId: `same-${"x".repeat(300)}`,
    });
    expect(repeated).toBe(first);
    expect(repeated.attempts).toHaveLength(1);
    expect(Object.values(repeated.masteryByKnowledgePoint)[0].evidenceCount).toBe(1);
  });

  it("safely rejects empty identifiers and invalid completion dates", () => {
    const state = createDefaultLearningState();
    expect(recordQuizAttempt(state, {
      course, exercise, score: 1, hints: 0, completedAt: now, attemptId: "   ",
    })).toBe(state);
    expect(recordQuizAttempt(state, {
      course, exercise, score: 1, hints: 0, completedAt: "2026-02-30T00:00:00.000Z", attemptId: "bad-date",
    })).toBe(state);
  });
});
