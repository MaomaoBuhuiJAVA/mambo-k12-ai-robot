import type { ExperimentEvidence, LearningState } from "@/lib/domain";

import type { ProjectRecord } from "./project-schema";

export interface ProjectEvidenceView {
  evidence: ExperimentEvidence;
  metricText: string;
  failureText: string;
}

const METRIC_LABELS: Record<string, string> = {
  rowCount: "记录数",
  validRowCount: "有效记录数",
  missingCount: "缺失记录数",
  mean: "均值",
  maximum: "最大值",
  comparisonCount: "比较次数",
  emptyInputComparisons: "空输入比较次数",
  trainCount: "训练记录",
  validationCount: "验证记录",
  testCount: "测试记录",
  baselineAccuracy: "基线准确率",
  leakageDetected: "检测到数据泄漏",
  accuracy: "准确率",
  precision: "精确率",
  recall: "召回率",
  f1: "F1",
  mse: "均方误差",
  steps: "曲线步数",
  learningRate: "学习率",
  finalTrainLoss: "最终训练损失",
  finalValidationLoss: "最终验证损失",
  bestValidationLoss: "最佳验证损失",
  overfitDetected: "检测到过拟合",
  availableModalities: "可用模态数",
  failedSamples: "失败样本数",
  withoutRetrievalCitations: "无检索引用数",
  matchedCitations: "匹配引用数",
  unmatchedCitations: "未知引用数",
  allowedSources: "允许来源数",
  toolCallsBlocked: "工具调用已阻止",
  groups: "分组数",
  totalSamples: "总样本数",
  correctSamples: "正确样本数",
  failedGroups: "失败分组数",
  challengePassed: "固定测试通过",
  challengeVersion: "挑战版本",
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return date.toISOString().slice(0, 10);
}

export function formatEvidenceMetrics(evidence: ExperimentEvidence): string {
  const metrics = Object.entries(evidence.metrics)
    .map(([key, value]) => `${METRIC_LABELS[key] ?? key} ${value}`)
    .join("；");
  return `${evidence.templateId} / ${formatDate(evidence.completedAt)}：${metrics || "已通过固定测试"}`;
}

export function formatEvidenceFailures(evidence: ExperimentEvidence): string {
  const metrics = evidence.metrics;
  const failures: string[] = [];
  if ((metrics.failedGroups ?? 0) > 0) failures.push(`有 ${metrics.failedGroups} 个分组出现错误`);
  if ((metrics.failedSamples ?? 0) > 0) failures.push(`保留 ${metrics.failedSamples} 个失败样本`);
  if ((metrics.unmatchedCitations ?? 0) > 0) failures.push(`有 ${metrics.unmatchedCitations} 条引用无法在允许来源中匹配`);
  if ((metrics.leakageDetected ?? 0) > 0) failures.push("检测到数据泄漏风险");
  if (failures.length === 0) failures.push("当前固定样本未暴露失败指标，仍需说明样本范围和适用限制");
  return `${evidence.templateId}：${failures.join("；")}。`;
}

export function collectProjectEvidence(state: LearningState): ProjectEvidenceView[] {
  return state.stageProgressByStage.high_school.experimentEvidence.map((evidence) => ({
    evidence,
    metricText: formatEvidenceMetrics(evidence),
    failureText: formatEvidenceFailures(evidence),
  }));
}

function uniqueEvidenceRefs(refs: readonly string[]): string[] {
  return [...new Set(refs)].slice(-60);
}

function withEvidenceSummary(
  project: ProjectRecord,
  refs: readonly string[],
  evidence: readonly ProjectEvidenceView[],
): ProjectRecord {
  if (evidence.length === 0) {
    return { ...project, evidenceRefs: [...refs] };
  }
  const metricText = evidence.map((item) => item.metricText).join("\n").slice(0, 1600);
  const failureText = evidence.map((item) => item.failureText).join("\n").slice(0, 1600);
  return {
    ...project,
    evidenceRefs: [...refs],
    metrics: project.metrics.trim() ? project.metrics : metricText,
    failureCases: project.failureCases.trim() ? project.failureCases : failureText,
  };
}

export function syncProjectEvidence(
  project: ProjectRecord,
  evidence: readonly ProjectEvidenceView[],
): ProjectRecord {
  const availableIds = new Set(evidence.map((item) => item.evidence.runId));
  // Refreshes only reconcile references that the learner already selected.
  // Newly completed experiments remain available in the panel but are not
  // attached until the learner explicitly selects them.
  const refs = uniqueEvidenceRefs(project.evidenceRefs.filter((runId) => availableIds.has(runId)));
  const selectedEvidence = evidence.filter((item) => refs.includes(item.evidence.runId));
  return withEvidenceSummary(project, refs, selectedEvidence);
}

export function importAllProjectEvidence(
  project: ProjectRecord,
  evidence: readonly ProjectEvidenceView[],
): ProjectRecord {
  const refs = uniqueEvidenceRefs(evidence.map((item) => item.evidence.runId));
  return withEvidenceSummary(project, refs, evidence);
}
