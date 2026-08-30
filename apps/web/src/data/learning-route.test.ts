import { describe, expect, it } from "vitest";

import { resolveLearningRoute, resolveLegacyHighProject } from "./learning-route";

describe("resolveLearningRoute", () => {
  it("normalizes the learning hub while rejecting unknown stage/view values", () => {
    expect(resolveLearningRoute({
      page: "hub",
      stage: "middle_school",
      view: "courses",
    })).toMatchObject({
      kind: "ready",
      canonicalPath: "/learn?stage=middle_school&view=courses",
      stage: "middle_school",
      view: "courses",
    });

    expect(resolveLearningRoute({ page: "hub", stage: "outside", view: "path" }))
      .toMatchObject({ kind: "redirect", reason: "invalid" });
    expect(resolveLearningRoute({ page: "hub", stage: "high_school", view: "timeline" }))
      .toMatchObject({ kind: "redirect", reason: "invalid", canonicalPath: "/learn?stage=high_school&view=path" });
  });

  it("keeps a valid grade in the hub canonical route and rejects a cross-stage grade", () => {
    expect(resolveLearningRoute({
      page: "hub",
      stage: "middle_school",
      grade: "middle_2",
      view: "courses",
    })).toMatchObject({
      kind: "ready",
      canonicalPath: "/learn?stage=middle_school&grade=middle_2&view=courses",
      stage: "middle_school",
      grade: "middle_2",
    });

    expect(resolveLearningRoute({
      page: "hub",
      stage: "middle_school",
      grade: "high_1",
      view: "path",
    })).toMatchObject({ kind: "redirect", reason: "cross_stage" });
    expect(resolveLearningRoute({ page: "hub", grade: "high_2" }))
      .toMatchObject({ kind: "ready", stage: "high_school", grade: "high_2" });
  });

  it("keeps course and lesson deep links in their configured stage", () => {
    expect(resolveLearningRoute({
      page: "course",
      courseId: "middle-ai-foundations",
      stage: "high_school",
    })).toMatchObject({ kind: "redirect", reason: "cross_stage" });

    expect(resolveLearningRoute({
      page: "course",
      courseId: "middle-ai-foundations",
      stage: "middle_school",
      grade: "middle_3",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });

    expect(resolveLearningRoute({
      page: "course",
      courseId: "middle-ai-foundations",
      stage: "middle_school",
      grade: "middle_2",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });

    expect(resolveLearningRoute({
      page: "lesson",
      lessonId: "middle-ai-foundations%3Aconcepts%3Arules-and-models",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });

    const lessonId = "middle-ai-foundations:concepts:rules-and-models";
    expect(resolveLearningRoute({
      page: "lesson",
      lessonId,
      activityId: "middle-ai-foundations-lesson",
    })).toMatchObject({
      kind: "ready",
      canonicalPath: `/learn/lesson/${encodeURIComponent(lessonId)}?activity=middle-ai-foundations-lesson`,
      courseId: "middle-ai-foundations",
      stage: "middle_school",
    });

    expect(resolveLearningRoute({
      page: "lesson",
      lessonId,
      stage: "middle_school",
      grade: "middle_3",
      activityId: "middle-ai-foundations-lesson",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });
  });

  it("rejects an activity from another lesson and reports missing prerequisites", () => {
    expect(resolveLearningRoute({
      page: "lesson",
      lessonId: "middle-ai-foundations:concepts:rules-and-models",
      activityId: "middle-data-and-algorithms-lesson",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });

    expect(resolveLearningRoute(
      {
        page: "lesson",
        lessonId: "middle-neural-signals:classification-lab:guided-and-independent-lab",
        activityId: "middle-neural-signals-independent-lab",
      },
      { completedActivityIds: [] },
    )).toMatchObject({
      kind: "locked",
      missingEvidenceIds: ["middle-neural-signals-guided-lab"],
    });
  });

  it("infers and validates practice-set stage and remediation ownership", () => {
    expect(resolveLearningRoute({
      page: "practice",
      practiceSetId: "course--high-generative-ai-rag",
      stage: "middle_school",
    })).toMatchObject({ kind: "redirect", reason: "cross_stage" });

    expect(resolveLearningRoute({
      page: "practice",
      practiceSetId: "course--high-generative-ai-rag",
      stage: "high_school",
      remediationActivityId: "high-generative-ai-rag-remediation",
    })).toMatchObject({
      kind: "ready",
      canonicalPath: "/learn/practice/course--high-generative-ai-rag?stage=high_school&remediation=high-generative-ai-rag-remediation",
      courseId: "high-generative-ai-rag",
      activityId: "high-generative-ai-rag-remediation",
    });

    expect(resolveLearningRoute({
      page: "practice",
      practiceSetId: "daily-middle_school",
      stage: "middle_school",
      grade: "middle_2",
    })).toMatchObject({
      kind: "ready",
      grade: "middle_2",
      canonicalPath: "/learn/practice/daily-middle_school?stage=middle_school&grade=middle_2",
    });

    expect(resolveLearningRoute({
      page: "practice",
      practiceSetId: "course--middle-ai-foundations",
      stage: "middle_school",
      grade: "middle_2",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });

    expect(resolveLearningRoute({
      page: "practice",
      practiceSetId: "course--high-generative-ai-rag",
      stage: "high_school",
      remediationActivityId: "high-python-data-lab-remediation",
    })).toMatchObject({ kind: "redirect", reason: "invalid" });
  });

  it("keeps H-09 project routes separate and lockable", () => {
    expect(resolveLearningRoute({
      page: "project",
      projectId: "capstone",
    })).toMatchObject({
      kind: "ready",
      canonicalPath: "/learn/project/capstone",
      stage: "high_school",
    });

    expect(resolveLearningRoute(
      { page: "project", projectId: "capstone" },
      { completedActivityIds: [] },
    )).toMatchObject({
      kind: "locked",
      missingEvidenceIds: ["high-image-model-audit-defense"],
    });

    expect(resolveLearningRoute({
      page: "project",
      projectId: "capstone",
      stage: "middle_school",
    })).toMatchObject({ kind: "redirect", reason: "cross_stage" });
  });

  it("maps legacy high-school project links to the canonical learn route", () => {
    expect(resolveLegacyHighProject("capstone")).toEqual({
      kind: "redirect",
      canonicalPath: "/learn/project/capstone",
      reason: "legacy",
    });
    expect(resolveLegacyHighProject("missing")).toMatchObject({
      kind: "redirect",
      reason: "invalid",
    });
  });
});
