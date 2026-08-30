import { describe, expect, it } from "vitest";
import { isKnownKnowledgePointId } from "./knowledge-points";
describe("known knowledge points", () => { it("registers every built-in high-school lab evidence id", () => { for (const id of ["high.python-data-basics", "high.bubble-sort-analysis", "high.dataset-split", "high.classification-metrics", "high.gradient-descent", "high.multimodal-input", "high.rag-citation-check", "high.model-audit"]) expect(isKnownKnowledgePointId(id)).toBe(true); }); });
