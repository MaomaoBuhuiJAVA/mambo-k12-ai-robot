import { getCourseById } from "./curriculum";
import { LAB_TEMPLATE_IDS, type LabTemplateId } from "@/features/lab/lab-protocol";

export type LearningPathStage = "middle_school" | "high_school";

export type LearningActivityKind =
  | "lesson"
  | "demonstration"
  | "guided_lab"
  | "independent_lab"
  | "research_challenge"
  | "assessment"
  | "remediation"
  | "project"
  | "defense";

export type LearningCompletionPolicyId =
  | "lesson-reviewed"
  | "demonstration-reviewed"
  | "lab-evidence"
  | "assessment-passed"
  | "research-evidence"
  | "project-evidence"
  | "defense-evidence";

export type LearningActivity = {
  id: string;
  stage: LearningPathStage;
  title: string;
  kind: LearningActivityKind;
  courseId: string;
  labTemplateId?: LabTemplateId;
  prerequisites: string[];
  route: string;
  completionPolicyId: LearningCompletionPolicyId;
};

const completionPolicyIds = new Set<LearningCompletionPolicyId>([
  "lesson-reviewed",
  "demonstration-reviewed",
  "lab-evidence",
  "assessment-passed",
  "research-evidence",
  "project-evidence",
  "defense-evidence",
]);

