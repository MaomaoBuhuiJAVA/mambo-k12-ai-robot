export type DataBiasMetricScenarioId = "baseline" | "targeted-resampling";

export interface DataBiasGroupMetric {
  readonly group: string;
  readonly correct: number;
  readonly total: number;
}

export interface DataBiasMetricScenario {
  readonly id: DataBiasMetricScenarioId;
  readonly label: string;
  readonly description: string;
  readonly groupMetrics: readonly DataBiasGroupMetric[];
}

export const DATA_BIAS_METRIC_SCENARIOS: readonly DataBiasMetricScenario[] = [
  {
    id: "baseline",
    label: "固定对照",
    description: "未补充逆光样本时，室内表现会抬高总体分数。",
    groupMetrics: [
      { group: "室内明亮组", correct: 9, total: 10 },
      { group: "逆光组", correct: 4, total: 10 },
    ],
  },
  {
    id: "targeted-resampling",
    label: "补充逆光样本后",
    description: "只补充逆光叶子、球和杯子样本后，再用相同固定评估组复测。",
    groupMetrics: [
      { group: "室内明亮组", correct: 9, total: 10 },
      { group: "逆光组", correct: 7, total: 10 },
    ],
  },
];

export interface DataBiasMetricSummary {
  readonly correct: number;
  readonly total: number;
  readonly accuracy: number;
}

export function summarizeDataBiasMetrics(
  groupMetrics: readonly DataBiasGroupMetric[],
): DataBiasMetricSummary {
  const correct = groupMetrics.reduce((sum, metric) => sum + metric.correct, 0);
  const total = groupMetrics.reduce((sum, metric) => sum + metric.total, 0);
  return { correct, total, accuracy: total === 0 ? 0 : correct / total };
}

export function getDataBiasMetricScenario(
  scenarioId: DataBiasMetricScenarioId = "baseline",
): DataBiasMetricScenario {
  const scenario = DATA_BIAS_METRIC_SCENARIOS.find((candidate) => candidate.id === scenarioId);
  if (!scenario) throw new Error(`Unknown data-bias metric scenario: ${scenarioId}`);
  return structuredClone(scenario);
}
