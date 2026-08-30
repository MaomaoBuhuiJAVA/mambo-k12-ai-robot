import { getCourseById } from "@/data/curriculum";
import { getCourseLesson, getCourseLessonForActivity, getStructuredCourse } from "@/data/course-structure";
import { getActivity, getLearningPath } from "@/data/learning-paths";
import { getLabTemplate } from "@/features/lab/lab-templates";

export const TUTOR_PROTOCOL_VERSION = 1 as const;

export const SLIDE_TYPES = [
  "title",
  "learning_objectives",
  "concept",
  "comparison",
  "process",
  "code_walkthrough",
  "data_table",
  "chart",
  "image_focus",
  "checkpoint",
  "summary",
] as const;

export const TUTOR_EVALUATION_POLICY_IDS = [
  "single-choice-v1",
  "prediction-v1",
  "short-answer-required-v1",
  "code-observation-required-v1",
] as const;

export type SlideType = typeof SLIDE_TYPES[number];
export type TutorStage = "middle_school" | "high_school";
export type TutorTeachingMode =
  | "self_study"
  | "ai_tutor"
  | "practice"
  | "lab"
  | "project"
  | "defense";
export type EvidenceKind = "quiz" | "code_test" | "experiment" | "project";
export type TutorInteractionKind =
  | "single_choice"
  | "prediction"
  | "short_answer"
  | "code_observation";

const EVALUATION_POLICY_BY_KIND: Record<TutorInteractionKind, string> = {
  single_choice: "single-choice-v1",
  prediction: "prediction-v1",
  short_answer: "short-answer-required-v1",
  code_observation: "code-observation-required-v1",
};

export interface LearningContextV2 {
  schemaVersion: 2;
  traceId: string;
  anonymousLearnerId: string;
  stage: TutorStage;
  grade: number | null;
  courseId: string;
  unitId: string;
  lessonId: string;
  activityId: string;
  teachingMode: TutorTeachingMode;
  knowledgePointIds: string[];
  masterySummary: Array<{
    knowledgePointId: string;
    level: number;
    evidenceCount: number;
  }>;
  misconceptionTags: string[];
  recentEvidenceSummary: Array<{
    evidenceId: string;
    kind: EvidenceKind;
    resultCode: string;
    metricSummary?: Record<string, number>;
  }>;
  allowedActionIds: string[];
  presentationState?: {
    sessionId: string;
    currentSlideId: string | null;
    completedSlideIds: string[];
  };
}

export type SlideBlock =
  | { kind: "text"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "code"; language: "python"; code: string; highlightLines: number[] }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "chart"; chartId: string; dataRef: string }
  | { kind: "asset"; assetId: string; alt: string };

export interface PresentationPlanV1 {
  schemaVersion: 1;
  planId: string;
  courseId: string;
  lessonId: string;
  title: string;
  objectiveIds: string[];
  estimatedMinutes: number;
  slideOutline: Array<{
    slideId: string;
    type: SlideType;
    knowledgePointIds: string[];
  }>;
}

export interface SlideSpecV1 {
  schemaVersion: 1;
  slideId: string;
  type: SlideType;
  title: string;
  blocks: SlideBlock[];
  knowledgePointIds: string[];
  sourceIds: string[];
}

export interface NarrationSegmentV1 {
  schemaVersion: 1;
  segmentId: string;
  slideId: string;
  text: string;
  order: number;
  interactionAfter?: string;
}

export interface TutorInteractionV1 {
  schemaVersion: 1;
  interactionId: string;
  slideId: string;
  kind: TutorInteractionKind;
  prompt: string;
  allowedResponseFormat: "option_id" | "short_text";
  evaluationPolicyId: string;
}

export interface TutorSummaryV1 {
  schemaVersion: 1;
  summaryId: string;
  highlights: string[];
  nextActivityId: string | null;
}

export type TutorProtocolEvent =
  | { schemaVersion: 1; type: "session.started"; sessionId: string; traceId: string }
  | { schemaVersion: 1; type: "plan.ready"; sessionId: string; traceId: string; plan: PresentationPlanV1 }
  | { schemaVersion: 1; type: "slide.ready"; sessionId: string; traceId: string; slide: SlideSpecV1 }
  | { schemaVersion: 1; type: "narration.delta"; sessionId: string; traceId: string; slideId: string; text: string }
  | { schemaVersion: 1; type: "narration.segment"; sessionId: string; traceId: string; segment: NarrationSegmentV1 }
  | { schemaVersion: 1; type: "interaction.ready"; sessionId: string; traceId: string; interaction: TutorInteractionV1 }
  | { schemaVersion: 1; type: "session.completed"; sessionId: string; traceId: string; summary: TutorSummaryV1 }
  | { schemaVersion: 1; type: "session.degraded"; sessionId: string; traceId: string; reasonCode: string };

export interface TutorProtocolWhitelist {
  courseIds?: readonly string[];
  lessonIds?: readonly string[];
  objectiveIds?: readonly string[];
  knowledgePointIds?: readonly string[];
  sourceIds?: readonly string[];
  assetIds?: readonly string[];
  chartIds?: readonly string[];
  dataRefs?: readonly string[];
  actionIds?: readonly string[];
  evaluationPolicyIds?: readonly string[];
  slideIds?: readonly string[];
  interactionIds?: readonly string[];
}

export interface ProtocolIssue {
  path: string;
  message: string;
}

export type ProtocolResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ProtocolIssue[] };

