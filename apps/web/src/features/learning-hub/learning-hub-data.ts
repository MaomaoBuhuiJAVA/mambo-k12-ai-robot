import { getStructuredCoursesForStage } from "@/data/course-structure";
import type { CurriculumCourse } from "@/data/curriculum";
import type { LearningActivity, LearningPathStage } from "@/data/learning-paths";
import { getLearningGrade, type LearningGradeId } from "@/data/learning-grades";
import type { LearningState } from "@/lib/domain";
import {
  getStageActivityStatuses,
  type LearningActivityStatus,
  type StageActivityStatus,
} from "@/features/progress/recommendation";

export type CourseLearningStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "completed";

export interface CourseLearningAction {
  href: string;
  label: "开始学习" | "继续学习" | "复习课程";
}

export interface CourseProgressSnapshot {
  course: CurriculumCourse;
  activities: StageActivityStatus[];
  completedCount: number;
  status: CourseLearningStatus;
  action: CourseLearningAction | null;
  hasLab: boolean;
}

/** Keep activity deep links in the same grade context as the hub. */
export function learningActivityHref(
  activity: LearningActivity,
  stage: LearningPathStage,
  grade?: LearningGradeId,
): string {
  if (!grade) return activity.route;
  const [pathname, rawQuery = ""] = activity.route.split("?", 2);
  const query = new URLSearchParams(rawQuery);
  query.set("stage", stage);
  query.set("grade", grade);
  return `${pathname}?${query.toString()}`;
}

export function getLearningActivityKindLabel(kind: LearningActivity["kind"]): string {
  const labels: Record<LearningActivity["kind"], string> = {
    lesson: "讲解",
    demonstration: "演示",
    guided_lab: "引导实验",
    independent_lab: "独立实验",
    research_challenge: "研究挑战",
    assessment: "阶段评价",
    remediation: "补救练习",
    project: "项目",
    defense: "答辩",
  };
  return labels[kind];
}

export function getLearningActivityStatusLabel(status: LearningActivityStatus): string {
  const labels: Record<LearningActivityStatus, string> = {
    completed: "已完成",
    active: "进行中",
    available: "可开始",
    locked: "已锁定",
  };
  return labels[status];
}

export function getCourseProgressSnapshots(
  state: LearningState,
  stage: LearningPathStage,
  grade?: LearningGradeId,
): CourseProgressSnapshot[] {
  const activityStatuses = getStageActivityStatuses(state, stage, grade);
  const selectedGrade = grade === undefined ? undefined : getLearningGrade(grade);
  const gradeCourseIds = selectedGrade === undefined
    ? undefined
    : selectedGrade.stage === stage
      ? new Set(selectedGrade.courseIds)
      : new Set<string>();

  return getStructuredCoursesForStage(stage)
    .filter(({ course }) => gradeCourseIds === undefined || gradeCourseIds.has(course.id))
    .map(({ course }) => {
      const activities = activityStatuses.filter(
        (item) => item.activity.courseId === course.id,
      );
      const completedCount = activities.filter(
        (item) => item.status === "completed",
      ).length;
      const active = activities.find((item) => item.status === "active");
      const available = activities.find((item) => item.status === "available");
      const completed = activities.length > 0 && completedCount === activities.length;
      const status: CourseLearningStatus = completed
        ? "completed"
        : active
          ? "in_progress"
          : available
            ? "available"
            : "locked";
      const action = completed
      ? activityAction(activities[0]?.activity, "复习课程", stage, grade)
      : active
        ? activityAction(active.activity, "继续学习", stage, grade)
        : available
          ? activityAction(available.activity, "开始学习", stage, grade)
          : null;

      return {
        course,
        activities,
        completedCount,
        status,
        action,
        hasLab: activities.some((item) => item.activity.labTemplateId !== undefined),
      };
    });
}

function activityAction(
  activity: LearningActivity | undefined,
  label: CourseLearningAction["label"],
  stage: LearningPathStage,
  grade?: LearningGradeId,
): CourseLearningAction | null {
  if (!activity) return null;
  return { href: learningActivityHref(activity, stage, grade), label };
}
