import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getStructuredCourse } from "@/data/course-structure";
import { getActivity } from "@/data/learning-paths";
import { CourseDetail, activityHref } from "./course-detail";

describe("CourseDetail", () => {
  it("shows structured units and opens the first unlocked activity in the lesson workspace", () => {
    const course = getStructuredCourse("middle-ai-foundations");
    if (!course) throw new Error("Expected structured middle-school course");

    render(<CourseDetail course={course} />);

    expect(screen.getByRole("heading", { name: "人工智能基础：从规则到学习" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "从规则到学习" })).toBeVisible();
    expect(screen.getByRole("link", { name: "开始课程" })).toHaveAttribute(
      "href",
      "/learn/lesson/middle-ai-foundations:concepts:rules-and-models?activity=middle-ai-foundations-lesson",
    );
    expect(screen.getByRole("link", { name: "开启 AI 导师学习" })).toHaveAttribute(
      "href",
      "/learn/tutor/middle-ai-foundations%3Aconcepts%3Arules-and-models",
    );
    expect(screen.getByRole("link", { name: "固定操作：开始课程" })).toHaveAttribute(
      "href",
      "/learn/lesson/middle-ai-foundations:concepts:rules-and-models?activity=middle-ai-foundations-lesson",
    );
    expect(screen.getByText("可开始")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "从规则到学习 完成度 0%" })).toBeVisible();
    expect(screen.getByRole("link", { name: "继续本单元" })).toHaveAttribute(
      "href",
      "/learn/lesson/middle-ai-foundations:concepts:rules-and-models?activity=middle-ai-foundations-lesson",
    );
    expect(screen.getByRole("heading", { name: "本课资料与证据" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "已经了解了吗？" })).toBeVisible();
    expect(screen.getByText("完成前置活动后可测试")).toBeVisible();
    expect(screen.getByRole("heading", { name: /本课术语/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "失败案例与补救" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "权威参考" })).toBeVisible();
    expect(screen.getAllByText("完成前置活动后解锁").length).toBeGreaterThan(0);

    const units = screen.getAllByRole("heading", { level: 3 });
    expect(units.find((heading) => heading.textContent === "从规则到学习")?.closest("details"))
      .toHaveAttribute("open");
    expect(units.find((heading) => heading.textContent === "特征、预测与核对")?.closest("details"))
      .not.toHaveAttribute("open");
  });

  it("routes project and defense activities to their dedicated workspaces", () => {
    const auditProject = getActivity("high-image-model-audit-project");
    const auditDefense = getActivity("high-image-model-audit-defense");
    if (!auditProject || !auditDefense) throw new Error("Expected audit activities");

    expect(activityHref("ignored-lesson", auditProject)).toBe("/learn/project/model-audit");
    expect(activityHref("ignored-lesson", auditDefense)).toBe("/learn/project/model-audit");
  });
});
