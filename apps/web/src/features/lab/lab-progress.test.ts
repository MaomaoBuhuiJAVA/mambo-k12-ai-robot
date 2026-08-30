import { describe, expect, it } from "vitest";

import { createDefaultLearningState } from "@/lib/learning-store";
import {
  createGuidedImageClassificationEvidence,
  getIndependentImageClassificationRuns,
  hasCompletedIndependentImageClassification,
  recordGuidedImageClassificationEvidence,
  recordIndependentImageClassificationConclusion,
  recordIndependentImageClassificationRun,
  getResearchImageClassificationAttempts,
  hasCompletedResearchImageClassificationChallenge,
  hasPassedLabAttempt,
  recordResearchImageClassificationAttempt,
  recordResearchImageClassificationConclusion,
  recordLabCompletion,
} from "./lab-progress";
import { calculateIndependentImageClassificationRun } from "./independent-image-classification";
import { calculateResearchImageClassificationAttempt } from "./research-image-classification";

const guidedLabPrerequisites = [
  "middle-ai-foundations-lesson",
  "middle-ai-foundations-demonstration",
  "middle-ai-foundations-assessment",
  "middle-data-and-algorithms-lesson",
  "middle-data-and-algorithms-demonstration",
  "middle-data-and-algorithms-lab",
  "middle-data-and-algorithms-assessment",
  "middle-python-basics-lesson",
  "middle-python-basics-demonstration",
  "middle-python-basics-lab",
  "middle-python-basics-assessment",
  "middle-neural-signals-lesson",
  "middle-neural-signals-demonstration",
];

function stateAtGuidedImageLab() {
  const state = createDefaultLearningState();
  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      middle_school: {
        ...state.stageProgressByStage.middle_school,
        completedActivityIds: guidedLabPrerequisites,
        activeActivityId: "middle-neural-signals-guided-lab",
      },
    },
  };
}

function stateAtIndependentImageLab() {
  const state = stateAtGuidedImageLab();
  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      middle_school: {
        ...state.stageProgressByStage.middle_school,
        completedActivityIds: [...guidedLabPrerequisites, "middle-neural-signals-guided-lab"],
        activeActivityId: "middle-neural-signals-independent-lab",
      },
    },
  };
}

function stateAtResearchChallenge() {
  const state = createDefaultLearningState();
  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      middle_school: {
        ...state.stageProgressByStage.middle_school,
        completedActivityIds: ["middle-data-bias-lesson", "middle-data-bias-demonstration"],
        activeActivityId: "middle-data-bias-research",
      },
    },
  };
}

function guidedEvidenceInput(completedAt = "2026-08-22T04:00:00.000Z") {
  return {
    prediction: "cup" as const,
    predictionBeforeRun: "cup" as const,
    observation: "纹理改成 handle 后，杯子相关线索上升，因此预测更支持 cup。",
    conclusion: "固定检查通过 3/3，杯子线索变强后应保留预测不等于事实的提醒。",
    runId: "550e8400-e29b-41d4-a716-446655440000",
    challengeVersion: 1,
    runDurationMs: 18,
    hintsUsed: 1,
    passedTests: 3,
    totalTests: 3,
    resultCode: "passed",
    completedAt,
  };
}

