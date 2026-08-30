import type { ExperimentEvidence, LearningState, MasteryRecord } from "@/lib/domain";
import { updateMastery } from "@/lib/learning-store";
import { getActivity, isActivityUnlocked } from "@/data/learning-paths";
import {
  IMAGE_CLASSIFICATION_LAB_CHALLENGE_VERSION,
  IMAGE_CLASSIFICATION_LAB_DATASET_VERSION,
  IMAGE_CLASSIFICATION_LAB_SAMPLE_COUNT,
} from "@/features/image-classification/image-classification-lab-dataset";
import {
  calculateIndependentImageClassificationRun,
  getComparableIndependentRuns,
  INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID,
  type IndependentImageClassificationRun,
  type IndependentVariableId,
} from "./independent-image-classification";
import {
  calculateResearchImageClassificationAttempt,
  evaluateResearchImageClassificationChallenge,
  RESEARCH_CHALLENGE_VERSION,
  RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID,
  type ResearchImageClassificationAttempt,
} from "./research-image-classification";
import {
  getLabTemplate,
  H01_DATASET_VERSIONS,
  H06_MODALITY_ORDER,
  H06_MULTIMODAL_DATASET_VERSION,
  H06_MULTIMODAL_INPUT_VERSION,
} from "./lab-templates";
import type { LabTemplateId } from "./lab-protocol";

export interface LabCompletion {
  templateId: LabTemplateId;
  challengeVersion: number;
  passed: boolean;
  completedAt: string;
  hintsUsed: number;
  durationMs?: number;
  resultCode?: string;
}

export const LAB_FORMATIVE_SCORE = 0.7;
export const GUIDED_IMAGE_CLASSIFICATION_TEST_COUNT = IMAGE_CLASSIFICATION_LAB_SAMPLE_COUNT;

const HIGH_LAB_EVIDENCE_METRICS: Partial<Record<LabTemplateId, Record<string, number>>> = {
  "python-data-basics": {
    rowCount: 4,
    validRowCount: 3,
    missingCount: 1,
    mean: 4,
    maximum: 6,
    csvRowCount: 4,
    csvValidRowCount: 3,
    csvMissingCount: 1,
    chartSeriesCount: 2,
  },
  "bubble-sort-analysis": {
    comparisonCount: 3,
    emptyInputComparisons: 0,
    sortedInputComparisons: 10,
    reverseInputComparisons: 10,
    duplicateInputComparisons: 6,
    quadraticFormulaAtSizeSix: 15,
  },
  "dataset-split": {
    trainCount: 6,
    validationCount: 2,
    testCount: 2,
    baselinePredictionCount: 2,
    baselineAccuracy: 0.5,
    leakageDetected: 0,
    leakageCaseDetected: 1,
  },
  "classification-metrics": {
    accuracy: 0.5,
    precision: 0.5,
    recall: 0.5,
    f1: 0.5,
    classificationSampleCount: 4,
    classificationBoundaryCaseCount: 3,
    truePositiveCount: 1,
    falsePositiveCount: 1,
    falseNegativeCount: 1,
    trueNegativeCount: 1,
    regressionSampleCount: 4,
    mse: 2.75,
    alternateRegressionSampleCount: 4,
    alternateMse: 0.5,
    errorCostCaseCount: 2,
  },
  "gradient-descent-demo": {
    steps: 5,
    sampleCount: 8,
    learningRate: 0.1,
    parameterSetVersion: 1,
    finalTrainLoss: 0.1,
    finalValidationLoss: 0.55,
    bestValidationLoss: 0.4,
    bestValidationStep: 3,
    overfitDetected: 1,
    curvePointCount: 5,
    trainCurveStepCount: 5,
    validationCurveStepCount: 5,
    alternateRunCount: 2,
    alternateLearningRate: 0.2,
    alternateBestValidationLoss: 0.7,
    stableRunOverfitDetected: 0,
  },
  "multimodal-input-audit": {
    modalityCount: 4,
    eligibleInputCount: 7,
    excludedInputCount: 1,
    failedInputCount: 2,
    failedSampleCount: 2,
    unavailableInputCount: 0,
    textAvailable: 2,
    textCorrect: 1,
    textFailed: 1,
    imageAvailable: 2,
    imageCorrect: 1,
    imageFailed: 1,
    structuredAvailable: 1,
    structuredCorrect: 1,
    structuredFailed: 0,
    combinedAvailable: 2,
    combinedCorrect: 2,
    combinedFailed: 0,
    bestAccuracy: 1,
    unauthorizedSampleCount: 1,
    restrictedSampleCount: 1,
  },
  "rag-citation-check": {
    withoutRetrievalCitationCount: 0,
    withoutRetrievalUnsupportedClaimCount: 1,
    withRetrievalCitationCount: 2,
    matchedCitationCount: 1,
    unmatchedCitationCount: 1,
    withRetrievalUnsupportedClaimCount: 1,
    citationCoverage: 0.5,
    allCitationsAllowed: 0,
    allowedSourceCount: 2,
    toolRequestCount: 2,
    blockedToolCount: 2,
    allRequestedToolsBlocked: 1,
    failedAnswerCount: 2,
  },
  "model-audit": { groups: 2, totalSamples: 3, correctSamples: 2, failedGroups: 1 },
};

