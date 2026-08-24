import type { LabTemplateId } from "@/features/lab/lab-protocol";

import {
  getCourseById,
  type CurriculumCourse,
} from "./curriculum";
import {
  getActivity,
  getLearningPath,
  type LearningActivity,
  type LearningActivityKind,
  type LearningCompletionPolicyId,
  type LearningPathStage,
} from "./learning-paths";
import {
  getStructuredCoursesForStage,
  type StructuredCourse,
} from "./course-structure";

export const COURSE_MANIFEST_SCHEMA_VERSION = 1 as const;

export type CourseManifestReviewStatus = "pending_review" | "reviewed";
export type CourseManifestMappingStatus = "draft" | "mapped" | "reviewed";

export interface CourseManifestActivity {
  activityId: string;
  kind: LearningActivityKind;
  promptIds: string[];
  templateId?: LabTemplateId;
  evaluationPolicyId: LearningCompletionPolicyId;
  remediationActivityIds: string[];
  prerequisiteIds: string[];
}

export interface CourseManifestUnit {
  unitId: string;
  title: string;
  lessons: Array<{
    lessonId: string;
    title: string;
    objectiveIds: string[];
    activityIds: string[];
    estimatedMinutes: number;
  }>;
}

export interface CourseManifest {
  schemaVersion: typeof COURSE_MANIFEST_SCHEMA_VERSION;
  kind: "course" | "project-only";
  courseId: string | null;
  projectId?: "model-audit" | "capstone";
  stage: LearningPathStage;
  gradeRange: { min: 7 | 8 | 9 | 10 | 11 | 12; max: 7 | 8 | 9 | 10 | 11 | 12 };
  title: string;
  summary: string;
  contentVersion: string;
  reviewStatus: CourseManifestReviewStatus;
  mappingStatus: CourseManifestMappingStatus;
  /** Official review gates whether this manifest may participate in unlocks. */
  unlockEligible: boolean;
  route: string;
  completionPolicyId: LearningCompletionPolicyId;
  evidenceSchema: string;
  officialMappings: Array<{
    officialChapterId: string | null;
    officialRequirement: string;
    mappingNote: string;
  }>;
  units: CourseManifestUnit[];
  knowledgePoints: Array<{ id: string; title: string; prerequisiteIds: string[] }>;
  activities: CourseManifestActivity[];
  evidencePolicy: Array<{
    activityId: string;
    kind: "quiz" | "code_test" | "experiment" | "artifact";
    ruleId: string;
  }>;
  sourceIds: string[];
}

const COURSE_COMPLETION_POLICY = "assessment-passed" as const;
const PROJECT_COMPLETION_POLICY = "project-evidence" as const;
const COURSE_SOURCE_PREFIX = "course:";

function gradeRange(stage: LearningPathStage): CourseManifest["gradeRange"] {
  return stage === "middle_school" ? { min: 7, max: 9 } : { min: 10, max: 12 };
}

function objectiveIds(course: CurriculumCourse): string[] {
  return course.objectives.map((_, index) => `${course.id}:objective:${index + 1}`);
}

function promptIds(course: CurriculumCourse, activity: LearningActivity): string[] {
  return activity.kind === "assessment"
    ? course.exercises.map((exercise) => exercise.id)
    : [];
}

function remediationIds(activity: LearningActivity): string[] {
  return getLearningPath(activity.stage)
    .filter((candidate) => candidate.kind === "remediation" && candidate.courseId === activity.courseId)
    .filter((candidate) => candidate.prerequisites.includes(activity.id))
    .map((candidate) => candidate.id);
}

function evidenceKind(activity: LearningActivity): CourseManifest["evidencePolicy"][number]["kind"] {
  if (activity.kind === "assessment") return "quiz";
  if (activity.kind === "guided_lab" || activity.kind === "independent_lab" || activity.kind === "research_challenge") {
    return "experiment";
  }
  if (activity.kind === "project" || activity.kind === "defense") return "artifact";
  return "quiz";
}

