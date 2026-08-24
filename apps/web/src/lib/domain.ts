export type Stage =
  | "lower_primary"
  | "upper_primary"
  | "middle_school"
  | "high_school";

export type LearningMode =
  | "voice"
  | "storybook"
  | "game"
  | "diagram"
  | "quiz"
  | "code"
  | "project";

export interface AccessibilityPreferences {
  captions: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

export interface StudentProfile {
  studentId: string;
  displayName: string;
  stage: Stage;
  grade: number | null;
  textbook: string | null;
  preferredMode: LearningMode;
  accessibility: AccessibilityPreferences;
  goals: string[];
}

export type StageTone = "story" | "encouraging" | "coach" | "project";
export type ExplanationDepth =
  | "concrete"
  | "guided"
  | "conceptual"
  | "rigorous";
export type CodeLevel = "none" | "blocks" | "guided" | "independent";

export interface StagePolicy {
  stage: Stage;
  tone: StageTone;
  explanationDepth: ExplanationDepth;
  maxAnswerChars: number;
  preferredModes: LearningMode[];
  codeLevel: CodeLevel;
}

export interface Attempt {
  attemptId: string;
  knowledgePointId: string;
  score: number;
  hints: number;
  mode: LearningMode;
  answer?: string;
  completedAt: string;
}

export interface MasteryRecord {
  knowledgePointId: string;
  mastery: number;
  confidence: number;
  evidenceCount: number;
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
  misconceptionTags: string[];
}

export type LearningPathStage = Extract<
  Stage,
  "middle_school" | "high_school"
>;

export type ExperimentMode =
  | "guided"
  | "independent"
  | "research"
  | "project";

export interface ExperimentEvidence {
  runId: string;
  activityId: string;
  courseId: string;
  templateId: string;
  mode: ExperimentMode;
  variables: Record<string, string | number | boolean>;
  metrics: Record<string, number>;
  conclusion: string;
  completedAt: string;
}

export interface StageProgress {
  completedActivityIds: string[];
  experimentEvidence: ExperimentEvidence[];
  activeActivityId: string | null;
}

export interface LearningState {
  schemaVersion: number;
  profile: StudentProfile;
  masteryByKnowledgePoint: Record<string, MasteryRecord>;
  attempts: Attempt[];
  recentTopics: string[];
  interests: string[];
  lastCourseId: string | null;
  stageProgressByStage: Record<LearningPathStage, StageProgress>;
  updatedAt: string;
}