export function getLabEvidenceMetrics(templateId: LabTemplateId): Readonly<Record<string, number>> | null {
  const metrics = HIGH_LAB_EVIDENCE_METRICS[templateId];
  return metrics ? { ...metrics } : null;
}

function activeHighSchoolLabActivity(
  state: LearningState,
  templateId: LabTemplateId,
): ReturnType<typeof getActivity> {
  const activeId = state.stageProgressByStage.high_school.activeActivityId;
  const activity = activeId ? getActivity(activeId) : undefined;
  return activity?.stage === "high_school" && activity.labTemplateId === templateId
    ? activity
    : undefined;
}

function createHighSchoolLabEvidence(
  state: LearningState,
  completion: LabCompletion,
): ExperimentEvidence | null {
  const activity = activeHighSchoolLabActivity(state, completion.templateId);
  const metrics = HIGH_LAB_EVIDENCE_METRICS[completion.templateId];
  if (!activity || !metrics) return null;
  const mode = activity.kind === "project" ? "project" : "independent";
  return {
    runId: `experiment:${activity.id}:v${completion.challengeVersion}`,
    activityId: activity.id,
    courseId: activity.courseId,
    templateId: completion.templateId,
    mode,
    variables: {
      evidenceType: "deterministic-challenge",
      challengeVersion: completion.challengeVersion,
      templateVersion: `${completion.templateId}:v${completion.challengeVersion}`,
      parameterSetId: `default:${completion.templateId}:v${completion.challengeVersion}`,
      resultCode: completion.resultCode?.trim() || "passed",
      hintsUsed: Math.max(0, Math.floor(completion.hintsUsed)),
      ...(Number.isFinite(completion.durationMs)
        ? { runDurationMs: Math.max(0, Math.round(completion.durationMs!)) }
        : {}),
      ...(completion.templateId === "python-data-basics"
        ? {
            datasetVersion: H01_DATASET_VERSIONS.json,
            alternateDatasetVersion: H01_DATASET_VERSIONS.csv,
            inputFormat: "json",
            supportedInputFormats: "json,csv",
            cleaningRule: "跳过 score 为 None 或空字符串的记录",
            chartPreparation: "有效/缺失计数",
          }
        : {}),
      ...(completion.templateId === "dataset-split"
        ? {
            datasetVersion: "pipeline-labels-v1",
            splitRule: "index % 5",
            baselinePolicy: "训练集多数类",
            baselineSource: "train",
            leakageCase: "baseline_source=test 时标记 leakage_detected=true",
            evaluationScope: "test-only",
          }
        : {}),
      ...(completion.templateId === "classification-metrics"
        ? {
            experimentVersion: "classification-metrics-v3",
            classificationDatasetVersion: "classification-cases-v1",
            classificationTask: "binary",
            classificationSampleCount: 4,
            classificationBoundaryCaseCount: 3,
            confusionMatrix: "tp=1,fp=1,fn=1,tn=1",
            regressionTask: "continuous",
            regressionDatasetVersion: "regression-cases-v2",
            regressionSampleCount: 4,
            alternateRegressionSampleCount: 4,
            errorCost: "miss",
            selectedMetric: "recall",
            metricPolicy: "漏检代价高时优先 recall",
            comparisonErrorCost: "false_alarm",
            comparisonSelectedMetric: "precision",
            comparisonMetricPolicy: "误报代价高时优先 precision",
          }
        : {}),
      ...(completion.templateId === "gradient-descent-demo"
        ? {
            experimentVersion: "gradient-descent-demo-v3",
            curveVersion: "loss-curves-v2",
            datasetVersion: "training-samples-v1",
            parameterSetId: "weights-init-v1",
            parameterSetVersion: 1,
            sampleCount: 8,
            epochCount: 5,
            learningRate: 0.1,
            alternateLearningRate: 0.2,
            trainCurve: "[0.95,0.7,0.45,0.2,0.1]",
            validationCurve: "[1,0.65,0.4,0.45,0.55]",
            trainingPolicy: "固定多轮损失曲线",
            overfitPolicy: "训练损失下降且最后验证损失高于最佳值",
            regularizationPolicy: "未使用正则化，观察过拟合信号",
          }
        : {}),
      ...(completion.templateId === "multimodal-input-audit"
        ? {
            experimentVersion: "multimodal-input-audit-v2",
            datasetVersion: H06_MULTIMODAL_DATASET_VERSION,
            inputVersion: H06_MULTIMODAL_INPUT_VERSION,
            modalityOrder: H06_MODALITY_ORDER.join(","),
            comparisonPolicy: "分别统计单模态与组合输入；只使用已授权且可用的输入",
            sourceVersion: "multimodal-sources-v2",
            failedSampleIds: "text:s2,image:s1",
            unavailableSampleIds: "",
            unauthorizedSampleIds: "s2",
            restrictedSampleIds: "s2",
            authorizationPolicy: "仅统计已授权且符合当前用途的输入；未授权输入保留在审计边界中",
            privacyPolicy: "受限输入不得用于模型训练或展示",
          }
        : {}),
      ...(completion.templateId === "rag-citation-check"
        ? {
            experimentVersion: "rag-citation-check-v3",
            knowledgeBaseVersion: "fixed-kb-v2",
            queryVersion: "rag-query-v2",
            retrievalMode: "fixed-whitelist",
            allowedSources: "课程手册,审核片段",
            withoutRetrievalStatus: "unverified",
            withRetrievalStatus: "needs_review",
            withoutRetrievalFailedClaims: "实验室周末免费开放",
            withRetrievalFailedClaims: "实验室周末免费开放",
            matchedCitationIds: "课程手册",
            unmatchedCitationIds: "未知网页",
            failurePolicy: "没有可核对来源或出现未支持主张时必须标记待核对",
            toolPolicy: "只允许 fixed_retrieval；web_search/code_execution 等请求全部记录为 blocked",
            requestedToolIds: "web_search,code_execution",
            blockedToolIds: "web_search,code_execution",
          }
        : {}),
    },
    metrics: {
      ...metrics,
      challengePassed: 1,
      challengeVersion: completion.challengeVersion,
    },
    conclusion: "固定测试通过；请在项目步骤中结合指标和失败信号写出解释。",
    completedAt: completion.completedAt,
  };
}

