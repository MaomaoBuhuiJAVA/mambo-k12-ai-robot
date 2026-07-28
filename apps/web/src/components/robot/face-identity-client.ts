export type FaceIdentityStatus = "idle" | "loading" | "running" | "unavailable" | "error";

export type FaceRecognitionState =
  | "idle"
  | "no_face"
  | "low_light"
  | "multiple_faces"
  | "collecting"
  | "unknown"
  | "recognizing"
  | "confirmed";

export type FaceIdentity = {
  id: string;
  label: string;
  samples: number;
  createdAt: string;
};

export type FaceRecognitionIdentity = FaceIdentity & {
  confirmed: boolean;
  confidence?: number;
};

export type FaceEnrollment = {
  label: string;
  collected: number;
  required: number;
};

export type FaceIdentityError = {
  code: string;
  message: string;
};

export type FaceIdentitySnapshot = {
  status: FaceIdentityStatus;
  state: FaceRecognitionState;
  message: string;
  enrollment: FaceEnrollment | null;
  identity: FaceRecognitionIdentity | null;
  error: FaceIdentityError | null;
};

export type FaceIdentityList = {
  count: number;
  identities: FaceIdentity[];
  error?: FaceIdentityError;
};

const FACE_IDENTITY_PREFIX = "/_mambo/face";
const FACE_IDENTITY_UNAVAILABLE = "face_identity_unavailable";
const LABEL_MAX_LENGTH = 32;

const STATUSES = new Set<FaceIdentityStatus>(["idle", "loading", "running", "unavailable", "error"]);
const STATES = new Set<FaceRecognitionState>([
  "idle",
  "no_face",
  "low_light",
  "multiple_faces",
  "collecting",
  "unknown",
  "recognizing",
  "confirmed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[]): boolean {
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.includes(key));
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPublicLabel(value: unknown): value is string {
  return isNonBlankString(value) && value === value.trim() && value.length <= LABEL_MAX_LENGTH;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function parseError(value: unknown): FaceIdentityError | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["code", "message"], ["code", "message"])) return null;
  if (!isNonBlankString(value.code) || !isNonBlankString(value.message)) return null;
  return { code: value.code, message: value.message };
}

function parsePublicIdentity(value: unknown): FaceIdentity | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "label", "samples", "created_at"], ["id", "label", "samples", "created_at"])) return null;
  if (!isNonBlankString(value.id) || !isPublicLabel(value.label) || !isPositiveInteger(value.samples) || !isNonBlankString(value.created_at)) return null;
  return {
    id: value.id,
    label: value.label,
    samples: value.samples,
    createdAt: value.created_at,
  };
}

function parseRecognitionIdentity(value: unknown): FaceRecognitionIdentity | null {
  if (!isRecord(value) || !hasOnlyKeys(
    value,
    ["id", "label", "samples", "created_at", "confirmed", "confidence"],
    ["id", "label", "samples", "created_at", "confirmed"],
  )) return null;

  const identity = parsePublicIdentity({
    id: value.id,
    label: value.label,
    samples: value.samples,
    created_at: value.created_at,
  });
  if (!identity || typeof value.confirmed !== "boolean") return null;
  if (value.confidence !== undefined && (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)) return null;

  return value.confidence === undefined
    ? { ...identity, confirmed: value.confirmed }
    : { ...identity, confirmed: value.confirmed, confidence: value.confidence };
}

function parseEnrollment(value: unknown): FaceEnrollment | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["label", "collected", "required"], ["label", "collected", "required"])) return null;
  if (!isPublicLabel(value.label) || !Number.isInteger(value.collected) || (value.collected as number) < 0 || !isPositiveInteger(value.required) || (value.collected as number) > value.required) return null;
  return {
    label: value.label,
    collected: value.collected as number,
    required: value.required,
  };
}

export function parseFaceIdentitySnapshot(value: unknown): FaceIdentitySnapshot | null {
  if (!isRecord(value) || !hasOnlyKeys(
    value,
    ["status", "state", "message", "enrollment", "identity", "error"],
    ["status", "state", "message", "enrollment", "identity", "error"],
  )) return null;
  if (typeof value.status !== "string" || !STATUSES.has(value.status as FaceIdentityStatus)) return null;
  if (typeof value.state !== "string" || !STATES.has(value.state as FaceRecognitionState)) return null;
  if (!isNonBlankString(value.message)) return null;

  const enrollment = value.enrollment === null ? null : parseEnrollment(value.enrollment);
  const identity = value.identity === null ? null : parseRecognitionIdentity(value.identity);
  const error = value.error === null ? null : parseError(value.error);
  if (enrollment === null && value.enrollment !== null) return null;
  if (identity === null && value.identity !== null) return null;
  if (error === null && value.error !== null) return null;
  if ((value.status === "unavailable" || value.status === "error") && error === null) return null;

  return {
    status: value.status as FaceIdentityStatus,
    state: value.state as FaceRecognitionState,
    message: value.message,
    enrollment,
    identity,
    error,
  };
}

export function parseFaceIdentityList(value: unknown): FaceIdentityList | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["count", "identities", "error"], ["count", "identities"])) return null;
  if (!Number.isInteger(value.count) || (value.count as number) < 0 || !Array.isArray(value.identities)) return null;

  const identities = value.identities.map(parsePublicIdentity);
  if (identities.some((identity) => identity === null) || value.count !== identities.length) return null;

  if (value.error === undefined) {
    return { count: value.count, identities: identities as FaceIdentity[] };
  }
  if (value.error === null) return null;
  const error = parseError(value.error);
  return error ? { count: value.count, identities: identities as FaceIdentity[], error } : null;
}

async function requestFaceIdentity<T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T | null,
): Promise<T> {
  try {
    const response = await fetch(`${FACE_IDENTITY_PREFIX}${path}`, {
      cache: "no-store",
      ...init,
    });
    if (!response.ok) throw new Error(FACE_IDENTITY_UNAVAILABLE);
    const parsed = parse(await response.json());
    if (parsed === null) throw new Error(FACE_IDENTITY_UNAVAILABLE);
    return parsed;
  } catch {
    throw new Error(FACE_IDENTITY_UNAVAILABLE);
  }
}

function jsonMutation(body: Record<string, string>): RequestInit {
  return {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function fetchFaceIdentityStatus(): Promise<FaceIdentitySnapshot> {
  return requestFaceIdentity("/status", {}, parseFaceIdentitySnapshot);
}

export function startFaceIdentity(): Promise<FaceIdentitySnapshot> {
  return requestFaceIdentity("/start", jsonMutation({}), parseFaceIdentitySnapshot);
}

export function stopFaceIdentity(): Promise<FaceIdentitySnapshot> {
  return requestFaceIdentity("/stop", jsonMutation({}), parseFaceIdentitySnapshot);
}

export function beginFaceEnrollment(label: string): Promise<FaceIdentitySnapshot> {
  return requestFaceIdentity("/enroll", jsonMutation({ label }), parseFaceIdentitySnapshot);
}

export function cancelFaceEnrollment(): Promise<FaceIdentitySnapshot> {
  return requestFaceIdentity("/cancel-enrollment", jsonMutation({}), parseFaceIdentitySnapshot);
}

export function fetchFaceIdentities(): Promise<FaceIdentityList> {
  return requestFaceIdentity("/identities", {}, parseFaceIdentityList);
}

export function deleteFaceIdentity(id: string): Promise<FaceIdentityList> {
  return requestFaceIdentity("/identities/delete", jsonMutation({ id }), parseFaceIdentityList);
}
