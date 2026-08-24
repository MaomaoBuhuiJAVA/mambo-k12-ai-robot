import type { CourseExercise, CurriculumCourse } from "@/data/curriculum";
import { getCourseById, getCoursesForStage } from "@/data/curriculum";
import type { LearningPathStage } from "@/data/learning-paths";
import type { LearningState } from "@/lib/domain";
import { getLearningGrade, isGradeForStage, type LearningGradeId } from "@/data/learning-grades";
import { getMisconceptionForExercise } from "@/features/quiz/middle-chapter-one-remediation";
import { getHighSchoolRemediationActivity } from "@/features/quiz/high-school-remediation";
import { recommendNextActivity } from "@/features/progress/recommendation";

export type PracticeSetKind = "daily" | "course" | "code" | "remediation" | "assessment";

export interface PracticeQuestion {
  key: string;
  course: CurriculumCourse;
  exercise: CourseExercise;
}

export interface PracticeSet {
  id: string;
  stage: LearningPathStage;
  kind: PracticeSetKind;
  title: string;
  description: string;
  questions: PracticeQuestion[];
  remediationActivityId?: string;
}

export interface PracticeSetSummary {
  id: string;
  kind: PracticeSetKind;
  title: string;
  description: string;
  questionCount: number;
  disabled: boolean;
  formats: string[];
  estimatedMinutes: number;
}

const DAILY_QUESTION_COUNT = 5;

function questionKey(course: CurriculumCourse, exercise: CourseExercise): string {
  return `${course.id}:${exercise.id}`;
}

function courseQuestions(course: CurriculumCourse): PracticeQuestion[] {
  return course.exercises.map((exercise) => ({ key: questionKey(course, exercise), course, exercise }));
}

function exerciseFormatLabel(type: CourseExercise["type"]): string {
  const labels: Record<CourseExercise["type"], string> = {
    single_choice: "单选",
    multi_select: "多选",
    order: "步骤排序",
    code_trace: "代码追踪",
    code_fill: "代码填空",
    result_interpretation: "结果解释",
    classification: "样本分类",
  };
  return labels[type];
}

function formatsForQuestions(questions: readonly PracticeQuestion[], kind: PracticeSetKind): string[] {
  const formats = [...new Set(questions.map((question) => exerciseFormatLabel(question.exercise.type)))];
  if (formats.length > 0) return formats;
  return kind === "remediation" ? ["针对性复测"] : ["等待题目"];
}

function estimatedMinutesForQuestions(questionCount: number, kind: PracticeSetKind): number {
  if (kind === "daily") return 15;
  if (kind === "assessment") return Math.max(10, questionCount * 4);
  if (kind === "remediation") return Math.max(8, questionCount * 3);
  return Math.max(10, questionCount * 3);
}

function stageQuestions(stage: LearningPathStage, grade?: LearningGradeId): PracticeQuestion[] {
  if (!grade) return getCoursesForStage(stage).flatMap(courseQuestions);
  const gradeDefinition = getLearningGrade(grade);
  const focusedCourses = gradeDefinition.courseIds
    .map((courseId) => getCourseById(courseId))
    .filter((course): course is CurriculumCourse => course?.stage === stage);
  return (focusedCourses.length > 0 ? focusedCourses : getCoursesForStage(stage)).flatMap(courseQuestions);
}

function hash(value: string): number {
  let valueHash = 0;
  for (const character of value) valueHash = (valueHash * 31 + character.charCodeAt(0)) >>> 0;
  return valueHash;
}

function dateToken(now: Date): string {
  return [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()].join("-");
}

function selectRotatingQuestions(
  questions: PracticeQuestion[],
  count: number,
  seed: string,
): PracticeQuestion[] {
  if (questions.length <= count) return questions;
  const offset = hash(seed) % questions.length;
  return Array.from({ length: count }, (_, index) => questions[(offset + index) % questions.length]);
}