export const LEARNING_ACTIVITIES: LearningActivity[] = [
  {
    id: "middle-ai-foundations-lesson",
    stage: "middle_school",
    title: "人工智能基础小课",
    kind: "lesson",
    courseId: "middle-ai-foundations",
    prerequisites: [],
    route: "/workspace?course=middle-ai-foundations",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "middle-ai-foundations-demonstration",
    stage: "middle_school",
    title: "规则与样本演示",
    kind: "demonstration",
    courseId: "middle-ai-foundations",
    prerequisites: ["middle-ai-foundations-lesson"],
    route: "/workspace?course=middle-ai-foundations&tab=animation",
    completionPolicyId: "demonstration-reviewed",
  },
  {
    id: "middle-ai-foundations-assessment",
    stage: "middle_school",
    title: "人工智能基础评价",
    kind: "assessment",
    courseId: "middle-ai-foundations",
    prerequisites: ["middle-ai-foundations-demonstration"],
    route: "/workspace?course=middle-ai-foundations&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "middle-data-and-algorithms-lesson",
    stage: "middle_school",
    title: "数据与算法小课",
    kind: "lesson",
    courseId: "middle-data-and-algorithms",
    prerequisites: ["middle-ai-foundations-assessment"],
    route: "/workspace?course=middle-data-and-algorithms",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "middle-data-and-algorithms-demonstration",
    stage: "middle_school",
    title: "星宝相邻比较示范",
    kind: "demonstration",
    courseId: "middle-data-and-algorithms",
    prerequisites: ["middle-data-and-algorithms-lesson"],
    route: "/workspace?course=middle-data-and-algorithms&tab=animation",
    completionPolicyId: "demonstration-reviewed",
  },
  {
    id: "middle-data-and-algorithms-lab",
    stage: "middle_school",
    title: "冒泡排序代码实验",
    kind: "independent_lab",
    courseId: "middle-data-and-algorithms",
    labTemplateId: "bubble-sort",
    prerequisites: ["middle-data-and-algorithms-demonstration"],
    route: "/lab?stage=middle_school&template=bubble-sort&mode=independent",
    completionPolicyId: "lab-evidence",
  },
  {
    id: "middle-data-and-algorithms-assessment",
    stage: "middle_school",
    title: "数据与算法评价",
    kind: "assessment",
    courseId: "middle-data-and-algorithms",
    prerequisites: ["middle-data-and-algorithms-lab"],
    route: "/workspace?course=middle-data-and-algorithms&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "middle-neural-signals-lesson",
    stage: "middle_school",
    title: "图像分类基础小课",
    kind: "lesson",
    courseId: "middle-neural-signals",
    prerequisites: ["middle-python-basics-assessment"],
    route: "/workspace?course=middle-neural-signals",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "middle-python-basics-lesson",
    stage: "middle_school",
    title: "Python 编程入门小课",
    kind: "lesson",
    courseId: "middle-python-basics",
    prerequisites: ["middle-data-and-algorithms-assessment"],
    route: "/workspace?course=middle-python-basics",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "middle-python-basics-demonstration",
    stage: "middle_school",
    title: "星宝筛选函数示范",
    kind: "demonstration",
    courseId: "middle-python-basics",
    prerequisites: ["middle-python-basics-lesson"],
    route: "/workspace?course=middle-python-basics&tab=animation",
    completionPolicyId: "demonstration-reviewed",
  },
  {
    id: "middle-python-basics-lab",
    stage: "middle_school",
    title: "Python 器材清单实验",
    kind: "independent_lab",
    courseId: "middle-python-basics",
    labTemplateId: "middle-python-basics",
    prerequisites: ["middle-python-basics-demonstration"],
    route: "/lab?stage=middle_school&template=middle-python-basics&mode=independent",
    completionPolicyId: "lab-evidence",
  },
  {
    id: "middle-python-basics-assessment",
    stage: "middle_school",
    title: "Python 编程基础评价",
    kind: "assessment",
    courseId: "middle-python-basics",
    prerequisites: ["middle-python-basics-lab"],
    route: "/workspace?course=middle-python-basics&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "middle-neural-signals-demonstration",
    stage: "middle_school",
    title: "星宝前向传播示范",
    kind: "demonstration",
    courseId: "middle-neural-signals",
    prerequisites: ["middle-neural-signals-lesson"],
    route: "/workspace?course=middle-neural-signals&tab=animation",
    completionPolicyId: "demonstration-reviewed",
  },
  {
    id: "middle-neural-signals-guided-lab",
    stage: "middle_school",
    title: "图像分类引导实验",
    kind: "guided_lab",
    courseId: "middle-neural-signals",
    labTemplateId: "image-classifier",
    prerequisites: ["middle-neural-signals-demonstration"],
    route: "/lab?stage=middle_school&template=image-classifier&mode=guided",
    completionPolicyId: "lab-evidence",
  },
  {
    id: "middle-neural-signals-independent-lab",
    stage: "middle_school",
    title: "图像分类独立实验",
    kind: "independent_lab",
    courseId: "middle-neural-signals",
    labTemplateId: "image-classifier",
    prerequisites: ["middle-neural-signals-guided-lab"],
    route: "/lab?stage=middle_school&template=image-classifier&mode=independent",
    completionPolicyId: "lab-evidence",
  },
  {
    id: "middle-neural-signals-assessment",
    stage: "middle_school",
    title: "图像分类知识点评价",
    kind: "assessment",
    courseId: "middle-neural-signals",
    prerequisites: ["middle-neural-signals-independent-lab"],
    route: "/workspace?course=middle-neural-signals&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "middle-model-evaluation-lesson",
    stage: "middle_school",
    title: "模型评价基础小课",
    kind: "lesson",
    courseId: "middle-model-evaluation",
    prerequisites: ["middle-neural-signals-assessment"],
    route: "/workspace?course=middle-model-evaluation",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "middle-model-evaluation-demonstration",
    stage: "middle_school",
    title: "星宝测试集评价示范",
    kind: "demonstration",
    courseId: "middle-model-evaluation",
    prerequisites: ["middle-model-evaluation-lesson"],
    route: "/workspace?course=middle-model-evaluation&tab=animation",
    completionPolicyId: "demonstration-reviewed",
  },
  {
    id: "middle-model-evaluation-assessment",
    stage: "middle_school",
    title: "模型评价知识点评价",
    kind: "assessment",
    courseId: "middle-model-evaluation",
    prerequisites: ["middle-model-evaluation-demonstration"],
    route: "/workspace?course=middle-model-evaluation&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "middle-data-bias-lesson",
    stage: "middle_school",
    title: "数据偏差调查小课",
    kind: "lesson",
    courseId: "middle-data-bias",
    prerequisites: ["middle-model-evaluation-assessment"],
    route: "/workspace?course=middle-data-bias",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "middle-data-bias-demonstration",
    stage: "middle_school",
    title: "星宝分组指标示范",
    kind: "demonstration",
    courseId: "middle-data-bias",
    prerequisites: ["middle-data-bias-lesson"],
    route: "/workspace?course=middle-data-bias&tab=animation",
    completionPolicyId: "demonstration-reviewed",
  },
  {
    id: "middle-data-bias-research",
    stage: "middle_school",
    title: "逆光分类研究挑战",
    kind: "research_challenge",
    courseId: "middle-data-bias",
    labTemplateId: "image-classifier",
    prerequisites: ["middle-data-bias-demonstration"],
    route: "/lab?stage=middle_school&template=image-classifier&mode=research",
    completionPolicyId: "research-evidence",
  },
  {
    id: "middle-data-bias-assessment",
    stage: "middle_school",
    title: "数据偏差知识点评价",
    kind: "assessment",
    courseId: "middle-data-bias",
    prerequisites: ["middle-data-bias-research"],
    route: "/workspace?course=middle-data-bias&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "middle-ai-safety-lesson",
    stage: "middle_school",
    title: "AI 安全情境小课",
    kind: "lesson",
    courseId: "middle-ai-safety",
    prerequisites: ["middle-generative-ai-assessment"],
    route: "/workspace?course=middle-ai-safety",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "middle-generative-ai-lesson",
    stage: "middle_school",
    title: "生成式 AI 与提示设计小课",
    kind: "lesson",
    courseId: "middle-generative-ai",
    prerequisites: ["middle-data-bias-assessment"],
    route: "/workspace?course=middle-generative-ai",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "middle-generative-ai-demonstration",
    stage: "middle_school",
    title: "星宝提示词约束示范",
    kind: "demonstration",
    courseId: "middle-generative-ai",
    prerequisites: ["middle-generative-ai-lesson"],
    route: "/workspace?course=middle-generative-ai&tab=animation",
    completionPolicyId: "demonstration-reviewed",
  },
  {
    id: "middle-generative-ai-assessment",
    stage: "middle_school",
    title: "提示设计与核对评价",
    kind: "assessment",
    courseId: "middle-generative-ai",
    prerequisites: ["middle-generative-ai-demonstration"],
    route: "/workspace?course=middle-generative-ai&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "middle-ai-safety-demonstration",
    stage: "middle_school",
    title: "星宝安全证据判断示范",
    kind: "demonstration",
    courseId: "middle-ai-safety",
    prerequisites: ["middle-ai-safety-lesson"],
    route: "/workspace?course=middle-ai-safety&tab=animation",
    completionPolicyId: "demonstration-reviewed",
  },
  {
    id: "middle-ai-safety-assessment",
    stage: "middle_school",
    title: "AI 安全知识点评价",
    kind: "assessment",
    courseId: "middle-ai-safety",
    prerequisites: ["middle-ai-safety-demonstration"],
    route: "/workspace?course=middle-ai-safety&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "high-python-data-lab-lesson", stage: "high_school", title: "Python 数据基础小课", kind: "lesson", courseId: "high-python-data-lab", prerequisites: [], route: "/workspace?course=high-python-data-lab", completionPolicyId: "lesson-reviewed",
  },
  {
    id: "high-python-data-lab-code", stage: "high_school", title: "CSV / JSON 双格式统计实验", kind: "independent_lab", courseId: "high-python-data-lab", labTemplateId: "python-data-basics", prerequisites: ["high-python-data-lab-lesson"], route: "/lab?stage=high_school&template=python-data-basics&mode=independent", completionPolicyId: "lab-evidence",
  },
  {
    id: "high-python-data-lab-assessment", stage: "high_school", title: "数据基础评价", kind: "assessment", courseId: "high-python-data-lab", prerequisites: ["high-python-data-lab-code"], route: "/workspace?course=high-python-data-lab&tab=exercise", completionPolicyId: "assessment-passed",
  },
  {
    id: "high-bubble-analysis-review",
    stage: "high_school",
    title: "排序算法概念复习",
    kind: "lesson",
    courseId: "high-bubble-analysis",
    prerequisites: ["high-python-data-lab-assessment"],
    route: "/workspace?course=high-bubble-analysis",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "high-bubble-analysis-code",
    stage: "high_school",
    title: "冒泡排序可复现实验",
    kind: "independent_lab",
    courseId: "high-bubble-analysis",
    labTemplateId: "bubble-sort-analysis",
    prerequisites: ["high-bubble-analysis-review"],
    route: "/lab?stage=high_school&template=bubble-sort-analysis&mode=independent",
    completionPolicyId: "lab-evidence",
  },
  {
    id: "high-bubble-analysis-assessment",
    stage: "high_school",
    title: "排序算法证据评价",
    kind: "assessment",
    courseId: "high-bubble-analysis",
    prerequisites: ["high-bubble-analysis-code"],
    route: "/workspace?course=high-bubble-analysis&tab=exercise",
    completionPolicyId: "assessment-passed",
  },
  {
    id: "high-ml-pipeline-lesson", stage: "high_school", title: "机器学习流程小课", kind: "lesson", courseId: "high-ml-pipeline", prerequisites: ["high-bubble-analysis-assessment"], route: "/workspace?course=high-ml-pipeline", completionPolicyId: "lesson-reviewed",
  },
  {
    id: "high-ml-pipeline-code", stage: "high_school", title: "基线预测与泄漏审计实验", kind: "independent_lab", courseId: "high-ml-pipeline", labTemplateId: "dataset-split", prerequisites: ["high-ml-pipeline-lesson"], route: "/lab?stage=high_school&template=dataset-split&mode=independent", completionPolicyId: "lab-evidence",
  },
  {
    id: "high-ml-pipeline-assessment", stage: "high_school", title: "机器学习流程评价", kind: "assessment", courseId: "high-ml-pipeline", prerequisites: ["high-ml-pipeline-code"], route: "/workspace?course=high-ml-pipeline&tab=exercise", completionPolicyId: "assessment-passed",
  },
  {
    id: "high-classification-regression-lesson", stage: "high_school", title: "分类、回归与边界指标小课", kind: "lesson", courseId: "high-classification-regression", prerequisites: ["high-ml-pipeline-assessment"], route: "/workspace?course=high-classification-regression", completionPolicyId: "lesson-reviewed",
  },
  {
    id: "high-classification-regression-code", stage: "high_school", title: "分类/回归指标与错误代价实验", kind: "independent_lab", courseId: "high-classification-regression", labTemplateId: "classification-metrics", prerequisites: ["high-classification-regression-lesson"], route: "/lab?stage=high_school&template=classification-metrics&mode=independent", completionPolicyId: "lab-evidence",
  },
  {
    id: "high-classification-regression-assessment", stage: "high_school", title: "分类/回归指标解释与版本证据", kind: "assessment", courseId: "high-classification-regression", prerequisites: ["high-classification-regression-code"], route: "/workspace?course=high-classification-regression&tab=exercise", completionPolicyId: "assessment-passed",
  },
  {
    id: "high-neural-network-training-lesson", stage: "high_school", title: "多轮神经网络训练与泛化小课", kind: "lesson", courseId: "high-neural-network-training", prerequisites: ["high-classification-regression-assessment"], route: "/workspace?course=high-neural-network-training", completionPolicyId: "lesson-reviewed",
  },
  {
    id: "high-neural-network-training-code", stage: "high_school", title: "多轮训练曲线与过拟合实验", kind: "independent_lab", courseId: "high-neural-network-training", labTemplateId: "gradient-descent-demo", prerequisites: ["high-neural-network-training-lesson"], route: "/lab?stage=high_school&template=gradient-descent-demo&mode=independent", completionPolicyId: "lab-evidence",
  },
  {
    id: "high-neural-network-training-assessment", stage: "high_school", title: "训练曲线复现与泛化评价", kind: "assessment", courseId: "high-neural-network-training", prerequisites: ["high-neural-network-training-code"], route: "/workspace?course=high-neural-network-training&tab=exercise", completionPolicyId: "assessment-passed",
  },
  {
    id: "high-multimodal-ai-lesson", stage: "high_school", title: "版本化多模态输入小课", kind: "lesson", courseId: "high-multimodal-ai", prerequisites: ["high-neural-network-training-assessment"], route: "/workspace?course=high-multimodal-ai", completionPolicyId: "lesson-reviewed",
  },
  {
    id: "high-multimodal-ai-code", stage: "high_school", title: "四种输入版本对照实验", kind: "independent_lab", courseId: "high-multimodal-ai", labTemplateId: "multimodal-input-audit", prerequisites: ["high-multimodal-ai-lesson"], route: "/lab?stage=high_school&template=multimodal-input-audit&mode=independent", completionPolicyId: "lab-evidence",
  },
  {
    id: "high-multimodal-ai-assessment", stage: "high_school", title: "失败样本与授权边界评价", kind: "assessment", courseId: "high-multimodal-ai", prerequisites: ["high-multimodal-ai-code"], route: "/workspace?course=high-multimodal-ai&tab=exercise", completionPolicyId: "assessment-passed",
  },
  {
    id: "high-generative-ai-rag-lesson", stage: "high_school", title: "固定知识库与检索增强小课", kind: "lesson", courseId: "high-generative-ai-rag", prerequisites: ["high-multimodal-ai-assessment"], route: "/workspace?course=high-generative-ai-rag", completionPolicyId: "lesson-reviewed",
  },
  {
    id: "high-generative-ai-rag-code", stage: "high_school", title: "无/有检索与失败回答实验", kind: "independent_lab", courseId: "high-generative-ai-rag", labTemplateId: "rag-citation-check", prerequisites: ["high-generative-ai-rag-lesson"], route: "/lab?stage=high_school&template=rag-citation-check&mode=independent", completionPolicyId: "lab-evidence",
  },
  {
    id: "high-generative-ai-rag-assessment", stage: "high_school", title: "引用匹配与工具权限评价", kind: "assessment", courseId: "high-generative-ai-rag", prerequisites: ["high-generative-ai-rag-code"], route: "/workspace?course=high-generative-ai-rag&tab=exercise", completionPolicyId: "assessment-passed",
  },
  {
    id: "high-image-model-audit-review",
    stage: "high_school",
    title: "图像模型审计阅读",
    kind: "lesson",
    courseId: "high-image-model-audit",
    prerequisites: ["high-generative-ai-rag-assessment"],
    route: "/workspace?course=high-image-model-audit",
    completionPolicyId: "lesson-reviewed",
  },
  {
    id: "high-image-model-audit-project",
    stage: "high_school",
    title: "图像模型审计项目",
    kind: "project",
    courseId: "high-image-model-audit",
    labTemplateId: "model-audit",
    prerequisites: ["high-image-model-audit-review"],
    route: "/learn/project/model-audit",
    completionPolicyId: "project-evidence",
  },
  {
    id: "high-image-model-audit-defense",
    stage: "high_school",
    title: "图像模型审计答辩",
    kind: "defense",
    courseId: "high-image-model-audit",
    prerequisites: ["high-image-model-audit-project"],
    route: "/learn/project/model-audit",
    completionPolicyId: "defense-evidence",
  },
  {
    id: "high-capstone-project", stage: "high_school", title: "AI 综合项目", kind: "project", courseId: "high-image-model-audit", prerequisites: ["high-image-model-audit-defense"], route: "/learn/project/capstone", completionPolicyId: "project-evidence",
  },
  {
    id: "high-capstone-defense", stage: "high_school", title: "星宝项目答辩", kind: "defense", courseId: "high-image-model-audit", prerequisites: ["high-capstone-project"], route: "/learn/project/capstone", completionPolicyId: "defense-evidence",
  },
];