const MAX = {
  id: 160,
  traceId: 128,
  title: 240,
  text: 4000,
  shortText: 800,
  list: 32,
  bullets: 16,
  tableColumns: 16,
  tableRows: 48,
  tableCells: 64,
  code: 5000,
  sources: 24,
  metrics: 24,
  slides: 12,
  masteryRecords: 32,
  evidenceCount: 1000000,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(issues: ProtocolIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function readString(
  value: unknown,
  path: string,
  issues: ProtocolIssue[],
  maxLength: number = MAX.text,
): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    issue(issues, path, "must be a non-empty string");
    return null;
  }
  if (value.length > maxLength) issue(issues, path, `must be at most ${maxLength} characters`);
  return value;
}

function readStringArray(
  value: unknown,
  path: string,
  issues: ProtocolIssue[],
  maxItems: number = MAX.list,
  itemMaxLength: number = MAX.id,
): string[] {
  if (!Array.isArray(value)) {
    issue(issues, path, "must be an array");
    return [];
  }
  if (value.length > maxItems) issue(issues, path, `must contain at most ${maxItems} items`);
  return value.flatMap((item, index) => {
    const parsed = readString(item, `${path}[${index}]`, issues, itemMaxLength);
    return parsed ? [parsed] : [];
  });
}

function readFiniteNumber(value: unknown, path: string, issues: ProtocolIssue[]): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issue(issues, path, "must be a finite number");
    return null;
  }
  return value;
}

function readEnum<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  issues: ProtocolIssue[],
): T | null {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    issue(issues, path, `must be one of: ${allowed.join(", ")}`);
    return null;
  }
  return value as T;
}

function checkKnownIds(
  values: readonly string[],
  path: string,
  allowed: readonly string[] | undefined,
  issues: ProtocolIssue[],
): void {
  if (!allowed) return;
  const allowedSet = new Set(allowed);
  values.forEach((value, index) => {
    if (!allowedSet.has(value)) issue(issues, `${path}[${index}]`, "is not in the application whitelist");
  });
}

function checkRequiredKnownIds(
  values: readonly string[],
  path: string,
  allowed: readonly string[] | undefined,
  issues: ProtocolIssue[],
): void {
  if (values.length === 0) return;
  if (!allowed) {
    issue(issues, path, "requires the current application whitelist");
    return;
  }
  checkKnownIds(values, path, allowed, issues);
}

function checkUniqueIds(values: readonly string[], path: string, issues: ProtocolIssue[]): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) issue(issues, `${path}[${index}]`, "must not contain duplicate IDs");
    seen.add(value);
  });
}

function knownKnowledgePointIds(stage: TutorStage, courseId: string, lessonId?: string, activityId?: string): Set<string> {
  const course = getCourseById(courseId);
  if (!course) return new Set();
  const ids = new Set([
    ...course.knowledgePointTags.map((tag) => `${courseId}:${tag}`),
  ]);
  const lesson = lessonId ? getCourseLesson(lessonId) : undefined;
  if (lesson?.courseId === courseId) {
    lesson.knowledgePointTags.forEach((tag) => {
      ids.add(`${courseId}:${tag}`);
    });
  }
  getLearningPath(stage).forEach((activity) => {
    if (activity.courseId !== courseId || activity.labTemplateId === undefined) return;
    ids.add(getLabTemplate(activity.labTemplateId).knowledgePointId);
  });
  const activity = activityId ? getActivity(activityId) : undefined;
  if (activity?.courseId === courseId && activity.labTemplateId !== undefined) {
    ids.add(getLabTemplate(activity.labTemplateId).knowledgePointId);
  }
  return ids;
}

function knownStageKnowledgePointIds(stage: TutorStage): Set<string> {
  const ids = new Set<string>();
  getLearningPath(stage).forEach((activity) => {
    const course = getCourseById(activity.courseId);
    if (!course) return;
    course.knowledgePointTags.forEach((tag) => ids.add(`${course.id}:${tag}`));
    if (activity.labTemplateId !== undefined) ids.add(getLabTemplate(activity.labTemplateId).knowledgePointId);
  });
  return ids;
}

function knownObjectiveIds(courseId: string): Set<string> {
  const course = getCourseById(courseId);
  return new Set(course?.objectives.map((_, index) => `${courseId}:objective:${index + 1}`) ?? []);
}

function validateMetricSummary(
  value: unknown,
  path: string,
  issues: ProtocolIssue[],
): Record<string, number> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issue(issues, path, "must be an object");
    return undefined;
  }
  const entries = Object.entries(value);
  if (entries.length > MAX.metrics) issue(issues, path, `must contain at most ${MAX.metrics} metrics`);
  const output: Record<string, number> = {};
  entries.slice(0, MAX.metrics).forEach(([key, metric]) => {
    if (key.length > MAX.id || key.trim().length === 0) issue(issues, `${path}.${key}`, "has an invalid metric name");
    const parsed = readFiniteNumber(metric, `${path}.${key}`, issues);
    if (parsed !== null) output[key] = parsed;
  });
  return output;
}

function validateEvidenceSummary(
  value: unknown,
  path: string,
  issues: ProtocolIssue[],
): LearningContextV2["recentEvidenceSummary"] {
  if (!Array.isArray(value)) {
    issue(issues, path, "must be an array");
    return [];
  }
  if (value.length > MAX.list) issue(issues, path, `must contain at most ${MAX.list} items`);
  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      issue(issues, `${path}[${index}]`, "must be an object");
      return [];
    }
    const evidenceId = readString(item.evidenceId, `${path}[${index}].evidenceId`, issues, MAX.id);
    const kind = readEnum(item.kind, `${path}[${index}].kind`, ["quiz", "code_test", "experiment", "project"], issues);
    const resultCode = readString(item.resultCode, `${path}[${index}].resultCode`, issues, MAX.shortText);
    const metricSummary = validateMetricSummary(item.metricSummary, `${path}[${index}].metricSummary`, issues);
    if (!evidenceId || !kind || !resultCode) return [];
    return [{ evidenceId, kind, resultCode, ...(metricSummary ? { metricSummary } : {}) }];
  });
}

