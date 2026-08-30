import {
  IMAGE_CLASSIFICATION_LAB_SAMPLE_COUNT,
} from "@/features/image-classification/image-classification-lab-dataset";

export const INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID = "middle-neural-signals-independent-lab";
export const INDEPENDENT_IMAGE_CLASSIFICATION_TEST_COUNT = IMAGE_CLASSIFICATION_LAB_SAMPLE_COUNT;

export type IndependentVariableId = "color" | "shape" | "texture";
export type IndependentClassificationLabel = "leaf" | "ball" | "cup";

export interface IndependentVariableOption {
  readonly value: string;
  readonly label: string;
}

export interface IndependentVariable {
  readonly id: IndependentVariableId;
  readonly label: string;
  readonly options: readonly IndependentVariableOption[];
}

export interface IndependentImageClassificationRun {
  readonly runId: string;
  readonly variableId: IndependentVariableId;
  readonly variableLabel: string;
  readonly value: string;
  readonly valueLabel: string;
  readonly prediction: IndependentClassificationLabel;
  readonly selectedScore: number;
  readonly scores: Readonly<Record<IndependentClassificationLabel, number>>;
  readonly passedTests: number;
  readonly totalTests: number;
  readonly hintsUsed: number;
  readonly completedAt: string;
}

const LABELS: readonly IndependentClassificationLabel[] = ["leaf", "ball", "cup"];

export const INDEPENDENT_VARIABLES: readonly IndependentVariable[] = [
  {
    id: "color",
    label: "颜色",
    options: [
      { value: "blue", label: "蓝色" },
      { value: "green", label: "绿色" },
    ],
  },
  {
    id: "shape",
    label: "形状",
    options: [
      { value: "tall", label: "高窄" },
      { value: "round", label: "圆形" },
    ],
  },
  {
    id: "texture",
    label: "纹理",
    options: [
      { value: "striped", label: "条纹" },
      { value: "handle", label: "把手" },
    ],
  },
];

const BASELINE_INPUTS = { color: "blue", shape: "tall", texture: "striped" } as const;

const FEATURE_WEIGHTS: Readonly<Record<IndependentClassificationLabel, Readonly<Record<string, number>>>> = {
  leaf: { green: 2, long: 1, veined: 2 },
  ball: { white: 2, round: 2, striped: 1 },
  cup: { blue: 2, tall: 1, handle: 2 },
};

export function getIndependentVariable(id: IndependentVariableId): IndependentVariable {
  return INDEPENDENT_VARIABLES.find((variable) => variable.id === id)!;
}

export function getIndependentVariableOption(
  variableId: IndependentVariableId,
  value: string,
): IndependentVariableOption | undefined {
  return getIndependentVariable(variableId).options.find((option) => option.value === value);
}

export function calculateIndependentImageClassificationRun(
  input: Pick<IndependentImageClassificationRun, "runId" | "variableId" | "value" | "hintsUsed" | "completedAt">,
): IndependentImageClassificationRun | null {
  const option = getIndependentVariableOption(input.variableId, input.value);
  if (!option || !input.runId || Number.isNaN(Date.parse(input.completedAt))) return null;

  const features = { ...BASELINE_INPUTS, [input.variableId]: option.value };
  const scores = Object.fromEntries(
    LABELS.map((label) => [
      label,
      Object.values(features).reduce((sum, feature) => sum + (FEATURE_WEIGHTS[label][feature] ?? 0), 0),
    ]),
  ) as Record<IndependentClassificationLabel, number>;
  const prediction = LABELS.reduce((current, label) => scores[label] > scores[current] ? label : current, LABELS[0]);
  const variable = getIndependentVariable(input.variableId);

  return {
    runId: input.runId,
    variableId: input.variableId,
    variableLabel: variable.label,
    value: option.value,
    valueLabel: option.label,
    prediction,
    selectedScore: scores[prediction],
    scores,
    passedTests: INDEPENDENT_IMAGE_CLASSIFICATION_TEST_COUNT,
    totalTests: INDEPENDENT_IMAGE_CLASSIFICATION_TEST_COUNT,
    hintsUsed: Number.isFinite(input.hintsUsed) ? Math.max(0, Math.floor(input.hintsUsed)) : 0,
    completedAt: input.completedAt,
  };
}

export function getComparableIndependentRuns(
  runs: readonly IndependentImageClassificationRun[],
): readonly [IndependentImageClassificationRun, IndependentImageClassificationRun] | null {
  if (runs.length < 2) return null;
  const first = runs[0];
  const comparable = runs.find((run) => run.variableId === first.variableId && run.value !== first.value);
  return comparable ? [first, comparable] : null;
}

export function formatIndependentRunMetric(run: IndependentImageClassificationRun): string {
  return `${run.prediction} 分数 ${run.selectedScore}，检查 ${run.passedTests}/${run.totalTests}`;
}
