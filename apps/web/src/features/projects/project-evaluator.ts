import { PROJECT_FIELDS, PROJECT_STEPS, type ProjectRecord, type ProjectStepId } from "./project-schema";

export interface ProjectEvaluation {
  passed: boolean;
  missing: string[];
}

export interface ProjectStepEvaluation extends ProjectEvaluation {
  stepId: ProjectStepId;
}

export type AvailableEvidenceIds = ReadonlySet<string> | readonly string[];

function hasReferencedEvidence(
  project: ProjectRecord,
  availableEvidenceIds: AvailableEvidenceIds = [],
): boolean {
  if (project.evidenceRefs.length === 0) return false;

  const available = availableEvidenceIds instanceof Set
    ? availableEvidenceIds
    : new Set(availableEvidenceIds);
  return project.evidenceRefs.every((runId) => available.has(runId));
}

function baseMissing(project: ProjectRecord): string[] {
  return PROJECT_FIELDS
    .filter((field) => project[field].trim().length < 4)
    .map((field) => `${field}（至少填写 4 个字符）`);
}

export function evaluateProjectStep(
  project: ProjectRecord,
  stepId: ProjectStepId,
  availableEvidenceIds?: AvailableEvidenceIds,
): ProjectStepEvaluation {
  const step = PROJECT_STEPS.find((item) => item.id === stepId) ?? PROJECT_STEPS[0];
  const missing = step.fields
    .filter((field) => project[field].trim().length < 4)
    .map((field) => `${field}（至少填写 4 个字符）`);

  if (stepId === "experiment") {
    if (!hasReferencedEvidence(project, availableEvidenceIds)) {
      missing.push("evidenceRefs（只能引用当前学习状态中已保存的实验记录）");
    }
    if (!/\d/.test(project.metrics)) missing.push("metrics（需要引用至少一个确定性数值指标）");
  }
  if (stepId === "audit" && !/(失败|错误|不足|限制)/.test(`${project.failureCases} ${project.limitations}`)) {
    missing.push("failureCases / limitations（需要说明失败或限制）");
  }
  if (stepId === "defense") {
    if (!evaluateProject(project, availableEvidenceIds).passed) missing.push("先完成前六个项目步骤");
    if (project.defenseAnswers.filter((answer) => answer.trim().length >= 8).length < 3) {
      missing.push("defenseAnswers（至少完成 3 个、每个 8 个字符以上的回答）");
    }
  }

  return { stepId, passed: missing.length === 0, missing: [...new Set(missing)] };
}

export function evaluateProject(
  project: ProjectRecord,
  availableEvidenceIds?: AvailableEvidenceIds,
): ProjectEvaluation {
  const missing = baseMissing(project);
  if (!/\d/.test(project.metrics)) missing.push("metrics（需要引用至少一个确定性数值指标）");
  if (!/(失败|错误|不足|限制)/.test(`${project.failureCases} ${project.limitations}`)) {
    missing.push("failureCases / limitations（需要说明失败或限制）");
  }
  if (!hasReferencedEvidence(project, availableEvidenceIds)) {
    missing.push("evidenceRefs（只能引用当前学习状态中已保存的实验记录）");
  }
  return { passed: missing.length === 0, missing: [...new Set(missing)] };
}

export function defenseQuestions(project: ProjectRecord): string[] {
  return [
    `为什么选择“${project.modelVersion || "当前算法"}”来回答研究问题？`,
    `你的指标“${project.metrics || "尚未填写"}”说明了什么，又不能说明什么？`,
    `请解释失败案例“${project.failureCases || "尚未填写"}”会如何影响结论。`,
    `根据限制“${project.limitations || "尚未填写"}”，下一步最应补充什么证据？`,
  ];
}
