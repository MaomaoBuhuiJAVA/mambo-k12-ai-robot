import { z } from "zod";

export const DIFY_CONTENT_VERSION = "2026-08-24" as const;
export const PRIMARY_BATTLE_WORKFLOW_VERSION = "primary-battle-question-v1" as const;
export const DIALOGUE_WORKFLOW_VERSION = "k12-learning-dialogue-v1" as const;
export const MIDDLE_LAB_WORKFLOW_VERSION = "middle-lab-coach-v1" as const;
export const RECOMMENDATION_WORKFLOW_VERSION = "learning-path-suggestion-v1" as const;
export const HIGH_DEFENSE_PLAN_WORKFLOW_VERSION = "high-project-defense-plan-v1" as const;
export const HIGH_DEFENSE_TURN_WORKFLOW_VERSION = "high-project-defense-turn-v1" as const;
export const AI_TUTOR_GUIDE_WORKFLOW_VERSION = "ai-tutor-guide-v1" as const;

export const PRIMARY_BATTLE_MODULE_IDS = [
  "castle-1",
  "core-lab",
  "desert-temple",
  "lava-cavern",
  "tree-sanctuary",
] as const;

const safeText = (max: number) =>
  z.string().trim().min(1).max(max).refine(
    (value) => !/[<>]|javascript:|<script|\u0000/i.test(value),
    "text contains markup or control content",
  );

const boundedText = (max: number) =>
  z.string().trim().max(max).refine(
    (value) => !/[<>]|javascript:|<script|\u0000/i.test(value),
    "text contains markup or control content",
  );

export const AgentContextV1Schema = z.object({
  schemaVersion: z.literal(1),
  traceId: safeText(120),
  anonymousLearnerId: safeText(120),
  stage: z.enum(["lower_primary", "upper_primary", "middle_school", "high_school"]),
  grade: z.number().int().min(1).max(12).nullable(),
  teachingMode: z.enum(["storybook", "dialogue", "battle", "lab", "project", "defense", "recommendation"]),
  activityId: safeText(160),
  courseId: safeText(160).nullable(),
  moduleId: safeText(80).nullable(),
  storybookId: safeText(120).nullable(),
  pageNumber: z.number().int().min(1).max(40).nullable(),
  knowledgePointIds: z.array(safeText(120)).max(12),
  completedActivityIds: z.array(safeText(160)).max(40),
  masterySummary: z.array(z.object({
    knowledgePointId: safeText(120),
    level: z.number().min(0).max(1),
    evidenceCount: z.number().int().min(0).max(1000),
  })).max(40),
  misconceptionTags: z.array(safeText(120)).max(20),
  recentEvidenceSummary: z.array(z.object({
    evidenceId: safeText(160),
    kind: safeText(80),
    resultCode: safeText(80),
    metrics: z.record(z.string(), z.number()).optional(),
  })).max(8),
  allowedActionIds: z.array(safeText(160)).max(8),
});

export const PrimaryBattleQuestionRequestSchema = z.object({
  context: AgentContextV1Schema,
  questionIndex: z.number().int().min(0).max(99),
  difficulty: z.enum(["introductory", "standard", "challenge"]),
  excludedQuestionIds: z.array(safeText(160)).max(40),
  allowedKnowledgePointIds: z.array(safeText(120)).min(1).max(12),
}).superRefine((input, ctx) => {
  if (input.context.stage !== "lower_primary" && input.context.stage !== "upper_primary") {
    ctx.addIssue({ code: "custom", path: ["context", "stage"], message: "battle questions are primary-stage only" });
  }
  if (input.context.teachingMode !== "battle") {
    ctx.addIssue({ code: "custom", path: ["context", "teachingMode"], message: "battle request must use teachingMode=battle" });
  }
  if (!input.context.moduleId || !PRIMARY_BATTLE_MODULE_IDS.includes(input.context.moduleId as typeof PRIMARY_BATTLE_MODULE_IDS[number])) {
    ctx.addIssue({ code: "custom", path: ["context", "moduleId"], message: "unknown primary battle module" });
  }
  const completed = new Set(input.context.knowledgePointIds);
  if (input.allowedKnowledgePointIds.some((id) => !completed.has(id))) {
    ctx.addIssue({ code: "custom", path: ["allowedKnowledgePointIds"], message: "knowledge point is not in the validated context" });
  }
});

export const BattleQuestionPayloadSchema = z.object({
  questionId: safeText(160),
  topic: safeText(120),
  prompt: safeText(300),
  options: z.array(safeText(120)).length(4).refine((options) => new Set(options).size === 4, "options must be unique"),
  answerIndex: z.number().int().min(0).max(3),
  explanation: safeText(240),
  knowledgePointIds: z.array(safeText(120)).min(1).max(12),
  sourcePageIds: z.array(safeText(160)).min(1).max(12),
  evidenceQuote: safeText(320).optional(),
});

export const BattleQuestionResponseSchema = z.object({
  schemaVersion: z.literal(1),
  traceId: safeText(120),
  workflowVersion: z.literal(PRIMARY_BATTLE_WORKFLOW_VERSION),
  resultType: z.literal("battle_question"),
  contentVersion: safeText(40),
  sourceIds: z.array(safeText(160)).min(1).max(12),
  payload: BattleQuestionPayloadSchema,
});

