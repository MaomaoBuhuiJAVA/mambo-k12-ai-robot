import type { LearningPathStage, LearningActivity } from "./learning-paths";
import {
  getActivity,
  isActivityUnlocked,
} from "./learning-paths";
import { getCourseById } from "./curriculum";
import {
  getCourseLesson,
  getStructuredCourse,
  type CourseLesson,
} from "./course-structure";
import {
  getHighSchoolRemediationActivity,
} from "@/features/quiz/high-school-remediation";
import {
  isKnownPracticeSetId,
  practiceSetIdForCourse,
} from "@/features/learning-hub/practice-data";
import {
  getProjectDefinition,
  isProjectId,
  type ProjectId,
} from "@/features/projects/project-schema";
import {
  isGradeForStage,
  getLearningGrade,
  parseLearningGrade,
  type LearningGradeId,
} from "./learning-grades";

export type LearningRoutePage =
  | "hub"
  | "course"
  | "lesson"
  | "tutor"
  | "practice"
  | "project";

export type LearningRouteView = "path" | "courses" | "practice" | "profile";

export interface LearningRouteInput {
  page: LearningRoutePage;
  stage?: string;
  grade?: string;
  view?: string;
  courseId?: string;
  lessonId?: string;
  activityId?: string;
  practiceSetId?: string;
  remediationActivityId?: string;
  projectId?: string;
  // Lab query fields are deliberately accepted so non-lab routes cannot
  // accidentally render a course route with an experiment contract attached.
  templateId?: string;
  mode?: string;
}

export interface LearningRouteOptions {
  /**
   * Server callers normally omit browser-only evidence.  Supplying it makes
   * the resolver useful for deep-link tests and locked-entry screens without
   * coupling route parsing to localStorage.
   */
  completedActivityIds?: readonly string[];
}

export interface LearningRouteReady {
  kind: "ready";
  page: LearningRoutePage;
  canonicalPath: string;
  stage?: LearningPathStage;
  grade?: LearningGradeId;
  view?: LearningRouteView;
  courseId?: string;
  lessonId?: string;
  activityId?: string;
  practiceSetId?: string;
  projectId?: ProjectId;
}

export interface LearningRouteLocked extends Omit<LearningRouteReady, "kind"> {
  kind: "locked";
  missingEvidenceIds: string[];
}

export interface LearningRouteRedirect {
  kind: "redirect";
  canonicalPath: string;
  reason: "legacy" | "invalid" | "cross_stage";
}

export type LearningRouteResult =
  | LearningRouteReady
  | LearningRouteLocked
  | LearningRouteRedirect;

const STAGES: readonly LearningPathStage[] = ["middle_school", "high_school"];
const VIEWS: readonly LearningRouteView[] = ["path", "courses", "practice", "profile"];

const PROJECT_ACTIVITY_IDS: Readonly<Record<ProjectId, readonly string[]>> = {
  "model-audit": ["high-image-model-audit-project", "high-image-model-audit-defense"],
  capstone: ["high-capstone-project", "high-capstone-defense"],
};

function parseStage(value: string | undefined): LearningPathStage | undefined {
  return STAGES.find((stage) => stage === value);
}

function parseView(value: string | undefined): LearningRouteView | undefined {
  return VIEWS.find((view) => view === value);
}

function stageFallback(stage: LearningPathStage | undefined, grade?: LearningGradeId): string {
  const params = new URLSearchParams();
  params.set("stage", stage ?? "middle_school");
  if (stage === "middle_school" || stage === undefined) {
    params.set("grade", grade ?? "middle_1");
    params.set("view", "courses");
  } else {
    if (grade) params.set("grade", grade);
    params.set("view", "path");
  }
  return `/learn?${params.toString()}`;
}

function redirect(
  stage: LearningPathStage | undefined,
  reason: LearningRouteRedirect["reason"],
): LearningRouteRedirect {
  return { kind: "redirect", canonicalPath: stageFallback(stage), reason };
}

