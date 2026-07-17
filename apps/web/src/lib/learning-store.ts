import type {
  Attempt,
  LearningMode,
  LearningState,
  MasteryRecord,
  Stage,
  StudentProfile,
} from "./domain";

export const CURRENT_LEARNING_STATE_VERSION = 1;
export const LEARNING_STATE_STORAGE_KEY = "mambo.learning-state";
export const LEGACY_LEARNING_STATE_STORAGE_KEY = "mambo.learning-state.v1";
export const MAX_PERSISTED_ATTEMPTS = 100;
export const MAX_PERSISTED_INTERESTS = 20;
export const MAX_PERSISTED_RECENT_TOPICS = 20;
export const MAX_PERSISTED_STRING_LENGTH = 160;

const MAX_PROFILE_GOALS = 20;
const MAX_MISCONCEPTION_TAGS = 20;
const MAX_ANSWER_LENGTH = 20_000;
const DEFAULT_UPDATED_AT = "1970-01-01T00:00:00.000Z";

type StorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DEFAULT_PROFILE: StudentProfile = {
  studentId: "local-student",
  displayName: "Learner",
  stage: "lower_primary",
  grade: null,
  textbook: null,
  preferredMode: "voice",
  accessibility: {
    captions: false,
    highContrast: false,
    reducedMotion: false,
  },
  goals: [],
};

const STAGES = new Set<Stage>([
  "lower_primary",
  "upper_primary",
  "middle_school",
  "high_school",
]);
const MODES = new Set<LearningMode>([
  "voice",
  "storybook",
  "game",
  "diagram",
  "quiz",
  "code",
  "project",
]);
const ISO_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnitInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isBoundedString(
  value: unknown,
  maxLength = MAX_PERSISTED_STRING_LENGTH,
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    (allowEmpty || value.length > 0)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isBoundedStringArray(
  value: unknown,
  maxItems: number,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isBoundedString(item))
  );
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = ISO_DATE_PATTERN.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= lastDayOfMonth;
}

function isStudentProfile(value: unknown): value is StudentProfile {
  if (!isRecord(value) || !isRecord(value.accessibility)) return false;

  return (
    isBoundedString(value.studentId) &&
    isBoundedString(value.displayName, 80) &&
    typeof value.stage === "string" &&
    STAGES.has(value.stage as Stage) &&
    (value.grade === null ||
      (typeof value.grade === "number" &&
        Number.isInteger(value.grade) &&
        value.grade >= 1 &&
        value.grade <= 12)) &&
    (value.textbook === null || isBoundedString(value.textbook)) &&
    typeof value.preferredMode === "string" &&
    MODES.has(value.preferredMode as LearningMode) &&
    typeof value.accessibility.captions === "boolean" &&
    typeof value.accessibility.highContrast === "boolean" &&
    typeof value.accessibility.reducedMotion === "boolean" &&
    isBoundedStringArray(value.goals, MAX_PROFILE_GOALS)
  );
}

function isAttempt(value: unknown): value is Attempt {
  return (
    isRecord(value) &&
    isBoundedString(value.attemptId) &&
    isBoundedString(value.knowledgePointId) &&
    isUnitInterval(value.score) &&
    isNonNegativeInteger(value.hints) &&
    typeof value.mode === "string" &&
    MODES.has(value.mode as LearningMode) &&
    (value.answer === undefined ||
      isBoundedString(value.answer, MAX_ANSWER_LENGTH, true)) &&
    isIsoDate(value.completedAt)
  );
}

function isMasteryRecord(value: unknown): value is MasteryRecord {
  return (
    isRecord(value) &&
    isBoundedString(value.knowledgePointId) &&
    isUnitInterval(value.mastery) &&
    isUnitInterval(value.confidence) &&
    isNonNegativeInteger(value.evidenceCount) &&
    (value.lastPracticedAt === null || isIsoDate(value.lastPracticedAt)) &&
    (value.nextReviewAt === null || isIsoDate(value.nextReviewAt)) &&
    isBoundedStringArray(value.misconceptionTags, MAX_MISCONCEPTION_TAGS)
  );
}

function isMasteryMap(
  value: unknown,
): value is Record<string, MasteryRecord> {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([knowledgePointId, record]) =>
        isMasteryRecord(record) && record.knowledgePointId === knowledgePointId,
    )
  );
}

