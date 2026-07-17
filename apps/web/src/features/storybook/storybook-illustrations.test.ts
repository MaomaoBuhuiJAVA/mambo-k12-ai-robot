import { describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";

import { selectStorybookIllustration } from "./storybook-illustrations";

describe("storybook illustration selection", () => {
  it("keeps bubble-sort pages within sorting, data, and review assets", () => {
    const course = getCourseById("lower-bubble-sort")!;
    const selected = course.storybook.map((page, index) => selectStorybookIllustration(course, page, index));

    expect(selected.every((image) => !image.src.includes("feature-studio"))).toBe(true);
    expect(selected[0].src).toContain("sorting-lab");
    expect(selected.at(-1)?.src).toContain("reflection-board");
  });

  it("never shows a sorting diagram in neural-network and classification stories", () => {
    for (const id of ["middle-neural-signals", "upper-fruit-classifier"]) {
      const course = getCourseById(id)!;
      const selected = course.storybook.map((page, index) => selectStorybookIllustration(course, page, index));
      expect(selected.every((image) => !image.src.includes("sorting-lab"))).toBe(true);
      expect(selected.some((image) => image.src.includes("feature-studio"))).toBe(true);
      expect(selected.at(-1)?.alt).toContain("复盘");
    }
  });
});