export function validateLearningActivities(activities: readonly LearningActivity[]): void {
  const activitiesById = new Map<string, LearningActivity>();

  for (const activity of activities) {
    if (activitiesById.has(activity.id)) {
      throw new Error(`Duplicate learning activity ID: ${activity.id}`);
    }
    activitiesById.set(activity.id, activity);

    const course = getCourseById(activity.courseId);
    if (!course) throw new Error(`Unknown course ID: ${activity.courseId}`);
    if (course.stage !== activity.stage) {
      throw new Error(`Course stage does not match learning activity stage: ${activity.id}`);
    }
    if (activity.labTemplateId && !LAB_TEMPLATE_IDS.includes(activity.labTemplateId)) {
      throw new Error(`Unknown lab template ID: ${activity.labTemplateId}`);
    }
    if (!completionPolicyIds.has(activity.completionPolicyId)) {
      throw new Error(`Unknown learning completion policy: ${activity.completionPolicyId}`);
    }
    if (!activity.route.startsWith("/") || activity.route.startsWith("//")) {
      throw new Error(`Learning activity route must be an internal pathname: ${activity.route}`);
    }
  }

  for (const activity of activities) {
    for (const prerequisiteId of activity.prerequisites) {
      const prerequisite = activitiesById.get(prerequisiteId);
      if (!prerequisite) {
        throw new Error(`Unknown prerequisite activity ID: ${prerequisiteId}`);
      }
      if (prerequisite.stage !== activity.stage) {
        throw new Error(`Cross-stage prerequisite: ${activity.id} -> ${prerequisiteId}`);
      }
    }
  }

  const visitState = new Map<string, "visiting" | "visited">();
  const visit = (activityId: string) => {
    const state = visitState.get(activityId);
    if (state === "visiting") throw new Error(`Cycle detected in learning activities: ${activityId}`);
    if (state === "visited") return;

    visitState.set(activityId, "visiting");
    for (const prerequisiteId of activitiesById.get(activityId)!.prerequisites) visit(prerequisiteId);
    visitState.set(activityId, "visited");
  };

  for (const activity of activities) visit(activity.id);

  for (const stage of ["middle_school", "high_school"] as const) {
    const entries = activities.filter((activity) => activity.stage === stage && activity.prerequisites.length === 0);
    if (entries.length !== 1) {
      throw new Error(`Expected one entry activity for ${stage}, found ${entries.length}`);
    }
  }
}

