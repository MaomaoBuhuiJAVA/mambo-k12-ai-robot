import type { ProjectEvaluation } from "./project-evaluator";
import { getProjectDefinition, PROJECT_SCHEMA_VERSION, type ProjectRecord } from "./project-schema";
import type { ExperimentEvidence } from "@/lib/domain";

const REPRODUCTION_METADATA_KEYS = new Set([
  "evidenceType",
  "challengeVersion",
  "templateVersion",
  "datasetVersion",
  "parameterSetId",
  "runDurationMs",
  "resultCode",
  "inputFormat",
]);

function formatRecord(values: Record<string, string | number | boolean>): string {
  const entries = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`);
  return entries.length > 0 ? entries.join("；") : "未记录";
}

function formatMetrics(metrics: Record<string, number>): string {
  const entries = Object.entries(metrics)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);
  return entries.length > 0 ? entries.join("；") : "未记录";
}

function formatEvidenceReproduction(evidence: ExperimentEvidence): string[] {
  const variables = evidence.variables;
  const runParameters = Object.fromEntries(
    Object.entries(variables).filter(([key]) => !REPRODUCTION_METADATA_KEYS.has(key)),
  );
  const challengeVersion = variables.challengeVersion ?? evidence.metrics.challengeVersion ?? "未记录";
  const templateVersion = variables.templateVersion ?? `challenge-v${String(challengeVersion)}`;
  const datasetVersion = variables.datasetVersion ?? variables.knowledgeBaseVersion ?? "未记录";
  const parameterSetId = variables.parameterSetId ?? `default:${evidence.templateId}:v${String(challengeVersion)}`;
  const runDurationMs = variables.runDurationMs ?? "未记录";
  const resultCode = variables.resultCode ?? "未记录";
  const inputFormat = variables.inputFormat ?? "未记录";
  return [
    `### ${evidence.templateId}`,
    `- 证据 runId：${evidence.runId}`,
    `- 实验模板：${evidence.templateId}`,
    `- 模板版本：${String(templateVersion)}`,
    `- 挑战版本：${String(challengeVersion)}`,
    `- 数据集/知识库版本：${String(datasetVersion)}`,
    `- 输入格式：${String(inputFormat)}`,
    `- 参数集：${String(parameterSetId)}`,
    `- 运行参数：${formatRecord(runParameters)}`,
    `- 实际运行耗时：${String(runDurationMs)}${typeof runDurationMs === "number" ? " ms" : ""}`,
    `- 结果代码：${String(resultCode)}`,
    `- 运行时间：${evidence.completedAt}`,
    `- 结果指标：${formatMetrics(evidence.metrics)}`,
  ];
}

export function formatProjectReport(
  project: ProjectRecord,
  evaluation: ProjectEvaluation,
  evidence: readonly ExperimentEvidence[] = [],
): string {
  const definition = getProjectDefinition(project.id);
  const reproduction = evidence.length > 0
    ? evidence.flatMap(formatEvidenceReproduction)
    : ["暂无已选择的实验记录。"];
  return [
    `# ${definition?.reportTitle ?? "Mambo AI 高中项目报告"}`,
    "",
    `项目 ID：${project.id}`,
    `项目结构版本：${PROJECT_SCHEMA_VERSION}`,
    "评价规则版本：2",
    `实验引用：${project.evidenceRefs.length} 条`,
    "",
    "## 研究问题",
    project.researchQuestion,
    "## 数据来源与授权",
    `${project.dataSource}\n${project.authorization}`,
    "## 数据处理与模型",
    `${project.processingSteps}\n${project.modelVersion}`,
    "## 实验指标",
    project.metrics,
    "## 复现信息",
    ...reproduction,
    "## 失败案例",
    project.failureCases,
    "## 结论与限制",
    `${project.conclusion}\n${project.limitations}`,
    "## 确定性评价",
    evaluation.passed ? "通过" : `未通过：${evaluation.missing.join("；")}`,
    "## 答辩回答",
    ...(project.defenseAnswers.length ? project.defenseAnswers : ["尚未完成答辩回答"]),
    "",
  ].join("\n");
}
