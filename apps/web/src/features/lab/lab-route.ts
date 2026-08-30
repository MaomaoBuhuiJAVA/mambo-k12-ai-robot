import type { ExperimentMode, Stage } from "@/lib/domain";
import { getActivity, isActivityUnlocked } from "@/data/learning-paths";
import { isProjectId, type ProjectId } from "@/features/projects/project-schema";
import { LAB_TEMPLATE_IDS, type LabTemplateId } from "./lab-protocol";
import { LAB_EXPERIMENT_MODES } from "./lab-mode";

/**
 * Query values are kept as strings at the page boundary.  This resolver is
 * the one place where a lab entry becomes a typed, stage-aware route.
 */
export interface LabRouteInput {
  stage?: string;
  templateId?: string;
  mode?: string;
  familiarity?: string;
  activityId?: string;
  projectId?: string;
}

export interface LabRouteOptions {
  /**
   * Supplying completion evidence makes the resolver useful to callers that
   * need to render a locked deep link.  The page can omit it and let the
   * client-side lab restore the current learner state after hydration.
   */
  completedActivityIds?: readonly string[];
}

type LabRouteMode = ExperimentMode | undefined;
type RouteStage = Stage | undefined;

export interface LabRouteReady {
  kind: "ready";
  canonicalPath: string;
  stage: RouteStage;
  templateId: LabTemplateId;
  mode: LabRouteMode;
  activityId?: string;
  projectId?: ProjectId;
}

export interface LabRouteLocked extends Omit<LabRouteReady, "kind"> {
  kind: "locked";
  missingEvidenceIds: string[];
}

export interface LabRouteRedirect {
  kind: "redirect";
  canonicalPath: string;
  reason: "legacy" | "invalid" | "cross_stage";
}

export type LabRouteResult = LabRouteReady | LabRouteLocked | LabRouteRedirect;

type LabRouteRule = {
  stage: Stage;
  templateId: LabTemplateId;
  mode: LabRouteMode;
};

/**
 * The matrix intentionally lists only combinations that have a teaching
 * contract.  A missing mode means the old, free-form lab entry (not a
 * learning-path activity).  It is still allowed for the two original common
 * templates so bookmarked `/lab` links keep working.
 */
export const LAB_ROUTE_RULES: readonly LabRouteRule[] = [
  { stage: "lower_primary", templateId: "bubble-sort", mode: undefined },
  { stage: "lower_primary", templateId: "image-classifier", mode: undefined },
  { stage: "upper_primary", templateId: "bubble-sort", mode: undefined },
  { stage: "upper_primary", templateId: "image-classifier", mode: undefined },
  { stage: "middle_school", templateId: "bubble-sort", mode: undefined },
  { stage: "middle_school", templateId: "bubble-sort", mode: "independent" },
  { stage: "middle_school", templateId: "middle-python-basics", mode: undefined },
  { stage: "middle_school", templateId: "middle-python-basics", mode: "independent" },
  { stage: "middle_school", templateId: "image-classifier", mode: undefined },
  { stage: "middle_school", templateId: "image-classifier", mode: "guided" },
  { stage: "middle_school", templateId: "image-classifier", mode: "independent" },
  { stage: "middle_school", templateId: "image-classifier", mode: "research" },
  { stage: "high_school", templateId: "bubble-sort", mode: undefined },
  { stage: "high_school", templateId: "image-classifier", mode: undefined },
  { stage: "high_school", templateId: "python-data-basics", mode: "independent" },
  { stage: "high_school", templateId: "bubble-sort-analysis", mode: "independent" },
  { stage: "high_school", templateId: "dataset-split", mode: "independent" },
  { stage: "high_school", templateId: "classification-metrics", mode: "independent" },
  { stage: "high_school", templateId: "gradient-descent-demo", mode: "independent" },
  { stage: "high_school", templateId: "multimodal-input-audit", mode: "independent" },
  { stage: "high_school", templateId: "rag-citation-check", mode: "independent" },
  { stage: "high_school", templateId: "model-audit", mode: "project" },
] as const;

type LabActivityContract = LabRouteRule & { projectId?: ProjectId };

