import {
  getCourseById,
  getCoursesForStage,
  type CurriculumCourse,
} from "./curriculum";
import {
  getActivity,
  getLearningPath,
  type LearningActivityKind,
  type LearningPathStage,
} from "./learning-paths";
import { getLearningGrade, type LearningGradeId } from "./learning-grades";

export type LessonId = string;

export interface CourseLesson {
  id: LessonId;
  courseId: string;
  unitId: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  knowledgePointTags: string[];
  activityIds: string[];
  activityKinds: LearningActivityKind[];
}

export interface CourseUnit {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  lessons: CourseLesson[];
}

export interface StructuredCourse {
  course: CurriculumCourse;
  stage: LearningPathStage;
  units: CourseUnit[];
}

export interface PlannedCourseOutline {
  id: string;
  stage: LearningPathStage;
  title: string;
  summary: string;
  knowledgePointTags: string[];
  units: Array<{
    id: string;
    title: string;
    lessons: Array<{
      id: string;
      title: string;
      estimatedMinutes: number;
    }>;
  }>;
}

interface LessonSeed {
  id: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  knowledgePointTags: string[];
  activityIds: string[];
}

interface UnitSeed {
  id: string;
  title: string;
  summary: string;
  lessons: LessonSeed[];
}

interface CourseStructureSeed {
  courseId: string;
  units: UnitSeed[];
}