function hasUnsupportedScope(input: LearningRouteInput, allowed: readonly string[]): boolean {
  const fields: Array<[string, unknown]> = [
    ["grade", input.grade],
    ["courseId", input.courseId],
    ["lessonId", input.lessonId],
    ["activityId", input.activityId],
    ["practiceSetId", input.practiceSetId],
    ["remediationActivityId", input.remediationActivityId],
    ["projectId", input.projectId],
    ["templateId", input.templateId],
    ["mode", input.mode],
  ];
  return fields.some(([field, value]) => value !== undefined && !allowed.includes(field));
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function lessonPath(
  page: "lesson" | "tutor",
  lessonId: string,
  activityId?: string,
  stage?: LearningPathStage,
  grade?: LearningGradeId,
): string {
  const base = `/learn/${page}/${encodePathSegment(lessonId)}`;
  const query = new URLSearchParams();
  if (stage) query.set("stage", stage);
  if (grade) query.set("grade", grade);
  if (activityId) query.set("activity", activityId);
  const suffix = query.toString();
  return suffix ? `${base}?${suffix}` : base;
}

function practicePath(
  stage: LearningPathStage,
  practiceSetId: string,
  remediationActivityId?: string,
  grade?: LearningGradeId,
): string {
  const query = new URLSearchParams({ stage });
  if (grade) query.set("grade", grade);
  if (remediationActivityId) query.set("remediation", remediationActivityId);
  return `/learn/practice/${encodePathSegment(practiceSetId)}?${query.toString()}`;
}

function lockedResult(
  ready: LearningRouteReady,
  activity: LearningActivity,
  completedActivityIds: readonly string[],
): LearningRouteLocked {
  const completed = new Set(completedActivityIds);
  return {
    ...ready,
    kind: "locked",
    missingEvidenceIds: activity.prerequisites.filter((id) => !completed.has(id)),
  };
}

function findStageForPracticeSet(practiceSetId: string): LearningPathStage | undefined {
  for (const stage of STAGES) {
    if (isKnownPracticeSetId(stage, practiceSetId)) return stage;
  }
  return undefined;
}

function resolveHub(input: LearningRouteInput): LearningRouteResult {
  if (hasUnsupportedScope(input, ["grade"])) return redirect(undefined, "invalid");
  const explicitStage = parseStage(input.stage);
  if (input.stage !== undefined && !explicitStage) return redirect(undefined, "invalid");
  const grade = parseLearningGrade(input.grade);
  if (input.grade !== undefined && !grade) return redirect(explicitStage, "invalid");
  if (grade && !isGradeForStage(grade, explicitStage)) return redirect(explicitStage, "cross_stage");
  const stage = explicitStage ?? (grade ? getLearningGradeStage(grade) : undefined);
  const view = parseView(input.view);
  if (input.view !== undefined && !view) return redirect(stage, "invalid");
  const resolvedView = view ?? "path";
  const params = new URLSearchParams();
  if (stage) params.set("stage", stage);
  if (grade) params.set("grade", grade);
  params.set("view", resolvedView);
  return {
    kind: "ready",
    page: "hub",
    canonicalPath: `/learn?${params.toString()}`,
    stage,
    ...(grade ? { grade } : {}),
    view: resolvedView,
  };
}

function getLearningGradeStage(grade: LearningGradeId): LearningPathStage {
  return grade.startsWith("middle_") ? "middle_school" : "high_school";
}

function resolveCourse(input: LearningRouteInput): LearningRouteResult {
  if (hasUnsupportedScope(input, ["stage", "grade", "courseId"])) return redirect(parseStage(input.stage), "invalid");
  const explicitStage = parseStage(input.stage);
  if (input.stage !== undefined && !explicitStage) return redirect(undefined, "invalid");
  const grade = parseLearningGrade(input.grade);
  if (input.grade !== undefined && !grade) return redirect(explicitStage, "invalid");
  if (grade && !isGradeForStage(grade, explicitStage)) return redirect(explicitStage, "cross_stage");
  const stage = explicitStage ?? (grade ? getLearningGradeStage(grade) : undefined);
  if (!input.courseId) return redirect(stage, "invalid");
  const course = getStructuredCourse(input.courseId);
  if (!course) return redirect(stage, "invalid");
  if (stage && course.stage !== stage) return redirect(stage, "cross_stage");
  if (grade && !getLearningGrade(grade).courseIds.includes(course.course.id)) {
    return redirect(stage ?? course.stage, "invalid");
  }
  const query = new URLSearchParams();
  if (stage) query.set("stage", stage);
  if (grade) query.set("grade", grade);
  const queryString = query.toString();
  const canonicalPath = `/learn/course/${encodePathSegment(course.course.id)}${queryString ? `?${queryString}` : ""}`;
  return {
    kind: "ready",
    page: "course",
    canonicalPath,
    stage: course.stage,
    ...(grade ? { grade } : {}),
    courseId: course.course.id,
  };
}

function resolveLesson(
  input: LearningRouteInput,
  options: LearningRouteOptions,
): LearningRouteResult {
  if (hasUnsupportedScope(input, ["stage", "grade", "lessonId", "activityId"])) {
    return redirect(parseStage(input.stage), "invalid");
  }
  const explicitStage = parseStage(input.stage);
  if (input.stage !== undefined && !explicitStage) return redirect(undefined, "invalid");
  const grade = parseLearningGrade(input.grade);
  if (input.grade !== undefined && !grade) return redirect(explicitStage, "invalid");
  if (grade && !isGradeForStage(grade, explicitStage)) return redirect(explicitStage, "cross_stage");
  const stage = explicitStage ?? (grade ? getLearningGradeStage(grade) : undefined);
  if (!input.lessonId) return redirect(stage, "invalid");
  const lesson = getCourseLesson(input.lessonId);
  if (!lesson) return redirect(stage, "invalid");
  const course = getStructuredCourse(lesson.courseId);
  if (!course) return redirect(stage, "invalid");
  if (stage && stage !== course.stage) return redirect(stage, "cross_stage");
  if (grade && !getLearningGrade(grade).courseIds.includes(course.course.id)) {
    return redirect(stage ?? course.stage, "invalid");
  }

  let activity: LearningActivity | undefined;
  if (input.activityId !== undefined) {
    activity = getActivity(input.activityId);
    if (!activity) return redirect(course.stage, "invalid");
    if (activity.courseId !== course.course.id || !lesson.activityIds.includes(activity.id)) {
      return redirect(course.stage, activity.stage !== course.stage ? "cross_stage" : "invalid");
    }
  }

  const ready: LearningRouteReady = {
    kind: "ready",
    page: input.page,
    canonicalPath: lessonPath(
      input.page as "lesson" | "tutor",
      lesson.id,
      activity?.id,
      grade || input.stage !== undefined ? course.stage : undefined,
      grade,
    ),
    stage: course.stage,
    ...(grade ? { grade } : {}),
    courseId: course.course.id,
    lessonId: lesson.id,
    ...(activity ? { activityId: activity.id } : {}),
  };
  if (activity && options.completedActivityIds) {
    if (!isActivityUnlocked(activity.id, options.completedActivityIds)) {
      return lockedResult(ready, activity, options.completedActivityIds);
    }
  }
  return ready;
}

function resolvePractice(input: LearningRouteInput): LearningRouteResult {
  if (hasUnsupportedScope(input, ["stage", "grade", "practiceSetId", "remediationActivityId"])) {
    return redirect(parseStage(input.stage), "invalid");
  }
  const explicitStage = parseStage(input.stage);
  if (input.stage !== undefined && !explicitStage) return redirect(undefined, "invalid");
  const grade = parseLearningGrade(input.grade);
  if (input.grade !== undefined && !grade) return redirect(explicitStage, "invalid");
  if (grade && !isGradeForStage(grade, explicitStage)) return redirect(explicitStage, "cross_stage");
  if (!input.practiceSetId) return redirect(explicitStage, "invalid");
  const inferredStage = findStageForPracticeSet(input.practiceSetId);
  if (!inferredStage) return redirect(explicitStage, "invalid");
  if (explicitStage && explicitStage !== inferredStage) return redirect(explicitStage, "cross_stage");
  const stage = explicitStage ?? inferredStage;
  if (grade && stage !== getLearningGradeStage(grade)) return redirect(stage, "cross_stage");
  if (!isKnownPracticeSetId(stage, input.practiceSetId)) return redirect(stage, "invalid");

  const isCourseSet = input.practiceSetId.startsWith("course--");
  const courseId = isCourseSet ? input.practiceSetId.slice("course--".length) : undefined;
  const course = courseId ? getCourseById(courseId) : undefined;
  if (isCourseSet && (!course || course.stage !== stage)) return redirect(stage, "cross_stage");
  if (isCourseSet && grade && course && !getLearningGrade(grade).courseIds.includes(course.id)) {
    return redirect(stage, "invalid");
  }

  const remediationId = input.remediationActivityId;
  if (remediationId !== undefined) {
    if (!isCourseSet || stage !== "high_school") return redirect(stage, "invalid");
    const remediation = getHighSchoolRemediationActivity(remediationId);
    if (!remediation) return redirect(stage, "invalid");
    if (remediation.courseId !== courseId) return redirect(stage, "invalid");
  }

  return {
    kind: "ready",
    page: "practice",
    canonicalPath: practicePath(stage, input.practiceSetId, remediationId, grade),
    stage,
    ...(grade ? { grade } : {}),
    courseId,
    practiceSetId: input.practiceSetId,
    ...(remediationId ? { activityId: remediationId } : {}),
  };
}

function resolveProject(
  input: LearningRouteInput,
  options: LearningRouteOptions,
): LearningRouteResult {
  if (hasUnsupportedScope(input, ["projectId", "activityId"])) {
    return redirect(parseStage(input.stage), "invalid");
  }
  const stage = parseStage(input.stage);
  if (input.stage !== undefined && !stage) return redirect(undefined, "invalid");
  if (!input.projectId || !isProjectId(input.projectId) || !getProjectDefinition(input.projectId)) {
    return redirect("high_school", "invalid");
  }
  if (stage && stage !== "high_school") return redirect(stage, "cross_stage");
  const projectId = input.projectId;
  const allowedActivityIds = PROJECT_ACTIVITY_IDS[projectId];
  let activity: LearningActivity | undefined;
  if (input.activityId !== undefined) {
    activity = getActivity(input.activityId);
    if (!activity) return redirect("high_school", "invalid");
    if (!allowedActivityIds.includes(activity.id)) {
      return redirect("high_school", activity.stage !== "high_school" ? "cross_stage" : "invalid");
    }
  }
  const entryActivity = getActivity(allowedActivityIds[0]);
  const ready: LearningRouteReady = {
    kind: "ready",
    page: "project",
    canonicalPath: `/learn/project/${encodePathSegment(projectId)}`,
    stage: "high_school",
    projectId,
    ...(activity ? { activityId: activity.id } : {}),
  };
  if (entryActivity && options.completedActivityIds && !isActivityUnlocked(entryActivity.id, options.completedActivityIds)) {
    return lockedResult(ready, entryActivity, options.completedActivityIds);
  }
  return ready;
}

/**
 * Resolve every non-lab learning deep link before a page renders.  The page
 * adapters only translate a redirect result into Next's navigation boundary;
 * all stage, ID and activity relationships remain testable as a pure function.
 */
export function resolveLearningRoute(
  input: LearningRouteInput,
  options: LearningRouteOptions = {},
): LearningRouteResult {
  switch (input.page) {
    case "hub":
      return resolveHub(input);
    case "course":
      return resolveCourse(input);
    case "lesson":
    case "tutor":
      return resolveLesson(input, options);
    case "practice":
      return resolvePractice(input);
    case "project":
      return resolveProject(input, options);
  }
}

/** Return the canonical destination for a legacy high-school project URL. */
export function resolveLegacyHighProject(
  projectId: string,
  stage?: string,
  activityId?: string,
  templateId?: string,
  mode?: string,
): LearningRouteResult {
  const route = resolveLearningRoute({ page: "project", projectId, stage, activityId, templateId, mode });
  if (route.kind === "redirect") return route;
  return {
    kind: "redirect",
    canonicalPath: route.canonicalPath,
    reason: "legacy",
  };
}

/** Useful to route adapters that need to validate an already-loaded lesson. */
export function isLessonForCourse(lesson: CourseLesson, courseId: string): boolean {
  return lesson.courseId === courseId;
}

export { practiceSetIdForCourse };