validateLearningActivities(LEARNING_ACTIVITIES);

export function getLearningPath(stage: LearningPathStage): LearningActivity[] {
  const remaining = LEARNING_ACTIVITIES.filter((activity) => activity.stage === stage);
  const ordered: LearningActivity[] = [];
  const completedIds = new Set<string>();

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex((activity) =>
      activity.prerequisites.every((prerequisiteId) => completedIds.has(prerequisiteId)),
    );
    if (nextIndex < 0) {
      throw new Error(`Unable to topologically order ${stage} learning path`);
    }
    const [next] = remaining.splice(nextIndex, 1);
    if (!next) throw new Error(`Unable to read ${stage} learning activity`);
    ordered.push(next);
    completedIds.add(next.id);
  }

  return structuredClone(ordered);
}

export function getActivity(activityId: string): LearningActivity | undefined {
  const activity = LEARNING_ACTIVITIES.find((candidate) => candidate.id === activityId);
  return activity ? structuredClone(activity) : undefined;
}

export function isActivityUnlocked(activityId: string, completedActivityIds: readonly string[]): boolean {
  const activity = LEARNING_ACTIVITIES.find((candidate) => candidate.id === activityId);
  if (!activity) return false;

  const completed = new Set(completedActivityIds);
  return activity.prerequisites.every((prerequisiteId) => completed.has(prerequisiteId));
}