function currentCourse(
  stage: LearningPathStage,
  state: LearningState,
  grade?: LearningGradeId,
): CurriculumCourse {
  const courses = getCoursesForStage(stage);
  const gradeCourseIds = grade ? new Set(getLearningGrade(grade).courseIds) : null;
  const recommendedCourseId = recommendNextActivity(state, stage, grade)?.activity.courseId;
  const recommended = recommendedCourseId ? getCourseById(recommendedCourseId) : undefined;
  if (recommended?.stage === stage && (!gradeCourseIds || gradeCourseIds.has(recommended.id))) return recommended;
  const saved = state.lastCourseId ? getCourseById(state.lastCourseId) : undefined;
  if (saved?.stage === stage && (!gradeCourseIds || gradeCourseIds.has(saved.id))) return saved;
  if (gradeCourseIds) {
    const focused = courses.find((course) => gradeCourseIds.has(course.id));
    if (focused) return focused;
  }
  return courses[0];
}

function exerciseNeedsRemediation(
  state: LearningState,
  question: PracticeQuestion,
): boolean {
  const directTag = `needs-review:${question.exercise.id}`;
  const remediationTag = getMisconceptionForExercise(question.exercise.id)?.tag;
  return question.exercise.knowledgePointTags.some((tag) => {
    const record = state.masteryByKnowledgePoint[`${question.course.id}:${tag}`];
    return record?.misconceptionTags.includes(directTag)
      || (remediationTag !== undefined && record?.misconceptionTags.includes(remediationTag));
  });
}

function stageAssessmentQuestions(stage: LearningPathStage, grade?: LearningGradeId): PracticeQuestion[] {
  const courses = grade
    ? getLearningGrade(grade).courseIds
      .map((courseId) => getCourseById(courseId))
      .filter((course): course is CurriculumCourse => course?.stage === stage)
    : getCoursesForStage(stage);
  const scopedCourses = courses.length > 0 ? courses : getCoursesForStage(stage);
  return scopedCourses
    .map((course, index) => {
      const exercises = courseQuestions(course);
      return exercises[index % exercises.length];
    })
    .slice(0, DAILY_QUESTION_COUNT);
}

export function practiceSetIdForCourse(courseId: string): string {
  return `course--${courseId}`;
}

export function isKnownPracticeSetId(stage: LearningPathStage, practiceSetId: string): boolean {
  if (
    practiceSetId === `daily-${stage}`
    || practiceSetId === `code-${stage}`
    || practiceSetId === `remediation-${stage}`
    || practiceSetId === `assessment-${stage}`
  ) return true;

  if (!practiceSetId.startsWith("course--")) return false;
  return getCoursesForStage(stage).some((course) => practiceSetId === practiceSetIdForCourse(course.id));
}