export const PrimaryBattleFeedbackRequestSchema = z.object({
  context: AgentContextV1Schema,
  isCorrect: z.boolean(),
  studentAnswer: safeText(120),
  correctAnswer: safeText(120),
  explanation: safeText(240),
  knowledgePointIds: z.array(safeText(120)).max(12),
}).superRefine((input, ctx) => {
  if (input.context.stage !== "lower_primary" && input.context.stage !== "upper_primary") {
    ctx.addIssue({ code: "custom", path: ["context", "stage"], message: "battle feedback is primary-stage only" });
  }
  if (input.context.teachingMode !== "battle") {
    ctx.addIssue({ code: "custom", path: ["context", "teachingMode"], message: "feedback request must use teachingMode=battle" });
  }
  if (input.isCorrect !== (input.studentAnswer === input.correctAnswer)) {
    ctx.addIssue({ code: "custom", path: ["isCorrect"], message: "website grading result conflicts with answer fields" });
  }
});

export const BattleFeedbackResponseSchema = z.object({
  schemaVersion: z.literal(1),
  traceId: safeText(120),
  workflowVersion: z.literal("primary-battle-feedback-v1"),
  resultType: z.literal("battle_feedback"),
  contentVersion: safeText(40),
  sourceIds: z.array(safeText(160)).max(12),
  payload: z.object({ feedback: safeText(320) }),
});

export const dialogueMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: safeText(2_000),
});

export const DialogueRequestSchema = z.object({
  context: AgentContextV1Schema,
  messages: z.array(dialogueMessageSchema).min(1).max(8),
  question: safeText(2_000),
}).superRefine((input, ctx) => {
  const supportedModes = new Set(["storybook", "dialogue", "lab", "project", "defense"]);
  if (!supportedModes.has(input.context.teachingMode)) {
    ctx.addIssue({ code: "custom", path: ["context", "teachingMode"], message: "unsupported dialogue teaching mode" });
  }
  if (input.messages.at(-1)?.role !== "user") {
    ctx.addIssue({ code: "custom", path: ["messages"], message: "dialogue history must end with a user message" });
  }
  if (input.messages.reduce((sum, message) => sum + message.content.length, 0) + input.question.length > 8_000) {
    ctx.addIssue({ code: "custom", path: ["messages"], message: "dialogue input exceeds 8000 characters" });
  }
});

/**
 * The browser can only ask about a registered lesson. The route resolves that
 * lesson against the server-side course catalog before it reaches Dify.
 */
export const TutorGuideRequestSchema = z.object({
  lessonId: safeText(160),
}).and(DialogueRequestSchema).superRefine((input, ctx) => {
  if (input.context.teachingMode !== "dialogue") {
    ctx.addIssue({ code: "custom", path: ["context", "teachingMode"], message: "tutor guidance requires teachingMode=dialogue" });
  }
});

const labTemplateIdSchema = z.enum([
  "bubble-sort",
  "image-classifier",
  "middle-python-basics",
]);

export const MiddleLabCoachRequestSchema = z.object({
  context: AgentContextV1Schema,
  templateId: labTemplateIdSchema,
  runId: safeText(160).nullable(),
  variables: z.record(z.string().max(80), z.union([z.string().max(120), z.number().finite(), z.boolean()])).refine((value) => Object.keys(value).length <= 16),
  metrics: z.record(z.string().max(80), z.number().finite()).refine((value) => Object.keys(value).length <= 16),
  conclusion: safeText(800).nullable(),
  question: safeText(2_000),
}).superRefine((input, ctx) => {
  if (input.context.stage !== "middle_school") {
    ctx.addIssue({ code: "custom", path: ["context", "stage"], message: "lab coach requires middle-school context" });
  }
  if (input.context.teachingMode !== "lab") {
    ctx.addIssue({ code: "custom", path: ["context", "teachingMode"], message: "lab coach requires teachingMode=lab" });
  }
});

const recommendationCandidateSchema = z.object({
  actionId: safeText(160),
  title: safeText(160),
  summary: safeText(300),
  courseId: safeText(160).nullable(),
}).strict();

export const RecommendationRequestSchema = z.object({
  context: AgentContextV1Schema,
  candidates: z.array(recommendationCandidateSchema).min(1).max(8),
}).superRefine((input, ctx) => {
  if (input.context.teachingMode !== "recommendation") {
    ctx.addIssue({ code: "custom", path: ["context", "teachingMode"], message: "recommendation requires teachingMode=recommendation" });
  }
  const ids = input.candidates.map((candidate) => candidate.actionId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "candidate action IDs must be unique" });
  }
});

const recommendationItemSchema = z.object({
  actionId: safeText(160),
  reason: safeText(320),
  priority: z.number().min(0).max(1),
}).strict();

