export const RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID = "middle-data-bias-research";
export const RESEARCH_CHALLENGE_VERSION = 1;
export const RESEARCH_BACKLIT_BASELINE_ACCURACY = 4;
export const RESEARCH_BACKLIT_TARGET_ACCURACY = 7;
export const RESEARCH_GROUP_SIZE = 10;
export const RESEARCH_REMEDIATION_ACTIVITY_ID = "middle-data-bias-lesson";

export type ResearchSampleId =
  | "backlit-leaf"
  | "backlit-ball"
  | "backlit-cup"
  | "indoor-bright";

export interface ResearchSampleOption {
  readonly id: ResearchSampleId;
  readonly label: string;
  readonly group: "backlit" | "indoor";
  readonly description: string;
}

export interface ResearchImageClassificationAttempt {
  readonly runId: string;
  readonly selectedSampleIds: readonly ResearchSampleId[];
  readonly indoorAccuracy: number;
  readonly backlitAccuracy: number;
  readonly overallAccuracy: number;
  readonly overallCorrect: number;
  readonly overallTotal: number;
  readonly overallPercent: number;
  readonly completedAt: string;
}

export interface ResearchChallengeEvaluation {
  readonly passed: boolean;
  readonly attemptsComplete: boolean;
  readonly comparedOutcomes: boolean;
  readonly targetedSamplesComplete: boolean;
  readonly targetReached: boolean;
  readonly conclusionConsistent: boolean;
  readonly feedback: string;
  readonly remediationActivityId: string | null;
}

export const RESEARCH_SAMPLE_OPTIONS: readonly ResearchSampleOption[] = [
  {
    id: "backlit-leaf",
    label: "逆光叶子样本",
    group: "backlit",
    description: "补充逆光条件下叶子轮廓不清晰的样本。",
  },
  {
    id: "backlit-ball",
    label: "逆光球样本",
    group: "backlit",
    description: "补充逆光条件下球体明暗反转的样本。",
  },
  {
    id: "backlit-cup",
    label: "逆光杯子样本",
    group: "backlit",
    description: "补充逆光条件下杯把细节缺失的样本。",
  },
  {
    id: "indoor-bright",
    label: "室内明亮样本",
    group: "indoor",
    description: "补充原本表现稳定的室内明亮图片。",
  },
];

const SAMPLE_IDS = new Set<ResearchSampleId>(RESEARCH_SAMPLE_OPTIONS.map((sample) => sample.id));
const REQUIRED_BACKLIT_SAMPLE_IDS: readonly ResearchSampleId[] = [
  "backlit-leaf",
  "backlit-ball",
  "backlit-cup",
];

export function normalizeResearchSampleIds(sampleIds: readonly string[]): ResearchSampleId[] {
  return RESEARCH_SAMPLE_OPTIONS
    .map((sample) => sample.id)
    .filter((sampleId) => sampleIds.includes(sampleId));
}

export function calculateResearchImageClassificationAttempt(input: {
  runId: string;
  selectedSampleIds: readonly string[];
  completedAt: string;
}): ResearchImageClassificationAttempt | null {
  if (!input.runId || Number.isNaN(Date.parse(input.completedAt))) return null;
  const selectedSampleIds = normalizeResearchSampleIds(input.selectedSampleIds);
  if (input.selectedSampleIds.some((sampleId) => !SAMPLE_IDS.has(sampleId as ResearchSampleId))) return null;

  const selected = new Set(selectedSampleIds);
  const backlitAccuracy = RESEARCH_BACKLIT_BASELINE_ACCURACY
    + REQUIRED_BACKLIT_SAMPLE_IDS.filter((sampleId) => selected.has(sampleId)).length;
  const indoorAccuracy = 9 + (selected.has("indoor-bright") ? 1 : 0);

  return {
    runId: input.runId,
    selectedSampleIds,
    indoorAccuracy,
    backlitAccuracy,
    overallAccuracy: Math.round(((indoorAccuracy + backlitAccuracy) / 2) * 10) / 10,
    overallCorrect: indoorAccuracy + backlitAccuracy,
    overallTotal: RESEARCH_GROUP_SIZE * 2,
    overallPercent: Math.round(((indoorAccuracy + backlitAccuracy) / (RESEARCH_GROUP_SIZE * 2)) * 100),
    completedAt: input.completedAt,
  };
}

