export type ModelEvaluationLabel = "树叶" | "水杯";
export type EvaluationBatchId = "indoor" | "shadow" | "backlit";

export interface EvaluationBatch {
  readonly id: EvaluationBatchId;
  readonly label: string;
  readonly description: string;
}

export interface EvaluationSample {
  readonly id: string;
  readonly title: string;
  readonly batchId: EvaluationBatchId;
  readonly actualLabel: ModelEvaluationLabel;
  readonly predictedLabel: ModelEvaluationLabel;
}

export interface EvaluationMetrics {
  readonly total: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly accuracy: number;
  readonly errorRate: number;
  readonly confusionMatrix: Readonly<Record<ModelEvaluationLabel, Readonly<Record<ModelEvaluationLabel, number>>>>;
}

export interface EvaluationSplit {
  readonly testBatch: EvaluationBatch;
  readonly trainingSamples: readonly EvaluationSample[];
  readonly testSamples: readonly EvaluationSample[];
  readonly metrics: EvaluationMetrics;
}

export const MODEL_EVALUATION_LABELS: readonly ModelEvaluationLabel[] = ["树叶", "水杯"];

export const EVALUATION_BATCHES: readonly EvaluationBatch[] = [
  { id: "indoor", label: "常规室内批次", description: "光线稳定，轮廓和颜色线索清楚。" },
  { id: "shadow", label: "阴影走廊批次", description: "局部阴影遮住了部分轮廓。" },
  { id: "backlit", label: "逆光窗边批次", description: "逆光让边缘和颜色都更难辨认。" },
];

export const FIXED_EVALUATION_SAMPLES: readonly EvaluationSample[] = [
  { id: "indoor-leaf-1", title: "室内绿叶", batchId: "indoor", actualLabel: "树叶", predictedLabel: "树叶" },
  { id: "indoor-cup-1", title: "室内蓝杯", batchId: "indoor", actualLabel: "水杯", predictedLabel: "水杯" },
  { id: "indoor-leaf-2", title: "室内黄叶", batchId: "indoor", actualLabel: "树叶", predictedLabel: "树叶" },
  { id: "indoor-cup-2", title: "室内白杯", batchId: "indoor", actualLabel: "水杯", predictedLabel: "水杯" },
  { id: "shadow-leaf-1", title: "阴影绿叶", batchId: "shadow", actualLabel: "树叶", predictedLabel: "树叶" },
  { id: "shadow-cup-1", title: "阴影蓝杯", batchId: "shadow", actualLabel: "水杯", predictedLabel: "水杯" },
  { id: "shadow-leaf-2", title: "阴影枯叶", batchId: "shadow", actualLabel: "树叶", predictedLabel: "水杯" },
  { id: "shadow-cup-2", title: "阴影白杯", batchId: "shadow", actualLabel: "水杯", predictedLabel: "水杯" },
  { id: "backlit-leaf-1", title: "逆光绿叶", batchId: "backlit", actualLabel: "树叶", predictedLabel: "树叶" },
  { id: "backlit-cup-1", title: "逆光蓝杯", batchId: "backlit", actualLabel: "水杯", predictedLabel: "树叶" },
  { id: "backlit-leaf-2", title: "逆光黄叶", batchId: "backlit", actualLabel: "树叶", predictedLabel: "水杯" },
  { id: "backlit-cup-2", title: "逆光白杯", batchId: "backlit", actualLabel: "水杯", predictedLabel: "水杯" },
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateEvaluationMetrics(
  samples: readonly EvaluationSample[],
): EvaluationMetrics {
  const confusionMatrix: Record<ModelEvaluationLabel, Record<ModelEvaluationLabel, number>> = {
    树叶: { 树叶: 0, 水杯: 0 },
    水杯: { 树叶: 0, 水杯: 0 },
  };
  let correct = 0;

  for (const sample of samples) {
    confusionMatrix[sample.actualLabel][sample.predictedLabel] += 1;
    if (sample.actualLabel === sample.predictedLabel) correct += 1;
  }

  const total = samples.length;
  const accuracy = total > 0 ? round(correct / total) : 0;
  return {
    total,
    correct,
    incorrect: total - correct,
    accuracy,
    errorRate: round(1 - accuracy),
    confusionMatrix,
  };
}

export function createEvaluationSplit(
  testBatchId: EvaluationBatchId = "backlit",
): EvaluationSplit {
  const testBatch = EVALUATION_BATCHES.find((batch) => batch.id === testBatchId);
  if (!testBatch) throw new Error(`Unknown evaluation batch: ${testBatchId}`);

  const testSamples = FIXED_EVALUATION_SAMPLES.filter((sample) => sample.batchId === testBatchId);
  const trainingSamples = FIXED_EVALUATION_SAMPLES.filter((sample) => sample.batchId !== testBatchId);
  return {
    testBatch,
    trainingSamples,
    testSamples,
    metrics: calculateEvaluationMetrics(testSamples),
  };
}
