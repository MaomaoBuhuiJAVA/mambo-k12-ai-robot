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

function bounded(value: string): string {
  return value.trim().slice(0, MAX_PERSISTED_STRING_LENGTH) || "unknown";
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
  return bounded(`${courseId}:${tag}`);
}

export function recordQuizAttempt(
  state: LearningState,
  input: QuizAttemptInput,
): LearningState {
  const score = clamp(input.score);
  const hints = Number.isFinite(input.hints)
    ? Math.min(20, Math.max(0, Math.floor(input.hints)))
    : 0;
  const completedAt = new Date(input.completedAt).toISOString();
  const completedAtMs = Date.parse(completedAt);
  const masteryByKnowledgePoint = { ...state.masteryByKnowledgePoint };
  const attempts: Attempt[] = [...state.attempts];
  const recentTopics = [...state.recentTopics];
  const primaryKnowledgePointId = knowledgePointId(
    input.course.id,
    input.exercise.knowledgePointTags[0] ?? input.exercise.id,
  );
  const consecutiveCorrect = score === 1
    ? previousCorrectStreak(state, primaryKnowledgePointId) + 1
    : 0;

  input.exercise.knowledgePointTags.forEach((tag) => {
    const id = knowledgePointId(input.course.id, tag);
    const previous = masteryByKnowledgePoint[id];
    const evidenceCount = (previous?.evidenceCount ?? 0) + 1;
    const misconception = bounded(`needs-review:${input.exercise.id}`);
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
    const priorIndex = recentTopics.indexOf(id);
    if (priorIndex >= 0) recentTopics.splice(priorIndex, 1);
    recentTopics.push(id);
  });
  attempts.push({
    attemptId: bounded(input.attemptId),
    knowledgePointId: primaryKnowledgePointId,
    score,
    hints,
    mode: "quiz",
    completedAt,
  });

  return {
    ...state,
    masteryByKnowledgePoint,
    attempts: attempts.slice(-MAX_PERSISTED_ATTEMPTS),
    recentTopics: recentTopics.slice(-MAX_PERSISTED_RECENT_TOPICS),
    lastCourseId: bounded(input.course.id),
    updatedAt: completedAt,
  };
}
