import { getCoursesForStage, type CurriculumCourse } from "@/data/curriculum";
import type { LearningState, MasteryRecord, Stage } from "@/lib/domain";

export interface CourseRecommendation {
  course: CurriculumCourse;
  reason: string;
  kind: "start" | "review" | "remediate" | "continue";
}

const STAGE_ORDER: Record<Stage, number> = {
  lower_primary: 0,
  upper_primary: 1,
  middle_school: 2,
  high_school: 3,
};

interface RankedCourse {
  course: CurriculumCourse;
  primary: number;
  interest: number;
  due: number;
  averageMastery: number | null;
  spaced: boolean;
}

function recordsForCourse(state: LearningState, course: CurriculumCourse): MasteryRecord[] {
  const prefix = `${course.id}:`;
  return Object.entries(state.masteryByKnowledgePoint)
    .filter(([id]) => id.startsWith(prefix))
    .map(([, record]) => record);
}

function interestMatch(state: LearningState, course: CurriculumCourse): number {
  const haystack = [course.title, course.summary, ...course.knowledgePointTags].join(" ").toLowerCase();
  return state.interests.filter((interest) => haystack.includes(interest.trim().toLowerCase())).length;
}

function rankCourse(state: LearningState, course: CurriculumCourse, nowMs: number): RankedCourse {
  const records = recordsForCourse(state, course);
  const expectedKnowledgePoints = new Set(course.knowledgePointTags).size;
  const distance = Math.abs(STAGE_ORDER[state.profile.stage] - STAGE_ORDER[course.stage]);
  const averageMastery = records.length === 0
    ? null
    : records.reduce((sum, record) => sum + record.mastery, 0) / expectedKnowledgePoints;
  const due = records.filter((record) => record.nextReviewAt !== null && Date.parse(record.nextReviewAt) <= nowMs).length;
  const spaced = records.length >= expectedKnowledgePoints && records.every((record) =>
    record.mastery >= 0.85 && record.evidenceCount >= 3 && record.nextReviewAt !== null && Date.parse(record.nextReviewAt) > nowMs,
  );
  const weakness = averageMastery === null ? 20 : (1 - averageMastery) * 40;
  const primary = 100 - distance * 35 + due * 50 + weakness - (spaced ? 120 : 0);

  return { course, primary, interest: interestMatch(state, course), due, averageMastery, spaced };
}

export function recommendNextCourse(
  state: LearningState,
  now: Date = new Date(),
): CourseRecommendation {
  const candidates = (["lower_primary", "upper_primary", "middle_school", "high_school"] as Stage[])
    .flatMap(getCoursesForStage)
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
    return { course: selected.course, kind: "remediate", reason: "这门课仍有薄弱知识点，建议用一次短练习查漏补缺。" };
  }
  if (deferredMastery) {
    return { course: selected.course, kind: "continue", reason: "已掌握内容正在间隔复习期，现在探索同学段的新主题。" };
  }
  if (Object.keys(state.masteryByKnowledgePoint).length === 0) {
    return { course: selected.course, kind: "start", reason: "根据当前学段和兴趣，为你选择这门入门课程。" };
  }
  return { course: selected.course, kind: "continue", reason: "根据当前掌握度，继续学习这门同学段课程。" };
}