function isLearningState(value: unknown): value is LearningState {
  return (
    isRecord(value) &&
    value.schemaVersion === CURRENT_LEARNING_STATE_VERSION &&
    isStudentProfile(value.profile) &&
    isMasteryMap(value.masteryByKnowledgePoint) &&
    Array.isArray(value.attempts) &&
    value.attempts.length <= MAX_PERSISTED_ATTEMPTS &&
    value.attempts.every(isAttempt) &&
    isBoundedStringArray(value.recentTopics, MAX_PERSISTED_RECENT_TOPICS) &&
    isBoundedStringArray(value.interests, MAX_PERSISTED_INTERESTS) &&
    (value.lastCourseId === null || isBoundedString(value.lastCourseId)) &&
    isIsoDate(value.updatedAt)
  );
}

export function createDefaultLearningState(
  profile: StudentProfile = DEFAULT_PROFILE,
): LearningState {
  return {
    schemaVersion: CURRENT_LEARNING_STATE_VERSION,
    profile: structuredClone(profile),
    masteryByKnowledgePoint: {},
    attempts: [],
    recentTopics: [],
    interests: [],
    lastCourseId: null,
    updatedAt: DEFAULT_UPDATED_AT,
  };
}

function anonymizeProfile(profile: StudentProfile): StudentProfile {
  const accessibility = profile.accessibility;

  return {
    studentId: DEFAULT_PROFILE.studentId,
    displayName: DEFAULT_PROFILE.displayName,
    stage: STAGES.has(profile.stage) ? profile.stage : DEFAULT_PROFILE.stage,
    grade:
      Number.isInteger(profile.grade) &&
      profile.grade !== null &&
      profile.grade >= 1 &&
      profile.grade <= 12
        ? profile.grade
        : null,
    textbook: null,
    preferredMode: MODES.has(profile.preferredMode)
      ? profile.preferredMode
      : DEFAULT_PROFILE.preferredMode,
    accessibility: {
      captions:
        typeof accessibility?.captions === "boolean"
          ? accessibility.captions
          : DEFAULT_PROFILE.accessibility.captions,
      highContrast:
        typeof accessibility?.highContrast === "boolean"
          ? accessibility.highContrast
          : DEFAULT_PROFILE.accessibility.highContrast,
      reducedMotion:
        typeof accessibility?.reducedMotion === "boolean"
          ? accessibility.reducedMotion
          : DEFAULT_PROFILE.accessibility.reducedMotion,
    },
    goals: [],
  };
}

function sanitizeStringArray(values: string[], maxItems: number): string[] {
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, MAX_PERSISTED_STRING_LENGTH))
    .filter(Boolean)
    .slice(-maxItems);
}

function stripAttemptAnswer(attempt: Attempt): Attempt {
  return {
    attemptId: attempt.attemptId,
    knowledgePointId: attempt.knowledgePointId,
    score: attempt.score,
    hints: attempt.hints,
    mode: attempt.mode,
    completedAt: attempt.completedAt,
  };
}

export function prepareLearningStateForStorage(
  state: LearningState,
): LearningState {
  const masteryByKnowledgePoint = Object.fromEntries(
    Object.entries(state.masteryByKnowledgePoint)
      .filter(
        ([knowledgePointId, record]) =>
          isMasteryRecord(record) && record.knowledgePointId === knowledgePointId,
      )
      .map(([knowledgePointId, record]) => [
        knowledgePointId,
        { ...record, misconceptionTags: [...record.misconceptionTags] },
      ]),
  );

  return {
    schemaVersion: CURRENT_LEARNING_STATE_VERSION,
    profile: anonymizeProfile(state.profile),
    masteryByKnowledgePoint,
    attempts: state.attempts
      .filter(isAttempt)
      .slice(-MAX_PERSISTED_ATTEMPTS)
      .map(stripAttemptAnswer),
    recentTopics: sanitizeStringArray(
      state.recentTopics,
      MAX_PERSISTED_RECENT_TOPICS,
    ),
    interests: sanitizeStringArray(state.interests, MAX_PERSISTED_INTERESTS),
    lastCourseId: isBoundedString(state.lastCourseId)
      ? state.lastCourseId
      : null,
    updatedAt: isIsoDate(state.updatedAt) ? state.updatedAt : DEFAULT_UPDATED_AT,
  };
}

