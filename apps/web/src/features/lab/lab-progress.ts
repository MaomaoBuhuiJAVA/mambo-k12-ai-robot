import type { LearningState, MasteryRecord } from "@/lib/domain";
import { updateMastery } from "@/lib/learning-store";
import { getLabTemplate } from "./lab-templates";
import type { LabTemplateId } from "./lab-protocol";

interface LabCompletion {
  templateId: LabTemplateId;
  passed: boolean;
  completedAt: string;
  attemptId: string;
}

export function recordLabCompletion(
  state: LearningState,
  completion: LabCompletion,
): LearningState {
  if (!completion.passed) return state;

  const knowledgePointId = getLabTemplate(completion.templateId).knowledgePointId;
  const previous = state.masteryByKnowledgePoint[knowledgePointId];
  const mastery = updateMastery(previous?.mastery ?? 0, { score: 1, hints: 0 });
  const nextReview = new Date(completion.completedAt);
  nextReview.setUTCDate(nextReview.getUTCDate() + 3);

  const record: MasteryRecord = {
    knowledgePointId,
    mastery,
    confidence: Math.min(1, (previous?.confidence ?? 0) + 0.15),
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
        attemptId: completion.attemptId,
        knowledgePointId,
        score: 1,
        hints: 0,
        mode: "code",
        completedAt: completion.completedAt,
      },
    ],
    recentTopics: [...state.recentTopics.filter((item) => item !== knowledgePointId), knowledgePointId].slice(-20),
    updatedAt: completion.completedAt,
  };
}