function hasAllTargetedBacklitSamples(attempts: readonly ResearchImageClassificationAttempt[]): boolean {
  return attempts.some((attempt) => {
    const selected = new Set(attempt.selectedSampleIds);
    return REQUIRED_BACKLIT_SAMPLE_IDS.every((sampleId) => selected.has(sampleId));
  });
}

function hasConsistentConclusion(conclusion: string): boolean {
  const normalized = conclusion.replaceAll(" ", "");
  return normalized.length >= 18
    && normalized.includes("逆光")
    && normalized.includes(`${RESEARCH_BACKLIT_BASELINE_ACCURACY}/${RESEARCH_GROUP_SIZE}`)
    && normalized.includes(`${RESEARCH_BACKLIT_TARGET_ACCURACY}/${RESEARCH_GROUP_SIZE}`)
    && (normalized.includes("补充") || normalized.includes("补样本"));
}

export function evaluateResearchImageClassificationChallenge(
  attempts: readonly ResearchImageClassificationAttempt[],
  conclusion: string,
): ResearchChallengeEvaluation {
  const attemptsComplete = attempts.length >= 2;
  const comparedOutcomes = new Set(attempts.map((attempt) => attempt.backlitAccuracy)).size >= 2;
  const targetedSamplesComplete = hasAllTargetedBacklitSamples(attempts);
  const targetReached = attempts.some(
    (attempt) => attempt.backlitAccuracy >= RESEARCH_BACKLIT_TARGET_ACCURACY,
  );
  const conclusionConsistent = hasConsistentConclusion(conclusion);
  const passed = attemptsComplete
    && comparedOutcomes
    && targetedSamplesComplete
    && targetReached
    && conclusionConsistent;

  if (passed) {
    return {
      passed,
      attemptsComplete,
      comparedOutcomes,
      targetedSamplesComplete,
      targetReached,
      conclusionConsistent,
      feedback: "研究证据完整：逆光组指标已从固定基线提升到目标，结论也引用了实际分组结果。",
      remediationActivityId: null,
    };
  }
  if (!attemptsComplete || !comparedOutcomes) {
    return {
      passed,
      attemptsComplete,
      comparedOutcomes,
      targetedSamplesComplete,
      targetReached,
      conclusionConsistent,
      feedback: "还缺少两次指标不同的方案评估。先保留一次对照，再比较新的补样本方案。",
      remediationActivityId: RESEARCH_REMEDIATION_ACTIVITY_ID,
    };
  }
  if (!targetedSamplesComplete || !targetReached) {
    return {
      passed,
      attemptsComplete,
      comparedOutcomes,
      targetedSamplesComplete,
      targetReached,
      conclusionConsistent,
      feedback: `逆光组尚未达到 ${RESEARCH_BACKLIT_TARGET_ACCURACY}/${RESEARCH_GROUP_SIZE}。请从逆光组的失败类别补充样本，再重新评估。`,
      remediationActivityId: RESEARCH_REMEDIATION_ACTIVITY_ID,
    };
  }
  return {
    passed,
    attemptsComplete,
    comparedOutcomes,
    targetedSamplesComplete,
    targetReached,
    conclusionConsistent,
    feedback: `请在结论中说明逆光组从 ${RESEARCH_BACKLIT_BASELINE_ACCURACY}/${RESEARCH_GROUP_SIZE} 到 ${RESEARCH_BACKLIT_TARGET_ACCURACY}/${RESEARCH_GROUP_SIZE} 的变化，并说明补充的是哪一组样本。`,
    remediationActivityId: RESEARCH_REMEDIATION_ACTIVITY_ID,
  };
}

export function getResearchChallengeHints(
  attempts: readonly ResearchImageClassificationAttempt[],
): readonly string[] {
  const hints = ["先比较室内组和逆光组的固定基线，优先研究表现较弱的分组。"];
  if (attempts.length >= 1) hints.push("下一次尝试只调整与逆光失败情境对应的补样本，再查看分组指标变化。");
  if (attempts.length >= 2) hints.push("结论应引用逆光组的前后分数，而不是只报告总体准确率。");
  return hints;
}
