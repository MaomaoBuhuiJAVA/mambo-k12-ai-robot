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
  answer: string;
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

export interface LearningState {
  schemaVersion: number;
  profile: StudentProfile;
  masteryByKnowledgePoint: Record<string, MasteryRecord>;
  attempts: Attempt[];
  recentTopics: string[];
  interests: string[];
  lastCourseId: string | null;
  updatedAt: string;
}