export function hasPassedLabAttempt(
  state: LearningState,
  templateId: LabTemplateId,
  challengeVersion = getLabTemplate(templateId).challengeVersion,
): boolean {
  return state.attempts.some((attempt) =>
    attempt.attemptId === `lab:${templateId}:v${challengeVersion}`
    && attempt.score >= LAB_FORMATIVE_SCORE,
  );
}

export interface IndependentImageClassificationConclusion {
  changed: string;
  result: string;
  reason: string;
  completedAt: string;
}

export interface GuidedImageClassificationEvidenceInput {
  prediction: "leaf" | "ball" | "cup";
  observation: string;
  conclusion: string;
  predictionBeforeRun: "leaf" | "ball" | "cup";
  runId: string;
  challengeVersion: number;
  runDurationMs: number;
  hintsUsed: number;
  passedTests: number;
  totalTests: number;
  resultCode: string;
  completedAt: string;
}

export function createGuidedImageClassificationEvidence(
  input: GuidedImageClassificationEvidenceInput,
): ExperimentEvidence | null {
  const observation = input.observation.trim();
  const conclusion = input.conclusion.trim();
  const hintsUsed = Number.isFinite(input.hintsUsed) ? Math.max(0, Math.floor(input.hintsUsed)) : -1;
  if (
    !["leaf", "ball", "cup"].includes(input.prediction)
    || input.prediction !== input.predictionBeforeRun
    || observation.length < 8
    || conclusion.length < 8
    || !conclusion.replaceAll(" ", "").includes(`${input.passedTests}/${input.totalTests}`)
    || !input.runId.trim()
    || input.challengeVersion !== IMAGE_CLASSIFICATION_LAB_CHALLENGE_VERSION
    || !Number.isFinite(input.runDurationMs) || input.runDurationMs < 0
    || hintsUsed < 0
    || input.passedTests !== GUIDED_IMAGE_CLASSIFICATION_TEST_COUNT
    || input.totalTests !== GUIDED_IMAGE_CLASSIFICATION_TEST_COUNT
    || input.resultCode.trim() !== "passed"
    || Number.isNaN(Date.parse(input.completedAt))
  ) return null;

  return {
    runId: input.runId,
    activityId: "middle-neural-signals-guided-lab",
    courseId: "middle-neural-signals",
    templateId: "image-classifier",
    mode: "guided",
    variables: {
      changedVariable: "texture",
      baselineTexture: "striped",
      changedTexture: "handle",
      learnerPrediction: input.prediction,
      predictionBeforeRun: input.predictionBeforeRun,
      datasetVersion: IMAGE_CLASSIFICATION_LAB_DATASET_VERSION,
      challengeVersion: input.challengeVersion,
      runDurationMs: Math.round(input.runDurationMs),
      hintsUsed,
      resultCode: input.resultCode.trim(),
      observation,
      learnerConclusion: conclusion,
    },
    metrics: {
      passedTests: input.passedTests,
      totalTests: input.totalTests,
      predictionCorrect: input.prediction === "cup" ? 1 : 0,
      sampleCount: GUIDED_IMAGE_CLASSIFICATION_TEST_COUNT,
    },
    conclusion: `观察：${observation}\n结论：${conclusion}`,
    completedAt: input.completedAt,
  };
}

