import { describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";
import { createSeedStorybook } from "./storybook";
import { readSavedStorybooks, STORYBOOK_STORAGE_KEY } from "./storybook-storage";

const course = getCourseById("lower-bubble-sort")!;

describe("readSavedStorybooks", () => {
  it("returns validated saved storybooks newest first", () => {
    localStorage.setItem(STORYBOOK_STORAGE_KEY, JSON.stringify([
      { id: "older", courseId: course.id, savedAt: "2026-07-17T08:00:00.000Z", storybook: createSeedStorybook(course) },
      { id: "newer", courseId: course.id, savedAt: "2026-07-18T08:00:00.000Z", storybook: createSeedStorybook(course) },
    ]));
    expect(readSavedStorybooks(localStorage).map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("drops malformed, unknown-course, overlong, and excessive records", () => {
    const valid = { id: "ok", courseId: course.id, savedAt: "2026-07-18T08:00:00.000Z", storybook: createSeedStorybook(course) };
    localStorage.setItem(STORYBOOK_STORAGE_KEY, JSON.stringify([
      { ...valid, id: "x".repeat(161) },
      { ...valid, id: "unknown", courseId: "not-a-course" },
      { ...valid, id: "bad-date", savedAt: "yesterday" },
      ...Array.from({ length: 35 }, (_, index) => ({ ...valid, id: `saved-${index}` })),
    ]));
    const result = readSavedStorybooks(localStorage);
    expect(result).toHaveLength(30);
    expect(result.every((item) => item.id.length <= 160 && item.courseId === course.id)).toBe(true);
  });

  it("returns an empty collection when storage is unavailable or corrupt", () => {
    localStorage.setItem(STORYBOOK_STORAGE_KEY, "not-json");
    expect(readSavedStorybooks(localStorage)).toEqual([]);
    expect(readSavedStorybooks(null)).toEqual([]);
  });
});
