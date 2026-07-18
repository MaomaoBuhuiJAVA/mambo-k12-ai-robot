import { CURRICULUM } from "@/data/curriculum";

const MAX_KNOWLEDGE_POINT_ID_LENGTH = 160;
const MAX_REGISTERED_EXTENSIONS = 500;
const LAB_KNOWLEDGE_POINT_IDS = [
  "algorithm.bubble-sort",
  "ai.image-classification-features",
] as const;

const curriculumKnowledgePointIds = CURRICULUM.flatMap((course) =>
  course.knowledgePointTags.map((tag) => `${course.id}:${tag}`),
);
const builtInIds = new Set<string>([
  ...curriculumKnowledgePointIds,
  ...LAB_KNOWLEDGE_POINT_IDS,
]);
const extensionReferences = new Map<string, number>();

function validExtensionId(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_KNOWLEDGE_POINT_ID_LENGTH
    && value.trim() === value
    && /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/i.test(value);
}

export function isKnownKnowledgePointId(value: unknown): value is string {
  return typeof value === "string"
    && (builtInIds.has(value) || extensionReferences.has(value));
}

export function registerKnowledgePointExtensions(ids: readonly string[]): () => void {
  const accepted = [...new Set(ids.filter(validExtensionId))]
    .slice(0, MAX_REGISTERED_EXTENSIONS);
  for (const id of accepted) {
    extensionReferences.set(id, (extensionReferences.get(id) ?? 0) + 1);
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    for (const id of accepted) {
      const references = extensionReferences.get(id) ?? 0;
      if (references <= 1) extensionReferences.delete(id);
      else extensionReferences.set(id, references - 1);
    }
  };
}