export function validateLearningContextV2(
  input: unknown,
  whitelist?: TutorProtocolWhitelist,
): ProtocolResult<LearningContextV2> {
  const issues: ProtocolIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", message: "must be an object" }] };

  if (input.schemaVersion !== 2) issue(issues, "schemaVersion", "must equal 2");
  const traceId = readString(input.traceId, "traceId", issues, MAX.traceId);
  const anonymousLearnerId = readString(input.anonymousLearnerId, "anonymousLearnerId", issues, MAX.id);
  const stage = readEnum(input.stage, "stage", ["middle_school", "high_school"], issues);
  const gradeValue = input.grade;
  const grade = gradeValue === null
    ? null
    : typeof gradeValue === "number" && Number.isInteger(gradeValue) && gradeValue >= 7 && gradeValue <= 12
      ? gradeValue
      : (issue(issues, "grade", "must be null or an integer from 7 to 12"), null);
  const courseId = readString(input.courseId, "courseId", issues, MAX.id);
  const unitId = readString(input.unitId, "unitId", issues, MAX.id);
  const lessonId = readString(input.lessonId, "lessonId", issues, MAX.id);
  const activityId = readString(input.activityId, "activityId", issues, MAX.id);
  const teachingMode = readEnum(input.teachingMode, "teachingMode", ["self_study", "ai_tutor", "practice", "lab", "project", "defense"], issues);
  const knowledgePointIds = readStringArray(input.knowledgePointIds, "knowledgePointIds", issues, MAX.list, MAX.id);
  const misconceptionTags = readStringArray(input.misconceptionTags, "misconceptionTags", issues, MAX.list, MAX.shortText);
  const masterySummary = Array.isArray(input.masterySummary)
    ? input.masterySummary.slice(0, MAX.masteryRecords).flatMap((item, index) => {
      if (!isRecord(item)) {
        issue(issues, `masterySummary[${index}]`, "must be an object");
        return [];
      }
      const knowledgePointId = readString(item.knowledgePointId, `masterySummary[${index}].knowledgePointId`, issues, MAX.id);
      const level = readFiniteNumber(item.level, `masterySummary[${index}].level`, issues);
      const evidenceCount = item.evidenceCount;
      if (!Number.isInteger(evidenceCount) || (evidenceCount as number) < 0 || (evidenceCount as number) > MAX.evidenceCount) {
        issue(issues, `masterySummary[${index}].evidenceCount`, `must be an integer from 0 to ${MAX.evidenceCount}`);
      }
      if (!knowledgePointId || level === null || !Number.isInteger(evidenceCount) || (evidenceCount as number) < 0) return [];
      if (level < 0 || level > 1) issue(issues, `masterySummary[${index}].level`, "must be between 0 and 1");
      return [{ knowledgePointId, level, evidenceCount: evidenceCount as number }];
    })
    : (issue(issues, "masterySummary", "must be an array"), []);
  if (Array.isArray(input.masterySummary) && input.masterySummary.length > MAX.masteryRecords) {
    issue(issues, "masterySummary", `must contain at most ${MAX.masteryRecords} items`);
  }
  checkUniqueIds(masterySummary.map((item) => item.knowledgePointId), "masterySummary", issues);
  const recentEvidenceSummary = validateEvidenceSummary(input.recentEvidenceSummary, "recentEvidenceSummary", issues);
  const allowedActionIds = readStringArray(input.allowedActionIds, "allowedActionIds", issues, MAX.list, MAX.id);
  checkUniqueIds(knowledgePointIds, "knowledgePointIds", issues);
  checkUniqueIds(allowedActionIds, "allowedActionIds", issues);

  const course = courseId ? getCourseById(courseId) : undefined;
  const lesson = lessonId ? getCourseLesson(lessonId) : undefined;
  const structuredCourse = courseId ? getStructuredCourse(courseId) : undefined;
  const activity = activityId ? getActivity(activityId) : undefined;
  if (!course) issue(issues, "courseId", "is not a configured course");
  if (course && stage && course.stage !== stage) issue(issues, "stage", "does not match courseId");
  if (!structuredCourse) issue(issues, "courseId", "does not have a structured course");
  if (!lesson) issue(issues, "lessonId", "is not a configured lesson");
  if (lesson && courseId && lesson.courseId !== courseId) issue(issues, "lessonId", "does not belong to courseId");
  if (lesson && unitId !== lesson.unitId) issue(issues, "unitId", "does not match lessonId");
  if (!activity) issue(issues, "activityId", "is not a configured activity");
  if (activity && stage && activity.stage !== stage) issue(issues, "activityId", "does not match stage");
  if (activity && courseId && activity.courseId !== courseId) issue(issues, "activityId", "does not belong to courseId");
  if (activity && lesson && getCourseLessonForActivity(activity.id)?.id !== lesson.id) issue(issues, "activityId", "does not belong to lessonId");

  if (courseId && stage) {
    const knownPoints = knownKnowledgePointIds(stage, courseId, lessonId ?? undefined, activityId ?? undefined);
    const knownStagePoints = knownStageKnowledgePointIds(stage);
    knowledgePointIds.forEach((value, index) => {
      if (!knownPoints.has(value)) issue(issues, `knowledgePointIds[${index}]`, "is not a configured course knowledge point");
    });
    masterySummary.forEach((item, index) => {
      if (!knownStagePoints.has(item.knowledgePointId)) issue(issues, `masterySummary[${index}].knowledgePointId`, "is not a configured stage knowledge point");
    });
  }
  if (!whitelist?.actionIds) {
    issue(issues, "allowedActionIds", "requires the current application candidate whitelist");
  } else {
    checkKnownIds(allowedActionIds, "allowedActionIds", whitelist.actionIds, issues);
  }
  checkRequiredKnownIds(knowledgePointIds, "knowledgePointIds", whitelist?.knowledgePointIds, issues);

  let presentationState: LearningContextV2["presentationState"];
  if (input.presentationState !== undefined) {
    if (!isRecord(input.presentationState)) {
      issue(issues, "presentationState", "must be an object");
    } else {
      const sessionId = readString(input.presentationState.sessionId, "presentationState.sessionId", issues, MAX.id);
      const currentSlideIdValue = input.presentationState.currentSlideId;
      const currentSlideId = currentSlideIdValue === null
        ? null
        : readString(currentSlideIdValue, "presentationState.currentSlideId", issues, MAX.id);
      const completedSlideIds = readStringArray(input.presentationState.completedSlideIds, "presentationState.completedSlideIds", issues, MAX.slides, MAX.id);
      checkUniqueIds(completedSlideIds, "presentationState.completedSlideIds", issues);
      checkRequiredKnownIds(
        currentSlideId === null ? [] : [currentSlideId],
        "presentationState.currentSlideId",
        whitelist?.slideIds,
        issues,
      );
      checkRequiredKnownIds(completedSlideIds, "presentationState.completedSlideIds", whitelist?.slideIds, issues);
      if (sessionId && (currentSlideId !== null || currentSlideIdValue === null)) presentationState = { sessionId, currentSlideId, completedSlideIds };
    }
  }

  if (issues.length > 0 || !traceId || !anonymousLearnerId || !stage || !courseId || !unitId || !lessonId || !activityId || !teachingMode) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      schemaVersion: 2,
      traceId,
      anonymousLearnerId,
      stage,
      grade,
      courseId,
      unitId,
      lessonId,
      activityId,
      teachingMode,
      knowledgePointIds,
      masterySummary,
      misconceptionTags,
      recentEvidenceSummary,
      allowedActionIds,
      ...(presentationState ? { presentationState } : {}),
    },
  };
}

