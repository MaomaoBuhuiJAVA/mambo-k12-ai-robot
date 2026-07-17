import type { CurriculumCourse, CourseExercise } from "@/data/curriculum";
import type { Attempt, LearningState, MasteryRecord } from "@/lib/domain";
import {
  MAX_PERSISTED_ATTEMPTS,
  MAX_PERSISTED_RECENT_TOPICS,
  MAX_PERSISTED_STRING_LENGTH,
  updateMastery,
} from "@/lib/learning-store";

interface QuizAttemptInput {
  course: CurriculumCourse;
  exercise: CourseExercise;
  score: number;
  hints: number;
  completedAt: string;
  attemptId: string;
  answer?: unknown;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function boundedIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, MAX_PERSISTED_STRING_LENGTH);
  return normalized || null;
}

function normalizeCompletedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
    return null;
  }
  return new Date(value).toISOString();
}

function evidenceAttemptId(attemptId: string, index: number): string {
  if (index === 0) return attemptId;
  const suffix = `~e${index + 1}`;
  return `${attemptId.slice(0, MAX_PERSISTED_STRING_LENGTH - suffix.length)}${suffix}`;
}

function reviewDelayMs(score: number, consecutiveCorrect: number): number {
  if (score < 1) return 6 * 60 * 60 * 1000;
  if (consecutiveCorrect >= 4) return 14 * 24 * 60 * 60 * 1000;
  if (consecutiveCorrect >= 3) return 7 * 24 * 60 * 60 * 1000;
  if (consecutiveCorrect >= 2) return 3 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function previousCorrectStreak(state: LearningState, knowledgePointId: string): number {
  let streak = 0;
  for (let index = state.attempts.length - 1; index >= 0; index -= 1) {
    const attempt = state.attempts[index];
    if (attempt.knowledgePointId !== knowledgePointId) continue;
    if (attempt.score !== 1) break;
    streak += 1;
  }
  return streak;
}

export function knowledgePointId(courseId: string, tag: string): string {
  return `${courseId}:${tag}`.slice(0, MAX_PERSISTED_STRING_LENGTH);
}

export function recordQuizAttempt(
  state: LearningState,
  input: QuizAttemptInput,
): LearningState {
  const attemptId = boundedIdentifier(input.attemptId);
  const completedAt = normalizeCompletedAt(input.completedAt);
  const courseId = boundedIdentifier(input.course?.id);
  const tags = input.exercise?.knowledgePointTags;
  if (!attemptId || !completedAt || !courseId || !Array.isArray(tags) || tags.length === 0) {
    return state;
  }
  if (state.attempts.some((attempt) => attempt.attemptId === attemptId)) return state;
  if (tags.some((tag) => boundedIdentifier(tag) === null)) return state;

  const score = clamp(input.score);
  const hints = Number.isFinite(input.hints)
    ? Math.min(20, Math.max(0, Math.floor(input.hints)))
    : 0;
  const completedAtMs = Date.parse(completedAt);
  const masteryByKnowledgePoint = { ...state.masteryByKnowledgePoint };
  const attempts: Attempt[] = [...state.attempts];
  const recentTopics = [...state.recentTopics];
  tags.forEach((tag, index) => {
    const id = knowledgePointId(courseId, tag);
    const previous = masteryByKnowledgePoint[id];
    const evidenceCount = (previous?.evidenceCount ?? 0) + 1;
    const consecutiveCorrect = score === 1
      ? previousCorrectStreak(state, id) + 1
      : 0;
    const misconception = `needs-review:${input.exercise.id}`.slice(0, MAX_PERSISTED_STRING_LENGTH);
    const misconceptionTags = score === 1
      ? (previous?.misconceptionTags ?? []).filter((item) => item !== misconception)
      : [...new Set([...(previous?.misconceptionTags ?? []), misconception])].slice(-20);
    const nextReviewAt = new Date(completedAtMs + reviewDelayMs(score, consecutiveCorrect)).toISOString();

    const record: MasteryRecord = {
      knowledgePointId: id,
      mastery: updateMastery(previous?.mastery ?? 0, { score, hints }),
      confidence: clamp((previous?.confidence ?? 0) + (score === 1 && hints === 0 ? 0.12 : 0.06)),
      evidenceCount,
      lastPracticedAt: completedAt,
      nextReviewAt,
      misconceptionTags,
    };
    masteryByKnowledgePoint[id] = record;
    attempts.push({
      attemptId: evidenceAttemptId(attemptId, index),
      knowledgePointId: id,
      score,
      hints,
      mode: "quiz",
      completedAt,
    });
    const priorIndex = recentTopics.indexOf(id);
    if (priorIndex >= 0) recentTopics.splice(priorIndex, 1);
    recentTopics.push(id);
  });
  return {
    ...state,
    masteryByKnowledgePoint,
    attempts: attempts.slice(-MAX_PERSISTED_ATTEMPTS),
    recentTopics: recentTopics.slice(-MAX_PERSISTED_RECENT_TOPICS),
    lastCourseId: courseId,
    updatedAt: completedAt,
  };
}
