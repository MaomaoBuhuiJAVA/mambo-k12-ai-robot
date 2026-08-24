import { describe, expect, it } from "vitest";

import { LAB_ROUTE_RULES, resolveLabRoute } from "./lab-route";

describe("resolveLabRoute", () => {
  it("accepts every versioned stage/template/mode rule", () => {
    for (const rule of LAB_ROUTE_RULES) {
      const result = resolveLabRoute({
        stage: rule.stage,
        templateId: rule.templateId,
        mode: rule.mode,
      });

      expect(result).toMatchObject({
        kind: "ready",
        stage: rule.stage,
        templateId: rule.templateId,
        mode: rule.mode,
      });
    }
  });

  it("resolves mode-only guided and project links to their versioned templates", () => {
    expect(resolveLabRoute({ stage: "middle_school", mode: "guided" })).toMatchObject({
      kind: "ready",
      templateId: "image-classifier",
      mode: "guided",
    });
    expect(resolveLabRoute({ stage: "high_school", mode: "project" })).toMatchObject({
      kind: "ready",
      templateId: "model-audit",
      mode: "project",
    });
  });

  it("rejects cross-stage template and mode combinations", () => {
    expect(resolveLabRoute({
      stage: "middle_school",
      templateId: "python-data-basics",
      mode: "independent",
    })).toMatchObject({ kind: "redirect", reason: "cross_stage", canonicalPath: "/learn?stage=middle_school&grade=middle_1&view=courses" });

    expect(resolveLabRoute({
      stage: "high_school",
      templateId: "image-classifier",
      mode: "guided",
    })).toMatchObject({ kind: "redirect", reason: "invalid", canonicalPath: "/learn?stage=high_school&view=path" });

    expect(resolveLabRoute({
      stage: "middle_school",
      templateId: "bubble-sort",
      mode: "project",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });
  });

  it("rejects unknown IDs and modes instead of silently falling back", () => {
    expect(resolveLabRoute({ stage: "middle_school", templateId: "not-a-template" })).toMatchObject({
      kind: "redirect",
      reason: "invalid",
      canonicalPath: "/learn?stage=middle_school&grade=middle_1&view=courses",
    });
    expect(resolveLabRoute({ stage: "middle_school", mode: "unsafe" })).toMatchObject({
      kind: "redirect",
      reason: "invalid",
    });
    expect(resolveLabRoute({ stage: "unknown", templateId: "bubble-sort" })).toMatchObject({
      kind: "redirect",
      reason: "invalid",
      canonicalPath: "/lab",
    });
  });

  it("keeps the old no-stage lab entry available for common templates", () => {
    expect(resolveLabRoute({ familiarity: "beginner" })).toMatchObject({
      kind: "ready",
      stage: undefined,
      templateId: "image-classifier",
      mode: undefined,
      canonicalPath: "/lab?template=image-classifier",
    });
    expect(resolveLabRoute({ templateId: "bubble-sort" })).toMatchObject({
      kind: "ready",
      stage: undefined,
      templateId: "bubble-sort",
      mode: undefined,
    });
    expect(resolveLabRoute({ templateId: "dataset-split" })).toMatchObject({ kind: "redirect", reason: "invalid" });
  });

  it("requires the activity contract to agree with explicit query values", () => {
    expect(resolveLabRoute({
      activityId: "middle-neural-signals-guided-lab",
    })).toMatchObject({
      kind: "ready",
      stage: "middle_school",
      templateId: "image-classifier",
      mode: "guided",
      activityId: "middle-neural-signals-guided-lab",
    });
    expect(resolveLabRoute({
      activityId: "middle-neural-signals-guided-lab",
      stage: "high_school",
    })).toMatchObject({ kind: "redirect", reason: "cross_stage" });
    expect(resolveLabRoute({
      activityId: "middle-neural-signals-guided-lab",
      templateId: "bubble-sort",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });
  });

  it("returns missing prerequisites for a locked activity when evidence is supplied", () => {
    expect(resolveLabRoute(
      { activityId: "middle-neural-signals-independent-lab" },
      { completedActivityIds: [] },
    )).toMatchObject({
      kind: "locked",
      missingEvidenceIds: ["middle-neural-signals-guided-lab"],
    });

    expect(resolveLabRoute(
      { activityId: "middle-neural-signals-independent-lab" },
      { completedActivityIds: ["middle-neural-signals-guided-lab"] },
    )).toMatchObject({ kind: "ready" });
  });

  it("keeps project mode bound to the model-audit project", () => {
    expect(resolveLabRoute({
      stage: "high_school",
      templateId: "model-audit",
      mode: "project",
      projectId: "model-audit",
    })).toMatchObject({ kind: "ready", projectId: "model-audit" });
    expect(resolveLabRoute({
      stage: "high_school",
      templateId: "model-audit",
      mode: "project",
      projectId: "capstone",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });
  });
});
