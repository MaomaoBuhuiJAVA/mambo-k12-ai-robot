import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { IMPORTED_STORYBOOKS } from "./index";
import { getStorybookSource, STORYBOOK_SOURCE_REGISTRY } from "./source-registry";

describe("storybook source registry", () => {
  it("registers every imported source book without duplicate content IDs", () => {
    expect(STORYBOOK_SOURCE_REGISTRY).toHaveLength(15);
    expect(new Set(STORYBOOK_SOURCE_REGISTRY.map((source) => source.contentId)).size).toBe(15);
    expect(getStorybookSource("lava-lesson-03")?.supersedes).toHaveLength(1);
  });

  it("keeps every imported manifest traceable and ships every referenced image", () => {
    for (const storybook of IMPORTED_STORYBOOKS) {
      const source = getStorybookSource(storybook.id);
      expect(source).toMatchObject({
        originalFileName: storybook.source.originalFileName,
        documentSha256: storybook.source.documentSha256,
        status: "ready",
        pageCount: storybook.pages.length,
      });
      for (const page of storybook.pages) {
        expect(existsSync(resolve(process.cwd(), "public", page.image.src.slice(1)))).toBe(true);
      }
    }
  });
});
