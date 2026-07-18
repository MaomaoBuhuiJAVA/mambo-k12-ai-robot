import { getCourseById } from "@/data/curriculum";
import { storybookSchema, type Storybook } from "./storybook";

export const STORYBOOK_STORAGE_KEY = "mambo.storybooks.v1";
const MAX_SAVED_STORYBOOKS = 30;
const MAX_IDENTIFIER_LENGTH = 160;

type ReadableStorage = Pick<Storage, "getItem">;

export interface SavedStorybook {
  id: string;
  courseId: string;
  savedAt: string;
  storybook: Storybook;
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function readSavedStorybooks(storage: ReadableStorage | null): SavedStorybook[] {
  if (!storage) return [];
  try {
    const value: unknown = JSON.parse(storage.getItem(STORYBOOK_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];

    return value.flatMap((item): SavedStorybook[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      if (
        typeof record.id !== "string"
        || record.id.length === 0
        || record.id.length > MAX_IDENTIFIER_LENGTH
        || typeof record.courseId !== "string"
        || record.courseId.length === 0
        || record.courseId.length > MAX_IDENTIFIER_LENGTH
        || !getCourseById(record.courseId)
        || !validIsoDate(record.savedAt)
      ) return [];
      const parsed = storybookSchema.safeParse(record.storybook);
      if (!parsed.success) return [];
      return [{ id: record.id, courseId: record.courseId, savedAt: record.savedAt, storybook: parsed.data }];
    })
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .slice(0, MAX_SAVED_STORYBOOKS);
  } catch {
    return [];
  }
}
