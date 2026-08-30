import { describe, expect, it } from "vitest";

import type { Stage } from "../lib/domain";
import {
  CURRICULUM,
  getCourseById,
  getCoursesForStage,
  getFeaturedCourses,
} from "./curriculum";

const stages = [
  "lower_primary",
  "upper_primary",
  "middle_school",
  "high_school",
] as const satisfies readonly Stage[];

describe("curriculum", () => {
  it("provides at least two courses for every K-12 stage", () => {
    for (const stage of stages) {
      expect(getCoursesForStage(stage).length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(CURRICULUM.map((course) => course.stage))).toEqual(
      new Set(stages),
    );
  });

  it("uses unique course IDs", () => {
    expect(new Set(CURRICULUM.map((course) => course.id)).size).toBe(
      CURRICULUM.length,
    );
  });

  it("includes every required exercise type and a four-to-eight-page storybook", () => {
    for (const course of CURRICULUM) {
      expect(new Set(course.exercises.map((exercise) => exercise.type))).toEqual(
        new Set([
          "single_choice",
          "multi_select",
          "order",
          "code_trace",
          "code_fill",
          ...(course.id === "middle-ai-foundations" || course.id === "middle-data-and-algorithms" || course.id === "middle-python-basics" || course.id === "middle-data-bias" || course.id === "middle-generative-ai" || course.id === "middle-ai-safety" || course.id === "high-multimodal-ai" || course.id === "high-generative-ai-rag"
            ? ["result_interpretation"]
            : []),
          ...(course.exercises.some((exercise) => exercise.type === "classification")
            ? ["classification"]
            : []),
        ]),
      );
      for (const exercise of course.exercises) {
        expect(exercise.answer).toBeDefined();
        expect(exercise.feedback.correct).toBeTruthy();
        expect(exercise.feedback.incorrect).toBeTruthy();
        expect(exercise.knowledgePointTags.length).toBeGreaterThan(0);

        if (exercise.type === "single_choice") {
          expect(exercise.options).toContain(exercise.answer);
        }
        if (exercise.type === "order") {
          expect(exercise.items).toEqual(exercise.answer);
        }
        if (exercise.type === "code_trace") {
          expect(exercise.code).toBeTruthy();
          expect(typeof exercise.answer).toBe("string");
        }
        if (exercise.type === "code_fill") {
          expect(exercise.code).toBeTruthy();
          expect(typeof exercise.answer).toBe("string");
        }
        if (exercise.type === "multi_select") {
          expect(exercise.answers.length).toBeGreaterThan(0);
          expect(exercise.answers.every((answer) => exercise.options.includes(answer))).toBe(true);
        }
        if (exercise.type === "classification") {
          expect(exercise.labels).toContain(exercise.answer);
          expect(exercise.trainingSamples.length).toBeGreaterThanOrEqual(2);
          expect(exercise.trainingSamples.every((sample) => exercise.labels.includes(sample.label))).toBe(true);
          expect(exercise.testSample.features.length).toBeGreaterThan(0);
          expect(exercise.classificationEvidence).toBeTruthy();
        }
      }
      expect(course.storybook.length).toBeGreaterThanOrEqual(4);
      expect(course.storybook.length).toBeLessThanOrEqual(8);
      for (const page of course.storybook) {
        expect(page).toMatchObject({
          title: expect.any(String),
          narration: expect.any(String),
          scene: expect.any(String),
          interaction: expect.any(String),
        });
      }
    }
  });

  it("keeps tags, animation references, and scoped IDs internally consistent", () => {
    for (const course of CURRICULUM) {
      const courseTags = new Set(course.knowledgePointTags);
      const entityIds = new Set(course.animation.entities.map((entity) => entity.id));

      expect(course.knowledgePointTags.every(Boolean)).toBe(true);
      expect(new Set(course.exercises.map((exercise) => exercise.id)).size).toBe(
        course.exercises.length,
      );
      expect(new Set(course.animation.steps.map((step) => step.id)).size).toBe(
        course.animation.steps.length,
      );

      for (const exercise of course.exercises) {
        expect(exercise.knowledgePointTags.every(Boolean)).toBe(true);
        expect(
          exercise.knowledgePointTags.every((tag) => courseTags.has(tag)),
        ).toBe(true);
      }
      for (const step of course.animation.steps) {
        expect(step.activeEntityIds.every((id) => entityIds.has(id))).toBe(true);
      }
    }
  });

  it("fully defines the bubble-sort and image-classification neural-network anchors", () => {
    const anchors = CURRICULUM.filter((course) =>
      ["冒泡排序", "图像分类与神经网络"].includes(course.title),
    );

    expect(anchors).toHaveLength(2);
    for (const course of anchors) {
      expect(course).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        summary: expect.any(String),
        stage: expect.any(String),
        knowledgePointTags: expect.any(Array),
        objectives: expect.any(Array),
        ageAdaptation: expect.any(Object),
        explanation: expect.any(Object),
        materials: expect.any(Array),
        starterCode: expect.any(String),
      });
      expect(course.animation.template).toBeTruthy();
      expect(course.animation.entities.length).toBeGreaterThan(0);
      expect(course.animation.steps.length).toBeGreaterThan(0);
      expect(course.animation.controls).toEqual(
        expect.arrayContaining(["play", "pause", "step", "reset", "speed"]),
      );
    }
  });

  it("defines an approachable middle-school AI foundations course before neural-network study", () => {
    const foundations = getCourseById("middle-ai-foundations");

    expect(foundations).toMatchObject({
      id: "middle-ai-foundations",
      stage: "middle_school",
      featured: true,
      title: expect.stringContaining("人工智能基础"),
    });
    expect(getCoursesForStage("middle_school")[0]?.id).toBe("middle-ai-foundations");
    expect(foundations?.knowledgePointTags).toEqual(expect.arrayContaining([
      "规则程序与机器学习",
      "数据样本",
      "特征与标签",
      "模型预测与误差",
    ]));
    expect(foundations?.objectives.join(" ")).toMatch(/规则|机器学习/);
    expect(foundations?.explanation.overview).toMatch(/预测.*不等于事实/);
    expect(foundations?.explanation.workedExample).toMatch(/水杯|书本/);
    expect(foundations?.materials).toHaveLength(4);
    expect(foundations?.animation.template).toBe("rule-and-data-classification");
    expect(foundations?.exercises).toHaveLength(7);
    expect(foundations?.starterCode).not.toMatch(/神经网络/);
  });

  it("keeps the high-school catalog in the H-01 through H-08 teaching order", () => {
    expect(getCoursesForStage("high_school").map((course) => course.id)).toEqual([
      "high-python-data-lab",
      "high-bubble-analysis",
      "high-ml-pipeline",
      "high-classification-regression",
      "high-neural-network-training",
      "high-multimodal-ai",
      "high-generative-ai-rag",
      "high-image-model-audit",
    ]);
  });

  it("defines H-04 as a versioned boundary-metric and error-cost experiment", () => {
    const metrics = getCourseById("high-classification-regression")!;

    expect(metrics.summary).toContain("混淆矩阵");
    expect(metrics.objectives.join(" ")).toContain("零分母");
    expect(metrics.explanation.workedExample).toContain("2.75");
    expect(metrics.materials.map((material) => material.name)).toEqual(expect.arrayContaining(["零分母边界样本", "实验版本记录表"]));
    expect(metrics.exercises.find((exercise) => exercise.type === "order")?.items).toContain("联系漏检/误报代价解释并记录版本");
  });

  it("provides deterministic training-sample classification in middle and high school", () => {
    const middle = getCourseById("middle-ai-foundations")?.exercises.find((exercise) => exercise.type === "classification");
    const high = getCourseById("high-classification-regression")?.exercises.find((exercise) => exercise.type === "classification");

    expect(middle).toMatchObject({ type: "classification", answer: "水杯" });
    expect(high).toMatchObject({ type: "classification", answer: "高风险" });
    if (middle?.type === "classification") {
      expect(middle.trainingSamples.map((sample) => sample.label)).toEqual(["水杯", "书本", "水杯"]);
      expect(middle.testSample.features).toEqual(expect.arrayContaining(["有旋盖", "细长圆柱形"]));
    }
  });

  it("defines H-05 as a reproducible multi-round training-curve experiment", () => {
    const training = getCourseById("high-neural-network-training")!;

    expect(training.summary).toContain("多轮");
    expect(training.objectives.join(" ")).toContain("参数集版本");
    expect(training.explanation.workedExample).toContain("weights-init-v1");
    expect(training.materials.map((material) => material.name)).toEqual(expect.arrayContaining([
      "样本数与步数记录",
      "学习率对照实验",
    ]));
    expect(training.exercises.find((exercise) => exercise.type === "order")?.items)
      .toContain("根据回升规则判断过拟合并记录版本");
  });

  it("defines H-06 as a versioned four-modality experiment with retained boundaries", () => {
    const multimodal = getCourseById("high-multimodal-ai")!;

    expect(multimodal.summary).toContain("固定数据集和输入版本");
    expect(multimodal.knowledgePointTags).toEqual(expect.arrayContaining(["多模态输入", "失败样本", "数据授权"]));
    expect(multimodal.objectives.join(" ")).toContain("vision-inputs-v2");
    expect(multimodal.explanation.workedExample).toContain("structured:s2");
    expect(multimodal.materials.map((material) => material.name)).toEqual(expect.arrayContaining([
      "固定数据集（multimodal-samples-v2）",
      "输入版本（vision-inputs-v2）",
      "source_id 与授权记录",
      "隐私边界与适用范围清单",
    ]));
    expect(multimodal.exercises.find((exercise) => exercise.type === "order")?.items)
      .toContain("排除未授权/不可用输入但保留边界记录");
  });

  it("defines H-07 as a versioned no-retrieval/retrieval comparison with failure evidence", () => {
    const rag = getCourseById("high-generative-ai-rag")!;

    expect(rag.summary).toContain("fixed-kb-v2");
    expect(rag.summary).toContain("rag-query-v2");
    expect(rag.knowledgePointTags).toEqual(expect.arrayContaining(["引用与权限", "幻觉核对"]));
    expect(rag.objectives.join(" ")).toContain("unsupported_claims");
    expect(rag.explanation.workedExample).toContain("needs_review");
    expect(rag.materials.map((material) => material.name)).toEqual(expect.arrayContaining([
      "固定知识库（fixed-kb-v2）",
      "查询版本（rag-query-v2）",
      "失败回答与改进策略",
      "工具权限边界与阻断记录",
    ]));
    expect(rag.exercises.find((exercise) => exercise.type === "order")?.items)
      .toContain("核对 matched/unmatched 引用与 unsupported_claims");
  });

  it("configures first-chapter choice, ordering, and result-interpretation evidence", () => {
    const foundations = getCourseById("middle-ai-foundations")!;
    const dataBias = getCourseById("middle-data-bias")!;

    expect(foundations.exercises.map((exercise) => exercise.type)).toEqual(expect.arrayContaining([
      "single_choice",
      "order",
      "result_interpretation",
    ]));
    expect(dataBias.exercises.find((exercise) => exercise.type === "result_interpretation"))
      .toMatchObject({ id: "middle-data-bias-result", answer: expect.stringContaining("逆光") });
  });

  it("defines the middle-school model-evaluation course with a held-out evaluation workflow", () => {
    const evaluation = getCourseById("middle-model-evaluation");

    expect(evaluation).toMatchObject({
      stage: "middle_school",
      title: expect.stringContaining("模型评价"),
      knowledgePointTags: ["训练集与测试集", "准确率与错误率", "混淆矩阵"],
    });
    expect(evaluation?.explanation.overview).toMatch(/训练样本.*测试样本/);
    expect(evaluation?.explanation.workedExample).toMatch(/2\/4/);
    expect(evaluation?.exercises).toHaveLength(5);
  });

  it("defines middle-school data and algorithms with deterministic sorting practice", () => {
    const algorithms = getCourseById("middle-data-and-algorithms");

    expect(algorithms).toMatchObject({
      stage: "middle_school",
      title: expect.stringContaining("数据与算法"),
      knowledgePointTags: ["数据表示", "表格与字段", "算法步骤", "排序与复杂度直觉"],
    });
    expect(algorithms?.explanation.overview).toMatch(/字段.*列表/);
    expect(algorithms?.starterCode).toMatch(/bubble_sort/);
    expect(algorithms?.exercises.map((exercise) => exercise.type)).toEqual(expect.arrayContaining([
      "single_choice", "order", "code_trace", "result_interpretation",
    ]));
  });

  it("defines the missing Python and generative-AI middle-school courses as constrained practice", () => {
    const python = getCourseById("middle-python-basics");
    const generative = getCourseById("middle-generative-ai");

    expect(python).toMatchObject({
      stage: "middle_school",
      knowledgePointTags: ["Python 变量与类型", "条件判断", "循环与列表", "函数与测试"],
    });
    expect(python?.starterCode).toMatch(/choose_ready_tools/);
    expect(python?.exercises.map((exercise) => exercise.type)).toEqual(expect.arrayContaining([
      "single_choice", "order", "code_trace", "result_interpretation",
    ]));

    expect(generative).toMatchObject({
      stage: "middle_school",
      knowledgePointTags: ["分类与生成", "提示目标与上下文", "输出约束", "事实核对与引用"],
    });
    expect(generative?.explanation.overview).toMatch(/生成式 AI/);
    expect(generative?.exercises.find((exercise) => exercise.type === "result_interpretation"))
      .toMatchObject({ answer: expect.stringContaining("逐项检查") });
  });

  it("defines AI safety as evidence-based action rather than a slogan exercise", () => {
    const safety = getCourseById("middle-ai-safety")!;
    expect(safety.knowledgePointTags).toEqual(expect.arrayContaining(["隐私保护", "数据授权", "预测需要核对", "模型责任边界"]));
    expect(safety.explanation.overview).toMatch(/授权.*核对/);
    expect(safety.exercises.find((exercise) => exercise.type === "result_interpretation"))
      .toMatchObject({ answer: expect.stringContaining("教师核对") });
  });

  it("changes explanation depth and learning activity across stages", () => {
    const representatives = stages.map((stage) => getCoursesForStage(stage)[0]);

    expect(
      new Set(representatives.map((course) => course.ageAdaptation.depth)).size,
    ).toBe(stages.length);
    expect(
      new Set(representatives.map((course) => course.ageAdaptation.activity)).size,
    ).toBe(stages.length);
  });

  it("exposes deterministic lookup and featured-course helpers", () => {
    const first = CURRICULUM[0];
    expect(getCourseById(first.id)).toEqual(first);
    expect(getCourseById("missing-course")).toBeUndefined();
    expect(getFeaturedCourses()).toEqual(
      CURRICULUM.filter((course) => course.featured),
    );
    expect(getFeaturedCourses("middle_school")).toEqual(
      CURRICULUM.filter(
        (course) => course.featured && course.stage === "middle_school",
      ),
    );
  });

  it("does not let callers mutate the curriculum through lookup results", () => {
    const courseId = CURRICULUM[0].id;
    const original = structuredClone(getCourseById(courseId));
    const byId = getCourseById(courseId);
    const byStage = getCoursesForStage(CURRICULUM[0].stage);
    const featured = getFeaturedCourses();

    expect(original).toBeDefined();
    expect(byId).toBeDefined();
    byId!.title = "被污染的标题";
    byId!.knowledgePointTags.push("外部标签");
    byStage[0].storybook[0].title = "被污染的绘本页";
    featured[0].animation.steps[0].narration = "被污染的动画步骤";

    expect(getCourseById(courseId)).toEqual(original);
    expect(getCoursesForStage(CURRICULUM[0].stage)[0]).toEqual(original);
    expect(getFeaturedCourses()[0]).toEqual(original);
  });
});