function manifestForCourse(structured: StructuredCourse): CourseManifest {
  const course = structured.course;
  const activities = getLearningPath(structured.stage)
    .filter((activity) => activity.courseId === course.id)
    .map((activity): CourseManifestActivity => ({
      activityId: activity.id,
      kind: activity.kind,
      promptIds: promptIds(course, activity),
      ...(activity.labTemplateId ? { templateId: activity.labTemplateId } : {}),
      evaluationPolicyId: activity.completionPolicyId,
      remediationActivityIds: remediationIds(activity),
      prerequisiteIds: [...activity.prerequisites],
    }));

  const objectives = objectiveIds(course);
  const units = structured.units.map((unit) => ({
    unitId: unit.id,
    title: unit.title,
    lessons: unit.lessons.map((lesson) => ({
      lessonId: lesson.id,
      title: lesson.title,
      objectiveIds: objectives.slice(0, Math.max(1, Math.min(2, objectives.length))),
      activityIds: [...lesson.activityIds],
      estimatedMinutes: lesson.estimatedMinutes,
    })),
  }));

  return {
    schemaVersion: COURSE_MANIFEST_SCHEMA_VERSION,
    kind: "course",
    courseId: course.id,
    stage: structured.stage,
    gradeRange: gradeRange(structured.stage),
    title: course.title,
    summary: course.summary,
    contentVersion: "curriculum-v1",
    reviewStatus: "pending_review",
    mappingStatus: "draft",
    unlockEligible: false,
    route: `/learn/course/${encodeURIComponent(course.id)}`,
    completionPolicyId: COURSE_COMPLETION_POLICY,
    evidenceSchema: "learning-evidence-v2",
    officialMappings: [{
      officialChapterId: null,
      officialRequirement: "待比赛方《人工智能通识课》正式条目映射",
      mappingNote: "首版课程蓝图，不能视为已通过官方审核。",
    }],
    units,
    knowledgePoints: course.knowledgePointTags.map((title, index) => ({
      id: `${course.id}:knowledge:${index + 1}`,
      title,
      prerequisiteIds: index === 0 ? [] : [`${course.id}:knowledge:${index}`],
    })),
    activities,
    evidencePolicy: activities.map((activity) => ({
      activityId: activity.activityId,
      kind: evidenceKind(getActivity(activity.activityId)!),
      ruleId: activity.evaluationPolicyId,
    })),
    sourceIds: [`${COURSE_SOURCE_PREFIX}${course.id}:content-v1`],
  };
}

function capstoneManifest(): CourseManifest {
  const activityIds = ["high-capstone-project", "high-capstone-defense"];
  const activities = activityIds.map((activityId): CourseManifestActivity => {
    const activity = getActivity(activityId)!;
    return {
      activityId,
      kind: activity.kind,
      promptIds: [],
      evaluationPolicyId: activity.completionPolicyId,
      remediationActivityIds: [],
      prerequisiteIds: [...activity.prerequisites],
    };
  });
  return {
    schemaVersion: COURSE_MANIFEST_SCHEMA_VERSION,
    kind: "project-only",
    courseId: null,
    projectId: "capstone",
    stage: "high_school",
    gradeRange: { min: 10, max: 12 },
    title: "AI 综合项目与答辩",
    summary: "把可复现实验、限制说明和答辩证据整理成项目成果。",
    contentVersion: "project-v2",
    reviewStatus: "reviewed",
    mappingStatus: "mapped",
    unlockEligible: true,
    route: "/learn/project/capstone",
    completionPolicyId: PROJECT_COMPLETION_POLICY,
    evidenceSchema: "project-evidence-v2",
    officialMappings: [{
      officialChapterId: null,
      officialRequirement: "综合项目与答辩能力（首版蓝图）",
      mappingNote: "等待正式比赛条目映射。",
    }],
    units: [{
      unitId: "high-capstone-project:workbench",
      title: "项目工作台",
      lessons: [{
        lessonId: "high-capstone-project:workbench:report-and-defense",
        title: "项目报告与答辩",
        objectiveIds: ["high-capstone-project:objective:1"],
        activityIds,
        estimatedMinutes: 45,
      }],
    }],
    knowledgePoints: [
      { id: "high-capstone-project:knowledge:1", title: "研究证据与限制", prerequisiteIds: [] },
    ],
    activities,
    evidencePolicy: activities.map((activity) => ({
      activityId: activity.activityId,
      kind: "artifact" as const,
      ruleId: activity.evaluationPolicyId,
    })),
    sourceIds: ["project:capstone:schema-v2"],
  };
}

const COURSE_MANIFESTS: readonly CourseManifest[] = [
  ...(["middle_school", "high_school"] as const)
    .flatMap((stage) => getStructuredCoursesForStage(stage).map(manifestForCourse)),
  capstoneManifest(),
];

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}

function validateActivityGraph(activities: readonly CourseManifestActivity[]): void {
  const ids = new Set(activities.map((activity) => activity.activityId));
  for (const activity of activities) {
    if (activity.prerequisiteIds.some((id) => !getActivity(id))) {
      throw new Error(`Unknown activity prerequisite: ${activity.activityId}`);
    }
  }
  const state = new Map<string, "visiting" | "visited">();
  const visit = (id: string) => {
    const current = state.get(id);
    if (current === "visiting") throw new Error(`Activity prerequisite cycle: ${id}`);
    if (current === "visited" || !ids.has(id)) return;
    state.set(id, "visiting");
    const activity = activities.find((item) => item.activityId === id)!;
    activity.prerequisiteIds.forEach(visit);
    state.set(id, "visited");
  };
  activities.forEach((activity) => visit(activity.activityId));
}