function validateSlideBlock(
  value: unknown,
  path: string,
  issues: ProtocolIssue[],
  whitelist?: TutorProtocolWhitelist,
): SlideBlock | null {
  if (!isRecord(value)) {
    issue(issues, path, "must be an object");
    return null;
  }
  const kind = readEnum(value.kind, `${path}.kind`, ["text", "bullets", "code", "table", "chart", "asset"], issues);
  if (!kind) return null;
  if (kind === "text") {
    const text = readString(value.text, `${path}.text`, issues, MAX.text);
    return text ? { kind, text } : null;
  }
  if (kind === "bullets") {
    const items = readStringArray(value.items, `${path}.items`, issues, MAX.bullets, MAX.shortText);
    return items.length > 0 ? { kind, items } : null;
  }
  if (kind === "code") {
    const language = readEnum(value.language, `${path}.language`, ["python"], issues);
    const code = readString(value.code, `${path}.code`, issues, MAX.code);
    const highlightLines = value.highlightLines;
    if (!Array.isArray(highlightLines)) issue(issues, `${path}.highlightLines`, "must be an array");
    const parsedLines = Array.isArray(highlightLines)
      ? highlightLines.flatMap((line, index) => {
        if (!Number.isInteger(line) || (line as number) < 1) {
          issue(issues, `${path}.highlightLines[${index}]`, "must be a positive integer");
          return [];
        }
        return [line as number];
      })
      : [];
    return language && code ? { kind, language, code, highlightLines: parsedLines } : null;
  }
  if (kind === "table") {
    const columns = readStringArray(value.columns, `${path}.columns`, issues, MAX.tableColumns, MAX.shortText);
    const rowsValue = value.rows;
    if (!Array.isArray(rowsValue)) issue(issues, `${path}.rows`, "must be an array");
    const rows = Array.isArray(rowsValue)
      ? rowsValue.slice(0, MAX.tableRows).flatMap((row, rowIndex) => {
        if (!Array.isArray(row)) {
          issue(issues, `${path}.rows[${rowIndex}]`, "must be an array");
          return [];
        }
        if (row.length > MAX.tableCells) issue(issues, `${path}.rows[${rowIndex}]`, `must contain at most ${MAX.tableCells} cells`);
        return [readStringArray(row.slice(0, MAX.tableCells), `${path}.rows[${rowIndex}]`, issues, MAX.tableCells, MAX.shortText)];
      })
      : [];
    if (Array.isArray(rowsValue) && rowsValue.length > MAX.tableRows) issue(issues, `${path}.rows`, `must contain at most ${MAX.tableRows} rows`);
    return columns.length > 0 ? { kind, columns, rows } : null;
  }
  if (kind === "chart") {
    const chartId = readString(value.chartId, `${path}.chartId`, issues, MAX.id);
    const dataRef = readString(value.dataRef, `${path}.dataRef`, issues, MAX.id);
    checkRequiredKnownIds(chartId ? [chartId] : [], `${path}.chartId`, whitelist?.chartIds, issues);
    checkRequiredKnownIds(dataRef ? [dataRef] : [], `${path}.dataRef`, whitelist?.dataRefs, issues);
    return chartId && dataRef ? { kind, chartId, dataRef } : null;
  }
  const assetId = readString(value.assetId, `${path}.assetId`, issues, MAX.id);
  const alt = readString(value.alt, `${path}.alt`, issues, MAX.shortText);
  checkRequiredKnownIds(assetId ? [assetId] : [], `${path}.assetId`, whitelist?.assetIds, issues);
  return assetId && alt ? { kind, assetId, alt } : null;
}

