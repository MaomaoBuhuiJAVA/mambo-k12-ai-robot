const STORAGE_KEY = "mambo.imported-storybook-progress.v1";
const MAX_PROGRESS_RECORDS = 30;

interface ReadingProgressRecord {
  storybookId: string;
  pageIndex: number;
  completed?: boolean;
  updatedAt: string;
}

export interface ImportedStorybookProgress {
  pageIndex: number;
  completed: boolean;
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "getItem" | "setItem">;

function isReadingProgressRecord(value: unknown): value is ReadingProgressRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.storybookId === "string"
    && record.storybookId.length > 0
    && record.storybookId.length <= 100
    && typeof record.pageIndex === "number"
    && Number.isInteger(record.pageIndex)
    && record.pageIndex >= 0
    && (record.completed === undefined || typeof record.completed === "boolean")
    && typeof record.updatedAt === "string"
    && Number.isFinite(Date.parse(record.updatedAt));
}

function readAll(storage: ReadableStorage | null): ReadingProgressRecord[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isReadingProgressRecord)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_PROGRESS_RECORDS);
  } catch {
    return [];
  }
}

export function readImportedStorybookPageIndex(
  storybookId: string,
  pageCount: number,
  storage: ReadableStorage | null,
): number {
  const record = readAll(storage).find((item) => item.storybookId === storybookId);
  if (!record) return 0;
  return Math.min(Math.max(record.pageIndex, 0), Math.max(pageCount - 1, 0));
}

export function readImportedStorybookProgress(
  storybookId: string,
  pageCount: number,
  storage: ReadableStorage | null,
): ImportedStorybookProgress {
  const record = readAll(storage).find((item) => item.storybookId === storybookId);
  return {
    pageIndex: record
      ? Math.min(Math.max(record.pageIndex, 0), Math.max(pageCount - 1, 0))
      : 0,
    completed: record?.completed === true,
  };
}

export function readCompletedImportedStorybookIds(storage: ReadableStorage | null): string[] {
  return readAll(storage)
    .filter((record) => record.completed === true)
    .map((record) => record.storybookId);
}

export function saveImportedStorybookPageIndex(
  storybookId: string,
  pageIndex: number,
  storage: WritableStorage | null,
): boolean {
  if (!storage || !Number.isInteger(pageIndex) || pageIndex < 0) return false;
  try {
    const existing = readAll(storage).find((item) => item.storybookId === storybookId);
    const next: ReadingProgressRecord = {
      storybookId,
      pageIndex,
      completed: existing?.completed === true,
      updatedAt: new Date().toISOString(),
    };
    const remaining = readAll(storage).filter((item) => item.storybookId !== storybookId);
    storage.setItem(STORAGE_KEY, JSON.stringify([next, ...remaining].slice(0, MAX_PROGRESS_RECORDS)));
    return true;
  } catch {
    return false;
  }
}

export function markImportedStorybookComplete(
  storybookId: string,
  pageIndex: number,
  storage: WritableStorage | null,
): boolean {
  if (!storage || !Number.isInteger(pageIndex) || pageIndex < 0) return false;
  try {
    const next: ReadingProgressRecord = {
      storybookId,
      pageIndex,
      completed: true,
      updatedAt: new Date().toISOString(),
    };
    const remaining = readAll(storage).filter((item) => item.storybookId !== storybookId);
    storage.setItem(STORAGE_KEY, JSON.stringify([next, ...remaining].slice(0, MAX_PROGRESS_RECORDS)));
    return true;
  } catch {
    return false;
  }
}

export const IMPORTED_STORYBOOK_PROGRESS_STORAGE_KEY = STORAGE_KEY;
