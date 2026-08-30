export interface PracticeSessionProgress {
  schemaVersion: 1;
  handledQuestionKeys: string[];
  correctQuestionKeys: string[];
  skippedQuestionKeys: string[];
  answersByQuestionKey?: Record<string, PracticeDraftAnswer>;
  submittedAnswerHistoryByQuestionKey?: Record<string, PracticeDraftAnswer[]>;
  resultsByQuestionKey?: Record<string, StoredPracticeResult>;
  hintsByQuestionKey?: Record<string, number>;
}

export type PracticeDraftAnswer = string | string[];

export interface StoredPracticeResult {
  correct: boolean;
  score: number;
  feedback: string;
  knowledgePointIds: string[];
}

export interface SessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const SESSION_PREFIX = "mambo-practice-session:v1:";
const MAX_SESSION_QUESTIONS = 32;
const MAX_ANSWER_LENGTH = 500;
const MAX_FEEDBACK_LENGTH = 1_000;
const MAX_KNOWLEDGE_POINTS = 12;

/** Keep the browser session key stable across the overview and player. */
export function practiceSessionStorageId(
  practiceSetId: string,
  questionKeys: readonly string[],
): string {
  let hash = 2166136261;
  for (const character of questionKeys.join("|")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${practiceSetId}:${(hash >>> 0).toString(36)}`;
}

function browserStorage(): SessionStorageAdapter | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function storageKey(practiceSetId: string): string {
  return `${SESSION_PREFIX}${practiceSetId}`;
}

function emptyProgress(): PracticeSessionProgress {
  return { schemaVersion: 1, handledQuestionKeys: [], correctQuestionKeys: [], skippedQuestionKeys: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeKeys(value: unknown, allowedKeys: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  const unique: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowedKeys.has(item) || unique.includes(item)) continue;
    unique.push(item);
    if (unique.length >= MAX_SESSION_QUESTIONS) break;
  }
  return unique;
}

function sanitizeAnswer(value: unknown): PracticeDraftAnswer | null {
  if (typeof value === "string") return value.slice(0, MAX_ANSWER_LENGTH);
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .slice(0, MAX_SESSION_QUESTIONS)
    .map((item) => item.slice(0, MAX_ANSWER_LENGTH));
  return items.length === value.length ? items : null;
}

function sanitizeAnswers(
  value: unknown,
  allowedQuestionKeys: ReadonlySet<string>,
): Record<string, PracticeDraftAnswer> {
  if (!isRecord(value)) return {};
  const answers: Record<string, PracticeDraftAnswer> = {};
  for (const [key, rawAnswer] of Object.entries(value)) {
    if (!allowedQuestionKeys.has(key) || Object.keys(answers).length >= MAX_SESSION_QUESTIONS) continue;
    const answer = sanitizeAnswer(rawAnswer);
    if (answer !== null) answers[key] = answer;
  }
  return answers;
}

function sanitizeAnswerHistory(
  value: unknown,
  allowedQuestionKeys: ReadonlySet<string>,
): Record<string, PracticeDraftAnswer[]> {
  if (!isRecord(value)) return {};
  const history: Record<string, PracticeDraftAnswer[]> = {};
  for (const [key, rawAnswers] of Object.entries(value)) {
    if (!allowedQuestionKeys.has(key) || Object.keys(history).length >= MAX_SESSION_QUESTIONS || !Array.isArray(rawAnswers)) continue;
    const answers = rawAnswers
      .slice(-8)
      .map(sanitizeAnswer)
      .filter((answer): answer is PracticeDraftAnswer => answer !== null);
    if (answers.length > 0) history[key] = answers;
  }
  return history;
}

function sanitizeResults(
  value: unknown,
  allowedQuestionKeys: ReadonlySet<string>,
): Record<string, StoredPracticeResult> {
  if (!isRecord(value)) return {};
  const results: Record<string, StoredPracticeResult> = {};
  for (const [key, rawResult] of Object.entries(value)) {
    if (!allowedQuestionKeys.has(key) || Object.keys(results).length >= MAX_SESSION_QUESTIONS || !isRecord(rawResult)) continue;
    if (typeof rawResult.correct !== "boolean" || (rawResult.score !== 0 && rawResult.score !== 1)) continue;
    const feedback = typeof rawResult.feedback === "string" ? rawResult.feedback.slice(0, MAX_FEEDBACK_LENGTH) : "";
    const knowledgePointIds = Array.isArray(rawResult.knowledgePointIds)
      ? rawResult.knowledgePointIds
        .filter((item): item is string => typeof item === "string")
        .slice(0, MAX_KNOWLEDGE_POINTS)
        .map((item) => item.slice(0, MAX_ANSWER_LENGTH))
      : [];
    results[key] = {
      correct: rawResult.correct,
      score: rawResult.score,
      feedback,
      knowledgePointIds,
    };
  }
  return results;
}

function sanitizeHints(
  value: unknown,
  allowedQuestionKeys: ReadonlySet<string>,
): Record<string, number> {
  if (!isRecord(value)) return {};
  const hints: Record<string, number> = {};
  for (const [key, rawHints] of Object.entries(value)) {
    if (!allowedQuestionKeys.has(key) || Object.keys(hints).length >= MAX_SESSION_QUESTIONS) continue;
    if (typeof rawHints !== "number" || !Number.isFinite(rawHints)) continue;
    hints[key] = Math.min(20, Math.max(0, Math.floor(rawHints)));
  }
  return hints;
}

export function parsePracticeSessionProgress(
  raw: string | null | undefined,
  allowedQuestionKeys: ReadonlySet<string>,
): PracticeSessionProgress {
  if (!raw) return emptyProgress();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return emptyProgress();
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== 1) return emptyProgress();
    const handledQuestionKeys = sanitizeKeys(candidate.handledQuestionKeys, allowedQuestionKeys);
    const correctQuestionKeys = sanitizeKeys(candidate.correctQuestionKeys, allowedQuestionKeys)
      .filter((key) => handledQuestionKeys.includes(key));
    const skippedQuestionKeys = sanitizeKeys(candidate.skippedQuestionKeys, allowedQuestionKeys)
      .filter((key) => handledQuestionKeys.includes(key) && !correctQuestionKeys.includes(key));
    const answersByQuestionKey = sanitizeAnswers(candidate.answersByQuestionKey, allowedQuestionKeys);
    const submittedAnswerHistoryByQuestionKey = sanitizeAnswerHistory(
      candidate.submittedAnswerHistoryByQuestionKey,
      allowedQuestionKeys,
    );
    const resultsByQuestionKey = sanitizeResults(candidate.resultsByQuestionKey, allowedQuestionKeys);
    const hintsByQuestionKey = sanitizeHints(candidate.hintsByQuestionKey, allowedQuestionKeys);
    return {
      schemaVersion: 1,
      handledQuestionKeys,
      correctQuestionKeys,
      skippedQuestionKeys,
      ...(Object.keys(answersByQuestionKey).length > 0 ? { answersByQuestionKey } : {}),
      ...(Object.keys(submittedAnswerHistoryByQuestionKey).length > 0
        ? { submittedAnswerHistoryByQuestionKey }
        : {}),
      ...(Object.keys(resultsByQuestionKey).length > 0 ? { resultsByQuestionKey } : {}),
      ...(Object.keys(hintsByQuestionKey).length > 0 ? { hintsByQuestionKey } : {}),
    };
  } catch {
    return emptyProgress();
  }
}

export function loadPracticeSessionProgress(
  practiceSetId: string,
  allowedQuestionKeys: ReadonlySet<string>,
  storage: SessionStorageAdapter | null = browserStorage(),
): PracticeSessionProgress {
  if (!storage) return emptyProgress();
  try {
    return parsePracticeSessionProgress(storage.getItem(storageKey(practiceSetId)), allowedQuestionKeys);
  } catch {
    return emptyProgress();
  }
}

export function savePracticeSessionProgress(
  practiceSetId: string,
  progress: PracticeSessionProgress,
  allowedQuestionKeys: ReadonlySet<string>,
  storage: SessionStorageAdapter | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    const safe = parsePracticeSessionProgress(JSON.stringify(progress), allowedQuestionKeys);
    storage.setItem(storageKey(practiceSetId), JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

export function clearPracticeSessionProgress(
  practiceSetId: string,
  storage: SessionStorageAdapter | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(storageKey(practiceSetId));
    return true;
  } catch {
    return false;
  }
}
