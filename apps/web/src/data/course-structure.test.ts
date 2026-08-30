import { describe, expect, it } from "vitest";

import { getCoursesForStage } from "./curriculum";
import { getLearningPath } from "./learning-paths";
import {
  getCourseLessonForActivity,
  getPlannedCourseOutlines,
  getStructuredCourse,
  getStructuredCoursesForGrade,
  getStructuredCoursesForStage,
  validateCourseStructures,
} from "./course-structure";
import { LEARNING_GRADES } from "./learning-grades";

describe("course structure", () => {
  it("keeps the existing course ID while exposing units, lessons, and configured activities", () => {
    const course = getStructuredCourse("middle-neural-signals");

    expect(course).toMatchObject({
      course: { id: "middle-neural-signals", stage: "middle_school" },
      stage: "middle_school",
    });
    expect(course?.units.map((unit) => unit.title)).toEqual([
      "图像如何变成类别分数",
      "图像分类实验",
    ]);
    expect(course?.units.flatMap((unit) => unit.lessons).flatMap((lesson) => lesson.activityIds))
      .toEqual(getLearningPath("middle_school")
        .filter((activity) => activity.courseId === "middle-neural-signals")
        .map((activity) => activity.id));
  });

  it("turns the data-and-algorithms outline into an active two-part middle-school course", () => {
    const course = getStructuredCourse("middle-data-and-algorithms");

    expect(course?.units.map((unit) => unit.title)).toEqual([
      "把记录变成可执行步骤",
      "用代码验证排序",
    ]);
    expect(course?.units.flatMap((unit) => unit.lessons).flatMap((lesson) => lesson.activityIds))
      .toEqual([
        "middle-data-and-algorithms-lesson",
        "middle-data-and-algorithms-demonstration",
        "middle-data-and-algorithms-lab",
        "middle-data-and-algorithms-assessment",
    ]);
  });

  it("exposes H-04 boundary metrics and version evidence in its lesson outline", () => {
    const course = getStructuredCourse("high-classification-regression");

    expect(course?.units[0]).toMatchObject({
      title: "问题类型、边界指标与错误代价",
      summary: expect.stringContaining("零分母"),
    });
    expect(course?.units[0]?.lessons.map((lesson) => lesson.title)).toEqual([
      "分类、回归与边界指标选择",
      "计算指标、核对边界并解释错误代价",
    ]);
  });

  it("exposes H-05 multi-round curves and reproducibility evidence in its lesson outline", () => {
    const course = getStructuredCourse("high-neural-network-training");

    expect(course?.units[0]).toMatchObject({
      title: "多轮训练、参数版本与泛化",
      summary: expect.stringContaining("参数集版本"),
    });
    expect(course?.units[0]?.lessons.map((lesson) => lesson.title)).toEqual([
      "梯度下降、多轮曲线与过拟合",
      "用版本化曲线检查训练与泛化",
    ]);
  });

  it("exposes H-06 four-modality versions and retained boundary evidence", () => {
    const course = getStructuredCourse("high-multimodal-ai");

    expect(course?.units[0]).toMatchObject({
      title: "输入模态与证据",
      summary: expect.stringContaining("multimodal-samples-v2"),
    });
    expect(course?.units[0]?.lessons.map((lesson) => lesson.title)).toEqual([
      "同一问题的不同输入",
      "版本化对照、失败样本与输入来源",
    ]);
    expect(course?.units[0]?.lessons[1]?.summary).toContain("授权排除");
  });

  it("exposes H-07 fixed retrieval versions, failed claims and tool permissions", () => {
    const course = getStructuredCourse("high-generative-ai-rag");

    expect(course?.units[0]).toMatchObject({
      title: "检索、生成与引用",
      summary: expect.stringContaining("fixed-kb-v2"),
    });
    expect(course?.units[0]?.lessons.map((lesson) => lesson.title)).toEqual([
      "上下文与检索增强",
      "版本化引用、失败回答与工具权限",
    ]);
    expect(course?.units[0]?.lessons[1]?.summary).toContain("unsupported_claims");
  });

  it("breaks the high-school audit and capstone into evidence-led chapters", () => {
    const course = getStructuredCourse("high-image-model-audit");

    expect(course?.units.flatMap((unit) => unit.lessons).map((lesson) => lesson.title)).toEqual([
      "读懂模型卡",
      "保留失败样本与限制",
      "用证据说明审计结论",
      "综合项目工作台",
      "用证据准备项目答辩",
    ]);
    expect(course?.units.flatMap((unit) => unit.lessons).flatMap((lesson) => lesson.activityIds))
      .toEqual([
        "high-image-model-audit-review",
        "high-image-model-audit-project",
        "high-image-model-audit-defense",
        "high-capstone-project",
        "high-capstone-defense",
      ]);
    expect(getCourseLessonForActivity("high-capstone-defense")).toMatchObject({
      courseId: "high-image-model-audit",
      title: "用证据准备项目答辩",
    });
  });

  it("maps every configured middle/high activity to exactly one lesson", () => {
    const lessons = (["middle_school", "high_school"] as const)
      .flatMap(getStructuredCoursesForStage)
      .flatMap((course) => course.units)
      .flatMap((unit) => unit.lessons);
    const mappedActivityIds = lessons.flatMap((lesson) => lesson.activityIds);
    const configuredActivityIds = (["middle_school", "high_school"] as const)
      .flatMap(getLearningPath)
      .map((activity) => activity.id);

    expect(mappedActivityIds).toEqual(expect.arrayContaining(configuredActivityIds));
    expect(new Set(mappedActivityIds).size).toBe(configuredActivityIds.length);
    expect(getCourseLessonForActivity("high-capstone-defense")).toMatchObject({
      courseId: "high-image-model-audit",
      title: "用证据准备项目答辩",
    });
  });

  it("gives every active course a concept lesson and a practice or evidence lesson", () => {
    for (const stage of ["middle_school", "high_school"] as const) {
      for (const course of getStructuredCoursesForStage(stage)) {
        const lessons = course.units.flatMap((unit) => unit.lessons);
        expect(lessons.length, course.course.id).toBeGreaterThanOrEqual(2);
        expect(lessons.flatMap((lesson) => lesson.activityIds).length, course.course.id).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("preserves the established curriculum ordering for catalog consumers", () => {
    for (const stage of ["middle_school", "high_school"] as const) {
      expect(getStructuredCoursesForStage(stage).map((item) => item.course.id))
        .toEqual(getCoursesForStage(stage).map((course) => course.id));
    }
  });

  it("returns fully structured, stage-safe courses for every selected grade", () => {
    for (const grade of LEARNING_GRADES) {
      const courses = getStructuredCoursesForGrade(grade.id);

      expect(courses.map((course) => course.course.id), grade.id).toEqual(grade.courseIds);
      for (const course of courses) {
        const lessons = course.units.flatMap((unit) => unit.lessons);
        expect(course.stage, course.course.id).toBe(grade.stage);
        expect(lessons.length, course.course.id).toBeGreaterThanOrEqual(2);
        expect(lessons.flatMap((lesson) => lesson.activityIds).length, course.course.id)
          .toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps planned courses separate from the active curriculum while validating their lesson schema", () => {
    const planned = getPlannedCourseOutlines();

    expect(planned).toEqual([]);

    expect(() => validateCourseStructures(
      getStructuredCoursesForStage("middle_school").slice(1),
      planned,
    )).toThrow("coverage");
  });
});