export function validatePresentationPlanV1(
  input: unknown,
  expected?: { courseId?: string; lessonId?: string },
  whitelist?: TutorProtocolWhitelist,
): ProtocolResult<PresentationPlanV1> {
  const issues: ProtocolIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", message: "must be an object" }] };
  if (input.schemaVersion !== 1) issue(issues, "schemaVersion", "must equal 1");
  const planId = readString(input.planId, "planId", issues, MAX.id);
  const courseId = readString(input.courseId, "courseId", issues, MAX.id);
  const lessonId = readString(input.lessonId, "lessonId", issues, MAX.id);
  const title = readString(input.title, "title", issues, MAX.title);
  const objectiveIds = readStringArray(input.objectiveIds, "objectiveIds", issues, MAX.list, MAX.id);
  const estimatedMinutes = readFiniteNumber(input.estimatedMinutes, "estimatedMinutes", issues);
  if (estimatedMinutes !== null && (estimatedMinutes < 1 || estimatedMinutes > 180)) issue(issues, "estimatedMinutes", "must be between 1 and 180");
  if (expected?.courseId && courseId !== expected.courseId) issue(issues, "courseId", "does not match the requested course");
  if (expected?.lessonId && lessonId !== expected.lessonId) issue(issues, "lessonId", "does not match the requested lesson");
  if (courseId && !getCourseById(courseId)) issue(issues, "courseId", "is not a configured course");
  if (lessonId && !getCourseLesson(lessonId)) issue(issues, "lessonId", "is not a configured lesson");
  if (courseId && lessonId && getCourseLesson(lessonId)?.courseId !== courseId) issue(issues, "lessonId", "does not belong to courseId");
  if (courseId) checkKnownIds([courseId], "courseId", whitelist?.courseIds, issues);
  if (lessonId) checkKnownIds([lessonId], "lessonId", whitelist?.lessonIds, issues);
  checkRequiredKnownIds(objectiveIds, "objectiveIds", whitelist?.objectiveIds, issues);
  if (courseId) {
    const objectiveRegistry = knownObjectiveIds(courseId);
    objectiveIds.forEach((objectiveId, index) => {
      if (!objectiveRegistry.has(objectiveId)) issue(issues, `objectiveIds[${index}]`, "is not a configured course objective");
    });
  }
  const outlineValue = input.slideOutline;
  if (!Array.isArray(outlineValue)) issue(issues, "slideOutline", "must be an array");
  const slideOutline = Array.isArray(outlineValue)
    ? outlineValue.slice(0, MAX.slides).flatMap((item, index) => {
      if (!isRecord(item)) {
        issue(issues, `slideOutline[${index}]`, "must be an object");
        return [];
      }
      const slideId = readString(item.slideId, `slideOutline[${index}].slideId`, issues, MAX.id);
      const type = readEnum(item.type, `slideOutline[${index}].type`, SLIDE_TYPES, issues);
      const knowledgePointIds = readStringArray(item.knowledgePointIds, `slideOutline[${index}].knowledgePointIds`, issues, MAX.list, MAX.id);
      checkRequiredKnownIds(knowledgePointIds, `slideOutline[${index}].knowledgePointIds`, whitelist?.knowledgePointIds, issues);
      if (courseId) {
        const course = getCourseById(courseId);
        const knownPoints = course && (course.stage === "middle_school" || course.stage === "high_school")
          ? knownKnowledgePointIds(course.stage, courseId, lessonId ?? undefined)
          : new Set<string>();
        knowledgePointIds.forEach((knowledgePointId, knowledgePointIndex) => {
          if (!knownPoints.has(knowledgePointId)) issue(issues, `slideOutline[${index}].knowledgePointIds[${knowledgePointIndex}]`, "is not a configured lesson knowledge point");
        });
      }
      if (!slideId || !type) return [];
      return [{ slideId, type, knowledgePointIds }];
    })
    : [];
  if (Array.isArray(outlineValue) && outlineValue.length > MAX.slides) issue(issues, "slideOutline", `must contain at most ${MAX.slides} slides`);
  if (Array.isArray(outlineValue) && outlineValue.length < 4) issue(issues, "slideOutline", "must contain at least four slides");
  const outlineIds = slideOutline.map((item) => item.slideId);
  if (new Set(outlineIds).size !== outlineIds.length) issue(issues, "slideOutline", "slide IDs must be unique");
  checkUniqueIds(objectiveIds, "objectiveIds", issues);
  if (issues.length > 0 || !planId || !courseId || !lessonId || !title || estimatedMinutes === null) return { ok: false, issues };
  return { ok: true, value: { schemaVersion: 1, planId, courseId, lessonId, title, objectiveIds, estimatedMinutes, slideOutline } };
}