export function getGuidedImageClassificationEvidence(
  state: LearningState,
): ExperimentEvidence | null {
  return state.stageProgressByStage.middle_school.experimentEvidence.find((entry) =>
    entry.activityId === "middle-neural-signals-guided-lab"
    && entry.mode === "guided"
    && entry.templateId === "image-classifier",
  ) ?? null;
}

export function recordGuidedImageClassificationEvidence(
  state: LearningState,
  input: GuidedImageClassificationEvidenceInput,
): LearningState {
  const evidence = createGuidedImageClassificationEvidence(input);
  if (!evidence) return state;
  const progress = state.stageProgressByStage.middle_school;
  if (
    progress.activeActivityId !== evidence.activityId
    || !isActivityUnlocked(evidence.activityId, progress.completedActivityIds)
  ) return state;
  if (progress.experimentEvidence.some((entry) => entry.runId === evidence.runId)) return state;

  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      middle_school: {
        ...progress,
        experimentEvidence: [...progress.experimentEvidence, evidence],
      },
    },
    updatedAt: input.completedAt,
  };
}

function isIndependentVariableId(value: unknown): value is IndependentVariableId {
  return value === "color" || value === "shape" || value === "texture";
}

function isIndependentRunEvidence(evidence: ExperimentEvidence): boolean {
  return evidence.activityId === INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID
    && evidence.mode === "independent"
    && evidence.variables.evidenceType === "run"
    && isIndependentVariableId(evidence.variables.independentVariable)
    && typeof evidence.variables.value === "string";
}

function restoreIndependentRun(evidence: ExperimentEvidence): IndependentImageClassificationRun | null {
  if (!isIndependentRunEvidence(evidence)) return null;
  const variableId = evidence.variables.independentVariable;
  const value = evidence.variables.value;
  if (!isIndependentVariableId(variableId) || typeof value !== "string") return null;
  const run = calculateIndependentImageClassificationRun({
    runId: evidence.runId,
    variableId,
    value,
    hintsUsed: evidence.metrics.hintsUsed ?? 0,
    completedAt: evidence.completedAt,
  });
  if (!run) return null;
  return (
    evidence.metrics.passedTests === run.passedTests
    && evidence.metrics.totalTests === run.totalTests
    && evidence.metrics.selectedScore === run.selectedScore
    && evidence.variables.prediction === run.prediction
  ) ? run : null;
}