const COURSE_STRUCTURE_SEEDS: readonly CourseStructureSeed[] = [
  {
    courseId: "middle-ai-foundations",
    units: [
      {
        id: "concepts",
        title: "从规则到学习",
        summary: "区分普通程序和从样本中学习的模型。",
        lessons: [
          {
            id: "rules-and-models",
            title: "规则、样本与模型",
            summary: "用校园失物案例建立规则程序和机器学习的区别。",
            estimatedMinutes: 18,
            knowledgePointTags: ["规则程序与机器学习", "数据样本"],
            activityIds: [
              "middle-ai-foundations-lesson",
              "middle-ai-foundations-demonstration",
            ],
          },
        ],
      },
      {
        id: "evidence",
        title: "特征、预测与核对",
        summary: "把预测视作需要验证的结果。",
        lessons: [
          {
            id: "prediction-is-not-fact",
            title: "模型输出需要核对",
            summary: "通过评价题识别特征、标签与模型错误来源。",
            estimatedMinutes: 12,
            knowledgePointTags: ["特征与标签", "模型预测与误差"],
            activityIds: ["middle-ai-foundations-assessment"],
          },
        ],
      },
    ],
  },
  {
    courseId: "middle-data-and-algorithms",
    units: [
      {
        id: "data-and-steps",
        title: "把记录变成可执行步骤",
        summary: "从字段、列表到条件和循环，建立算法的可追踪过程。",
        lessons: [
          {
            id: "fields-lists-and-steps",
            title: "字段、列表与算法步骤",
            summary: "把校园器材记录整理成字段和列表，并追踪相邻比较的规则。",
            estimatedMinutes: 18,
            knowledgePointTags: ["数据表示", "表格与字段", "算法步骤"],
            activityIds: [
              "middle-data-and-algorithms-lesson",
              "middle-data-and-algorithms-demonstration",
            ],
          },
        ],
      },
      {
        id: "sorting-code",
        title: "用代码验证排序",
        summary: "完成相邻比较代码，并用边界输入核对结果。",
        lessons: [
          {
            id: "bubble-sort-and-boundaries",
            title: "冒泡排序与边界输入",
            summary: "在固定测试中完成排序函数，解释空列表和已有序列表的行为。",
            estimatedMinutes: 22,
            knowledgePointTags: ["算法步骤", "排序与复杂度直觉"],
            activityIds: [
              "middle-data-and-algorithms-lab",
              "middle-data-and-algorithms-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "middle-neural-signals",
    units: [
      {
        id: "image-features",
        title: "图像如何变成类别分数",
        summary: "追踪像素、特征和加权连接。",
        lessons: [
          {
            id: "forward-signal",
            title: "从像素到类别",
            summary: "观察像素特征经过网络连接形成类别概率。",
            estimatedMinutes: 20,
            knowledgePointTags: ["像素输入", "加权连接", "类别概率"],
            activityIds: [
              "middle-neural-signals-lesson",
              "middle-neural-signals-demonstration",
            ],
          },
        ],
      },
      {
        id: "classification-lab",
        title: "图像分类实验",
        summary: "从引导实验逐步独立完成评价。",
        lessons: [
          {
            id: "guided-and-independent-lab",
            title: "控制变量并解释结果",
            summary: "完成引导和独立图像分类实验，保存可核对证据。",
            estimatedMinutes: 25,
            knowledgePointTags: ["像素输入", "加权连接", "类别概率"],
            activityIds: [
              "middle-neural-signals-guided-lab",
              "middle-neural-signals-independent-lab",
              "middle-neural-signals-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "middle-python-basics",
    units: [
      {
        id: "values-and-branches",
        title: "让数据走进程序",
        summary: "用变量、条件和列表表达实验室中的器材状态。",
        lessons: [
          {
            id: "variables-conditions-and-lists",
            title: "变量、条件与列表",
            summary: "把器材记录转成可读的变量和列表，并追踪条件如何筛选每一项。",
            estimatedMinutes: 18,
            knowledgePointTags: ["Python 变量与类型", "条件判断", "循环与列表"],
            activityIds: [
              "middle-python-basics-lesson",
              "middle-python-basics-demonstration",
            ],
          },
        ],
      },
      {
        id: "functions-and-tests",
        title: "封装函数并用测试核对",
        summary: "把筛选规则写成函数，并检查边界输入。",
        lessons: [
          {
            id: "choose-ready-tools",
            title: "函数、返回值与固定测试",
            summary: "完成器材筛选函数，在空列表、混合状态和无匹配项中核对结果。",
            estimatedMinutes: 22,
            knowledgePointTags: ["循环与列表", "函数与测试"],
            activityIds: [
              "middle-python-basics-lab",
              "middle-python-basics-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "middle-model-evaluation",
    units: [
      {
        id: "held-out-evaluation",
        title: "测试集与混淆矩阵",
        summary: "使用未参与规则选择的样本检查模型。",
        lessons: [
          {
            id: "evaluate-with-evidence",
            title: "让分数说清楚",
            summary: "从留出测试集、准确率到混淆矩阵解释错误。",
            estimatedMinutes: 22,
            knowledgePointTags: ["训练集与测试集", "准确率与错误率", "混淆矩阵"],
            activityIds: [
              "middle-model-evaluation-lesson",
              "middle-model-evaluation-demonstration",
            ],
          },
          {
            id: "evaluation-checkpoint",
            title: "用混淆矩阵完成评价",
            summary: "根据固定结果计算指标，并说明错误发生在哪些类别之间。",
            estimatedMinutes: 14,
            knowledgePointTags: ["准确率与错误率", "混淆矩阵"],
            activityIds: ["middle-model-evaluation-assessment"],
          },
        ],
      },
    ],
  },
  {
    courseId: "middle-data-bias",
    units: [
      {
        id: "grouped-evidence",
        title: "发现数据偏差",
        summary: "比较总体与分组指标，发现样本缺口。",
        lessons: [
          {
            id: "bias-investigation",
            title: "逆光样本研究",
            summary: "使用分组结果判断偏差并记录下一次实验。",
            estimatedMinutes: 25,
            knowledgePointTags: ["数据分布", "混淆矩阵", "偏差"],
            activityIds: [
              "middle-data-bias-lesson",
              "middle-data-bias-demonstration",
            ],
          },
          {
            id: "bias-research-and-review",
            title: "逆光分类研究挑战",
            summary: "完成一次可比较实验，再用分组指标评价改善是否成立。",
            estimatedMinutes: 25,
            knowledgePointTags: ["数据分布", "混淆矩阵", "偏差"],
            activityIds: [
              "middle-data-bias-research",
              "middle-data-bias-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "middle-ai-safety",
    units: [
      {
        id: "responsible-use",
        title: "可信 AI 使用",
        summary: "围绕授权、核对和责任边界作出可解释选择。",
        lessons: [
          {
            id: "safety-evidence",
            title: "先核对，再使用",
            summary: "在校园情境中完成安全证据判断与评价。",
            estimatedMinutes: 18,
            knowledgePointTags: ["隐私保护", "数据授权", "预测需要核对", "模型责任边界"],
            activityIds: [
              "middle-ai-safety-lesson",
              "middle-ai-safety-demonstration",
            ],
          },
          {
            id: "safety-checkpoint",
            title: "可信 AI 使用评价",
            summary: "在校园情境中选择有证据支持的安全行动，并说明责任边界。",
            estimatedMinutes: 14,
            knowledgePointTags: ["隐私保护", "数据授权", "预测需要核对", "模型责任边界"],
            activityIds: ["middle-ai-safety-assessment"],
          },
        ],
      },
    ],
  },
  {
    courseId: "middle-generative-ai",
    units: [
      {
        id: "generation-and-constraints",
        title: "生成内容需要边界",
        summary: "区分分类与生成，并将目标、材料范围和格式写入提示。",
        lessons: [
          {
            id: "prompt-structure",
            title: "目标、材料与输出约束",
            summary: "比较固定提示词，找出可检查的目标、上下文和格式约束。",
            estimatedMinutes: 18,
            knowledgePointTags: ["分类与生成", "提示目标与上下文", "输出约束"],
            activityIds: [
              "middle-generative-ai-lesson",
              "middle-generative-ai-demonstration",
            ],
          },
        ],
      },
      {
        id: "verification",
        title: "生成后回到证据",
        summary: "把来源与限制当作输出的一部分。",
        lessons: [
          {
            id: "source-checking",
            title: "事实核对与引用",
            summary: "完成固定提示词对照评价，确认生成内容仍需回到材料核对。",
            estimatedMinutes: 14,
            knowledgePointTags: ["输出约束", "事实核对与引用"],
            activityIds: ["middle-generative-ai-assessment"],
          },
        ],
      },
    ],
  },
  {
    courseId: "high-python-data-lab",
    units: [
      {
        id: "reproducible-data",
        title: "可复现数据分析",
        summary: "从字段、清洗到统计结论保留完整证据。",
        lessons: [
          {
            id: "data-basics",
            title: "读取、清洗与统计",
            summary: "在固定 CSV/JSON 数据上运行统计函数、核对清洗规则并准备图表数据。",
            estimatedMinutes: 24,
            knowledgePointTags: ["数据结构", "数据清洗", "描述统计"],
            activityIds: ["high-python-data-lab-lesson"],
          },
          {
            id: "data-evidence-check",
            title: "保存可复现的数据证据",
            summary: "运行 CSV/JSON 双格式统计实验并通过评价，记录版本、清洗规则、结果与图表数据。",
            estimatedMinutes: 20,
            knowledgePointTags: ["数据清洗", "描述统计"],
            activityIds: [
              "high-python-data-lab-code",
              "high-python-data-lab-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "high-bubble-analysis",
    units: [
      {
        id: "algorithm-evidence",
        title: "算法、测试与复杂度",
        summary: "用确定性输入检查排序算法的正确性和代价。",
        lessons: [
          {
            id: "bubble-sort-analysis",
            title: "冒泡排序可复现实验",
            summary: "比较次数、边界情况和测试结果共同构成算法证据。",
            estimatedMinutes: 22,
            knowledgePointTags: ["循环不变量", "时间复杂度", "实验测量"],
            activityIds: ["high-bubble-analysis-review"],
          },
          {
            id: "bubble-sort-evidence",
            title: "比较次数与测试证据",
            summary: "运行排序实验并用边界输入核对复杂度结论。",
            estimatedMinutes: 20,
            knowledgePointTags: ["时间复杂度", "实验测量"],
            activityIds: [
              "high-bubble-analysis-code",
              "high-bubble-analysis-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "high-ml-pipeline",
    units: [
      {
        id: "data-splits",
        title: "机器学习完整流程",
        summary: "冻结切分规则后，才比较模型和指标。",
        lessons: [
          {
            id: "train-validate-test",
            title: "训练、验证与测试",
            summary: "建立基线并识别让测试集泄漏进决策的错误。",
            estimatedMinutes: 23,
            knowledgePointTags: ["数据切分", "基线模型", "数据泄漏"],
            activityIds: ["high-ml-pipeline-lesson"],
          },
          {
            id: "pipeline-evidence",
            title: "冻结切分、基线预测与泄漏审计",
            summary: "记录训练集基线预测，用测试集对照案例核对数据泄漏风险。",
            estimatedMinutes: 20,
            knowledgePointTags: ["数据切分", "数据泄漏"],
            activityIds: [
              "high-ml-pipeline-code",
              "high-ml-pipeline-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "high-classification-regression",
    units: [
      {
        id: "metrics-and-cost",
        title: "问题类型、边界指标与错误代价",
        summary: "从混淆矩阵和完整回归样本计算指标，检查零分母并解释错误代价。",
        lessons: [
          {
            id: "classification-metrics",
            title: "分类、回归与边界指标选择",
            summary: "统计混淆矩阵、完整回归样本和零分母边界，再引用错误代价作出选择。",
            estimatedMinutes: 22,
            knowledgePointTags: ["分类与回归", "精确率与召回率", "均方误差"],
            activityIds: ["high-classification-regression-lesson"],
          },
          {
            id: "classification-metrics-evidence",
            title: "计算指标、核对边界并解释错误代价",
            summary: "完成多组分类/回归指标实验，记录混淆矩阵、样本数和版本，再选择与任务风险匹配的指标。",
            estimatedMinutes: 20,
            knowledgePointTags: ["精确率与召回率", "均方误差"],
            activityIds: [
              "high-classification-regression-code",
              "high-classification-regression-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "high-neural-network-training",
    units: [
      {
        id: "optimization",
        title: "多轮训练、参数版本与泛化",
        summary: "用固定样本和参数集版本记录多轮损失，比较学习率与验证表现。",
        lessons: [
          {
            id: "gradient-descent",
            title: "梯度下降、多轮曲线与过拟合",
            summary: "记录每轮权重更新、学习率和参数集，再以训练/验证曲线判断泛化。",
            estimatedMinutes: 24,
            knowledgePointTags: ["损失函数", "梯度下降", "过拟合与正则化"],
            activityIds: ["high-neural-network-training-lesson"],
          },
          {
            id: "gradient-descent-evidence",
            title: "用版本化曲线检查训练与泛化",
            summary: "比较不同学习率的多轮曲线，保存样本数、最佳验证轮次并说明过拟合或正则化证据。",
            estimatedMinutes: 20,
            knowledgePointTags: ["梯度下降", "过拟合与正则化"],
            activityIds: [
              "high-neural-network-training-code",
              "high-neural-network-training-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "high-multimodal-ai",
    units: [
      {
        id: "modality-evidence",
        title: "输入模态与证据",
        summary: "冻结 multimodal-samples-v2 与 vision-inputs-v2，比较文本、图像、结构化和组合输入携带的证据。",
        lessons: [
          {
            id: "multimodal-inputs",
            title: "同一问题的不同输入",
            summary: "观察四种输入携带的信息差异，理解组合输入、授权和隐私边界。",
            estimatedMinutes: 20,
            knowledgePointTags: ["图像分类", "特征表示", "多模态输入"],
            activityIds: [
              "high-multimodal-ai-lesson",
            ],
          },
          {
            id: "multimodal-audit",
            title: "版本化对照、失败样本与输入来源",
            summary: "运行 v2 固定对照实验，记录四种模态结果、失败样本、授权排除和隐私限制。",
            estimatedMinutes: 24,
            knowledgePointTags: ["多模态输入", "失败样本"],
            activityIds: [
              "high-multimodal-ai-code",
              "high-multimodal-ai-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "high-generative-ai-rag",
    units: [
      {
        id: "retrieval-and-citations",
        title: "检索、生成与引用",
        summary: "使用 fixed-kb-v2/rag-query-v2 约束回答，并逐条核对引用、失败主张和工具权限。",
        lessons: [
          {
            id: "rag-basics",
            title: "上下文与检索增强",
            summary: "比较无检索和有检索回答，识别无来源与未支持主张。",
            estimatedMinutes: 20,
            knowledgePointTags: ["上下文与提示", "结构化输出", "检索增强"],
            activityIds: [
              "high-generative-ai-rag-lesson",
            ],
          },
          {
            id: "citation-check",
            title: "版本化引用、失败回答与工具权限",
            summary: "完成固定引用检查，记录 matched/unmatched 引用、unsupported_claims 和工具阻断边界。",
            estimatedMinutes: 24,
            knowledgePointTags: ["检索增强", "引用与权限"],
            activityIds: [
              "high-generative-ai-rag-code",
              "high-generative-ai-rag-assessment",
            ],
          },
        ],
      },
    ],
  },
  {
    courseId: "high-image-model-audit",
    units: [
      {
        id: "audit-evidence",
        title: "模型审计与限制",
        summary: "分析数据来源、分组表现和失败样本。",
        lessons: [
          {
            id: "audit-review",
            title: "读懂模型卡",
            summary: "从用途、数据切分和分组指标开始，定位模型可以回答什么问题。",
            estimatedMinutes: 18,
            knowledgePointTags: ["训练验证切分", "交叉熵", "模型审计"],
            activityIds: ["high-image-model-audit-review"],
          },
          {
            id: "audit-project-evidence",
            title: "保留失败样本与限制",
            summary: "把分组指标、失败案例和适用边界整理成可复核的模型证据。",
            estimatedMinutes: 22,
            knowledgePointTags: ["训练验证切分", "交叉熵", "模型审计"],
            activityIds: ["high-image-model-audit-project"],
          },
          {
            id: "audit-defense",
            title: "用证据说明审计结论",
            summary: "围绕数据、分组表现和失败样本，说明模型适用范围与部署限制。",
            estimatedMinutes: 20,
            knowledgePointTags: ["训练验证切分", "交叉熵", "模型审计"],
            activityIds: ["high-image-model-audit-defense"],
          },
        ],
      },
      {
        id: "capstone",
        title: "AI 综合项目与答辩",
        summary: "逐步整理研究问题、实验和项目答辩证据。",
        lessons: [
          {
            id: "capstone-project",
            title: "综合项目工作台",
            summary: "将可复现实验、限制说明和答辩回答整理为项目成果。",
            estimatedMinutes: 25,
            knowledgePointTags: ["训练验证切分", "交叉熵", "模型审计"],
            activityIds: ["high-capstone-project"],
          },
          {
            id: "capstone-defense",
            title: "用证据准备项目答辩",
            summary: "围绕方法、失败样本、限制和下一步，准备能引用实验证据的回答。",
            estimatedMinutes: 20,
            knowledgePointTags: ["训练验证切分", "交叉熵", "模型审计"],
            activityIds: ["high-capstone-defense"],
          },
        ],
      },
    ],
  },
];

const PLANNED_COURSE_OUTLINES: readonly PlannedCourseOutline[] = [];

const STRUCTURED_COURSES: readonly StructuredCourse[] = COURSE_STRUCTURE_SEEDS.map(
  buildStructuredCourse,
);
const ACTIVE_STAGES: readonly LearningPathStage[] = ["middle_school", "high_school"];

validateCourseStructures(STRUCTURED_COURSES, PLANNED_COURSE_OUTLINES);

export function getStructuredCourse(courseId: string): StructuredCourse | undefined {
  const course = STRUCTURED_COURSES.find((item) => item.course.id === courseId);
  return course ? structuredClone(course) : undefined;
}

export function getStructuredCoursesForStage(stage: LearningPathStage): StructuredCourse[] {
  const order = new Map(
    getCoursesForStage(stage).map((course, index) => [course.id, index]),
  );
  return STRUCTURED_COURSES
    .filter((item) => item.stage === stage)
    .sort((left, right) => (order.get(left.course.id) ?? 0) - (order.get(right.course.id) ?? 0))
    .map((item) => structuredClone(item));
}

/** Return the stage-safe structured catalog for one selected school grade. */
export function getStructuredCoursesForGrade(grade: LearningGradeId): StructuredCourse[] {
  const definition = getLearningGrade(grade);
  return definition.courseIds
    .map((courseId) => getStructuredCourse(courseId))
    .filter((course): course is StructuredCourse => course !== undefined && course.stage === definition.stage);
}

export function getCourseLesson(lessonId: LessonId): CourseLesson | undefined {
  for (const course of STRUCTURED_COURSES) {
    for (const unit of course.units) {
      const lesson = unit.lessons.find((item) => item.id === lessonId);
      if (lesson) return structuredClone(lesson);
    }
  }
  return undefined;
}

export function getCourseLessonForActivity(activityId: string): CourseLesson | undefined {
  for (const course of STRUCTURED_COURSES) {
    for (const unit of course.units) {
      const lesson = unit.lessons.find((item) => item.activityIds.includes(activityId));
      if (lesson) return structuredClone(lesson);
    }
  }
  return undefined;
}

export function getPlannedCourseOutlines(): PlannedCourseOutline[] {
  return structuredClone(PLANNED_COURSE_OUTLINES) as PlannedCourseOutline[];
}

export function validateCourseStructures(
  courses: readonly StructuredCourse[],
  plannedCourses: readonly PlannedCourseOutline[],
): void {
  const activeCourseIds = new Set(
    ACTIVE_STAGES
      .flatMap((stage) => getCoursesForStage(stage))
      .map((course) => course.id),
  );
  const structureIds = new Set<string>();
  const lessonIds = new Set<string>();
  const coveredActivityIds = new Set<string>();

  for (const structuredCourse of courses) {
    const course = getCourseById(structuredCourse.course.id);
    if (!course || course.stage !== structuredCourse.stage) {
      throw new Error(`Unknown or mismatched structured course: ${structuredCourse.course.id}`);
    }
    if (structureIds.has(course.id)) throw new Error(`Duplicate structured course: ${course.id}`);
    structureIds.add(course.id);
    const tags = new Set(course.knowledgePointTags);
    const lessons = structuredCourse.units.flatMap((unit) => unit.lessons);
    const activityCount = lessons.reduce((count, lesson) => count + lesson.activityIds.length, 0);
    if (structuredCourse.units.length < 1 || lessons.length < 2 || activityCount < 3) {
      throw new Error(`Course needs at least one unit, two lessons, and three activities: ${course.id}`);
    }

    for (const unit of structuredCourse.units) {
      if (unit.courseId !== course.id || unit.lessons.length === 0) {
        throw new Error(`Invalid course unit: ${unit.id}`);
      }
      for (const lesson of unit.lessons) {
        if (
          lesson.courseId !== course.id
          || lesson.unitId !== unit.id
          || lessonIds.has(lesson.id)
          || lesson.estimatedMinutes < 10
          || lesson.estimatedMinutes > 25
          || lesson.activityIds.length === 0
          || lesson.knowledgePointTags.length === 0
          || !lesson.knowledgePointTags.every((tag) => tags.has(tag))
        ) {
          throw new Error(`Invalid course lesson: ${lesson.id}`);
        }
        lessonIds.add(lesson.id);
        for (const activityId of lesson.activityIds) {
          const activity = getActivity(activityId);
          if (
            !activity
            || activity.courseId !== course.id
            || activity.stage !== structuredCourse.stage
            || coveredActivityIds.has(activityId)
          ) {
            throw new Error(`Invalid lesson activity reference: ${lesson.id} -> ${activityId}`);
          }
          coveredActivityIds.add(activityId);
        }
      }
    }
  }

  if (structureIds.size !== activeCourseIds.size || ![...activeCourseIds].every((id) => structureIds.has(id))) {
    throw new Error("Structured course coverage does not match active middle/high curriculum");
  }

  const configuredActivityIds = ACTIVE_STAGES
    .flatMap((stage) => getLearningPath(stage))
    .map((activity) => activity.id);
  if (
    configuredActivityIds.length !== coveredActivityIds.size
    || !configuredActivityIds.every((id) => coveredActivityIds.has(id))
  ) {
    throw new Error("Course lesson coverage does not match configured learning activities");
  }

  const plannedIds = new Set<string>();
  for (const plannedCourse of plannedCourses) {
    if (
      activeCourseIds.has(plannedCourse.id)
      || plannedIds.has(plannedCourse.id)
      || plannedCourse.knowledgePointTags.length < 2
      || plannedCourse.units.length === 0
    ) {
      throw new Error(`Invalid planned course outline: ${plannedCourse.id}`);
    }
    plannedIds.add(plannedCourse.id);
    for (const unit of plannedCourse.units) {
      if (unit.lessons.length === 0 || unit.lessons.some((lesson) => lesson.estimatedMinutes < 10 || lesson.estimatedMinutes > 25)) {
        throw new Error(`Invalid planned course unit: ${unit.id}`);
      }
    }
  }
}

function buildStructuredCourse(seed: CourseStructureSeed): StructuredCourse {
  const course = getCourseById(seed.courseId);
  if (!course || (course.stage !== "middle_school" && course.stage !== "high_school")) {
    throw new Error(`Cannot structure unknown or unsupported course: ${seed.courseId}`);
  }

  return {
    course,
    stage: course.stage,
    units: seed.units.map((unit) => ({
      id: `${seed.courseId}:${unit.id}`,
      courseId: seed.courseId,
      title: unit.title,
      summary: unit.summary,
      lessons: unit.lessons.map((lesson) => ({
        id: `${seed.courseId}:${unit.id}:${lesson.id}`,
        courseId: seed.courseId,
        unitId: `${seed.courseId}:${unit.id}`,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
        knowledgePointTags: [...lesson.knowledgePointTags],
        activityIds: [...lesson.activityIds],
        activityKinds: lesson.activityIds.map((activityId) => {
          const activity = getActivity(activityId);
          if (!activity) throw new Error(`Unknown course activity: ${activityId}`);
          return activity.kind;
        }),
      })),
    })),
  };
}
