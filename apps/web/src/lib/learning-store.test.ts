import { beforeEach, describe, expect, it } from "vitest";

import type {
  Attempt,
  LearningState,
  MasteryRecord,
  StudentProfile,
} from "./domain";
import {
  CURRENT_LEARNING_STATE_VERSION,
  LEARNING_STATE_STORAGE_KEY,
  LEGACY_LEARNING_STATE_STORAGE_KEY,
  MAX_PERSISTED_ATTEMPTS,
  MAX_PERSISTED_INTERESTS,
  MAX_PERSISTED_RECENT_TOPICS,
  MAX_PERSISTED_STRING_LENGTH,
  clearLearningState,
  createDefaultLearningState,
  loadLearningState,
  parseLearningState,
  saveLearningState,
  updateMastery,
} from "./learning-store";

const profile: StudentProfile = {
  studentId: "student-1",
  displayName: "Ada",
  stage: "upper_primary",
  grade: 5,
  textbook: "Private textbook",
  preferredMode: "game",
  accessibility: {
    captions: true,
    highContrast: false,
    reducedMotion: false,
  },
  goals: ["learn sorting"],
};

function makeAttempt(index: number): Attempt {
  return {
    attemptId: `attempt-${index}`,
    knowledgePointId: "sorting",
    score: 0.75,
    hints: 1,
    mode: "quiz",
    answer: `private answer ${index}`,
    completedAt: "2026-07-18T00:00:00.000Z",
  };
}

function makeMastery(knowledgePointId = "sorting"): MasteryRecord {
  return {
    knowledgePointId,
    mastery: 0.7,
    confidence: 0.8,
    evidenceCount: 2,
    lastPracticedAt: "2026-07-18T00:00:00.000Z",
    nextReviewAt: null,
    misconceptionTags: ["swap-direction"],
  };
}

