export type HighSchoolCourseId =
  | "high-python-data-lab"
  | "high-bubble-analysis"
  | "high-ml-pipeline"
  | "high-classification-regression"
  | "high-neural-network-training"
  | "high-multimodal-ai"
  | "high-generative-ai-rag"
  | "high-image-model-audit";

export interface HighSchoolRemediationActivity {
  readonly activityId: string;
  readonly courseId: HighSchoolCourseId;
  readonly tag: string;
  readonly title: string;
  readonly explanation: string;
  readonly example: string;
  readonly nextStep: string;
  readonly triggerExerciseIds: readonly string[];
  readonly retestExerciseIds: readonly string[];
  readonly route: string;
}

const REMEDIATIONS: readonly HighSchoolRemediationActivity[] = [
  {
    activityId: "high-python-data-lab-remediation",
    courseId: "high-python-data-lab",
    tag: "数据清洗规则未记录",
    title: "先记录清洗规则，再计算统计",
    explanation: "统计结果只有在输入格式、原始行数、缺失值和处理规则都留下时才可复核。不要只保留最后一个平均值。",
    example: "scores-json-v1 和 scores-csv-v1 各有 4 条记录，其中 1 条 score 缺失；按跳过缺失记录的规则，两个格式都应留下有效记录数 3。",
    nextStep: "重新运行双格式实验，填写数据集版本、缺失值规则、有效行数和图表数据，再复测本课题目。",
    triggerExerciseIds: ["high-python-data-lab-choice", "high-python-data-lab-order", "high-python-data-lab-trace"],
    retestExerciseIds: ["high-python-data-lab-order", "high-python-data-lab-trace"],
    route: "/learn/practice/course--high-python-data-lab?stage=high_school&remediation=high-python-data-lab-remediation",
  },
  {
    activityId: "high-bubble-analysis-remediation",
    courseId: "high-bubble-analysis",
    tag: "算法边界未验证",
    title: "用边界输入重新核对排序",
    explanation: "一次随机输入通过不能证明排序算法正确。已有序、逆序、重复值、空列表和单元素输入要使用同一计数口径分别检查。",
    example: "长度为 5 的逆序输入最多需要 10 次相邻比较；空列表和单元素列表应保持原样且不报错。",
    nextStep: "重新运行有序、逆序、重复值和空输入四组案例，保存比较次数后复测复杂度题。",
    triggerExerciseIds: ["high-bubble-analysis-choice", "high-bubble-analysis-order", "high-bubble-analysis-trace"],
    retestExerciseIds: ["high-bubble-analysis-order", "high-bubble-analysis-trace"],
    route: "/learn/practice/course--high-bubble-analysis?stage=high_school&remediation=high-bubble-analysis-remediation",
  },
  {
    activityId: "high-ml-pipeline-remediation",
    courseId: "high-ml-pipeline",
    tag: "测试集泄漏",
    title: "冻结测试集，重建基线",
    explanation: "测试集只能用于最后核验。用测试标签选择基线或反复调参会让结果偏乐观，程序应保留泄漏对照而不是删除它。",
    example: "训练集多数类为 cat 时，测试预测应来自 cat；把 baseline_source 改成 test 的对照必须标记 leakage_detected=true。",
    nextStep: "恢复 baseline_source=train，保存固定切分、训练基线预测和泄漏对照，再复测流程排序题。",
    triggerExerciseIds: ["high-ml-pipeline-choice", "high-ml-pipeline-order", "high-ml-pipeline-trace"],
    retestExerciseIds: ["high-ml-pipeline-choice", "high-ml-pipeline-order"],
    route: "/learn/practice/course--high-ml-pipeline?stage=high_school&remediation=high-ml-pipeline-remediation",
  },
  {
    activityId: "high-classification-regression-remediation",
    courseId: "high-classification-regression",
    tag: "指标与错误代价不匹配",
    title: "从混淆矩阵和完整样本选指标",
    explanation: "准确率、精确率、召回率、F1 和 MSE 回答不同问题。先统计全部样本和四个混淆矩阵计数，再按漏检或误报代价选择指标。",
    example: "没有真实正例或没有正预测时，precision、recall 和 F1 按课程规则记为 0；漏检代价高时优先关注 recall。",
    nextStep: "重新填写 tp/fp/fn/tn、回归样本数和错误代价，复测分类与回归判断题。",
    triggerExerciseIds: ["high-classification-regression-choice", "high-classification-regression-order", "high-classification-regression-trace"],
    retestExerciseIds: ["high-classification-regression-choice", "high-classification-regression-trace"],
    route: "/learn/practice/course--high-classification-regression?stage=high_school&remediation=high-classification-regression-remediation",
  },
  {
    activityId: "high-neural-network-training-remediation",
    courseId: "high-neural-network-training",
    tag: "训练曲线证据不完整",
    title: "保存等长的训练与验证曲线",
    explanation: "只看最后一轮会丢失最佳泛化点。每一轮都要同时保存训练损失和验证损失，并记录学习率、参数集版本和样本数。",
    example: "验证损失在第 3 轮最低、之后回升，而训练损失继续下降时，应标记 overfit_detected=true，并讨论早停或正则化。",
    nextStep: "用至少 5 轮固定曲线重新运行，填写 best_step 和 overfit_detected，再复测过拟合判断题。",
    triggerExerciseIds: ["high-neural-network-training-choice", "high-neural-network-training-order", "high-neural-network-training-trace"],
    retestExerciseIds: ["high-neural-network-training-order", "high-neural-network-training-trace"],
    route: "/learn/practice/course--high-neural-network-training?stage=high_school&remediation=high-neural-network-training-remediation",
  },
  {
    activityId: "high-multimodal-ai-remediation",
    courseId: "high-multimodal-ai",
    tag: "模态来源或授权边界缺失",
    title: "保留失败样本和授权排除",
    explanation: "组合输入分数更高不等于所有输入都可用。必须固定数据集/输入版本，记录 source_id、失败样本，以及未授权或 restricted 输入的排除原因。",
    example: "structured:s2 未获授权时不能计入准确率，但要作为 excluded_samples 和隐私边界保留在证据中。",
    nextStep: "重新运行四种模态对照，补齐来源和授权字段，再复测结果解释题。",
    triggerExerciseIds: ["high-multimodal-ai-choice", "high-multimodal-ai-order", "high-multimodal-ai-trace", "high-multimodal-ai-result"],
    retestExerciseIds: ["high-multimodal-ai-result", "high-multimodal-ai-order"],
    route: "/learn/practice/course--high-multimodal-ai?stage=high_school&remediation=high-multimodal-ai-remediation",
  },
  {
    activityId: "high-generative-ai-rag-remediation",
    courseId: "high-generative-ai-rag",
    tag: "引用与工具权限未核对",
    title: "回到固定知识库核对主张",
    explanation: "有检索只代表找到了一些来源，不能自动证明整段回答正确。未知引用、未支持主张和被阻断的工具请求都要保留。",
    example: "fixed-kb-v2 中没有“周末免费开放”时，无检索和有检索回答都应标记 unsupported_claims；web_search 和 code_execution 只能进入 blocked_tools。",
    nextStep: "重新运行无检索/有检索对照，填写 matched/unmatched citations、unsupported_claims 和工具白名单，再复测引用题。",
    triggerExerciseIds: ["high-generative-ai-rag-choice", "high-generative-ai-rag-order", "high-generative-ai-rag-trace", "high-generative-ai-rag-result"],
    retestExerciseIds: ["high-generative-ai-rag-result", "high-generative-ai-rag-order"],
    route: "/learn/practice/course--high-generative-ai-rag?stage=high_school&remediation=high-generative-ai-rag-remediation",
  },
  {
    activityId: "high-image-model-audit-remediation",
    courseId: "high-image-model-audit",
    tag: "总体指标掩盖分组失败",
    title: "补齐模型卡中的分组证据",
    explanation: "整体准确率不能替代按场景或群体的检查。模型卡必须说明数据切分、分组指标、失败样本、适用范围和限制。",
    example: "逆光组持续错误时，应保留该组失败样本和数据来源，不能因为室内组分数较高就删除逆光结果。",
    nextStep: "重新整理模型卡的分组指标和失败案例，再复测测试集与模型限制题。",
    triggerExerciseIds: ["high-image-model-audit-choice", "high-image-model-audit-order", "high-image-model-audit-trace"],
    retestExerciseIds: ["high-image-model-audit-choice", "high-image-model-audit-order"],
    route: "/learn/practice/course--high-image-model-audit?stage=high_school&remediation=high-image-model-audit-remediation",
  },
];

const BY_EXERCISE = new Map(
  REMEDIATIONS.flatMap((remediation) => remediation.triggerExerciseIds.map((exerciseId) => [exerciseId, remediation] as const)),
);

export function getHighSchoolRemediationForCourse(courseId: string): HighSchoolRemediationActivity | undefined {
  return REMEDIATIONS.find((remediation) => remediation.courseId === courseId);
}

export function getHighSchoolRemediationForExercise(exerciseId: string): HighSchoolRemediationActivity | undefined {
  return BY_EXERCISE.get(exerciseId);
}

export function getHighSchoolRemediationActivity(activityId: string): HighSchoolRemediationActivity | undefined {
  return REMEDIATIONS.find((remediation) => remediation.activityId === activityId);
}

export function getHighSchoolRemediation(tag: string): HighSchoolRemediationActivity | undefined {
  return REMEDIATIONS.find((remediation) => remediation.tag === tag);
}

export function getHighSchoolRemediations(): HighSchoolRemediationActivity[] {
  return REMEDIATIONS.map((remediation) => ({
    ...remediation,
    triggerExerciseIds: [...remediation.triggerExerciseIds],
    retestExerciseIds: [...remediation.retestExerciseIds],
  }));
}
