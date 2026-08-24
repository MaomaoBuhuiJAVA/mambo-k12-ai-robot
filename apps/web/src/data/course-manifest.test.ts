import { describe, expect, it } from "vitest";

import {
  getAllCourseManifests,
  getCourseManifest,
  getCourseManifestsForStage,
  validateCourseManifests,
} from "./course-manifest";

describe("course manifests", () => {
  it("covers every active middle/high course and the independent capstone project", () => {
    const manifests = getAllCourseManifests();
    expect(manifests.filter((manifest) => manifest.kind === "course")).toHaveLength(16);
    expect(getCourseManifest("capstone")).toMatchObject({
      kind: "project-only",
      courseId: null,
      projectId: "capstone",
      route: "/learn/project/capstone",
      evidenceSchema: "project-evidence-v2",
    });
    expect(getCourseManifestsForStage("middle_school").every((manifest) => manifest.gradeRange.max === 9)).toBe(true);
    expect(getCourseManifestsForStage("high_school").every((manifest) => manifest.gradeRange.min === 10)).toBe(true);
  });

  it("keeps stable IDs, prerequisites, completion policies and lab templates aligned", () => {
    for (const manifest of getAllCourseManifests()) {
      expect(manifest.sourceIds.length, manifest.title).toBeGreaterThan(0);
      expect(manifest.units.flatMap((unit) => unit.lessons).flatMap((lesson) => lesson.activityIds))
        .toEqual(expect.arrayContaining(manifest.activities.map((activity) => activity.activityId)));
      for (const activity of manifest.activities) {
        expect(activity.evaluationPolicyId, activity.activityId).toBeTruthy();
        if (activity.kind.endsWith("lab") || activity.kind === "research_challenge") {
          expect(activity.templateId, activity.activityId).toBeTruthy();
        }
      }
    }
  });

  it("rejects a pending manifest that claims reviewed mappings", () => {
    const manifest = getCourseManifest("middle-ai-foundations")!;
    expect(() => validateCourseManifests([{ ...manifest, mappingStatus: "reviewed" }]))
      .toThrow("Pending manifest cannot be marked reviewed");
    expect(manifest.unlockEligible).toBe(false);
    expect(() => validateCourseManifests([{ ...manifest, unlockEligible: true }]))
      .toThrow("Pending manifest cannot participate in unlocks");
  });

  it("rejects an activity with a mismatched template or completion policy", () => {
    const manifest = getCourseManifest("high-python-data-lab")!;
    const activities = manifest.activities.map((activity) => activity.activityId === "high-python-data-lab-code"
      ? { ...activity, templateId: "bubble-sort-analysis" as const }
      : activity);
    expect(() => validateCourseManifests([{ ...manifest, activities }]))
      .toThrow("Manifest lab template mismatch");
  });
});
