import { beforeEach, describe, expect, it } from "vitest";

import type { StudentProfile } from "./domain";
import {
  CURRENT_LEARNING_STATE_VERSION,
  LEARNING_STATE_STORAGE_KEY,
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
  textbook: null,
  preferredMode: "game",
  accessibility: {
    captions: true,
    highContrast: false,
    reducedMotion: false,
  },
  goals: ["learn sorting"],
};

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

  it("round-trips state through an injected storage adapter", () => {
    const state = {
      ...createDefaultLearningState(profile),
      interests: ["robots"],
      recentTopics: ["bubble-sort"],
      lastCourseId: "sorting-101",
    };

    saveLearningState(state, localStorage);

    expect(localStorage.getItem(LEARNING_STATE_STORAGE_KEY)).not.toBeNull();
    expect(loadLearningState(localStorage)).toEqual(state);
  });

  it("is safe without browser storage during server rendering", () => {
    const fallback = createDefaultLearningState();

    expect(loadLearningState(null)).toEqual(fallback);
    expect(() => saveLearningState(fallback, null)).not.toThrow();
  });

  it("falls back safely when stored JSON is damaged", () => {
    expect(parseLearningState("{not-json")).toEqual(
      createDefaultLearningState(),
    );
  });

  it("migrates a legacy version while preserving useful learning data", () => {
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
    expect(migrated.profile).toEqual(profile);
    expect(migrated.masteryByKnowledgePoint.sorting).toMatchObject({
      knowledgePointId: "sorting",
      mastery: 0.7,
      evidenceCount: 0,
    });
    expect(migrated.recentTopics).toEqual(["sorting"]);
    expect(migrated.lastCourseId).toBe("legacy-course");
  });
});

describe("updateMastery", () => {
  it("raises mastery for an unassisted correct answer and clamps at one", () => {
    expect(updateMastery(0.55, { score: 1, hints: 0 })).toBeCloseTo(0.66);
    expect(updateMastery(0.99, { score: 1, hints: 0 })).toBe(1);
  });

  it("always clamps malformed or extreme inputs to zero through one", () => {
    expect(updateMastery(-10, { score: 0, hints: 100 })).toBe(0);
    expect(updateMastery(10, { score: 10, hints: -4 })).toBe(1);
  });
});
