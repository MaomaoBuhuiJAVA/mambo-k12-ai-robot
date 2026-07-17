import { describe, expect, it } from "vitest";

import { getCourseById } from "./curriculum";
import {
  KNOWLEDGE_SOURCE_CATALOG,
  getKnowledgeContextForCourse,
} from "./knowledge-sources";

const AUTHORITATIVE_HOSTS = new Set([
  "docs.pytorch.org",
  "scikit-learn.org",
  "www.nist.gov",
]);

describe("knowledge source catalog", () => {
  it("stores a versioned, dated catalog with unique authoritative HTTPS sources", () => {
    expect(KNOWLEDGE_SOURCE_CATALOG.schemaVersion).toBe(1);
    expect(KNOWLEDGE_SOURCE_CATALOG.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const sourceIds = KNOWLEDGE_SOURCE_CATALOG.sources.map((source) => source.id);
    const urls = KNOWLEDGE_SOURCE_CATALOG.sources.map((source) => source.url);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(new Set(urls).size).toBe(urls.length);

    for (const source of KNOWLEDGE_SOURCE_CATALOG.sources) {
      const url = new URL(source.url);
      expect(url.protocol).toBe("https:");
      expect(AUTHORITATIVE_HOSTS.has(url.hostname)).toBe(true);
      expect(source.publisher).toBeTruthy();
      expect(source.title).toBeTruthy();
    }
  });

  it("keeps every fact citation and mapped course resolvable", () => {
    const sourceIds = new Set(KNOWLEDGE_SOURCE_CATALOG.sources.map((source) => source.id));

    for (const topic of KNOWLEDGE_SOURCE_CATALOG.topics) {
      expect(topic.facts.length).toBeGreaterThan(0);
      expect(topic.courseIds.every((courseId) => getCourseById(courseId) !== undefined)).toBe(true);
      for (const fact of topic.facts) {
        expect(fact.sourceIds.length).toBeGreaterThan(0);
        expect(fact.sourceIds.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
      }
    }
  });

  it.each([
    ["lower-bubble-sort", "bubble-sort", "NIST"],
    ["high-bubble-analysis", "bubble-sort", "NIST"],
    ["lower-picture-labels", "image-classification", "PyTorch"],
    ["upper-fruit-classifier", "image-classification", "PyTorch"],
    ["middle-neural-signals", "image-classification", "PyTorch"],
    ["middle-data-bias", "image-classification", "scikit-learn"],
    ["high-image-model-audit", "image-classification", "scikit-learn"],
  ])("maps %s to its verified %s context", (courseId, topicId, publisher) => {
    const context = getKnowledgeContextForCourse(courseId);

    expect(context?.topic.id).toBe(topicId);
    expect(context?.sources.some((source) => source.publisher.includes(publisher))).toBe(true);
  });

  it("returns no invented evidence for an unrelated course", () => {
    expect(getKnowledgeContextForCourse("upper-loop-maze")).toBeUndefined();
    expect(getKnowledgeContextForCourse("missing-course")).toBeUndefined();
  });

  it("does not let a caller mutate the shared source catalog through a lookup", () => {
    const first = getKnowledgeContextForCourse("lower-bubble-sort");
    if (!first) throw new Error("fixture context missing");
    const original = first.facts[0].statement;

    first.facts[0].statement = "被调用方改写";
    first.sources.splice(0);

    const second = getKnowledgeContextForCourse("lower-bubble-sort");
    expect(second?.facts[0].statement).toBe(original);
    expect(second?.sources).toHaveLength(1);
    expect(Object.isFrozen(KNOWLEDGE_SOURCE_CATALOG)).toBe(true);
  });
});