export const RecommendationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  traceId: safeText(120),
  workflowVersion: z.literal(RECOMMENDATION_WORKFLOW_VERSION),
  resultType: z.literal("learning_path_suggestion"),
  contentVersion: safeText(40),
  sourceIds: z.array(safeText(160)).min(1).max(12),
  payload: z.object({ recommendations: z.array(recommendationItemSchema).min(1).max(3) }).strict(),
}).strict();

const projectIdSchema = z.enum(["model-audit", "capstone"]);
const projectEvidenceSchema = z.object({
  researchQuestion: boundedText(2_000),
  dataSource: boundedText(2_000),
  authorization: boundedText(2_000),
  processingSteps: boundedText(2_000),
  modelVersion: boundedText(800),
  metrics: boundedText(2_000),
  failureCases: boundedText(2_000),
  conclusion: boundedText(2_000),
  limitations: boundedText(2_000),
  evidenceRefs: z.array(safeText(160)).max(8),
}).strict();

function checkEvidenceRefs(
  evidenceRefs: readonly string[],
  context: z.RefinementCtx,
  source: AgentContextV1,
  path: string[],
) {
  const available = new Set(source.recentEvidenceSummary.map((item) => item.evidenceId));
  if (evidenceRefs.some((id) => !available.has(id))) {
    context.addIssue({ code: "custom", path, message: "project evidence reference is not present in the validated context" });
  }
}

export const HighDefensePlanRequestSchema = z.object({
  context: AgentContextV1Schema,
  projectId: projectIdSchema,
  project: projectEvidenceSchema,
}).superRefine((input, ctx) => {
  if (input.context.stage !== "high_school") {
    ctx.addIssue({ code: "custom", path: ["context", "stage"], message: "defense plan requires high-school context" });
  }
  if (input.context.teachingMode !== "defense") {
    ctx.addIssue({ code: "custom", path: ["context", "teachingMode"], message: "defense plan requires teachingMode=defense" });
  }
  checkEvidenceRefs(input.project.evidenceRefs, ctx, input.context, ["project", "evidenceRefs"]);
});

const defenseQuestionSchema = z.object({
  questionId: safeText(160),
  category: z.enum(["research_goal", "data_authorization", "processing", "model_parameters", "metrics", "failure_limitations", "evidence_conclusion"]),
  prompt: safeText(500),
  requiredEvidenceIds: z.array(safeText(160)).max(8),
}).strict();

export const HighDefensePlanResponseSchema = z.object({
  schemaVersion: z.literal(1),
  traceId: safeText(120),
  workflowVersion: z.literal(HIGH_DEFENSE_PLAN_WORKFLOW_VERSION),
  resultType: z.literal("defense_plan"),
  contentVersion: safeText(40),
  sourceIds: z.array(safeText(160)).min(1).max(12),
  payload: z.object({ questions: z.array(defenseQuestionSchema).min(3).max(5) }).strict(),
}).strict();

export const HighDefenseTurnRequestSchema = z.object({
  context: AgentContextV1Schema,
  projectId: projectIdSchema,
  questionId: safeText(160),
  question: safeText(500),
  studentAnswer: safeText(2_000),
  referencedEvidenceIds: z.array(safeText(160)).max(8),
}).superRefine((input, ctx) => {
  if (input.context.stage !== "high_school") {
    ctx.addIssue({ code: "custom", path: ["context", "stage"], message: "defense turn requires high-school context" });
  }
  if (input.context.teachingMode !== "defense") {
    ctx.addIssue({ code: "custom", path: ["context", "teachingMode"], message: "defense turn requires teachingMode=defense" });
  }
  checkEvidenceRefs(input.referencedEvidenceIds, ctx, input.context, ["referencedEvidenceIds"]);
});

export type AgentContextV1 = z.infer<typeof AgentContextV1Schema>;
export type PrimaryBattleQuestionRequest = z.infer<typeof PrimaryBattleQuestionRequestSchema>;
export type BattleQuestionPayload = z.infer<typeof BattleQuestionPayloadSchema>;
export type BattleQuestionResponse = z.infer<typeof BattleQuestionResponseSchema>;
export type PrimaryBattleFeedbackRequest = z.infer<typeof PrimaryBattleFeedbackRequestSchema>;
export type BattleFeedbackResponse = z.infer<typeof BattleFeedbackResponseSchema>;
export type DialogueRequest = z.infer<typeof DialogueRequestSchema>;
export type TutorGuideRequest = z.infer<typeof TutorGuideRequestSchema>;
export type MiddleLabCoachRequest = z.infer<typeof MiddleLabCoachRequestSchema>;
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;
export type HighDefensePlanRequest = z.infer<typeof HighDefensePlanRequestSchema>;
export type HighDefensePlanResponse = z.infer<typeof HighDefensePlanResponseSchema>;
export type HighDefenseTurnRequest = z.infer<typeof HighDefenseTurnRequestSchema>;

export function parseBattleQuestionResponse(input: unknown) {
  const result = BattleQuestionResponseSchema.safeParse(input);
  if (result.success) return { ok: true as const, value: result.data };
  return {
    ok: false as const,
    reason: "DIFY_INVALID_STRUCTURED_OUTPUT" as const,
    issues: result.error.issues,
  };
}