export function getPracticeSet(
  stage: LearningPathStage,
  practiceSetId: string,
  state: LearningState,
  now: Date = new Date(),
  remediationActivityId?: string,
  grade?: LearningGradeId,
): PracticeSet | undefined {
  if (grade !== undefined && !isGradeForStage(grade, stage)) return undefined;
  if (!isKnownPracticeSetId(stage, practiceSetId)) return undefined;

  const questions = stageQuestions(stage, grade);
  if (practiceSetId === `daily-${stage}`) {
    const gradeLabel = grade ? getLearningGrade(grade).label : stage === "middle_school" ? "初中" : "高中";
    return {
      id: practiceSetId,
      stage,
      kind: "daily",
      title: `${gradeLabel}每日 5 题`,
      description: `从${gradeLabel}重点课程中抽取当天练习，覆盖不同知识点和题型。`,
      questions: selectRotatingQuestions(questions, DAILY_QUESTION_COUNT, `${stage}:${grade ?? "overview"}:${dateToken(now)}`),
    };
  }
  if (practiceSetId === `code-${stage}`) {
    return {
      id: practiceSetId,
      stage,
      kind: "code",
      title: grade ? `${getLearningGrade(grade).label}代码挑战` : "代码追踪挑战",
      description: "阅读固定代码、完成输出填空，逐步核对变量、条件和执行结果。",
      questions: questions.filter((question) => question.exercise.type === "code_trace" || question.exercise.type === "code_fill"),
    };
  }
  if (practiceSetId === `remediation-${stage}`) {
    return {
      id: practiceSetId,
      stage,
      kind: "remediation",
      title: "错题补救",
      description: "只展示现有学习记录中仍需要复测的知识点，不虚构错题。",
      questions: questions.filter((question) => exerciseNeedsRemediation(state, question)),
    };
  }
  if (practiceSetId === `assessment-${stage}`) {
    return {
      id: practiceSetId,
      stage,
      kind: "assessment",
      title: "阶段评价",
      description: `${grade ? "从当前年级重点课程" : "从当前学段课程"}中各选择一道可确定性判分的题目，形成阶段学习证据。`,
      questions: stageAssessmentQuestions(stage, grade),
    };
  }

  const courseId = practiceSetId.slice("course--".length);
  const course = getCourseById(courseId);
  if (!course || course.stage !== stage) return undefined;
  if (grade !== undefined && !getLearningGrade(grade).courseIds.includes(course.id)) return undefined;
  const remediation = stage === "high_school" && remediationActivityId
    ? getHighSchoolRemediationActivity(remediationActivityId)
    : undefined;
  if (remediationActivityId && !remediation) return undefined;
  if (remediation && remediation.courseId !== course.id) return undefined;
  const courseQuestionsForSet = remediation
    ? courseQuestions(course).filter((question) => remediation.retestExerciseIds.includes(question.exercise.id))
    : courseQuestions(course);
  return {
    id: practiceSetId,
    stage,
    kind: "course",
    title: remediation
      ? `${course.title}补救练习`
      : `${grade ? `${getLearningGrade(grade).label} · ` : ""}${course.title}练习`,
    description: remediation
      ? `${remediation.title}：完成指定复测题，确认错误原因已经修正。`
      : "围绕当前课程的知识点完成选择、排序、代码追踪和结果解释。",
    questions: courseQuestionsForSet,
    remediationActivityId: remediation?.activityId,
  };
}

export function getPracticeSetSummaries(
  stage: LearningPathStage,
  state: LearningState,
  now: Date = new Date(),
  grade?: LearningGradeId,
): PracticeSetSummary[] {
  const course = currentCourse(stage, state, grade);
  const daily = getPracticeSet(stage, `daily-${stage}`, state, now, undefined, grade)!;
  const code = getPracticeSet(stage, `code-${stage}`, state, now, undefined, grade)!;
  const remediation = getPracticeSet(stage, `remediation-${stage}`, state, now, undefined, grade)!;
  const assessment = getPracticeSet(stage, `assessment-${stage}`, state, now, undefined, grade)!;
  const coursePractice = getPracticeSet(stage, practiceSetIdForCourse(course.id), state, now, undefined, grade)!;

  const summaryFor = (set: PracticeSet, title: string, description: string, disabled: boolean): PracticeSetSummary => ({
    id: set.id,
    kind: set.kind,
    title,
    description,
    questionCount: set.questions.length,
    disabled,
    formats: formatsForQuestions(set.questions, set.kind),
    estimatedMinutes: estimatedMinutesForQuestions(set.questions.length, set.kind),
  });

  return [
    summaryFor(daily, daily.title, daily.description, false),
    summaryFor(coursePractice, "当前课程练习", `${course.title}：${coursePractice.description}`, false),
    summaryFor(code, code.title, code.description, code.questions.length === 0),
    summaryFor(remediation, remediation.title, remediation.questions.length > 0 ? remediation.description : "尚未形成需要补救的错误证据。", remediation.questions.length === 0),
    summaryFor(assessment, assessment.title, assessment.description, assessment.questions.length === 0),
  ];
}
