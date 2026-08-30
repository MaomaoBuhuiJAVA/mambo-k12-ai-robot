import { describe, expect, it } from "vitest";

import {
  IMPORTED_STORYBOOK_PROGRESS_STORAGE_KEY,
  markImportedStorybookComplete,
  readCompletedImportedStorybookIds,
  readImportedStorybookPageIndex,
  readImportedStorybookProgress,
  saveImportedStorybookPageIndex,
} from "./imported-storybook-progress";

function createStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => {
      void key;
      return value;
    },
    setItem: (_key: string, next: string) => { value = next; },
  };
}

describe("imported storybook progress", () => {
  it("saves and restores a page index without changing other books", () => {
    const storage = createStorage(JSON.stringify([{
      storybookId: "another-book",
      pageIndex: 2,
      updatedAt: "2026-08-20T09:00:00.000Z",
    }]));

    expect(saveImportedStorybookPageIndex("castle-lesson-01", 6, storage)).toBe(true);
    expect(readImportedStorybookPageIndex("castle-lesson-01", 10, storage)).toBe(6);
    expect(readImportedStorybookPageIndex("another-book", 10, storage)).toBe(2);
  });

  it("falls back safely for malformed storage and clamps stale indexes", () => {
    expect(readImportedStorybookPageIndex("castle-lesson-01", 10, createStorage("not json"))).toBe(0);
    const storage = createStorage(JSON.stringify([{
      storybookId: "castle-lesson-01",
      pageIndex: 99,
      updatedAt: "2026-08-20T09:00:00.000Z",
    }]));
    expect(readImportedStorybookPageIndex("castle-lesson-01", 10, storage)).toBe(9);
  });

  it("does not write invalid indexes", () => {
    const storage = createStorage();
    expect(saveImportedStorybookPageIndex("castle-lesson-01", -1, storage)).toBe(false);
    expect(storage.getItem(IMPORTED_STORYBOOK_PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it("marks a book complete and keeps completion when its page changes later", () => {
    const storage = createStorage();

    expect(markImportedStorybookComplete("castle-lesson-01", 9, storage)).toBe(true);
    expect(readImportedStorybookProgress("castle-lesson-01", 10, storage)).toEqual({
      pageIndex: 9,
      completed: true,
    });
    expect(readCompletedImportedStorybookIds(storage)).toEqual(["castle-lesson-01"]);

    expect(saveImportedStorybookPageIndex("castle-lesson-01", 3, storage)).toBe(true);
    expect(readImportedStorybookProgress("castle-lesson-01", 10, storage)).toEqual({
      pageIndex: 3,
      completed: true,
    });
  });

  it("treats old progress records without a completion flag as unfinished", () => {
    const storage = createStorage(JSON.stringify([{
      storybookId: "castle-lesson-01",
      pageIndex: 8,
      updatedAt: "2026-08-20T09:00:00.000Z",
    }]));

    expect(readImportedStorybookProgress("castle-lesson-01", 10, storage)).toEqual({
      pageIndex: 8,
      completed: false,
    });
    expect(readCompletedImportedStorybookIds(storage)).toEqual([]);
  });
});
