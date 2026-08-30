import { getCoursesForStage, type CurriculumCourse } from "@/data/curriculum";
import {
  getActivity,
  getLearningPath,
  type LearningActivity,
  type LearningPathStage,
} from "@/data/learning-paths";
import {
  getLearningGrade,
  getLearningGrades,
  type LearningGradeId,
} from "@/data/learning-grades";
import type { LearningState, MasteryRecord, Stage } from "@/lib/domain";
import { getLabTemplate } from "@/features/lab/lab-templates";
import { interestKeywords } from "./interest-options";
import { getMisconceptionRemediation } from "@/features/quiz/middle-chapter-one-remediation";

export interface CourseRecommendation {
  course: CurriculumCourse;
  reason: string;
  kind: "start" | "review" | "remediate" | "continue";
}

export type LearningActivityStatus =
  | "completed"
  | "active"
  | "available"
  | "locked";

export interface StageActivityStatus {
  activity: LearningActivity;
  status: LearningActivityStatus;
  missingPrerequisites: LearningActivity[];
}

export interface StageActivityRecommendation {
  activity: LearningActivity;
  reason: string;
  kind: "resume" | "next";
}

interface RankedCourse {
  course: CurriculumCourse;
  primary: number;
  interest: number;
  due: number;
  averageMastery: number | null;
  spaced: boolean;
  activeMisconceptionTags: string[];
}

function knowledgePointIdsForCourse(course: CurriculumCourse): string[] {
  const ids = course.knowledgePointTags.map((tag) => `${course.id}:${tag}`);
  if (course.stage === "middle_school" || course.stage === "high_school") {
    for (const activity of getLearningPath(course.stage)) {
      if (activity.courseId !== course.id || activity.labTemplateId === undefined) continue;
      ids.push(getLabTemplate(activity.labTemplateId).knowledgePointId);
    }
  }
  return [...new Set(ids)];
}

function recordsForCourse(state: LearningState, course: CurriculumCourse): MasteryRecord[] {
  return knowledgePointIdsForCourse(course)
    .map((id) => {
      const record = state.masteryByKnowledgePoint[id];
      return record?.knowledgePointId === id ? record : undefined;
    })
    .filter((record): record is MasteryRecord => record !== undefined);
}

function interestMatch(state: LearningState, course: CurriculumCourse): number {
  const haystack = [course.title, course.summary, ...course.knowledgePointTags].join(" ").toLowerCase();
  return state.interests.reduce(
    (matches, interest) => matches + Number(
      interestKeywords(interest).some((keyword) => haystack.includes(keyword.toLowerCase())),
    ),
    0,
  );
}

function rankCourse(state: LearningState, course: CurriculumCourse, nowMs: number): RankedCourse {
  const records = recordsForCourse(state, course);
  const expectedKnowledgePoints = knowledgePointIdsForCourse(course).length;
  const averageMastery = records.length === 0
    ? null
    : records.reduce((sum, record) => sum + record.mastery, 0) / expectedKnowledgePoints;
  const due = records.filter((record) => record.nextReviewAt !== null && Date.parse(record.nextReviewAt) <= nowMs).length;
  const spaced = records.length >= expectedKnowledgePoints && records.every((record) =>
    record.mastery >= 0.85 && record.evidenceCount >= 3 && record.nextReviewAt !== null && Date.parse(record.nextReviewAt) > nowMs,
  );
  const weakness = averageMastery === null ? 20 : (1 - averageMastery) * 40;
  const primary = 100 + due * 50 + weakness - (spaced ? 120 : 0);
  const activeMisconceptionTags = [...new Set(records.flatMap((record) => record.misconceptionTags))]
    .filter((tag) => getMisconceptionRemediation(tag) !== undefined);

  return {
    course,
    primary,
    interest: interestMatch(state, course),
    due,
    averageMastery,
    spaced,
    activeMisconceptionTags,
  };
}