/** Activity IDs are versioned path contracts, not user-controlled URLs. */
const LAB_ACTIVITY_CONTRACTS: Readonly<Record<string, LabActivityContract>> = {
  "middle-data-and-algorithms-lab": {
    stage: "middle_school",
    templateId: "bubble-sort",
    mode: "independent",
  },
  "middle-python-basics-lab": {
    stage: "middle_school",
    templateId: "middle-python-basics",
    mode: "independent",
  },
  "middle-neural-signals-guided-lab": {
    stage: "middle_school",
    templateId: "image-classifier",
    mode: "guided",
  },
  "middle-neural-signals-independent-lab": {
    stage: "middle_school",
    templateId: "image-classifier",
    mode: "independent",
  },
  "middle-data-bias-research": {
    stage: "middle_school",
    templateId: "image-classifier",
    mode: "research",
  },
  "high-python-data-lab-code": {
    stage: "high_school",
    templateId: "python-data-basics",
    mode: "independent",
  },
  "high-bubble-analysis-code": {
    stage: "high_school",
    templateId: "bubble-sort-analysis",
    mode: "independent",
  },
  "high-ml-pipeline-code": {
    stage: "high_school",
    templateId: "dataset-split",
    mode: "independent",
  },
  "high-classification-regression-code": {
    stage: "high_school",
    templateId: "classification-metrics",
    mode: "independent",
  },
  "high-neural-network-training-code": {
    stage: "high_school",
    templateId: "gradient-descent-demo",
    mode: "independent",
  },
  "high-multimodal-ai-code": {
    stage: "high_school",
    templateId: "multimodal-input-audit",
    mode: "independent",
  },
  "high-generative-ai-rag-code": {
    stage: "high_school",
    templateId: "rag-citation-check",
    mode: "independent",
  },
  "high-image-model-audit-project": {
    stage: "high_school",
    templateId: "model-audit",
    mode: "project",
    projectId: "model-audit",
  },
};

const STAGES: readonly Stage[] = [
  "lower_primary",
  "upper_primary",
  "middle_school",
  "high_school",
];

const TEMPLATE_IDS: readonly string[] = LAB_TEMPLATE_IDS;

function parseStage(value: string | undefined): RouteStage {
  return STAGES.find((stage) => stage === value);
}

function parseTemplate(value: string | undefined): LabTemplateId | undefined {
  return TEMPLATE_IDS.includes(value ?? "") ? value as LabTemplateId : undefined;
}

function parseMode(value: string | undefined): LabRouteMode {
  return LAB_EXPERIMENT_MODES.find((mode) => mode === value);
}