export function validateSlideSpecV1(
  input: unknown,
  options?: TutorProtocolWhitelist,
): ProtocolResult<SlideSpecV1> {
  const issues: ProtocolIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", message: "must be an object" }] };
  if (input.schemaVersion !== 1) issue(issues, "schemaVersion", "must equal 1");
  const slideId = readString(input.slideId, "slideId", issues, MAX.id);
  const type = readEnum(input.type, "type", SLIDE_TYPES, issues);
  const title = readString(input.title, "title", issues, MAX.title);
  const knowledgePointIds = readStringArray(input.knowledgePointIds, "knowledgePointIds", issues, MAX.list, MAX.id);
  const sourceIds = readStringArray(input.sourceIds, "sourceIds", issues, MAX.sources, MAX.id);
  checkRequiredKnownIds(knowledgePointIds, "knowledgePointIds", options?.knowledgePointIds, issues);
  checkRequiredKnownIds(sourceIds, "sourceIds", options?.sourceIds, issues);
  if (sourceIds.length === 0) issue(issues, "sourceIds", "must contain at least one approved source");
  if (slideId) checkRequiredKnownIds([slideId], "slideId", options?.slideIds, issues);
  checkUniqueIds(knowledgePointIds, "knowledgePointIds", issues);
  checkUniqueIds(sourceIds, "sourceIds", issues);
  const blocksValue = input.blocks;
  if (!Array.isArray(blocksValue)) issue(issues, "blocks", "must be an array");
  const blocks = Array.isArray(blocksValue)
    ? blocksValue.slice(0, MAX.list).flatMap((block, index) => {
      const parsed = validateSlideBlock(block, `blocks[${index}]`, issues, options);
      return parsed ? [parsed] : [];
    })
    : [];
  if (Array.isArray(blocksValue) && blocksValue.length > MAX.list) issue(issues, "blocks", `must contain at most ${MAX.list} blocks`);
  if (blocks.length === 0) issue(issues, "blocks", "must contain at least one valid block");
  if (issues.length > 0 || !slideId || !type || !title) return { ok: false, issues };
  return { ok: true, value: { schemaVersion: 1, slideId, type, title, blocks, knowledgePointIds, sourceIds } };
}

export function validateNarrationSegmentV1(input: unknown, options?: TutorProtocolWhitelist): ProtocolResult<NarrationSegmentV1> {
  const issues: ProtocolIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", message: "must be an object" }] };
  if (input.schemaVersion !== 1) issue(issues, "schemaVersion", "must equal 1");
  const segmentId = readString(input.segmentId, "segmentId", issues, MAX.id);
  const slideId = readString(input.slideId, "slideId", issues, MAX.id);
  const text = readString(input.text, "text", issues, MAX.text);
  const order = input.order;
  if (!Number.isInteger(order) || (order as number) < 0) issue(issues, "order", "must be a non-negative integer");
  const interactionAfter = input.interactionAfter === undefined ? undefined : readString(input.interactionAfter, "interactionAfter", issues, MAX.id);
  if (slideId) checkRequiredKnownIds([slideId], "slideId", options?.slideIds, issues);
  if (interactionAfter) checkRequiredKnownIds([interactionAfter], "interactionAfter", options?.interactionIds, issues);
  if (issues.length > 0 || !segmentId || !slideId || !text || !Number.isInteger(order)) return { ok: false, issues };
  return { ok: true, value: { schemaVersion: 1, segmentId, slideId, text, order: order as number, ...(interactionAfter ? { interactionAfter } : {}) } };
}

export function validateTutorInteractionV1(input: unknown, options?: TutorProtocolWhitelist): ProtocolResult<TutorInteractionV1> {
  const issues: ProtocolIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", message: "must be an object" }] };
  if (input.schemaVersion !== 1) issue(issues, "schemaVersion", "must equal 1");
  const interactionId = readString(input.interactionId, "interactionId", issues, MAX.id);
  const slideId = readString(input.slideId, "slideId", issues, MAX.id);
  const kind = readEnum(input.kind, "kind", ["single_choice", "prediction", "short_answer", "code_observation"], issues);
  const prompt = readString(input.prompt, "prompt", issues, MAX.text);
  const allowedResponseFormat = readEnum(input.allowedResponseFormat, "allowedResponseFormat", ["option_id", "short_text"], issues);
  const evaluationPolicyId = readString(input.evaluationPolicyId, "evaluationPolicyId", issues, MAX.id);
  if (slideId) checkRequiredKnownIds([slideId], "slideId", options?.slideIds, issues);
  if (evaluationPolicyId) {
    const policies = options?.evaluationPolicyIds ?? TUTOR_EVALUATION_POLICY_IDS;
    if (!policies.includes(evaluationPolicyId)) issue(issues, "evaluationPolicyId", "is not an allowed evaluation policy");
  }
  if ((kind === "single_choice" || kind === "prediction") && allowedResponseFormat !== "option_id") issue(issues, "allowedResponseFormat", "must be option_id for choice interactions");
  if ((kind === "short_answer" || kind === "code_observation") && allowedResponseFormat !== "short_text") issue(issues, "allowedResponseFormat", "must be short_text for text interactions");
  if (kind && evaluationPolicyId && evaluationPolicyId !== EVALUATION_POLICY_BY_KIND[kind]) {
    issue(issues, "evaluationPolicyId", "does not match the interaction kind");
  }
  if (issues.length > 0 || !interactionId || !slideId || !kind || !prompt || !allowedResponseFormat || !evaluationPolicyId) return { ok: false, issues };
  return { ok: true, value: { schemaVersion: 1, interactionId, slideId, kind, prompt, allowedResponseFormat, evaluationPolicyId } };
}

export interface TutorSummaryValidationOptions {
  actionIds?: readonly string[];
  stage?: TutorStage;
}