export function getIndependentImageClassificationRuns(
  state: LearningState,
): IndependentImageClassificationRun[] {
  return state.stageProgressByStage.middle_school.experimentEvidence
    .map(restoreIndependentRun)
    .filter((run): run is IndependentImageClassificationRun => run !== null);
}

export function recordIndependentImageClassificationRun(
  state: LearningState,
  run: IndependentImageClassificationRun,
): LearningState {
  const progress = state.stageProgressByStage.middle_school;
  if (
    progress.activeActivityId !== INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID
    || !isActivityUnlocked(INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID, progress.completedActivityIds)
    || progress.experimentEvidence.some((entry) => entry.runId === run.runId)
  ) return state;

  const evidence: ExperimentEvidence = {
    runId: run.runId,
    activityId: INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID,
    courseId: "middle-neural-signals",
    templateId: "image-classifier",
    mode: "independent",
    variables: {
      evidenceType: "run",
      independentVariable: run.variableId,
      value: run.value,
      valueLabel: run.valueLabel,
      prediction: run.prediction,
      datasetVersion: IMAGE_CLASSIFICATION_LAB_DATASET_VERSION,
      challengeVersion: IMAGE_CLASSIFICATION_LAB_CHALLENGE_VERSION,
    },
    metrics: {
      passedTests: run.passedTests,
      totalTests: run.totalTests,
      selectedScore: run.selectedScore,
      hintsUsed: run.hintsUsed,
    },
    conclusion: "",
    completedAt: run.completedAt,
  };
  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      middle_school: {
        ...progress,
        experimentEvidence: [...progress.experimentEvidence, evidence],
      },
    },
    updatedAt: run.completedAt,
  };
}

function isConclusionComplete(
  input: IndependentImageClassificationConclusion,
  comparableRuns: readonly [IndependentImageClassificationRun, IndependentImageClassificationRun],
): boolean {
  const [first, second] = comparableRuns;
  const changed = input.changed.trim();
  const result = input.result.trim();
  const reason = input.reason.trim();
  return (
    changed.length >= 6
    && result.length >= 6
    && reason.length >= 6
    && changed.includes(first.variableLabel)
    && result.includes(`${first.passedTests}/${first.totalTests}`)
    && result.includes(String(first.selectedScore))
    && result.includes(String(second.selectedScore))
    && !Number.isNaN(Date.parse(input.completedAt))
  );
}

export function recordIndependentImageClassificationConclusion(
  state: LearningState,
  input: IndependentImageClassificationConclusion,
): LearningState {
  const progress = state.stageProgressByStage.middle_school;
  const comparableRuns = getComparableIndependentRuns(getIndependentImageClassificationRuns(state));
  if (
    progress.activeActivityId !== INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID
    || !isActivityUnlocked(INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID, progress.completedActivityIds)
    || !comparableRuns
    || !isConclusionComplete(input, comparableRuns)
  ) return state;

  const [first, second] = comparableRuns;
  const runId = `independent-image-classifier:summary:${input.completedAt}`;
  if (progress.experimentEvidence.some((entry) => entry.runId === runId)) return state;
  const conclusion = `改变：${input.changed.trim()}\n结果：${input.result.trim()}\n原因：${input.reason.trim()}`;
  const evidence: ExperimentEvidence = {
    runId,
    activityId: INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID,
    courseId: "middle-neural-signals",
    templateId: "image-classifier",
    mode: "independent",
    variables: {
      evidenceType: "summary",
      independentVariable: first.variableId,
      firstRunId: first.runId,
      secondRunId: second.runId,
      datasetVersion: IMAGE_CLASSIFICATION_LAB_DATASET_VERSION,
      challengeVersion: IMAGE_CLASSIFICATION_LAB_CHALLENGE_VERSION,
      changedStatement: input.changed.trim(),
      resultStatement: input.result.trim(),
      reasonStatement: input.reason.trim(),
    },
    metrics: {
      runCount: 2,
      distinctValues: 2,
      firstSelectedScore: first.selectedScore,
      secondSelectedScore: second.selectedScore,
      passedTests: first.passedTests,
      totalTests: first.totalTests,
      hintsUsed: first.hintsUsed + second.hintsUsed,
    },
    conclusion,
    completedAt: input.completedAt,
  };
  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      middle_school: {
        ...progress,
        experimentEvidence: [...progress.experimentEvidence, evidence],
      },
    },
    updatedAt: input.completedAt,
  };
}

