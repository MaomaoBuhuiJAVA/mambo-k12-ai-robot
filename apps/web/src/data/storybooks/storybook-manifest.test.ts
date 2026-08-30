import { describe, expect, it } from "vitest";

import { CASTLE_LESSON_01 } from "./castle-lesson-01";
import { IMPORTED_STORYBOOKS, LAVA_LESSON_02 } from "./index";
import {
  importedStorybookManifestSchema,
  storybookQuestionSchema,
} from "./storybook-manifest";

describe("imported storybook manifest schema", () => {
  it("accepts the canonical castle book with a contiguous page sequence", () => {
    expect(importedStorybookManifestSchema.parse(CASTLE_LESSON_01)).toEqual(CASTLE_LESSON_01);
    expect(CASTLE_LESSON_01.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("keeps every imported Word storybook on a complete ten-page sequence", () => {
    expect(IMPORTED_STORYBOOKS).toHaveLength(15);
    for (const storybook of IMPORTED_STORYBOOKS) {
      expect(importedStorybookManifestSchema.parse(storybook)).toEqual(storybook);
      expect(storybook.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it("does not manufacture the missing question prompt in lava lesson two", () => {
    expect(LAVA_LESSON_02.pages[4]?.title).toBe("假声音出现");
    expect(LAVA_LESSON_02.pages[4]?.question).toBeUndefined();
  });

  it("rejects duplicate page image sources, mismatched source pages, and non-contiguous page numbers", () => {
    const duplicateImage = structuredClone(CASTLE_LESSON_01);
    duplicateImage.pages[1]!.image.src = duplicateImage.pages[0]!.image.src;
    expect(importedStorybookManifestSchema.safeParse(duplicateImage).success).toBe(false);

    const swappedImages = structuredClone(CASTLE_LESSON_01);
    const firstImage = swappedImages.pages[0]!.image;
    swappedImages.pages[0]!.image = swappedImages.pages[1]!.image;
    swappedImages.pages[1]!.image = firstImage;
    expect(importedStorybookManifestSchema.safeParse(swappedImages).success).toBe(false);

    const nonContiguous = structuredClone(CASTLE_LESSON_01);
    nonContiguous.pages[1]!.pageNumber = 3;
    expect(importedStorybookManifestSchema.safeParse(nonContiguous).success).toBe(false);
  });

  it("rejects unknown speakers and missing image paths", () => {
    const unknownSpeaker = structuredClone(CASTLE_LESSON_01);
    unknownSpeaker.pages[0]!.dialogue[0]!.speaker = "monster" as "starbao";
    expect(importedStorybookManifestSchema.safeParse(unknownSpeaker).success).toBe(false);

    const missingImage = structuredClone(CASTLE_LESSON_01);
    missingImage.pages[0]!.image.src = "";
    expect(importedStorybookManifestSchema.safeParse(missingImage).success).toBe(false);
  });

  it("rejects incomplete source questions instead of inventing a question prompt", () => {
    expect(storybookQuestionSchema.safeParse({
      options: ["打开", "关闭"],
      answer: "关闭",
      correctFeedback: "正确。",
      incorrectFeedback: "再想一想。",
    }).success).toBe(false);
  });
});