export function validateTutorSummaryV1(
  input: unknown,
  options?: TutorSummaryValidationOptions,
): ProtocolResult<TutorSummaryV1> {
  const issues: ProtocolIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", message: "must be an object" }] };
  if (input.schemaVersion !== 1) issue(issues, "schemaVersion", "must equal 1");
  const summaryId = readString(input.summaryId, "summaryId", issues, MAX.id);
  const highlights = readStringArray(input.highlights, "highlights", issues, MAX.bullets, MAX.shortText);
  const nextActivityId = input.nextActivityId === null ? null : readString(input.nextActivityId, "nextActivityId", issues, MAX.id);
  if (nextActivityId) {
    checkRequiredKnownIds([nextActivityId], "nextActivityId", options?.actionIds, issues);
    const activity = getActivity(nextActivityId);
    if (!activity) issue(issues, "nextActivityId", "is not a configured activity");
    if (activity && options?.stage && activity.stage !== options.stage) issue(issues, "nextActivityId", "does not match the current stage");
  }
  if (issues.length > 0 || !summaryId || highlights.length === 0 || nextActivityId === undefined) return { ok: false, issues };
  return { ok: true, value: { schemaVersion: 1, summaryId, highlights, nextActivityId } };
}

export function validateTutorProtocolEvent(
  input: unknown,
  options?: TutorProtocolWhitelist,
): ProtocolResult<TutorProtocolEvent> {
  const issues: ProtocolIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", message: "must be an object" }] };
  if (input.schemaVersion !== 1) issue(issues, "schemaVersion", "must equal 1");
  const type = readEnum(input.type, "type", ["session.started", "plan.ready", "slide.ready", "narration.delta", "narration.segment", "interaction.ready", "session.completed", "session.degraded"], issues);
  if (!type) return { ok: false, issues };
  const sessionId = readString(input.sessionId, "sessionId", issues, MAX.id);
  const traceId = readString(input.traceId, "traceId", issues, MAX.traceId);
  if (type === "session.started") {
    if (issues.length > 0 || !sessionId || !traceId) return { ok: false, issues };
    return { ok: true, value: { schemaVersion: 1, type, sessionId, traceId } };
  }
  if (type === "plan.ready") {
    const plan = validatePresentationPlanV1(input.plan, undefined, options);
    if (!plan.ok) return plan;
    if (issues.length > 0 || !sessionId || !traceId) return { ok: false, issues };
    return { ok: true, value: { schemaVersion: 1, type, sessionId, traceId, plan: plan.value } };
  }
  if (type === "slide.ready") {
    const slide = validateSlideSpecV1(input.slide, options);
    if (!slide.ok) return slide;
    if (issues.length > 0 || !sessionId || !traceId) return { ok: false, issues };
    return { ok: true, value: { schemaVersion: 1, type, sessionId, traceId, slide: slide.value } };
  }
  if (type === "narration.delta") {
    const slideId = readString(input.slideId, "slideId", issues, MAX.id);
    const text = readString(input.text, "text", issues, MAX.text);
    if (slideId) checkRequiredKnownIds([slideId], "slideId", options?.slideIds, issues);
    if (issues.length > 0 || !sessionId || !traceId || !slideId || !text) return { ok: false, issues };
    return { ok: true, value: { schemaVersion: 1, type, sessionId, traceId, slideId, text } };
  }
  if (type === "narration.segment") {
    const segment = validateNarrationSegmentV1(input.segment, options);
    if (!segment.ok) return segment;
    if (issues.length > 0 || !sessionId || !traceId) return { ok: false, issues };
    return { ok: true, value: { schemaVersion: 1, type, sessionId, traceId, segment: segment.value } };
  }
  if (type === "interaction.ready") {
    const interaction = validateTutorInteractionV1(input.interaction, options);
    if (!interaction.ok) return interaction;
    if (issues.length > 0 || !sessionId || !traceId) return { ok: false, issues };
    return { ok: true, value: { schemaVersion: 1, type, sessionId, traceId, interaction: interaction.value } };
  }
  if (type === "session.completed") {
    const summary = validateTutorSummaryV1(input.summary, { actionIds: options?.actionIds });
    if (!summary.ok) return summary;
    if (issues.length > 0 || !sessionId || !traceId) return { ok: false, issues };
    return { ok: true, value: { schemaVersion: 1, type, sessionId, traceId, summary: summary.value } };
  }
  const reasonCode = readString(input.reasonCode, "reasonCode", issues, MAX.shortText);
  if (issues.length > 0 || !sessionId || !traceId || !reasonCode) return { ok: false, issues };
  return { ok: true, value: { schemaVersion: 1, type, sessionId, traceId, reasonCode } };
}

export interface TutorProtocolStreamConfig {
  expected: {
    traceId: string;
    stage: TutorStage;
    courseId: string;
    lessonId: string;
  };
  whitelist: TutorProtocolWhitelist;
}

export type TutorProtocolStreamPhase = "idle" | "started" | "planned" | "presenting" | "completed" | "degraded";

export interface TutorProtocolStreamState {
  phase: TutorProtocolStreamPhase;
  sessionId: string | null;
  traceId: string | null;
  planId: string | null;
  plan: PresentationPlanV1 | null;
  slideIds: string[];
  readySlideIds: string[];
  interactionIds: string[];
}

export interface TutorProtocolStreamValidator {
  readonly state: TutorProtocolStreamState;
  accept(input: unknown): ProtocolResult<TutorProtocolEvent>;
}

function streamFailure(path: string, message: string): ProtocolResult<never> {
  return { ok: false, issues: [{ path, message }] };
}

