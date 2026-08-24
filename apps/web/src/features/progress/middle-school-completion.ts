import { getCourseById } from "@/data/curriculum";
import type { LearningState } from "@/lib/domain";

const MIDDLE_CORE_COURSE_IDS = ["middle-ai-foundations", "middle-data-and-algorithms", "middle-python-basics", "middle-neural-signals", "middle-model-evaluation", "middle-data-bias", "middle-generative-ai", "middle-ai-safety"] as const;
const MASTERY_THRESHOLD = 0.7;

export interface MiddleSchoolCompletionRequirement {
  id: string;
  label: string;
  met: boolean;
  remediationHref: string;
}

export function getMiddleSchoolCompletionRequirements(state: LearningState): MiddleSchoolCompletionRequirement[] {
  const completed = new Set(state.stageProgressByStage.middle_school.completedActivityIds);
  const coreMastery = MIDDLE_CORE_COURSE_IDS.map((courseId) => {
    const course = getCourseById(courseId)!;
    return course.knowledgePointTags.every((tag) => state.masteryByKnowledgePoint[`${courseId}:${tag}`]?.mastery >= MASTERY_THRESHOLD);
  }).every(Boolean);
  const researchEvidence = state.stageProgressByStage.middle_school.experimentEvidence.some((item) => item.activityId === "middle-data-bias-research" && item.conclusion.trim().length > 0);

  return [
    { id: "core-mastery", label: "八门初中核心课的全部知识点达到 70% 掌握度", met: coreMastery, remediationHref: "/learn?stage=middle_school&view=profile" },
    { id: "research-challenge", label: "完成一项研究挑战", met: completed.has("middle-data-bias-research"), remediationHref: "/lab?stage=middle_school&template=image-classifier&mode=research" },
    { id: "structured-conclusion", label: "提交一份包含结论的结构化实验记录", met: researchEvidence, remediationHref: "/lab?stage=middle_school&template=image-classifier&mode=research" },
    { id: "safety-assessment", label: "通过 AI 安全知识点评价", met: completed.has("middle-ai-safety-assessment"), remediationHref: "/workspace?course=middle-ai-safety&tab=exercise" },
  ];
}

export function hasCompletedMiddleSchool(state: LearningState): boolean {
  return getMiddleSchoolCompletionRequirements(state).every((item) => item.met);
}
