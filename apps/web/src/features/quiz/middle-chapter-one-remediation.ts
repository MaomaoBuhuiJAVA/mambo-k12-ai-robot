import { getHighSchoolRemediation, getHighSchoolRemediationForExercise } from "./high-school-remediation";

export interface MisconceptionRemediation {
  readonly tag: string;
  readonly title: string;
  readonly explanation: string;
  readonly example: string;
  readonly activityId?: string;
  readonly nextStep?: string;
  readonly route?: string;
}

const REMEDIATIONS: readonly MisconceptionRemediation[] = [
  {
    tag: "预测等于事实",
    title: "预测还需要核对",
    explanation: "模型依据已有样本和特征给出预测；遮挡、陌生场景或样本不足都可能让预测出错。",
    example: "图片被遮住时模型预测“水杯”，应再观察瓶盖、把手或请人工核对，而不是直接把预测当作事实。",
  },
  {
    tag: "标签和特征混淆",
    title: "特征是线索，标签是类别名",
    explanation: "特征是颜色、形状、边缘等可比较线索；标签是“水杯”“书本”等已知类别名称。",
    example: "“有把手”是特征，“水杯”是标签。先记录特征，再由模型根据特征预测标签。",
  },
  {
    tag: "只看总体准确率",
    title: "总体数据会遮住分组差异",
    explanation: "把表现不同的场景混在一起统计，可能掩盖某一组持续较差的结果。",
    example: "室内组 9/10、逆光组 4/10 时，应补充逆光场景样本并重新评估，而不是只报告总体 13/20。",
  },
];

const EXERCISE_TAGS: Readonly<Record<string, MisconceptionRemediation["tag"]>> = {
  "middle-ai-foundations-order": "标签和特征混淆",
  "middle-ai-foundations-result": "预测等于事实",
  "middle-data-bias-choice": "只看总体准确率",
  "middle-data-bias-result": "只看总体准确率",
};

export function getMisconceptionForExercise(exerciseId: string): MisconceptionRemediation | undefined {
  const tag = EXERCISE_TAGS[exerciseId];
  const middleRemediation = REMEDIATIONS.find((remediation) => remediation.tag === tag);
  if (middleRemediation) return middleRemediation;
  return getHighSchoolRemediationForExercise(exerciseId);
}

export function getMisconceptionRemediation(tag: string): MisconceptionRemediation | undefined {
  return REMEDIATIONS.find((remediation) => remediation.tag === tag) ?? getHighSchoolRemediation(tag);
}