export function hasCompletedIndependentImageClassification(
  state: LearningState,
): boolean {
  const comparableRuns = getComparableIndependentRuns(getIndependentImageClassificationRuns(state));
  if (!comparableRuns) return false;
  const [first, second] = comparableRuns;
  return state.stageProgressByStage.middle_school.experimentEvidence.some((evidence) => {
    if (
      evidence.activityId !== INDEPENDENT_IMAGE_CLASSIFICATION_ACTIVITY_ID
      || evidence.mode !== "independent"
      || evidence.variables.evidenceType !== "summary"
      || evidence.variables.firstRunId !== first.runId
      || evidence.variables.secondRunId !== second.runId
      || evidence.metrics.runCount !== 2
      || evidence.metrics.distinctValues !== 2
      || evidence.metrics.firstSelectedScore !== first.selectedScore
      || evidence.metrics.secondSelectedScore !== second.selectedScore
    ) return false;
    return isConclusionComplete({
      changed: String(evidence.variables.changedStatement ?? ""),
      result: String(evidence.variables.resultStatement ?? ""),
      reason: String(evidence.variables.reasonStatement ?? ""),
      completedAt: evidence.completedAt,
    }, comparableRuns);
  });
}

function isResearchAttemptEvidence(evidence: ExperimentEvidence): boolean {
  return evidence.activityId === RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID
    && evidence.mode === "research"
    && evidence.variables.evidenceType === "attempt"
    && typeof evidence.variables.selectedSampleIds === "string"
    && evidence.metrics.challengeVersion === RESEARCH_CHALLENGE_VERSION;
}

function restoreResearchAttempt(evidence: ExperimentEvidence): ResearchImageClassificationAttempt | null {
  if (!isResearchAttemptEvidence(evidence)) return null;
  const attempt = calculateResearchImageClassificationAttempt({
    runId: evidence.runId,
    selectedSampleIds: String(evidence.variables.selectedSampleIds).split(",").filter(Boolean),
    completedAt: evidence.completedAt,
  });
  if (!attempt) return null;
  return attempt.indoorAccuracy === evidence.metrics.indoorAccuracy
    && attempt.backlitAccuracy === evidence.metrics.backlitAccuracy
    && attempt.overallAccuracy === evidence.metrics.overallAccuracy
    ? attempt
    : null;
}

export function getResearchImageClassificationAttempts(
  state: LearningState,
): ResearchImageClassificationAttempt[] {
  return state.stageProgressByStage.middle_school.experimentEvidence
    .map(restoreResearchAttempt)
    .filter((attempt): attempt is ResearchImageClassificationAttempt => attempt !== null);
}

export function recordResearchImageClassificationAttempt(
  state: LearningState,
  attempt: ResearchImageClassificationAttempt,
): LearningState {
  const progress = state.stageProgressByStage.middle_school;
  if (
    progress.activeActivityId !== RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID
    || !isActivityUnlocked(RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID, progress.completedActivityIds)
    || progress.experimentEvidence.some((entry) => entry.runId === attempt.runId)
  ) return state;

  const evidence: ExperimentEvidence = {
    runId: attempt.runId,
    activityId: RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID,
    courseId: "middle-data-bias",
    templateId: "image-classifier",
    mode: "research",
    variables: {
      evidenceType: "attempt",
      selectedSampleIds: attempt.selectedSampleIds.join(","),
    },
    metrics: {
      challengeVersion: RESEARCH_CHALLENGE_VERSION,
      indoorAccuracy: attempt.indoorAccuracy,
      backlitAccuracy: attempt.backlitAccuracy,
      overallAccuracy: attempt.overallAccuracy,
    },
    conclusion: "",
    completedAt: attempt.completedAt,
  };
  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      middle_school: {
        ...progress,
        experimentEvidence: [...progress.experimentEvidence, evidence],
      },
    },
    updatedAt: attempt.completedAt,
  };
}

