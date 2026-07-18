import sourceCatalog from "./knowledge-sources.v1.json";

export interface KnowledgeSource {
  id: string;
  title: string;
  publisher: string;
  sourceType: string;
  url: string;
}

export interface KnowledgeFact {
  id: string;
  statement: string;
  sourceIds: string[];
  courseIds: string[];
}

export interface KnowledgeTopic {
  id: string;
  label: string;
  courseIds: string[];
  facts: KnowledgeFact[];
}

export interface KnowledgeSourceCatalog {
  schemaVersion: number;
  reviewedOn: string;
  sources: KnowledgeSource[];
  topics: KnowledgeTopic[];
}

export interface CourseKnowledgeContext {
  topic: KnowledgeTopic;
  facts: KnowledgeFact[];
  sources: KnowledgeSource[];
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

export const KNOWLEDGE_SOURCE_CATALOG = deepFreeze(
  sourceCatalog as KnowledgeSourceCatalog,
);

export function getKnowledgeContextForCourse(courseId: string): CourseKnowledgeContext | undefined {
  const topic = KNOWLEDGE_SOURCE_CATALOG.topics.find((candidate) =>
    candidate.courseIds.includes(courseId),
  );
  if (!topic) return undefined;

  const facts = topic.facts.filter((fact) => fact.courseIds.includes(courseId));
  const usedSourceIds = new Set(facts.flatMap((fact) => fact.sourceIds));
  const sources = KNOWLEDGE_SOURCE_CATALOG.sources.filter((source) =>
    usedSourceIds.has(source.id),
  );

  return structuredClone({ topic, facts, sources }) as CourseKnowledgeContext;
}

export function formatKnowledgeContextForPrompt(courseId: string): string | undefined {
  const context = getKnowledgeContextForCourse(courseId);
  if (!context) return undefined;

  const markerBySourceId = new Map(
    context.sources.map((source, index) => [source.id, `S${index + 1}`]),
  );
  const facts = context.facts.map((fact) => {
    const markers = fact.sourceIds
      .map((sourceId) => markerBySourceId.get(sourceId))
      .filter((marker): marker is string => marker !== undefined)
      .map((marker) => `[${marker}]`)
      .join("");
    return `- ${fact.statement} ${markers}`;
  });
  const sources = context.sources.map(
    (source) =>
      `- [${markerBySourceId.get(source.id)}] ${source.publisher}《${source.title}》 ${source.url}`,
  );

  return [
    `已核验课程事实（${context.topic.label}）：`,
    ...facts,
    "来源索引：",
    ...sources,
    "引用规则：回答涉及这些技术事实时，用 [S1] 这样的编号标注依据；不要把资料没有支持的说法补成事实，资料不足时明确说明；不要虚构教材名称、出版社或版本。",
  ].join("\n");
}
