export const PROJECT_SCHEMA_VERSION = 2 as const;

export const PROJECT_IDS = ["model-audit", "capstone"] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];

export interface ProjectDefinition {
  id: ProjectId;
  eyebrow: string;
  title: string;
  summary: string;
  reportTitle: string;
}

export const PROJECT_DEFINITIONS: Readonly<Record<ProjectId, ProjectDefinition>> = {
  "model-audit": {
    id: "model-audit",
    eyebrow: "高中模型审计",
    title: "图像模型审计项目",
    summary: "检查数据来源、分组表现、失败样本和模型部署边界。",
    reportTitle: "图像模型审计项目报告",
  },
  capstone: {
    id: "capstone",
    eyebrow: "高中综合项目",
    title: "AI 综合项目与答辩",
    summary: "把研究问题、实验指标、模型卡和答辩证据整理成可复核成果。",
    reportTitle: "AI 综合项目与答辩报告",
  },
};

export function isProjectId(value: string): value is ProjectId {
  return (PROJECT_IDS as readonly string[]).includes(value);
}

export function getProjectDefinition(id: string): ProjectDefinition | undefined {
  return isProjectId(id) ? PROJECT_DEFINITIONS[id] : undefined;
}

export type ProjectStepId =
  | "question"
  | "data"
  | "baseline"
  | "experiment"
  | "audit"
  | "report"
  | "defense";

export interface ProjectStep {
  id: ProjectStepId;
  title: string;
  summary: string;
  fields: readonly ProjectField[];
}

export const PROJECT_STEPS: readonly ProjectStep[] = [
  { id: "question", title: "研究问题", summary: "把要回答的问题写成可验证的句子。", fields: ["researchQuestion"] },
  { id: "data", title: "数据与授权", summary: "说明数据从哪里来、能否用于本次研究。", fields: ["dataSource", "authorization"] },
  { id: "baseline", title: "处理与基线", summary: "记录清洗步骤和用于比较的模型或算法。", fields: ["processingSteps", "modelVersion"] },
  { id: "experiment", title: "实验与指标", summary: "引用已完成实验，保留可复核的数值指标。", fields: ["metrics"] },
  { id: "audit", title: "失败与模型卡", summary: "记录失败样本、适用范围和限制。", fields: ["failureCases", "limitations"] },
  { id: "report", title: "结论与报告", summary: "根据证据写出结论，并准备导出报告。", fields: ["conclusion"] },
  { id: "defense", title: "星宝答辩", summary: "逐题回答为什么、证据是什么以及下一步做什么。", fields: [] },
] as const;

export interface ProjectRecord {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  updatedAt: string;
  researchQuestion: string;
  dataSource: string;
  authorization: string;
  processingSteps: string;
  modelVersion: string;
  metrics: string;
  failureCases: string;
  conclusion: string;
  limitations: string;
  defenseAnswers: string[];
  currentStep: ProjectStepId;
  evidenceRefs: string[];
}

export const PROJECT_FIELDS = ["researchQuestion", "dataSource", "authorization", "processingSteps", "modelVersion", "metrics", "failureCases", "conclusion", "limitations"] as const;
export type ProjectField = (typeof PROJECT_FIELDS)[number];

export function createProject(id: string): ProjectRecord {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id,
    updatedAt: new Date(0).toISOString(),
    researchQuestion: "",
    dataSource: "",
    authorization: "",
    processingSteps: "",
    modelVersion: "",
    metrics: "",
    failureCases: "",
    conclusion: "",
    limitations: "",
    defenseAnswers: [],
    currentStep: "question",
    evidenceRefs: [],
  };
}

export function getProjectStep(stepId: ProjectStepId): ProjectStep {
  return PROJECT_STEPS.find((step) => step.id === stepId) ?? PROJECT_STEPS[0];
}

export function isProjectComplete(project: ProjectRecord): boolean { return PROJECT_FIELDS.every((field) => project[field].trim().length >= 4); }