export function recordResearchImageClassificationConclusion(
  state: LearningState,
  conclusion: string,
  completedAt: string,
): LearningState {
  const progress = state.stageProgressByStage.middle_school;
  const attempts = getResearchImageClassificationAttempts(state);
  const evaluation = evaluateResearchImageClassificationChallenge(attempts, conclusion);
  if (
    progress.activeActivityId !== RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID
    || !isActivityUnlocked(RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID, progress.completedActivityIds)
    || !evaluation.passed
    || Number.isNaN(Date.parse(completedAt))
  ) return state;

  const runId = `research-image-classifier:summary:v${RESEARCH_CHALLENGE_VERSION}:${completedAt}`;
  if (progress.experimentEvidence.some((entry) => entry.runId === runId)) return state;
  const evidence: ExperimentEvidence = {
    runId,
    activityId: RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID,
    courseId: "middle-data-bias",
    templateId: "image-classifier",
    mode: "research",
    variables: {
      evidenceType: "summary",
      conclusion: conclusion.trim(),
    },
    metrics: {
      challengeVersion: RESEARCH_CHALLENGE_VERSION,
      attemptCount: attempts.length,
      bestBacklitAccuracy: Math.max(...attempts.map((attempt) => attempt.backlitAccuracy)),
    },
    conclusion: conclusion.trim(),
    completedAt,
  };
  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      middle_school: {
        ...progress,
        experimentEvidence: [...progress.experimentEvidence, evidence],
      },
    },
    updatedAt: completedAt,
  };
}

export function hasCompletedResearchImageClassificationChallenge(
  state: LearningState,
): boolean {
  const attempts = getResearchImageClassificationAttempts(state);
  return state.stageProgressByStage.middle_school.experimentEvidence.some((evidence) => {
    if (
      evidence.activityId !== RESEARCH_IMAGE_CLASSIFICATION_ACTIVITY_ID
      || evidence.mode !== "research"
      || evidence.variables.evidenceType !== "summary"
      || evidence.metrics.challengeVersion !== RESEARCH_CHALLENGE_VERSION
      || evidence.metrics.attemptCount !== attempts.length
    ) return false;
    return evaluateResearchImageClassificationChallenge(attempts, evidence.conclusion).passed;
  });
}

export function recordLabCompletion(
  state: LearningState,
  completion: LabCompletion,
): LearningState {
  if (!completion.passed) return state;

  const knowledgePointId = getLabTemplate(completion.templateId).knowledgePointId;
  const attemptId = `lab:${completion.templateId}:v${completion.challengeVersion}`;
  if (state.attempts.some((attempt) => attempt.attemptId === attemptId)) return state;

  const hints = Number.isFinite(completion.hintsUsed)
    ? Math.max(0, Math.floor(completion.hintsUsed))
    : 0;
  const previous = state.masteryByKnowledgePoint[knowledgePointId];
  const mastery = updateMastery(previous?.mastery ?? 0, {
    score: LAB_FORMATIVE_SCORE,
    hints,
  });
  const nextReview = new Date(completion.completedAt);
  nextReview.setUTCDate(nextReview.getUTCDate() + 3);

  const record: MasteryRecord = {
    knowledgePointId,
    mastery,
    confidence: Math.min(1, (previous?.confidence ?? 0) + 0.06),
    evidenceCount: (previous?.evidenceCount ?? 0) + 1,
    lastPracticedAt: completion.completedAt,
    nextReviewAt: nextReview.toISOString(),
    misconceptionTags: previous ? [...previous.misconceptionTags] : [],
  };

  const experimentEvidence = createHighSchoolLabEvidence(state, completion);
  const currentHighProgress = state.stageProgressByStage.high_school;
  const nextHighProgress = experimentEvidence && !currentHighProgress.experimentEvidence.some(
    (entry) => entry.runId === experimentEvidence.runId,
  )
    ? { ...currentHighProgress, experimentEvidence: [...currentHighProgress.experimentEvidence, experimentEvidence] }
    : currentHighProgress;

  return {
    ...state,
    masteryByKnowledgePoint: {
      ...state.masteryByKnowledgePoint,
      [knowledgePointId]: record,
    },
    attempts: [
      ...state.attempts,
      {
        attemptId,
        knowledgePointId,
        score: LAB_FORMATIVE_SCORE,
        hints,
        mode: "code",
        completedAt: completion.completedAt,
      },
    ],
    stageProgressByStage: {
      ...state.stageProgressByStage,
      high_school: nextHighProgress,
    },
    recentTopics: [...state.recentTopics.filter((item) => item !== knowledgePointId), knowledgePointId].slice(-20),
    updatedAt: completion.completedAt,
  };
}