export function recommendNextCourse(
  state: LearningState,
  now: Date = new Date(),
  grade?: LearningGradeId,
): CourseRecommendation {
  const stageCourses = getCoursesForStage(state.profile.stage);
  const profileGrade = grade ?? profileGradeForStage(state.profile.stage, state.profile.grade);
  const gradeDefinition = profileGrade ? getLearningGrade(profileGrade) : undefined;
  const gradeCourses = gradeDefinition?.stage === state.profile.stage
    ? stageCourses.filter((course) => gradeDefinition.courseIds.includes(course.id))
    : stageCourses;
  const scopedCourses = gradeCourses.length > 0 ? gradeCourses : stageCourses;
  const fallbackCourses = scopedCourses.length > 0
    ? scopedCourses
    : (["lower_primary", "upper_primary", "middle_school", "high_school"] as Stage[])
      .flatMap(getCoursesForStage);
  const candidates = fallbackCourses
    .map((course) => rankCourse(state, course, now.getTime()))
    .sort((left, right) =>
      right.primary - left.primary
      || right.interest - left.interest
      || Number(right.course.featured) - Number(left.course.featured)
      || left.course.id.localeCompare(right.course.id),
    );
  const selected = candidates[0];
  if (!selected) throw new Error("Curriculum has no courses to recommend");
  const deferredMastery = candidates.some((candidate) => candidate.spaced);

  if (selected.due > 0) {
    return { course: selected.course, kind: "review", reason: "这门课包含已经到期的知识点，先复习可以巩固记忆。" };
  }
  if (selected.averageMastery !== null && selected.averageMastery < 0.6) {
    const misconception = selected.activeMisconceptionTags
      .map(getMisconceptionRemediation)
      .find((item) => item !== undefined);
    return {
      course: selected.course,
      kind: "remediate",
      reason: misconception
        ? `检测到“${misconception.tag}”这一误区，建议先复习示例后完成一次复测。`
        : "这门课仍有薄弱知识点，建议用一次短练习查漏补缺。",
    };
  }
  if (deferredMastery) {
    return { course: selected.course, kind: "continue", reason: "已掌握内容正在间隔复习期，现在探索同学段的新主题。" };
  }
  if (!candidates.some((candidate) => candidate.averageMastery !== null)) {
    const interestReason = selected.interest > 0 ? "和你选择的兴趣" : "";
    return { course: selected.course, kind: "start", reason: `根据当前学段${interestReason}，为你选择这门入门课程。` };
  }
  return { course: selected.course, kind: "continue", reason: "根据当前掌握度，继续学习这门同学段课程。" };
}

function profileGradeForStage(
  stage: Stage,
  gradeNumber: number | null,
): LearningGradeId | undefined {
  if (stage !== "middle_school" && stage !== "high_school") return undefined;
  return getLearningGrades(stage).find((grade) => grade.number === gradeNumber)?.id;
}

export function getStageActivityStatuses(
  state: LearningState,
  stage: LearningPathStage,
  grade?: LearningGradeId,
): StageActivityStatus[] {
  if (grade !== undefined && getLearningGrade(grade).stage !== stage) return [];
  const allActivities = getLearningPath(stage);
  const gradeCourseIds = grade !== undefined
    ? new Set(getLearningGrade(grade).courseIds)
    : undefined;
  const activities = gradeCourseIds === undefined
    ? allActivities
    : allActivities.filter((activity) => gradeCourseIds.has(activity.courseId));
  const completed = new Set(
    state.stageProgressByStage[stage].completedActivityIds,
  );
  const activeActivityId = state.stageProgressByStage[stage].activeActivityId;
  const activitiesById = new Map(
    allActivities.map((activity) => [activity.id, activity]),
  );

  return activities.map((activity) => {
    const missingPrerequisites = activity.prerequisites
      .filter((prerequisiteId) => !completed.has(prerequisiteId))
      .map((prerequisiteId) => activitiesById.get(prerequisiteId))
      .filter((prerequisite): prerequisite is LearningActivity => Boolean(prerequisite));

    if (completed.has(activity.id)) {
      return { activity, status: "completed", missingPrerequisites: [] };
    }
    if (activeActivityId === activity.id && missingPrerequisites.length === 0) {
      return { activity, status: "active", missingPrerequisites: [] };
    }
    if (missingPrerequisites.length === 0) {
      return { activity, status: "available", missingPrerequisites: [] };
    }
    return { activity, status: "locked", missingPrerequisites };
  });
}

export function recommendNextActivity(
  state: LearningState,
  stage: LearningPathStage,
  grade?: LearningGradeId,
): StageActivityRecommendation | null {
  const statuses = getStageActivityStatuses(state, stage, grade);
  const active = statuses.find((item) => item.status === "active");
  if (active) {
    return {
      activity: active.activity,
      kind: "resume",
      reason: "这是你上次保存的当前任务，继续完成后会解锁后续学习。",
    };
  }

  const next = statuses.find((item) => item.status === "available");
  if (!next) return null;
  if (next.activity.prerequisites.length === 0) {
    return {
      activity: next.activity,
      kind: "next",
      reason: "这是本学段的起始任务，已经可以开始。",
    };
  }
  return {
    activity: next.activity,
    kind: "next",
    reason: `已满足前置任务：${next.activity.prerequisites
      .map((prerequisiteId) => getActivity(prerequisiteId)?.title ?? prerequisiteId)
      .join("、")}。`,
  };
}
