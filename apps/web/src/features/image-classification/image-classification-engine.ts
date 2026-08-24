export type ImageClassificationPhase =
  | "input"
  | "cap-feature"
  | "shape-feature"
  | "page-feature"
  | "prediction";

export interface FixedImageSample {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly actualLabel: string;
  readonly inputs: Readonly<Record<string, number>>;
}

export interface ClassificationFeature {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly inputKey: string;
  readonly phase: ImageClassificationPhase;
  readonly weights: Readonly<Record<ClassificationLabel, number>>;
}

export type ClassificationLabel = "水杯" | "书本";

export interface ClassificationScore {
  readonly label: ClassificationLabel;
  readonly value: number;
}

export interface ClassificationPrediction {
  readonly label: ClassificationLabel | null;
  readonly scoreShare: number;
  readonly explanation: string;
}

export interface ImageClassificationFrame {
  readonly index: number;
  readonly sample: FixedImageSample;
  readonly phase: ImageClassificationPhase;
  readonly title: string;
  readonly narration: string;
  readonly processedFeatureIds: readonly string[];
  readonly featureValues: Readonly<Record<string, number>>;
  readonly scores: readonly ClassificationScore[];
  readonly prediction: ClassificationPrediction;
  readonly complete: boolean;
}

export const FIXED_IMAGE_SAMPLE: FixedImageSample = {
  id: "lost-and-found-blue-bottle",
  title: "失物招领图片：蓝色随行杯",
  description: "图片中物品有杯盖、外形偏高，几乎看不到书页或矩形封面边缘。",
  actualLabel: "水杯",
  inputs: {
    hasCap: 1,
    tallShape: 0.9,
    visiblePages: 0,
    rectangularCover: 0.1,
  },
};

export const CLASSIFICATION_LABELS: readonly ClassificationLabel[] = ["水杯", "书本"];

export const CLASSIFICATION_FEATURES: readonly ClassificationFeature[] = [
  {
    id: "cap",
    label: "瓶盖线索",
    description: "检测到清晰的杯盖。",
    inputKey: "hasCap",
    phase: "cap-feature",
    weights: { 水杯: 3, 书本: -1 },
  },
  {
    id: "tall-shape",
    label: "高窄外形",
    description: "物品外形偏高且偏窄。",
    inputKey: "tallShape",
    phase: "shape-feature",
    weights: { 水杯: 1.5, 书本: -0.5 },
  },
  {
    id: "visible-pages",
    label: "书页线索",
    description: "可见书页会提高“书本”分数。",
    inputKey: "visiblePages",
    phase: "page-feature",
    weights: { 水杯: -0.75, 书本: 3 },
  },
  {
    id: "rectangular-cover",
    label: "矩形封面",
    description: "矩形封面边缘更接近书本。",
    inputKey: "rectangularCover",
    phase: "page-feature",
    weights: { 水杯: -0.2, 书本: 1.5 },
  },
];

const PHASES: readonly ImageClassificationPhase[] = [
  "input",
  "cap-feature",
  "shape-feature",
  "page-feature",
  "prediction",
];

const PHASE_COPY: Readonly<Record<ImageClassificationPhase, Pick<ImageClassificationFrame, "title" | "narration">>> = {
  input: {
    title: "第 1 步：读取图片输入",
    narration: "星宝先把图片整理成可比较的数值线索；这些数值本身还不是答案。",
  },
  "cap-feature": {
    title: "第 2 步：记录瓶盖线索",
    narration: "瓶盖让“水杯”得到较高加分，也让“书本”得到较低分。",
  },
  "shape-feature": {
    title: "第 3 步：比较外形",
    narration: "高窄外形继续支持“水杯”，但这仍只是根据现有特征作出的计算。",
  },
  "page-feature": {
    title: "第 4 步：检查书页与封面",
    narration: "书页和矩形封面几乎没有出现，因此“书本”没有得到相应加分。",
  },
  prediction: {
    title: "第 5 步：比较分数并作出预测",
    narration: "最高分是“水杯”。这是预测，不等于事实，仍应由失物招领人员核对。",
  },
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getProcessedFeatureIds(phase: ImageClassificationPhase): readonly string[] {
  const phaseIndex = PHASES.indexOf(phase);
  return CLASSIFICATION_FEATURES
    .filter((feature) => PHASES.indexOf(feature.phase) <= phaseIndex)
    .map((feature) => feature.id);
}

export function calculateFeatureValues(
  sample: FixedImageSample = FIXED_IMAGE_SAMPLE,
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    CLASSIFICATION_FEATURES.map((feature) => [feature.id, sample.inputs[feature.inputKey] ?? 0]),
  );
}

export function calculateClassificationScores(
  featureValues: Readonly<Record<string, number>>,
  processedFeatureIds: readonly string[] = CLASSIFICATION_FEATURES.map((feature) => feature.id),
): readonly ClassificationScore[] {
  const processed = new Set(processedFeatureIds);
  return CLASSIFICATION_LABELS.map((label) => ({
    label,
    value: round(CLASSIFICATION_FEATURES.reduce((score, feature) => (
      processed.has(feature.id)
        ? score + (featureValues[feature.id] ?? 0) * feature.weights[label]
        : score
    ), 0)),
  }));
}

export function calculatePrediction(
  scores: readonly ClassificationScore[],
  isComplete: boolean,
): ClassificationPrediction {
  if (!isComplete) {
    const leader = scores.reduce<ClassificationScore | null>((current, score) => (
      !current || score.value > current.value ? score : current
    ), null);
    return {
      label: leader?.value && leader.value > 0 ? leader.label : null,
      scoreShare: 0,
      explanation: leader?.value && leader.value > 0
        ? `当前暂时领先：${leader.label}。还需继续检查特征。`
        : "当前没有足够的特征分数，暂不作出预测。",
    };
  }

  const sorted = [...scores].sort((left, right) => right.value - left.value);
  const leader = sorted[0];
  const runnerUp = sorted[1];
  const totalPositiveScore = scores.reduce((total, score) => total + Math.max(0, score.value), 0);
  return {
    label: leader?.label ?? null,
    scoreShare: leader && totalPositiveScore > 0 ? round(Math.max(0, leader.value) / totalPositiveScore) : 0,
    explanation: leader && runnerUp
      ? `${leader.label} 分数 ${leader.value}，高于 ${runnerUp.label} 的 ${runnerUp.value}。`
      : "没有可比较的类别分数。",
  };
}

export function createImageClassificationFrame(
  index = 0,
  sample: FixedImageSample = FIXED_IMAGE_SAMPLE,
): ImageClassificationFrame {
  const normalizedIndex = Math.min(Math.max(0, Math.floor(index)), PHASES.length - 1);
  const phase = PHASES[normalizedIndex];
  const complete = phase === "prediction";
  const featureValues = calculateFeatureValues(sample);
  const processedFeatureIds = getProcessedFeatureIds(phase);
  const scores = calculateClassificationScores(featureValues, processedFeatureIds);
  return {
    index: normalizedIndex,
    sample,
    phase,
    ...PHASE_COPY[phase],
    processedFeatureIds,
    featureValues,
    scores,
    prediction: calculatePrediction(scores, complete),
    complete,
  };
}

export function nextImageClassificationFrame(current: ImageClassificationFrame): ImageClassificationFrame {
  return createImageClassificationFrame(
    Math.min(current.index + 1, PHASES.length - 1),
    current.sample,
  );
}

export function resetImageClassificationFrame(): ImageClassificationFrame {
  return createImageClassificationFrame(0);
}
