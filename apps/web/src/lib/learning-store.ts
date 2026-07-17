import type {
  Attempt,
  LearningMode,
  LearningState,
  MasteryRecord,
  Stage,
  StudentProfile,
} from "./domain";

export const CURRENT_LEARNING_STATE_VERSION = 1;
export const LEARNING_STATE_STORAGE_KEY = "mambo.learning-state.v1";

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStudentProfile(value: unknown): value is StudentProfile {
  if (!isRecord(value) || !isRecord(value.accessibility)) return false;

  return (
    typeof value.studentId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.stage === "string" &&
    STAGES.has(value.stage as Stage) &&
    (value.grade === null || typeof value.grade === "number") &&
    (value.textbook === null || typeof value.textbook === "string") &&
    typeof value.preferredMode === "string" &&
    MODES.has(value.preferredMode as LearningMode) &&
    typeof value.accessibility.captions === "boolean" &&
    typeof value.accessibility.highContrast === "boolean" &&
    typeof value.accessibility.reducedMotion === "boolean" &&
    isStringArray(value.goals)
  );
}

function isAttempt(value: unknown): value is Attempt {
  return (
    isRecord(value) &&
    typeof value.attemptId === "string" &&
    typeof value.knowledgePointId === "string" &&
    typeof value.score === "number" &&
    typeof value.hints === "number" &&
    typeof value.mode === "string" &&
    MODES.has(value.mode as LearningMode) &&
    typeof value.answer === "string" &&
    typeof value.completedAt === "string"
  );
}

function isMasteryRecord(value: unknown): value is MasteryRecord {
  return (
    isRecord(value) &&
    typeof value.knowledgePointId === "string" &&
    typeof value.mastery === "number" &&
    typeof value.confidence === "number" &&
    typeof value.evidenceCount === "number" &&
    (value.lastPracticedAt === null ||
      typeof value.lastPracticedAt === "string") &&
    (value.nextReviewAt === null || typeof value.nextReviewAt === "string") &&
    isStringArray(value.misconceptionTags)
  );
}

function isMasteryMap(
  value: unknown,
): value is Record<string, MasteryRecord> {
  return isRecord(value) && Object.values(value).every(isMasteryRecord);
}

function isLearningState(value: unknown): value is LearningState {
  return (
    isRecord(value) &&
    value.schemaVersion === CURRENT_LEARNING_STATE_VERSION &&
    isStudentProfile(value.profile) &&
    isMasteryMap(value.masteryByKnowledgePoint) &&
    Array.isArray(value.attempts) &&
    value.attempts.every(isAttempt) &&
    isStringArray(value.recentTopics) &&
    isStringArray(value.interests) &&
    (value.lastCourseId === null || typeof value.lastCourseId === "string") &&
    typeof value.updatedAt === "string"
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
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
}

function migrateLegacyState(value: Record<string, unknown>): LearningState | null {
  if (value.schemaVersion !== 0 || !isStudentProfile(value.profile)) return null;

  const migrated = createDefaultLearningState(value.profile);
  const legacyMastery = isRecord(value.mastery) ? value.mastery : {};

  migrated.masteryByKnowledgePoint = Object.fromEntries(
    Object.entries(legacyMastery)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number")
      .map(([knowledgePointId, mastery]) => [
        knowledgePointId,
        {
          knowledgePointId,
          mastery: clamp(mastery),
          confidence: 0,
          evidenceCount: 0,
          lastPracticedAt: null,
          nextReviewAt: null,
          misconceptionTags: [],
        },
      ]),
  );
  migrated.attempts =
    Array.isArray(value.attempts) && value.attempts.every(isAttempt)
      ? value.attempts
      : [];
  migrated.recentTopics = isStringArray(value.recentTopics)
    ? value.recentTopics
    : [];
  migrated.interests = isStringArray(value.interests) ? value.interests : [];
  migrated.lastCourseId =
    typeof value.lastCourseId === "string" ? value.lastCourseId : null;
  migrated.updatedAt =
    typeof value.updatedAt === "string" ? value.updatedAt : migrated.updatedAt;

  return migrated;
}

export function parseLearningState(raw: string | null | undefined): LearningState {
  if (!raw) return createDefaultLearningState();

  try {
    const value: unknown = JSON.parse(raw);
    if (isLearningState(value)) return value;
    if (isRecord(value)) return migrateLegacyState(value) ?? createDefaultLearningState();
  } catch {
    // A corrupt local value should never prevent the application from starting.
  }

  return createDefaultLearningState();
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
    return parseLearningState(storage.getItem(LEARNING_STATE_STORAGE_KEY));
  } catch {
    return createDefaultLearningState();
  }
}

export function saveLearningState(
  state: LearningState,
  storage: StorageAdapter | null = browserStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(LEARNING_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is best effort when storage is unavailable or full.
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
  const hints = Math.max(0, evidence.hints);
  const reliability = 1 / (1 + hints * 0.25);
  const updated = clamp(current + 0.25 * reliability * (score - current));

  return updated > 0.99 ? 1 : updated;
}
