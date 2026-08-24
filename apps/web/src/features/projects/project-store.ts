import {
  createProject,
  isProjectId,
  PROJECT_SCHEMA_VERSION,
  PROJECT_STEPS,
  type ProjectRecord,
  type ProjectStepId,
} from "./project-schema";
const KEY = "mambo.high-projects.v1";

const stepIds = new Set(PROJECT_STEPS.map((step) => step.id));

function isProjectStepId(value: unknown): value is ProjectStepId {
  return typeof value === "string" && stepIds.has(value as ProjectStepId);
}

function migrateProject(id: string, item: unknown): ProjectRecord {
  if (!item || typeof item !== "object" || Array.isArray(item)) return createProject(id);
  const raw = item as Record<string, unknown>;
  if ((raw.schemaVersion !== 1 && raw.schemaVersion !== PROJECT_SCHEMA_VERSION) || raw.id !== id) {
    return createProject(id);
  }
  const fields = createProject(id);
  for (const key of ["researchQuestion", "dataSource", "authorization", "processingSteps", "modelVersion", "metrics", "failureCases", "conclusion", "limitations"] as const) {
    fields[key] = typeof raw[key] === "string" ? raw[key].slice(0, 1600) : "";
  }
  fields.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : fields.updatedAt;
  fields.defenseAnswers = Array.isArray(raw.defenseAnswers)
    ? raw.defenseAnswers.filter((answer): answer is string => typeof answer === "string").slice(0, 8).map((answer) => answer.slice(0, 1600))
    : [];
  fields.currentStep = isProjectStepId(raw.currentStep) ? raw.currentStep : "question";
  fields.evidenceRefs = Array.isArray(raw.evidenceRefs)
    ? raw.evidenceRefs.filter((ref): ref is string => typeof ref === "string").slice(0, 60)
    : [];
  fields.schemaVersion = PROJECT_SCHEMA_VERSION;
  return fields;
}

export function loadProject(id: string, storage: Storage | null = typeof window === "undefined" ? null : window.localStorage): ProjectRecord | null {
  if (!isProjectId(id)) return null;
  if (!storage) return createProject(id);
  try {
    const raw = storage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return migrateProject(id, parsed[id]);
  } catch {
    return createProject(id);
  }
}

export function saveProject(project: ProjectRecord, storage: Storage | null = typeof window === "undefined" ? null : window.localStorage): boolean {
  if (!isProjectId(project.id)) return false;
  if (!storage) return false;
  try {
    const raw = storage.getItem(KEY);
    const all = raw ? JSON.parse(raw) : {};
    const next = migrateProject(project.id, { ...project, schemaVersion: PROJECT_SCHEMA_VERSION });
    storage.setItem(KEY, JSON.stringify({ ...all, [project.id]: { ...next, updatedAt: new Date().toISOString() } }));
    return true;
  } catch {
    return false;
  }
}