export function validateCourseManifests(manifests: readonly CourseManifest[]): void {
  assertUnique(manifests.map((manifest) => manifest.courseId ?? `project:${manifest.projectId}`), "manifest IDs");
  for (const manifest of manifests) {
    if (manifest.schemaVersion !== COURSE_MANIFEST_SCHEMA_VERSION) throw new Error(`Unsupported manifest schema: ${manifest.title}`);
    if (manifest.gradeRange.min > manifest.gradeRange.max) throw new Error(`Invalid grade range: ${manifest.title}`);
    if (manifest.reviewStatus === "pending_review" && manifest.mappingStatus === "reviewed") {
      throw new Error(`Pending manifest cannot be marked reviewed: ${manifest.title}`);
    }
    if (manifest.reviewStatus === "pending_review" && manifest.unlockEligible) {
      throw new Error(`Pending manifest cannot participate in unlocks: ${manifest.title}`);
    }
    if (!manifest.route.startsWith("/") || manifest.route.startsWith("//")) throw new Error(`Invalid manifest route: ${manifest.title}`);
    assertUnique(manifest.units.map((unit) => unit.unitId), `${manifest.title} unit IDs`);
    const lessons = manifest.units.flatMap((unit) => unit.lessons);
    assertUnique(lessons.map((lesson) => lesson.lessonId), `${manifest.title} lesson IDs`);
    assertUnique(manifest.activities.map((activity) => activity.activityId), `${manifest.title} activity IDs`);
    if (manifest.kind === "course") {
      if (!manifest.courseId) throw new Error(`Course manifest is missing course ID: ${manifest.title}`);
      const course = getCourseById(manifest.courseId);
      if (!course || course.stage !== manifest.stage || course.title !== manifest.title) throw new Error(`Manifest course mismatch: ${manifest.title}`);
      const expected = gradeRange(manifest.stage);
      if (manifest.gradeRange.min !== expected.min || manifest.gradeRange.max !== expected.max) throw new Error(`Manifest grade mismatch: ${manifest.title}`);
      if (manifest.units.length < 1 || lessons.length < 2 || manifest.activities.length < 3) throw new Error(`Manifest coverage is incomplete: ${manifest.title}`);
    }
    const lessonActivities = new Set(lessons.flatMap((lesson) => lesson.activityIds));
    for (const activity of manifest.activities) {
      const configured = getActivity(activity.activityId);
      if (!configured || configured.stage !== manifest.stage || configured.courseId !== manifest.courseId && manifest.kind === "course") {
        throw new Error(`Manifest activity mismatch: ${manifest.title} -> ${activity.activityId}`);
      }
      if (!lessonActivities.has(activity.activityId)) throw new Error(`Manifest activity is not in a lesson: ${activity.activityId}`);
      if (activity.evaluationPolicyId !== configured.completionPolicyId) throw new Error(`Manifest completion policy mismatch: ${activity.activityId}`);
      if (activity.templateId !== configured.labTemplateId) throw new Error(`Manifest lab template mismatch: ${activity.activityId}`);
      if ((configured.kind === "guided_lab" || configured.kind === "independent_lab" || configured.kind === "research_challenge") && !activity.templateId) {
        throw new Error(`Lab activity is missing a template: ${activity.activityId}`);
      }
    }
    for (const policy of manifest.evidencePolicy) {
      if (!manifest.activities.some((activity) => activity.activityId === policy.activityId)) throw new Error(`Evidence policy references unknown activity: ${policy.activityId}`);
    }
    validateActivityGraph(manifest.activities);
  }
}

validateCourseManifests(COURSE_MANIFESTS);

export function getCourseManifest(id: string): CourseManifest | undefined {
  const manifest = COURSE_MANIFESTS.find((item) => item.courseId === id || item.projectId === id);
  return manifest ? structuredClone(manifest) : undefined;
}

export function getCourseManifestsForStage(stage: LearningPathStage): CourseManifest[] {
  return COURSE_MANIFESTS.filter((manifest) => manifest.stage === stage).map((manifest) => structuredClone(manifest));
}

export function getAllCourseManifests(): CourseManifest[] {
  return structuredClone(COURSE_MANIFESTS) as CourseManifest[];
}
