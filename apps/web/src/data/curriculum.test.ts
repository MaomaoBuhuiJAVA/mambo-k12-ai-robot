import { describe, expect, it } from "vitest";

import type { Stage } from "../lib/domain";
import {
  CURRICULUM,
  getCourseById,
  getCoursesForStage,
  getFeaturedCourses,
} from "./curriculum";

const stages = [
  "lower_primary",
  "upper_primary",
  "middle_school",
  "high_school",
] as const satisfies readonly Stage[];

describe("curriculum", () => {
  it("provides at least two courses for every K-12 stage", () => {
    for (const stage of stages) {
      expect(getCoursesForStage(stage).length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(CURRICULUM.map((course) => course.stage))).toEqual(
      new Set(stages),
    );
  });

  it("uses unique course IDs", () => {
    expect(new Set(CURRICULUM.map((course) => course.id)).size).toBe(
      CURRICULUM.length,
    );
  });

  it("includes every required exercise type and a four-to-eight-page storybook", () => {
    for (const course of CURRICULUM) {
      expect(new Set(course.exercises.map((exercise) => exercise.type))).toEqual(
        new Set(["single_choice", "order", "code_trace"]),
      );
      for (const exercise of course.exercises) {
        expect(exercise.answer).toBeDefined();
        expect(exercise.feedback.correct).toBeTruthy();
        expect(exercise.feedback.incorrect).toBeTruthy();
        expect(exercise.knowledgePointTags.length).toBeGreaterThan(0);
      }
      expect(course.storybook.length).toBeGreaterThanOrEqual(4);
      expect(course.storybook.length).toBeLessThanOrEqual(8);
      for (const page of course.storybook) {
        expect(page).toMatchObject({
          title: expect.any(String),
          narration: expect.any(String),
          scene: expect.any(String),
          interaction: expect.any(String),
        });
      }
    }
  });

  it("fully defines the bubble-sort and image-classification neural-network anchors", () => {
    const anchors = CURRICULUM.filter((course) =>
      ["冒泡排序", "图像分类与神经网络"].includes(course.title),
    );

    expect(anchors).toHaveLength(2);
    for (const course of anchors) {
      expect(course).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        summary: expect.any(String),
        stage: expect.any(String),
        knowledgePointTags: expect.any(Array),
        objectives: expect.any(Array),
        ageAdaptation: expect.any(Object),
        explanation: expect.any(Object),
        materials: expect.any(Array),
        starterCode: expect.any(String),
      });
      expect(course.animation.template).toBeTruthy();
      expect(course.animation.entities.length).toBeGreaterThan(0);
      expect(course.animation.steps.length).toBeGreaterThan(0);
      expect(course.animation.controls).toEqual(
        expect.arrayContaining(["play", "pause", "step", "reset", "speed"]),
      );
    }
  });

  it("changes explanation depth and learning activity across stages", () => {
    const representatives = stages.map((stage) => getCoursesForStage(stage)[0]);

    expect(
      new Set(representatives.map((course) => course.ageAdaptation.depth)).size,
    ).toBe(stages.length);
    expect(
      new Set(representatives.map((course) => course.ageAdaptation.activity)).size,
    ).toBe(stages.length);
  });

  it("exposes deterministic lookup and featured-course helpers", () => {
    const first = CURRICULUM[0];
    expect(getCourseById(first.id)).toBe(first);
    expect(getCourseById("missing-course")).toBeUndefined();
    expect(getFeaturedCourses()).toEqual(
      CURRICULUM.filter((course) => course.featured),
    );
    expect(getFeaturedCourses("middle_school")).toEqual(
      CURRICULUM.filter(
        (course) => course.featured && course.stage === "middle_school",
      ),
    );
  });
});