describe("learning state storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a serializable versioned default state", () => {
    const state = createDefaultLearningState(profile);

    expect(state).toMatchObject({
      schemaVersion: CURRENT_LEARNING_STATE_VERSION,
      profile,
      masteryByKnowledgePoint: {},
      attempts: [],
      recentTopics: [],
      interests: [],
      lastCourseId: null,
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("writes only minimized bounded learning data under the stable key", () => {
    const state: LearningState = {
      ...createDefaultLearningState(profile),
      attempts: Array.from(
        { length: MAX_PERSISTED_ATTEMPTS + 5 },
        (_, index) => makeAttempt(index),
      ),
      interests: Array.from(
        { length: MAX_PERSISTED_INTERESTS + 5 },
        (_, index) => `${index}-${"i".repeat(MAX_PERSISTED_STRING_LENGTH + 20)}`,
      ),
      recentTopics: Array.from(
        { length: MAX_PERSISTED_RECENT_TOPICS + 5 },
        (_, index) => `${index}-${"t".repeat(MAX_PERSISTED_STRING_LENGTH + 20)}`,
      ),
      lastCourseId: "sorting-101",
    };

    expect(saveLearningState(state, localStorage)).toBe(true);

    const raw = localStorage.getItem(LEARNING_STATE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? "null") as LearningState;
    expect(LEARNING_STATE_STORAGE_KEY).toBe("mambo.learning-state");
    expect(stored.profile).toMatchObject({
      studentId: "local-student",
      displayName: "Learner",
      textbook: null,
      goals: [],
      stage: "upper_primary",
    });
    expect(stored.attempts).toHaveLength(MAX_PERSISTED_ATTEMPTS);
    expect(stored.attempts[0].attemptId).toBe("attempt-5");
    expect(stored.attempts.every((attempt) => !("answer" in attempt))).toBe(true);
    expect(stored.interests).toHaveLength(MAX_PERSISTED_INTERESTS);
    expect(stored.recentTopics).toHaveLength(MAX_PERSISTED_RECENT_TOPICS);
    expect(
      [...stored.interests, ...stored.recentTopics].every(
        (item) => item.length <= MAX_PERSISTED_STRING_LENGTH,
      ),
    ).toBe(true);
  });

  it("returns false when browser storage rejects a write", () => {
    const quotaLimitedStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
      removeItem: () => undefined,
    };

    expect(
      saveLearningState(createDefaultLearningState(), quotaLimitedStorage),
    ).toBe(false);
  });

  it("clears both current and legacy storage keys", () => {
    localStorage.setItem(LEARNING_STATE_STORAGE_KEY, "current");
    localStorage.setItem(LEGACY_LEARNING_STATE_STORAGE_KEY, "legacy");

    expect(clearLearningState(localStorage)).toBe(true);
    expect(localStorage.getItem(LEARNING_STATE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_LEARNING_STATE_STORAGE_KEY)).toBeNull();
  });

  it("is safe without browser storage during server rendering", () => {
    const fallback = createDefaultLearningState();

    expect(loadLearningState(null)).toEqual(fallback);
    expect(saveLearningState(fallback, null)).toBe(false);
    expect(clearLearningState(null)).toBe(false);
  });

  it("falls back safely when stored JSON is damaged", () => {
    expect(parseLearningState("{not-json")).toEqual(
      createDefaultLearningState(),
    );
  });

  it("migrates a legacy schema while removing identifying profile data", () => {
    const migrated = parseLearningState(
      JSON.stringify({
        schemaVersion: 0,
        profile,
        mastery: { sorting: 0.7 },
        attempts: [],
        recentTopics: ["sorting"],
        interests: ["robots"],
        lastCourseId: "legacy-course",
        updatedAt: "2026-07-17T00:00:00.000Z",
      }),
    );

    expect(migrated.schemaVersion).toBe(CURRENT_LEARNING_STATE_VERSION);
    expect(migrated.profile).toMatchObject({
      studentId: "local-student",
      displayName: "Learner",
      textbook: null,
      goals: [],
      stage: profile.stage,
    });
    expect(migrated.masteryByKnowledgePoint.sorting).toMatchObject({
      knowledgePointId: "sorting",
      mastery: 0.7,
      evidenceCount: 0,
    });
    expect(migrated.recentTopics).toEqual(["sorting"]);
    expect(migrated.lastCourseId).toBe("legacy-course");
  });

  it("loads the legacy key once and migrates it to the stable key", () => {
    const state = {
      ...createDefaultLearningState(profile),
      interests: ["robots"],
    };
    localStorage.setItem(LEGACY_LEARNING_STATE_STORAGE_KEY, JSON.stringify(state));

    expect(loadLearningState(localStorage)).toMatchObject({
      interests: ["robots"],
      profile: { stage: "upper_primary", studentId: "local-student" },
    });
    expect(localStorage.getItem(LEARNING_STATE_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(LEGACY_LEARNING_STATE_STORAGE_KEY)).toBeNull();
  });

  it("loosely migrates oversized legacy v1 data without losing progress", () => {
    const legacyState: LearningState = {
      ...createDefaultLearningState(profile),
      masteryByKnowledgePoint: { sorting: makeMastery() },
      attempts: Array.from(
        { length: MAX_PERSISTED_ATTEMPTS + 5 },
        (_, index) => makeAttempt(index),
      ),
      interests: Array.from(
        { length: MAX_PERSISTED_INTERESTS + 5 },
        (_, index) => `${index}-${"i".repeat(MAX_PERSISTED_STRING_LENGTH + 20)}`,
      ),
      recentTopics: Array.from(
        { length: MAX_PERSISTED_RECENT_TOPICS + 5 },
        (_, index) => `${index}-${"t".repeat(MAX_PERSISTED_STRING_LENGTH + 20)}`,
      ),
    };
    localStorage.setItem(
      LEGACY_LEARNING_STATE_STORAGE_KEY,
      JSON.stringify(legacyState),
    );

    const migrated = loadLearningState(localStorage);

    expect(migrated.masteryByKnowledgePoint.sorting).toEqual(makeMastery());
    expect(migrated.attempts).toHaveLength(MAX_PERSISTED_ATTEMPTS);
    expect(migrated.attempts[0].attemptId).toBe("attempt-5");
    expect(migrated.attempts.every((attempt) => !("answer" in attempt))).toBe(
      true,
    );
    expect(migrated.interests).toHaveLength(MAX_PERSISTED_INTERESTS);
    expect(migrated.recentTopics).toHaveLength(MAX_PERSISTED_RECENT_TOPICS);
    expect(
      [...migrated.interests, ...migrated.recentTopics].every(
        (item) => item.length <= MAX_PERSISTED_STRING_LENGTH,
      ),
    ).toBe(true);
    expect(migrated.profile).toMatchObject({
      studentId: "local-student",
      displayName: "Learner",
      textbook: null,
      goals: [],
      stage: "upper_primary",
    });
  });

  it("normalizes legacy v1 records field by field instead of rejecting the state", () => {
    const longAnswer = "a".repeat(20_001);
    const legacyState = {
      ...createDefaultLearningState(profile),
      profile: {
        ...profile,
        goals: Array.from(
          { length: 25 },
          () => "g".repeat(MAX_PERSISTED_STRING_LENGTH + 20),
        ),
      },
      masteryByKnowledgePoint: {
        sorting: {
          ...makeMastery(),
          mastery: 1.4,
          confidence: -0.2,
        },
        broken: {
          ...makeMastery("broken"),
          mastery: "not-a-number",
        },
      },
      attempts: [
        ...Array.from(
          { length: MAX_PERSISTED_ATTEMPTS + 5 },
          (_, index) => ({ ...makeAttempt(index), answer: longAnswer }),
        ),
        { ...makeAttempt(999), score: "not-a-number" },
      ],
      interests: Array.from(
        { length: MAX_PERSISTED_INTERESTS + 5 },
        () => "i".repeat(MAX_PERSISTED_STRING_LENGTH + 20),
      ),
      recentTopics: Array.from(
        { length: MAX_PERSISTED_RECENT_TOPICS + 5 },
        () => "t".repeat(MAX_PERSISTED_STRING_LENGTH + 20),
      ),
    };
    localStorage.setItem(
      LEGACY_LEARNING_STATE_STORAGE_KEY,
      JSON.stringify(legacyState),
    );

    const migrated = loadLearningState(localStorage);

    expect(migrated.profile).toMatchObject({
      studentId: "local-student",
      displayName: "Learner",
      stage: profile.stage,
      preferredMode: profile.preferredMode,
      accessibility: profile.accessibility,
      textbook: null,
      goals: [],
    });
    expect(migrated.masteryByKnowledgePoint).toEqual({
      sorting: {
        ...makeMastery(),
        mastery: 1,
        confidence: 0,
      },
    });
    expect(migrated.attempts).toHaveLength(MAX_PERSISTED_ATTEMPTS);
    expect(migrated.attempts[0].attemptId).toBe("attempt-5");
    expect(migrated.attempts.some((attempt) => attempt.attemptId === "attempt-999")).toBe(
      false,
    );
    expect(migrated.attempts.every((attempt) => !("answer" in attempt))).toBe(
      true,
    );
    expect(migrated.interests).toHaveLength(MAX_PERSISTED_INTERESTS);
    expect(migrated.recentTopics).toHaveLength(MAX_PERSISTED_RECENT_TOPICS);
    expect(
      [...migrated.interests, ...migrated.recentTopics].every(
        (item) => item.length <= MAX_PERSISTED_STRING_LENGTH,
      ),
    ).toBe(true);
  });

  it("rejects future schemas instead of interpreting them as current", () => {
    const futureState = {
      ...createDefaultLearningState(profile),
      schemaVersion: CURRENT_LEARNING_STATE_VERSION + 1,
    };

    expect(parseLearningState(JSON.stringify(futureState))).toEqual(
      createDefaultLearningState(),
    );
  });

  it("rejects semantically invalid persisted state", () => {
    const invalidGrade = createDefaultLearningState();
    invalidGrade.profile.grade = 13;

    const invalidAttempt = createDefaultLearningState();
    invalidAttempt.attempts = [{ ...makeAttempt(1), score: 1.1 }];

    const fractionalHints = createDefaultLearningState();
    fractionalHints.attempts = [{ ...makeAttempt(1), hints: 0.5 }];

    const negativeHints = createDefaultLearningState();
    negativeHints.attempts = [{ ...makeAttempt(1), hints: -1 }];

    const invalidMastery = createDefaultLearningState();
    invalidMastery.masteryByKnowledgePoint.sorting = {
      ...makeMastery(),
      confidence: -0.1,
    };

    const outOfRangeMastery = createDefaultLearningState();
    outOfRangeMastery.masteryByKnowledgePoint.sorting = {
      ...makeMastery(),
      mastery: 1.1,
    };

    const fractionalEvidence = createDefaultLearningState();
    fractionalEvidence.masteryByKnowledgePoint.sorting = {
      ...makeMastery(),
      evidenceCount: 1.5,
    };

    const mismatchedMasteryKey = createDefaultLearningState();
    mismatchedMasteryKey.masteryByKnowledgePoint.wrong = makeMastery("sorting");

    const invalidDate = createDefaultLearningState();
    invalidDate.updatedAt = "not-a-date";

    const invalidAttemptDate = createDefaultLearningState();
    invalidAttemptDate.attempts = [
      { ...makeAttempt(1), completedAt: "2026-02-30T00:00:00.000Z" },
    ];

    const tooManyInterests = createDefaultLearningState();
    tooManyInterests.interests = Array.from(
      { length: MAX_PERSISTED_INTERESTS + 1 },
      () => "robotics",
    );

    const overlongTopic = createDefaultLearningState();
    overlongTopic.recentTopics = ["t".repeat(MAX_PERSISTED_STRING_LENGTH + 1)];

    for (const state of [
      invalidGrade,
      invalidAttempt,
      fractionalHints,
      negativeHints,
      invalidMastery,
      outOfRangeMastery,
      fractionalEvidence,
      mismatchedMasteryKey,
      invalidDate,
      invalidAttemptDate,
      tooManyInterests,
      overlongTopic,
    ]) {
      expect(parseLearningState(JSON.stringify(state))).toEqual(
        createDefaultLearningState(),
      );
    }
  });
});

describe("updateMastery", () => {
  it("raises mastery for an unassisted correct answer and clamps at one", () => {
    expect(updateMastery(0.55, { score: 1, hints: 0 })).toBeCloseTo(0.66);
    expect(updateMastery(0.99, { score: 1, hints: 0 })).toBe(1);
  });

  it("reduces the gain from a correct answer when hints were used", () => {
    expect(updateMastery(0.55, { score: 1, hints: 4 })).toBeLessThan(
      updateMastery(0.55, { score: 1, hints: 0 }),
    );
  });

  it("does not reduce the penalty for a wrong answer when hints increase", () => {
    expect(updateMastery(0.8, { score: 0, hints: 4 })).toBeLessThanOrEqual(
      updateMastery(0.8, { score: 0, hints: 0 }),
    );
  });

  it("always clamps malformed or extreme inputs to zero through one", () => {
    expect(updateMastery(-10, { score: 0, hints: 100 })).toBe(0);
    expect(updateMastery(10, { score: 10, hints: -4 })).toBe(1);
  });
});