function streamHasId(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

export function createTutorProtocolStreamValidator(
  config: TutorProtocolStreamConfig,
): TutorProtocolStreamValidator {
  let current: TutorProtocolStreamState = {
    phase: "idle",
    sessionId: null,
    traceId: null,
    planId: null,
    plan: null,
    slideIds: [],
    readySlideIds: [],
    interactionIds: [],
  };

  const validator: TutorProtocolStreamValidator = {
    get state() {
      return {
        ...current,
        slideIds: [...current.slideIds],
        readySlideIds: [...current.readySlideIds],
        interactionIds: [...current.interactionIds],
      };
    },
    accept(input) {
      const whitelist: TutorProtocolWhitelist = {
        ...config.whitelist,
        slideIds: current.slideIds.length > 0 ? current.slideIds : config.whitelist.slideIds,
      };
      const parsed = validateTutorProtocolEvent(input, whitelist);
      if (!parsed.ok) return parsed;
      const event = parsed.value;

      if (event.type === "session.started") {
        if (current.phase !== "idle") return streamFailure("type", "session.started must be the first event");
        if (event.traceId !== config.expected.traceId) return streamFailure("traceId", "does not match the learning context");
        current = { ...current, phase: "started", sessionId: event.sessionId, traceId: event.traceId };
        return parsed;
      }

      if (current.phase === "idle") return streamFailure("type", "session.started is required before other events");
      if (current.phase === "completed" || current.phase === "degraded") return streamFailure("type", "the session is already terminal");
      if (event.sessionId !== current.sessionId) return streamFailure("sessionId", "does not match session.started");
      if (event.traceId !== current.traceId || event.traceId !== config.expected.traceId) return streamFailure("traceId", "does not match the learning context");

      if (event.type === "plan.ready") {
        if (current.phase !== "started") return streamFailure("type", "plan.ready must follow session.started");
        if (event.plan.courseId !== config.expected.courseId) return streamFailure("plan.courseId", "does not match the learning context");
        if (event.plan.lessonId !== config.expected.lessonId) return streamFailure("plan.lessonId", "does not match the learning context");
        current = {
          ...current,
          phase: "planned",
          planId: event.plan.planId,
          plan: event.plan,
          slideIds: event.plan.slideOutline.map((slide) => slide.slideId),
        };
        return parsed;
      }

      if (event.type === "slide.ready") {
        if (current.phase !== "planned" && current.phase !== "presenting") return streamFailure("type", "slide.ready must follow plan.ready");
        if (!streamHasId(current.slideIds, event.slide.slideId)) return streamFailure("slide.slideId", "is not present in plan.ready");
        if (streamHasId(current.readySlideIds, event.slide.slideId)) return streamFailure("slide.slideId", "was already emitted");
        const outline = current.plan?.slideOutline.find((item) => item.slideId === event.slide.slideId);
        if (!outline) return streamFailure("slide.slideId", "is not present in plan.ready");
        if (outline.type !== event.slide.type) return streamFailure("slide.type", "does not match plan.ready");
        if (event.slide.knowledgePointIds.some((id) => !outline.knowledgePointIds.includes(id))) {
          return streamFailure("slide.knowledgePointIds", "contains a point not declared by plan.ready");
        }
        current = { ...current, phase: "presenting", readySlideIds: [...current.readySlideIds, event.slide.slideId] };
        return parsed;
      }

      if (event.type === "narration.delta") {
        if (current.phase !== "planned" && current.phase !== "presenting") return streamFailure("type", "narration.delta must follow plan.ready");
        if (!streamHasId(current.readySlideIds, event.slideId)) return streamFailure("slideId", "must reference a ready slide");
        return parsed;
      }

      if (event.type === "narration.segment") {
        if (current.phase !== "planned" && current.phase !== "presenting") return streamFailure("type", "narration.segment must follow plan.ready");
        if (!streamHasId(current.readySlideIds, event.segment.slideId)) return streamFailure("segment.slideId", "must reference a ready slide");
        return parsed;
      }

      if (event.type === "interaction.ready") {
        if (current.phase !== "planned" && current.phase !== "presenting") return streamFailure("type", "interaction.ready must follow plan.ready");
        if (!streamHasId(current.readySlideIds, event.interaction.slideId)) return streamFailure("interaction.slideId", "must reference a ready slide");
        if (streamHasId(current.interactionIds, event.interaction.interactionId)) return streamFailure("interaction.interactionId", "was already emitted");
        current = { ...current, interactionIds: [...current.interactionIds, event.interaction.interactionId] };
        return parsed;
      }

      if (event.type === "session.completed") {
        if (current.phase !== "planned" && current.phase !== "presenting") return streamFailure("type", "session.completed must follow plan.ready");
        if (current.readySlideIds.length !== current.slideIds.length) return streamFailure("type", "all plan slides must be ready before session.completed");
        if (event.summary.nextActivityId) {
          const nextActivity = getActivity(event.summary.nextActivityId);
          if (!nextActivity || nextActivity.stage !== config.expected.stage) return streamFailure("summary.nextActivityId", "must be an available activity in the current stage");
        }
        current = { ...current, phase: "completed" };
        return parsed;
      }

      if (event.type === "session.degraded") {
        current = { ...current, phase: "degraded" };
        return parsed;
      }

      return streamFailure("type", "unsupported event");
    },
  };

  return validator;
}

export function intersectAllowedActionIds(
  suggestions: readonly string[],
  allowedActionIds: readonly string[],
): string[] {
  const allowed = new Set(allowedActionIds);
  return [...new Set(suggestions)].filter((actionId) => allowed.has(actionId));
}
