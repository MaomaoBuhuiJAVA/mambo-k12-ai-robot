import type { LearningState, MasteryRecord } from "@/lib/domain";
import { updateMastery } from "@/lib/learning-store";
import { getLabTemplate } from "./lab-templates";
import type { LabTemplateId } from "./lab-protocol";

interface LabCompletion {
  templateId: LabTemplateId;
  challengeVersion: number;
  passed: boolean;
  completedAt: string;
  hintsUsed: number;
}

export const LAB_FORMATIVE_SCORE = 0.7;

export function recordLabCompletion(
  state: LearningState,
  completion: LabCompletion,
): LearningState {
  if (!completion.passed) return state;

  const knowledgePointId = getLabTemplate(completion.templateId).knowledgePointId;
  const attemptId = `lab:${completion.templateId}:v${completion.challengeVersion}`;
  if (state.attempts.some((attempt) => attempt.attemptId === attemptId)) return state;

  const hints = Number.isFinite(completion.hintsUsed)
    ? Math.max(0, Math.floor(completion.hintsUsed))
    : 0;
  const previous = state.masteryByKnowledgePoint[knowledgePointId];
  const mastery = updateMastery(previous?.mastery ?? 0, {
    score: LAB_FORMATIVE_SCORE,
    hints,
  });
  const nextReview = new Date(completion.completedAt);
  nextReview.setUTCDate(nextReview.getUTCDate() + 3);

  const record: MasteryRecord = {
    knowledgePointId,
    mastery,
    confidence: Math.min(1, (previous?.confidence ?? 0) + 0.06),
    evidenceCount: (previous?.evidenceCount ?? 0) + 1,
    lastPracticedAt: completion.completedAt,
    nextReviewAt: nextReview.toISOString(),
    misconceptionTags: previous ? [...previous.misconceptionTags] : [],
  };

  return {
    ...state,
    masteryByKnowledgePoint: {
      ...state.masteryByKnowledgePoint,
      [knowledgePointId]: record,
    },
    attempts: [
      ...state.attempts,
      {
        attemptId,
        knowledgePointId,
        score: LAB_FORMATIVE_SCORE,
        hints,
        mode: "code",
        completedAt: completion.completedAt,
      },
    ],
    recentTopics: [...state.recentTopics.filter((item) => item !== knowledgePointId), knowledgePointId].slice(-20),
    updatedAt: completion.completedAt,
  };
}