function migrateLegacyState(value: Record<string, unknown>): LearningState | null {
  if (value.schemaVersion !== 0 || !isStudentProfile(value.profile)) return null;

  const masteryByKnowledgePoint: Record<string, MasteryRecord> = {};
  if (isRecord(value.mastery)) {
    for (const [knowledgePointId, mastery] of Object.entries(value.mastery)) {
      if (!isBoundedString(knowledgePointId) || !isUnitInterval(mastery)) continue;
      masteryByKnowledgePoint[knowledgePointId] = {
        knowledgePointId,
        mastery,
        confidence: 0,
        evidenceCount: 0,
        lastPracticedAt: null,
        nextReviewAt: null,
        misconceptionTags: [],
      };
    }
  }

  const attempts =
    Array.isArray(value.attempts) && value.attempts.every(isAttempt)
      ? value.attempts
      : [];

  return prepareLearningStateForStorage({
    schemaVersion: CURRENT_LEARNING_STATE_VERSION,
    profile: value.profile,
    masteryByKnowledgePoint,
    attempts,
    recentTopics: isStringArray(value.recentTopics) ? value.recentTopics : [],
    interests: isStringArray(value.interests) ? value.interests : [],
    lastCourseId:
      typeof value.lastCourseId === "string" ? value.lastCourseId : null,
    updatedAt: isIsoDate(value.updatedAt) ? value.updatedAt : DEFAULT_UPDATED_AT,
  });
}

function migrateLegacyV1State(
  value: Record<string, unknown>,
): LearningState | null {
  if (
    value.schemaVersion !== CURRENT_LEARNING_STATE_VERSION ||
    !isStudentProfile(value.profile) ||
    !isMasteryMap(value.masteryByKnowledgePoint) ||
    !Array.isArray(value.attempts) ||
    !value.attempts.every(isAttempt) ||
    !isStringArray(value.recentTopics) ||
    !isStringArray(value.interests) ||
    (value.lastCourseId !== null && typeof value.lastCourseId !== "string") ||
    !isIsoDate(value.updatedAt)
  ) {
    return null;
  }

  return prepareLearningStateForStorage({
    schemaVersion: CURRENT_LEARNING_STATE_VERSION,
    profile: value.profile,
    masteryByKnowledgePoint: value.masteryByKnowledgePoint,
    attempts: value.attempts,
    recentTopics: value.recentTopics,
    interests: value.interests,
    lastCourseId: value.lastCourseId,
    updatedAt: value.updatedAt,
  });
}

function decodeLearningState(
  raw: string,
  allowLegacyV1 = false,
): LearningState | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (isLearningState(value)) return prepareLearningStateForStorage(value);
    if (isRecord(value)) {
      if (allowLegacyV1) {
        const migratedV1 = migrateLegacyV1State(value);
        if (migratedV1) return migratedV1;
      }
      return migrateLegacyState(value);
    }
  } catch {
    return null;
  }

  return null;
}

export function parseLearningState(raw: string | null | undefined): LearningState {
  if (!raw) return createDefaultLearningState();
  return decodeLearningState(raw) ?? createDefaultLearningState();
}

function browserStorage(): StorageAdapter | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadLearningState(
  storage: StorageAdapter | null = browserStorage(),
): LearningState {
  if (!storage) return createDefaultLearningState();

  try {
    const currentRaw = storage.getItem(LEARNING_STATE_STORAGE_KEY);
    if (currentRaw !== null) {
      return decodeLearningState(currentRaw) ?? createDefaultLearningState();
    }

    const legacyRaw = storage.getItem(LEGACY_LEARNING_STATE_STORAGE_KEY);
    if (legacyRaw === null) return createDefaultLearningState();

    const migrated = decodeLearningState(legacyRaw, true);
    if (!migrated) return createDefaultLearningState();

    if (saveLearningState(migrated, storage)) {
      try {
        storage.removeItem(LEGACY_LEARNING_STATE_STORAGE_KEY);
      } catch {
        // The stable copy is already persisted; stale cleanup can be retried later.
      }
    }
    return migrated;
  } catch {
    return createDefaultLearningState();
  }
}

export function saveLearningState(
  state: LearningState,
  storage: StorageAdapter | null = browserStorage(),
): boolean {
  if (!storage) return false;

  try {
    const prepared = prepareLearningStateForStorage(state);
    storage.setItem(LEARNING_STATE_STORAGE_KEY, JSON.stringify(prepared));
    return true;
  } catch {
    return false;
  }
}

export function clearLearningState(
  storage: StorageAdapter | null = browserStorage(),
): boolean {
  if (!storage) return false;

  try {
    storage.removeItem(LEARNING_STATE_STORAGE_KEY);
    storage.removeItem(LEGACY_LEARNING_STATE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function updateMastery(
  currentMastery: number,
  evidence: Pick<Attempt, "score" | "hints">,
): number {
  const current = clamp(currentMastery);
  const score = clamp(evidence.score);
  const hints = Number.isFinite(evidence.hints)
    ? Math.max(0, Math.floor(evidence.hints))
    : 0;
  const difference = score - current;
  const hintFactor =
    difference >= 0
      ? 1 / (1 + hints * 0.25)
      : 1 + Math.min(hints, 10) * 0.1;
  const updated = clamp(current + 0.25 * hintFactor * difference);

  return updated > 0.99 ? 1 : updated;
}