describe("recordLabCompletion", () => {
  it("uses the analysis challenge when recording high-school sorting evidence", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.activeActivityId = "high-bubble-analysis-code";

    const next = recordLabCompletion(state, {
      templateId: "bubble-sort-analysis",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-08-22T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next.stageProgressByStage.high_school.experimentEvidence).toMatchObject([{
      activityId: "high-bubble-analysis-code",
      courseId: "high-bubble-analysis",
      templateId: "bubble-sort-analysis",
      metrics: {
        comparisonCount: 3,
        emptyInputComparisons: 0,
        sortedInputComparisons: 10,
        reverseInputComparisons: 10,
        duplicateInputComparisons: 6,
        quadraticFormulaAtSizeSix: 15,
        challengePassed: 1,
      },
    }]);
    expect(next.stageProgressByStage.high_school.experimentEvidence[0]?.templateId).not.toBe("bubble-sort");
  });

  it("records both H-01 dataset versions, cleaning rule and chart preparation", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.activeActivityId = "high-python-data-lab-code";

    const next = recordLabCompletion(state, {
      templateId: "python-data-basics",
      challengeVersion: 3,
      passed: true,
      completedAt: "2026-08-23T04:00:00.000Z",
      hintsUsed: 1,
      durationMs: 142,
      resultCode: "passed",
    });

    expect(next.stageProgressByStage.high_school.experimentEvidence).toMatchObject([{
      activityId: "high-python-data-lab-code",
      templateId: "python-data-basics",
      variables: {
        templateVersion: "python-data-basics:v3",
        parameterSetId: "default:python-data-basics:v3",
        runDurationMs: 142,
        resultCode: "passed",
        datasetVersion: "scores-json-v1",
        alternateDatasetVersion: "scores-csv-v1",
        inputFormat: "json",
        supportedInputFormats: "json,csv",
        cleaningRule: "跳过 score 为 None 或空字符串的记录",
        chartPreparation: "有效/缺失计数",
      },
      metrics: {
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
    }]);
  });

  it("records the fixed split rule, baseline and leakage result for H-03", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.activeActivityId = "high-ml-pipeline-code";

    const next = recordLabCompletion(state, {
      templateId: "dataset-split",
      challengeVersion: 3,
      passed: true,
      completedAt: "2026-08-23T05:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next.stageProgressByStage.high_school.experimentEvidence).toMatchObject([{
      activityId: "high-ml-pipeline-code",
      templateId: "dataset-split",
      variables: {
        datasetVersion: "pipeline-labels-v1",
        splitRule: "index % 5",
        baselinePolicy: "训练集多数类",
        baselineSource: "train",
        leakageCase: "baseline_source=test 时标记 leakage_detected=true",
        evaluationScope: "test-only",
      },
      metrics: {
        trainCount: 6,
        validationCount: 2,
        testCount: 2,
        baselinePredictionCount: 2,
        baselineAccuracy: 0.5,
        leakageDetected: 0,
        leakageCaseDetected: 1,
      },
    }]);
  });

  it("records classification, regression and error-cost metrics for H-04", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.activeActivityId = "high-classification-regression-code";

    const next = recordLabCompletion(state, {
      templateId: "classification-metrics",
      challengeVersion: 3,
      passed: true,
      completedAt: "2026-08-23T06:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next.stageProgressByStage.high_school.experimentEvidence).toMatchObject([{
      activityId: "high-classification-regression-code",
      templateId: "classification-metrics",
      variables: {
        classificationTask: "binary",
        experimentVersion: "classification-metrics-v3",
        classificationDatasetVersion: "classification-cases-v1",
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
      },
      metrics: {
        accuracy: 0.5,
        precision: 0.5,
        recall: 0.5,
        f1: 0.5,
        classificationSampleCount: 4,
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
    }]);
  });

  it("records training and validation curve evidence for H-05", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.activeActivityId = "high-neural-network-training-code";

    const next = recordLabCompletion(state, {
      templateId: "gradient-descent-demo",
      challengeVersion: 3,
      passed: true,
      completedAt: "2026-08-23T07:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next.stageProgressByStage.high_school.experimentEvidence).toMatchObject([{
      activityId: "high-neural-network-training-code",
      templateId: "gradient-descent-demo",
      variables: {
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
      },
      metrics: {
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
        alternateRunCount: 2,
        alternateLearningRate: 0.2,
        alternateBestValidationLoss: 0.7,
        stableRunOverfitDetected: 0,
        trainCurveStepCount: 5,
        validationCurveStepCount: 5,
      },
    }]);
  });

  it("records versioned multimodal comparisons, failed samples and privacy boundaries for H-06", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.activeActivityId = "high-multimodal-ai-code";

    const next = recordLabCompletion(state, {
      templateId: "multimodal-input-audit",
      challengeVersion: 2,
      passed: true,
      completedAt: "2026-08-23T07:30:00.000Z",
      hintsUsed: 1,
      durationMs: 188,
      resultCode: "passed",
    });

    expect(next.stageProgressByStage.high_school.experimentEvidence).toMatchObject([{
      activityId: "high-multimodal-ai-code",
      templateId: "multimodal-input-audit",
      variables: {
        experimentVersion: "multimodal-input-audit-v2",
        datasetVersion: "multimodal-samples-v2",
        inputVersion: "vision-inputs-v2",
        modalityOrder: "text,image,structured,combined",
        sourceVersion: "multimodal-sources-v2",
        failedSampleIds: "text:s2,image:s1",
        unavailableSampleIds: "",
        unauthorizedSampleIds: "s2",
        restrictedSampleIds: "s2",
        authorizationPolicy: "仅统计已授权且符合当前用途的输入；未授权输入保留在审计边界中",
        privacyPolicy: "受限输入不得用于模型训练或展示",
      },
      metrics: {
        modalityCount: 4,
        eligibleInputCount: 7,
        excludedInputCount: 1,
        failedInputCount: 2,
        failedSampleCount: 2,
        textAvailable: 2,
        textCorrect: 1,
        textFailed: 1,
        imageAvailable: 2,
        imageCorrect: 1,
        imageFailed: 1,
        structuredAvailable: 1,
        structuredCorrect: 1,
        combinedAvailable: 2,
        combinedCorrect: 2,
        bestAccuracy: 1,
        unauthorizedSampleCount: 1,
        restrictedSampleCount: 1,
      },
    }]);
  });

  it("records the versioned no-retrieval/retrieval comparison and fixed-tool policy for H-07", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.activeActivityId = "high-generative-ai-rag-code";

    const next = recordLabCompletion(state, {
      templateId: "rag-citation-check",
      challengeVersion: 3,
      passed: true,
      completedAt: "2026-08-23T08:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next.stageProgressByStage.high_school.experimentEvidence).toMatchObject([{
      activityId: "high-generative-ai-rag-code",
      templateId: "rag-citation-check",
      variables: {
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
      },
      metrics: {
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
    }]);
  });

  it("stores a structured high-school experiment reference for the project workspace", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.high_school.activeActivityId = "high-image-model-audit-project";
    const next = recordLabCompletion(state, {
      templateId: "model-audit",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-08-22T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next.stageProgressByStage.high_school.experimentEvidence).toMatchObject([{
      activityId: "high-image-model-audit-project",
      mode: "project",
      templateId: "model-audit",
      metrics: { groups: 2, totalSamples: 3, correctSamples: 2, failedGroups: 1 },
    }]);
  });

  it("treats a successful fixed challenge as completion evidence even though mastery is formative", () => {
    const next = recordLabCompletion(createDefaultLearningState(), {
      templateId: "model-audit",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-08-22T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next.attempts.at(-1)?.score).toBe(0.7);
    expect(hasPassedLabAttempt(next, "model-audit")).toBe(true);
    expect(hasPassedLabAttempt(next, "model-audit", 2)).toBe(false);
  });

  it("records a code attempt and mastery without persisting source", () => {
    const state = createDefaultLearningState();
    const next = recordLabCompletion(state, {
      templateId: "bubble-sort",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-07-18T04:00:00.000Z",
      hintsUsed: 2,
    });

    expect(next.attempts.at(-1)).toMatchObject({
      attemptId: "lab:bubble-sort:v1",
      knowledgePointId: "algorithm.bubble-sort",
      score: 0.7,
      hints: 2,
      mode: "code",
    });
    expect(next.attempts.at(-1)).not.toHaveProperty("answer");
    expect(next.masteryByKnowledgePoint["algorithm.bubble-sort"]).toMatchObject({
      evidenceCount: 1,
      lastPracticedAt: "2026-07-18T04:00:00.000Z",
    });
  });

  it("does not award completion for a failed deterministic check", () => {
    const state = createDefaultLearningState();
    const next = recordLabCompletion(state, {
      templateId: "image-classifier",
      challengeVersion: 1,
      passed: false,
      completedAt: "2026-07-18T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next).toBe(state);
  });

  it("does not add evidence twice for the same challenge version", () => {
    const first = recordLabCompletion(createDefaultLearningState(), {
      templateId: "bubble-sort",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-07-18T04:00:00.000Z",
      hintsUsed: 0,
    });
    const repeated = recordLabCompletion(first, {
      templateId: "bubble-sort",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-07-19T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(repeated).toBe(first);
    expect(repeated.attempts).toHaveLength(1);
    expect(repeated.masteryByKnowledgePoint["algorithm.bubble-sort"].evidenceCount).toBe(1);
  });

  it("records a new deterministic attempt after a challenge version changes", () => {
    const first = recordLabCompletion(createDefaultLearningState(), {
      templateId: "bubble-sort",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-07-18T04:00:00.000Z",
      hintsUsed: 0,
    });
    const upgraded = recordLabCompletion(first, {
      templateId: "bubble-sort",
      challengeVersion: 2,
      passed: true,
      completedAt: "2026-07-19T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(upgraded.attempts.map((attempt) => attempt.attemptId)).toEqual([
      "lab:bubble-sort:v1",
      "lab:bubble-sort:v2",
    ]);
  });

  it("records the dedicated middle-school Python challenge against its own knowledge point", () => {
    const next = recordLabCompletion(createDefaultLearningState(), {
      templateId: "middle-python-basics",
      challengeVersion: 1,
      passed: true,
      completedAt: "2026-08-22T04:00:00.000Z",
      hintsUsed: 0,
    });

    expect(next.attempts.at(-1)).toMatchObject({
      attemptId: "lab:middle-python-basics:v1",
      knowledgePointId: "middle.python-basics",
    });
  });

  it("creates structured guided evidence only after a prediction and complete observation", () => {
    const completedAt = "2026-08-22T04:00:00.000Z";
    const evidence = createGuidedImageClassificationEvidence({
      ...guidedEvidenceInput(completedAt),
      prediction: "ball",
      predictionBeforeRun: "ball",
    });

    expect(evidence).toMatchObject({
      activityId: "middle-neural-signals-guided-lab",
      courseId: "middle-neural-signals",
      templateId: "image-classifier",
      mode: "guided",
      variables: {
        changedVariable: "texture",
        learnerPrediction: "ball",
        datasetVersion: "image-classifier-lab-v1",
        hintsUsed: 1,
        runDurationMs: 18,
      },
      metrics: { passedTests: 3, totalTests: 3, predictionCorrect: 0 },
    });
    expect(createGuidedImageClassificationEvidence({
      ...guidedEvidenceInput(completedAt),
      observation: "太短",
    })).toBeNull();
  });

  it("adds the guided record without marking the learning activity complete", () => {
    const completedAt = "2026-08-22T04:00:00.000Z";
    const next = recordGuidedImageClassificationEvidence(stateAtGuidedImageLab(), {
      ...guidedEvidenceInput(completedAt),
    });

    expect(next.stageProgressByStage.middle_school.experimentEvidence).toHaveLength(1);
    expect(next.stageProgressByStage.middle_school.experimentEvidence[0]?.metrics.predictionCorrect).toBe(1);
    expect(next.stageProgressByStage.middle_school.completedActivityIds).toEqual(guidedLabPrerequisites);
  });

  it("does not create guided evidence from a direct URL before the activity is unlocked", () => {
    const state = createDefaultLearningState();
    const next = recordGuidedImageClassificationEvidence(state, {
      ...guidedEvidenceInput(),
    });

    expect(next).toBe(state);
  });

  it("requires two comparable independent runs and a metric-grounded conclusion", () => {
    const first = calculateIndependentImageClassificationRun({
      runId: "independent-1",
      variableId: "texture",
      value: "striped",
      hintsUsed: 0,
      completedAt: "2026-08-22T04:00:00.000Z",
    })!;
    const second = calculateIndependentImageClassificationRun({
      runId: "independent-2",
      variableId: "texture",
      value: "handle",
      hintsUsed: 2,
      completedAt: "2026-08-22T04:01:00.000Z",
    })!;
    let state = recordIndependentImageClassificationRun(stateAtIndependentImageLab(), first);

    expect(getIndependentImageClassificationRuns(state)).toEqual([first]);
    expect(hasCompletedIndependentImageClassification(state)).toBe(false);
    state = recordIndependentImageClassificationRun(state, second);
    expect(hasCompletedIndependentImageClassification(state)).toBe(false);

    const incomplete = recordIndependentImageClassificationConclusion(state, {
      changed: "我改变了纹理线索，从条纹改为把手。",
      result: "cup 分数从 3 增到 5。",
      reason: "把手是杯子的明显线索，因此得分会提高。",
      completedAt: "2026-08-22T04:02:00.000Z",
    });
    expect(incomplete).toBe(state);

    const completed = recordIndependentImageClassificationConclusion(state, {
      changed: "我改变了纹理线索，从条纹改为把手。",
      result: "两次固定检查都是 3/3，cup 分数从 3 增到 5。",
      reason: "把手是杯子的明显线索，因此得分会提高。",
      completedAt: "2026-08-22T04:02:00.000Z",
    });
    expect(hasCompletedIndependentImageClassification(completed)).toBe(true);
    expect(completed.stageProgressByStage.middle_school.experimentEvidence).toHaveLength(3);
  });

  it("records research attempts but only accepts a versioned, metric-grounded challenge summary", () => {
    const control = calculateResearchImageClassificationAttempt({
      runId: "research-control",
      selectedSampleIds: [],
      completedAt: "2026-08-22T04:00:00.000Z",
    })!;
    const improved = calculateResearchImageClassificationAttempt({
      runId: "research-improved",
      selectedSampleIds: ["backlit-leaf", "backlit-ball", "backlit-cup"],
      completedAt: "2026-08-22T04:01:00.000Z",
    })!;
    let state = recordResearchImageClassificationAttempt(stateAtResearchChallenge(), control);
    state = recordResearchImageClassificationAttempt(state, improved);

    expect(getResearchImageClassificationAttempts(state)).toEqual([control, improved]);
    expect(hasCompletedResearchImageClassificationChallenge(state)).toBe(false);
    expect(recordResearchImageClassificationConclusion(
      state,
      "我补充了逆光样本，表现更好。",
      "2026-08-22T04:02:00.000Z",
    )).toBe(state);

    const completed = recordResearchImageClassificationConclusion(
      state,
      "我补充了逆光叶子、球和杯子样本，逆光组从 4/10 提升到 7/10，说明应补充逆光场景的样本。",
      "2026-08-22T04:02:00.000Z",
    );
    expect(hasCompletedResearchImageClassificationChallenge(completed)).toBe(true);
    expect(completed.stageProgressByStage.middle_school.experimentEvidence.at(-1)).toMatchObject({
      activityId: "middle-data-bias-research",
      mode: "research",
      variables: { evidenceType: "summary" },
      metrics: { challengeVersion: 1, attemptCount: 2, bestBacklitAccuracy: 7 },
    });
  });

  it("does not record research evidence when a direct URL bypasses the learning sequence", () => {
    const state = createDefaultLearningState();
    const attempt = calculateResearchImageClassificationAttempt({
      runId: "blocked-research",
      selectedSampleIds: [],
      completedAt: "2026-08-22T04:00:00.000Z",
    })!;
    expect(recordResearchImageClassificationAttempt(state, attempt)).toBe(state);
  });
});
