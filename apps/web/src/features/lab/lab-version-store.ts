import type { Stage, ExperimentMode } from "@/lib/domain";
import { LAB_TEMPLATE_IDS, type LabTemplateId } from "./lab-protocol";

const STORAGE_KEY = "mambo.lab-versions.v1";
const MAX_VERSIONS = 24;
const MAX_CODE_CHARS = 12_000;

export type LabVersionMode = ExperimentMode | "standard";

export interface LabCodeVersion {
  id: string;
  stage: Stage | null;
  mode: LabVersionMode;
  templateId: LabTemplateId;
  challengeVersion: number;
  code: string;
  savedAt: string;
}

interface VersionQuery {
  stage: Stage | null;
  mode: LabVersionMode;
  templateId: LabTemplateId;
  challengeVersion: number;
}

function getStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  return typeof window === "undefined" ? null : window.localStorage;
}

function isStage(value: unknown): value is Stage {
  return value === "lower_primary"
    || value === "upper_primary"
    || value === "middle_school"
    || value === "high_school";
}

function isLabTemplateId(value: unknown): value is LabTemplateId {
  return typeof value === "string" && (LAB_TEMPLATE_IDS as readonly string[]).includes(value);
}

function isMode(value: unknown): value is LabVersionMode {
  return value === "standard"
    || value === "guided"
    || value === "independent"
    || value === "research"
    || value === "project";
}

function normalizeVersion(value: unknown): LabCodeVersion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string"
    || !isLabTemplateId(raw.templateId)
    || !isMode(raw.mode)
    || (raw.stage !== null && !isStage(raw.stage))
    || typeof raw.challengeVersion !== "number"
    || !Number.isInteger(raw.challengeVersion)
    || raw.challengeVersion < 1
    || typeof raw.code !== "string"
    || raw.code.length > MAX_CODE_CHARS
    || typeof raw.savedAt !== "string"
    || Number.isNaN(Date.parse(raw.savedAt))
  ) return null;
  return {
    id: raw.id.slice(0, 120),
    stage: raw.stage as Stage | null,
    mode: raw.mode,
    templateId: raw.templateId,
    challengeVersion: raw.challengeVersion,
    code: raw.code,
    savedAt: raw.savedAt,
  };
}

function readVersions(storage: Storage | null): LabCodeVersion[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeVersion)
      .filter((item): item is LabCodeVersion => item !== null)
      .slice(-MAX_VERSIONS);
  } catch {
    return [];
  }
}

export function saveLabCodeVersion(
  input: Omit<LabCodeVersion, "id">,
  storage?: Storage | null,
): boolean {
  const target = getStorage(storage);
  const version = normalizeVersion({
    ...input,
    id: `lab-version:${input.templateId}:${input.challengeVersion}:${input.savedAt}`,
  });
  if (!target || !version) return false;
  try {
    const versions = [...readVersions(target), version].slice(-MAX_VERSIONS);
    target.setItem(STORAGE_KEY, JSON.stringify(versions));
    return true;
  } catch {
    return false;
  }
}

export function listLabCodeVersions(storage?: Storage | null): LabCodeVersion[] {
  return readVersions(getStorage(storage));
}

export function loadLatestLabCodeVersion(
  query: VersionQuery,
  storage?: Storage | null,
): LabCodeVersion | null {
  const versions = readVersions(getStorage(storage));
  return [...versions].reverse().find((version) =>
    version.stage === query.stage
    && version.mode === query.mode
    && version.templateId === query.templateId
    && version.challengeVersion === query.challengeVersion,
  ) ?? null;
}

export { MAX_CODE_CHARS, MAX_VERSIONS, STORAGE_KEY as LAB_VERSION_STORAGE_KEY };