function normalizeFamiliarity(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function chooseDefaultTemplate(
  stage: RouteStage,
  familiarity: string | undefined,
  mode: LabRouteMode,
): LabTemplateId {
  if (mode === "project") return "model-audit";
  if (mode === "guided" || mode === "research") return "image-classifier";
  if (mode === "independent" && stage === "high_school") return "python-data-basics";

  const normalized = normalizeFamiliarity(familiarity);
  if (["beginner", "new", "starter", "zero", "none", "first_steps"].includes(normalized)) {
    return "image-classifier";
  }
  if (["confident", "advanced", "independent", "experienced", "ready"].includes(normalized)) {
    return "bubble-sort";
  }
  return stage === "middle_school" || stage === "high_school" ? "bubble-sort" : "image-classifier";
}

function fallbackPath(stage: RouteStage): string {
  if (stage === "middle_school") {
    return "/learn?stage=middle_school&grade=middle_1&view=courses";
  }
  if (stage === "high_school") {
    return `/learn?stage=${stage}&view=path`;
  }
  return "/lab";
}

function redirect(
  stage: RouteStage,
  reason: LabRouteRedirect["reason"],
): LabRouteRedirect {
  return { kind: "redirect", canonicalPath: fallbackPath(stage), reason };
}

function buildCanonicalPath(
  stage: RouteStage,
  templateId: LabTemplateId,
  mode: LabRouteMode,
): string {
  const params = new URLSearchParams();
  if (stage) params.set("stage", stage);
  params.set("template", templateId);
  if (mode) params.set("mode", mode);
  return `/lab?${params.toString()}`;
}

function matchesRule(
  stage: RouteStage,
  templateId: LabTemplateId,
  mode: LabRouteMode,
): boolean {
  if (!stage) return mode === undefined && (templateId === "bubble-sort" || templateId === "image-classifier");
  return LAB_ROUTE_RULES.some((rule) =>
    rule.stage === stage && rule.templateId === templateId && rule.mode === mode,
  );
}

function knownStage(value: string | undefined): boolean {
  return value === undefined || STAGES.includes(value as Stage);
}

function knownTemplate(value: string | undefined): boolean {
  return value === undefined || TEMPLATE_IDS.includes(value);
}

function knownMode(value: string | undefined): boolean {
  return value === undefined || LAB_EXPERIMENT_MODES.includes(value as ExperimentMode);
}

function contractForActivity(activityId: string): LabActivityContract | undefined {
  const contract = LAB_ACTIVITY_CONTRACTS[activityId];
  if (!contract || !getActivity(activityId)) return undefined;
  return contract;
}

function resolveProjectId(value: string | undefined): ProjectId | undefined {
  return value && isProjectId(value) ? value : undefined;
}

/**
 * Resolve a lab deep link without reading browser state or doing navigation.
 * Callers can therefore test every stage/template/mode combination in Node.
 */
export function resolveLabRoute(
  input: LabRouteInput,
  options: LabRouteOptions = {},
): LabRouteResult {
  const rawStage = input.stage;
  const rawTemplate = input.templateId;
  const rawMode = input.mode;
  const rawActivityId = input.activityId;
  const rawProjectId = input.projectId;

  if (!knownStage(rawStage) || !knownTemplate(rawTemplate) || !knownMode(rawMode)) {
    return redirect(parseStage(rawStage), "invalid");
  }

  const stage = parseStage(rawStage);
  const templateFromQuery = parseTemplate(rawTemplate);
  const modeFromQuery = parseMode(rawMode);
  const projectId = resolveProjectId(rawProjectId);

  if (rawProjectId !== undefined && !projectId) return redirect(stage, "invalid");

  const activityContract = rawActivityId ? contractForActivity(rawActivityId) : undefined;
  if (rawActivityId !== undefined && !activityContract) return redirect(stage, "invalid");

  const expectedStage = activityContract?.stage;
  const expectedTemplate = activityContract?.templateId;
  const expectedMode = activityContract?.mode;

  if (stage && expectedStage && stage !== expectedStage) return redirect(stage, "cross_stage");
  if (templateFromQuery && expectedTemplate && templateFromQuery !== expectedTemplate) {
    return redirect(stage ?? expectedStage, stage && expectedStage && stage !== expectedStage ? "cross_stage" : "invalid");
  }
  if (modeFromQuery && expectedMode && modeFromQuery !== expectedMode) return redirect(stage, "invalid");
  if (rawMode !== undefined && !modeFromQuery) return redirect(stage, "invalid");

  const resolvedStage = stage ?? expectedStage;
  // The project entry is versioned around model-audit.  Keep the historical
  // deep link safe by pinning a conflicting high-school template to that
  // contract; middle-school project links still fail the matrix check below.
  const pinnedProjectTemplate = resolvedStage === "high_school"
    && (modeFromQuery ?? expectedMode) === "project"
    && !activityContract
    ? "model-audit" as const
    : undefined;
  const resolvedTemplate = pinnedProjectTemplate ?? templateFromQuery ?? expectedTemplate
    ?? chooseDefaultTemplate(resolvedStage, input.familiarity, modeFromQuery ?? expectedMode);
  const resolvedMode = modeFromQuery ?? expectedMode;

  if (!matchesRule(resolvedStage, resolvedTemplate, resolvedMode)) {
    const hasTemplateForStage = resolvedStage
      && LAB_ROUTE_RULES.some((rule) => rule.stage === resolvedStage && rule.templateId === resolvedTemplate);
    const existsInAnotherStage = LAB_ROUTE_RULES.some(
      (rule) => rule.templateId === resolvedTemplate && rule.stage !== resolvedStage,
    );
    const reason: LabRouteRedirect["reason"] = resolvedStage && !hasTemplateForStage && existsInAnotherStage
      ? "cross_stage"
      : "invalid";
    return redirect(resolvedStage, reason);
  }

  if (projectId && !(resolvedStage === "high_school" && resolvedTemplate === "model-audit" && resolvedMode === "project" && projectId === "model-audit")) {
    return redirect(resolvedStage, "invalid");
  }
  if (activityContract?.projectId && projectId && activityContract.projectId !== projectId) {
    return redirect(resolvedStage, "invalid");
  }

  const canonicalPath = buildCanonicalPath(resolvedStage, resolvedTemplate, resolvedMode);
  const ready: LabRouteReady = {
    kind: "ready",
    canonicalPath,
    stage: resolvedStage,
    templateId: resolvedTemplate,
    mode: resolvedMode,
    ...(rawActivityId ? { activityId: rawActivityId } : {}),
    ...(projectId ? { projectId } : activityContract?.projectId ? { projectId: activityContract.projectId } : {}),
  };

  if (rawActivityId && options.completedActivityIds) {
    const activity = getActivity(rawActivityId);
    if (activity && !isActivityUnlocked(rawActivityId, options.completedActivityIds)) {
      return {
        ...ready,
        kind: "locked",
        missingEvidenceIds: activity.prerequisites.filter(
          (prerequisiteId) => !options.completedActivityIds?.includes(prerequisiteId),
        ),
      };
    }
  }

  return ready;
}

export function isLabTemplateId(value: string): value is LabTemplateId {
  return TEMPLATE_IDS.includes(value);
}

export function isLabMode(value: string): value is ExperimentMode {
  return LAB_EXPERIMENT_MODES.includes(value as ExperimentMode);
}
