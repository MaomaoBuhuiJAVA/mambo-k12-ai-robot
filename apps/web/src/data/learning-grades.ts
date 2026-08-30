import { getCourseById } from "./curriculum";
import type { LearningPathStage } from "./learning-paths";

export type LearningGradeId =
  | "middle_1"
  | "middle_2"
  | "middle_3"
  | "high_1"
  | "high_2"
  | "high_3";

export interface LearningGradeDefinition {
  id: LearningGradeId;
  stage: LearningPathStage;
  number: 7 | 8 | 9 | 10 | 11 | 12;
  label: string;
  shortLabel: string;
  focus: readonly string[];
  courseIds: readonly string[];
  description: string;
}

export const LEARNING_GRADES: readonly LearningGradeDefinition[] = [
  {
    id: "middle_1",
    stage: "middle_school",
    number: 7,
    label: "初一",
    shortLabel: "初一",
    focus: ["AI 基础", "数据表示", "Python 入门"],
    courseIds: [
      "middle-ai-foundations",
      "middle-data-and-algorithms",
      "middle-python-basics",
      "middle-neural-signals",
    ],
    description: "先建立人工智能、数据、算法和可运行代码的共同语言。",
  },
  {
    id: "middle_2",
    stage: "middle_school",
    number: 8,
    label: "初二",
    shortLabel: "初二",
    focus: ["Python", "图像分类", "模型评价"],
    courseIds: [
      "middle-python-basics",
      "middle-neural-signals",
      "middle-model-evaluation",
      "middle-data-bias",
    ],
    description: "用代码、分类实验和分组指标观察模型如何学习与出错。",
  },
  {
    id: "middle_3",
    stage: "middle_school",
    number: 9,
    label: "初三",
    shortLabel: "初三",
    focus: ["模型评价", "数据偏差", "生成式 AI"],
    courseIds: [
      "middle-model-evaluation",
      "middle-data-bias",
      "middle-generative-ai",
      "middle-ai-safety",
    ],
    description: "比较模型边界、生成内容和安全风险，练习用证据负责任地使用 AI。",
  },
  {
    id: "high_1",
    stage: "high_school",
    number: 10,
    label: "高一",
    shortLabel: "高一",
    focus: ["Python 数据", "算法实验", "机器学习流程"],
    courseIds: [
      "high-python-data-lab",
      "high-bubble-analysis",
      "high-ml-pipeline",
      "high-classification-regression",
    ],
    description: "从可运行 Python 和算法实验开始，完成数据准备、切分和基线评价。",
  },
  {
    id: "high_2",
    stage: "high_school",
    number: 11,
    label: "高二",
    shortLabel: "高二",
    focus: ["机器学习指标", "神经网络", "多模态", "RAG"],
    courseIds: [
      "high-ml-pipeline",
      "high-classification-regression",
      "high-neural-network-training",
      "high-multimodal-ai",
    ],
    description: "比较数据切分、指标、模型结构和输入模态对实验结论的影响。",
  },
  {
    id: "high_3",
    stage: "high_school",
    number: 12,
    label: "高三",
    shortLabel: "高三",
    focus: ["生成式 AI", "模型审计", "项目证据"],
    courseIds: [
      "high-neural-network-training",
      "high-generative-ai-rag",
      "high-image-model-audit",
      "high-multimodal-ai",
    ],
    description: "把神经网络、生成式 AI 和多模态实验整理成可复核的审计与项目证据。",
  },
];

const GRADE_BY_ID = new Map(LEARNING_GRADES.map((grade) => [grade.id, grade]));

export const MIN_COURSES_PER_GRADE = 4 as const;

/**
 * Keep grade filters backed by real, stage-correct course records.  A grade
 * can intentionally reuse a course from the adjacent grade as a spiral
 * review, but it may never point at an unknown or cross-stage course.
 */
export function validateLearningGrades(
  grades: readonly LearningGradeDefinition[] = LEARNING_GRADES,
): void {
  const ids = new Set<string>();
  for (const grade of grades) {
    if (ids.has(grade.id)) throw new Error(`Duplicate learning grade ID: ${grade.id}`);
    ids.add(grade.id);
    if (grade.courseIds.length < MIN_COURSES_PER_GRADE) {
      throw new Error(`Learning grade needs at least ${MIN_COURSES_PER_GRADE} courses: ${grade.id}`);
    }
    if (new Set(grade.courseIds).size !== grade.courseIds.length) {
      throw new Error(`Duplicate grade course ID: ${grade.id}`);
    }
    for (const courseId of grade.courseIds) {
      const course = getCourseById(courseId);
      if (!course) throw new Error(`Unknown grade course ID: ${grade.id} -> ${courseId}`);
      if (course.stage !== grade.stage) {
        throw new Error(`Cross-stage grade course: ${grade.id} -> ${courseId}`);
      }
    }
  }
}

validateLearningGrades();

export function getLearningGrade(id: LearningGradeId): LearningGradeDefinition {
  return GRADE_BY_ID.get(id) ?? LEARNING_GRADES[0];
}

export function getLearningGrades(stage: LearningPathStage): readonly LearningGradeDefinition[] {
  return LEARNING_GRADES.filter((grade) => grade.stage === stage);
}

export function parseLearningGrade(value: string | undefined): LearningGradeId | undefined {
  return value && GRADE_BY_ID.has(value as LearningGradeId)
    ? value as LearningGradeId
    : undefined;
}

export function gradeIdForProfile(
  stage: LearningPathStage,
  gradeNumber: number | null | undefined,
): LearningGradeId {
  const stageGrades = getLearningGrades(stage);
  const matching = stageGrades.find((grade) => grade.number === gradeNumber);
  return matching?.id ?? stageGrades[0].id;
}

export function gradeNumberForId(id: LearningGradeId): number {
  return getLearningGrade(id).number;
}

export function isGradeForStage(
  grade: LearningGradeId | undefined,
  stage: LearningPathStage | undefined,
): boolean {
  return grade === undefined || stage === undefined || getLearningGrade(grade).stage === stage;
}
