import { describe, expect, it } from "vitest";

import {
  getActivity,
  getLearningPath,
  isActivityUnlocked,
  LEARNING_ACTIVITIES,
  validateLearningActivities,
} from "./learning-paths";

describe("learning paths", () => {
  it("defines a validated middle-school and high-school path using existing course and lab IDs", () => {
    expect(() => validateLearningActivities(LEARNING_ACTIVITIES)).not.toThrow();

    const middlePath = getLearningPath("middle_school");
    const highPath = getLearningPath("high_school");

    expect(middlePath.map((activity) => activity.id)).toEqual(expect.arrayContaining([
      "middle-ai-foundations-lesson",
      "middle-data-and-algorithms-lesson",
      "middle-python-basics-lesson",
      "middle-neural-signals-lesson",
      "middle-model-evaluation-lesson",
      "middle-generative-ai-lesson",
    ]));
    expect(highPath.map((activity) => activity.id)).toContain("high-bubble-analysis-review");
    expect(middlePath.every((activity) => activity.stage === "middle_school")).toBe(true);
    expect(highPath.every((activity) => activity.stage === "high_school")).toBe(true);
  });

  it("unlocks only the first middle-school activity until its required evidence is complete", () => {
    expect(isActivityUnlocked("middle-ai-foundations-lesson", [])).toBe(true);
    expect(isActivityUnlocked("middle-neural-signals-lesson", [])).toBe(false);
    expect(isActivityUnlocked("middle-ai-foundations-demonstration", [])).toBe(false);
    expect(isActivityUnlocked("middle-ai-foundations-demonstration", ["middle-ai-foundations-lesson"])).toBe(true);
    expect(isActivityUnlocked("middle-data-and-algorithms-lesson", [
      "middle-ai-foundations-lesson",
      "middle-ai-foundations-demonstration",
      "middle-ai-foundations-assessment",
    ])).toBe(true);
    expect(isActivityUnlocked("middle-python-basics-lesson", [
      "middle-ai-foundations-lesson",
      "middle-ai-foundations-demonstration",
      "middle-ai-foundations-assessment",
      "middle-data-and-algorithms-lesson",
      "middle-data-and-algorithms-demonstration",
      "middle-data-and-algorithms-lab",
      "middle-data-and-algorithms-assessment",
    ])).toBe(true);
    expect(isActivityUnlocked("middle-neural-signals-lesson", [
      "middle-ai-foundations-lesson",
      "middle-ai-foundations-demonstration",
      "middle-ai-foundations-assessment",
      "middle-data-and-algorithms-lesson",
      "middle-data-and-algorithms-demonstration",
      "middle-data-and-algorithms-lab",
      "middle-data-and-algorithms-assessment",
      "middle-python-basics-lesson",
      "middle-python-basics-demonstration",
      "middle-python-basics-lab",
      "middle-python-basics-assessment",
    ])).toBe(true);
    expect(isActivityUnlocked("middle-data-and-algorithms-demonstration", [])).toBe(false);
    expect(isActivityUnlocked("middle-data-and-algorithms-demonstration", ["middle-data-and-algorithms-lesson"])).toBe(true);
    expect(isActivityUnlocked("middle-data-and-algorithms-lab", ["middle-data-and-algorithms-lesson"])).toBe(false);
    expect(isActivityUnlocked("middle-data-and-algorithms-lab", [
      "middle-data-and-algorithms-lesson",
      "middle-data-and-algorithms-demonstration",
    ])).toBe(true);
    expect(isActivityUnlocked("middle-neural-signals-demonstration", [])).toBe(false);
    expect(isActivityUnlocked("middle-neural-signals-demonstration", ["middle-neural-signals-lesson"])).toBe(true);
    expect(isActivityUnlocked("middle-neural-signals-guided-lab", ["middle-neural-signals-lesson"])).toBe(false);
    expect(isActivityUnlocked("middle-neural-signals-guided-lab", [
      "middle-neural-signals-lesson",
      "middle-neural-signals-demonstration",
    ])).toBe(true);
    expect(isActivityUnlocked("middle-model-evaluation-lesson", [
      "middle-ai-foundations-lesson",
      "middle-ai-foundations-demonstration",
      "middle-ai-foundations-assessment",
      "middle-neural-signals-lesson",
      "middle-neural-signals-demonstration",
      "middle-neural-signals-guided-lab",
      "middle-neural-signals-independent-lab",
      "middle-neural-signals-assessment",
    ])).toBe(true);
    expect(isActivityUnlocked("middle-data-bias-lesson", ["middle-neural-signals-assessment"])).toBe(false);
    expect(isActivityUnlocked("middle-data-bias-demonstration", ["middle-data-bias-lesson"])).toBe(true);
    expect(isActivityUnlocked("middle-data-bias-research", ["middle-data-bias-lesson"])).toBe(false);
    expect(isActivityUnlocked("middle-data-bias-research", ["middle-data-bias-lesson", "middle-data-bias-demonstration"])).toBe(true);
    expect(isActivityUnlocked("middle-generative-ai-lesson", ["middle-data-bias-assessment"])).toBe(true);
    expect(isActivityUnlocked("middle-generative-ai-demonstration", ["middle-data-bias-assessment"])).toBe(false);
    expect(isActivityUnlocked("middle-ai-safety-lesson", ["middle-data-bias-assessment"])).toBe(false);
    expect(isActivityUnlocked("middle-ai-safety-lesson", [
      "middle-data-bias-assessment",
      "middle-generative-ai-lesson",
      "middle-generative-ai-demonstration",
      "middle-generative-ai-assessment",
    ])).toBe(true);
    expect(isActivityUnlocked("middle-ai-safety-demonstration", ["middle-data-bias-assessment"])).toBe(false);
  });

  it("keeps the complete high-school research route, registered templates, audit, and capstone connected", () => {
    const highPath = getLearningPath("high_school");
    expect(highPath.map((activity) => activity.courseId)).toEqual(expect.arrayContaining([
      "high-python-data-lab", "high-bubble-analysis", "high-ml-pipeline",
      "high-classification-regression", "high-neural-network-training", "high-multimodal-ai", "high-generative-ai-rag", "high-image-model-audit",
    ]));
    expect(highPath.map((activity) => activity.labTemplateId)).toEqual(expect.arrayContaining([
      "python-data-basics", "bubble-sort-analysis", "dataset-split", "classification-metrics",
      "gradient-descent-demo", "multimodal-input-audit", "rag-citation-check", "model-audit",
    ]));
    expect(highPath.find((activity) => activity.id === "high-classification-regression-lesson")?.title)
      .toBe("分类、回归与边界指标小课");
    expect(highPath.find((activity) => activity.id === "high-classification-regression-code")?.title)
      .toBe("分类/回归指标与错误代价实验");
    expect(highPath.find((activity) => activity.id === "high-neural-network-training-lesson")?.title)
      .toBe("多轮神经网络训练与泛化小课");
    expect(highPath.find((activity) => activity.id === "high-neural-network-training-code")?.title)
      .toBe("多轮训练曲线与过拟合实验");
    expect(highPath.find((activity) => activity.id === "high-multimodal-ai-lesson")?.title)
      .toBe("版本化多模态输入小课");
    expect(highPath.find((activity) => activity.id === "high-multimodal-ai-code")?.title)
      .toBe("四种输入版本对照实验");
    expect(highPath.find((activity) => activity.id === "high-multimodal-ai-assessment")?.title)
      .toBe("失败样本与授权边界评价");
    expect(highPath.find((activity) => activity.id === "high-generative-ai-rag-lesson")?.title)
      .toBe("固定知识库与检索增强小课");
    expect(highPath.find((activity) => activity.id === "high-generative-ai-rag-code")?.title)
      .toBe("无/有检索与失败回答实验");
    expect(highPath.find((activity) => activity.id === "high-generative-ai-rag-assessment")?.title)
      .toBe("引用匹配与工具权限评价");
    expect(highPath.map((activity) => activity.id)).toEqual(expect.arrayContaining([
      "high-image-model-audit-project", "high-capstone-project", "high-capstone-defense",
    ]));
  });

  it("returns cloned path data and no activity for an unknown ID", () => {
    const activity = getActivity("middle-neural-signals-lesson");
    expect(activity).toBeDefined();
    activity!.title = "外部修改";

    expect(getActivity("middle-neural-signals-lesson")!.title).not.toBe("外部修改");
    expect(getActivity("unknown-activity")).toBeUndefined();
  });

  it("rejects duplicate IDs, unknown references, cycles, and cross-stage prerequisites", () => {
    const duplicate = structuredClone(LEARNING_ACTIVITIES);
    duplicate[1]!.id = duplicate[0]!.id;
    expect(() => validateLearningActivities(duplicate)).toThrow("Duplicate learning activity ID");

    const unknownCourse = structuredClone(LEARNING_ACTIVITIES);
    unknownCourse[0]!.courseId = "missing-course";
    expect(() => validateLearningActivities(unknownCourse)).toThrow("Unknown course ID");

    const unknownTemplate = structuredClone(LEARNING_ACTIVITIES);
    const guidedLab = unknownTemplate.find((activity) => activity.id === "middle-neural-signals-guided-lab")!;
    guidedLab.labTemplateId = "missing-template" as never;
    expect(() => validateLearningActivities(unknownTemplate)).toThrow("Unknown lab template ID");

    const unknownPrerequisite = structuredClone(LEARNING_ACTIVITIES);
    unknownPrerequisite[0]!.prerequisites = ["missing-activity"];
    expect(() => validateLearningActivities(unknownPrerequisite)).toThrow("Unknown prerequisite activity ID");

    const cyclic = structuredClone(LEARNING_ACTIVITIES);
    cyclic.find((activity) => activity.id === "middle-neural-signals-lesson")!.prerequisites = ["middle-data-bias-assessment"];
    expect(() => validateLearningActivities(cyclic)).toThrow("Cycle detected");

    const crossStage = structuredClone(LEARNING_ACTIVITIES);
    crossStage.find((activity) => activity.id === "high-bubble-analysis-review")!.prerequisites = ["middle-data-bias-assessment"];
    expect(() => validateLearningActivities(crossStage)).toThrow("Cross-stage prerequisite");

    const secondMiddleEntry = structuredClone(LEARNING_ACTIVITIES);
    secondMiddleEntry.push({
      ...secondMiddleEntry[0]!,
      id: "another-middle-entry",
      prerequisites: [],
    });
    expect(() => validateLearningActivities(secondMiddleEntry)).toThrow("Expected one entry activity for middle_school");
  });
});
