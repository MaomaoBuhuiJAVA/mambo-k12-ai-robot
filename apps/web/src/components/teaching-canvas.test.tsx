import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";

import { TeachingCanvas } from "./teaching-canvas";

const course = getCourseById("lower-bubble-sort")!;

describe("TeachingCanvas", () => {
  it("exposes course, animation, storybook, resources, and practice as real tabs", async () => {
    const user = userEvent.setup();
    render(<TeachingCanvas course={course} />);

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    await user.click(screen.getByRole("tab", { name: "动画" }));
    expect(screen.getByRole("region", { name: "冒泡排序交互动画" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "绘本" }));
    expect(screen.getByRole("region", { name: /绘本阅读器/ })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "资源" }));
    expect(screen.getByRole("button", { name: "下载 Word 讲义" })).toBeVisible();
    expect(screen.getByRole("button", { name: "下载 PowerPoint 课件" })).toBeVisible();
  });

  it("supports roving focus with arrows, Home, and End", async () => {
    const user = userEvent.setup();
    render(<TeachingCanvas course={course} />);
    const courseTab = screen.getByRole("tab", { name: "课程" });
    courseTab.focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "动画" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "动画" })).toHaveAttribute("tabindex", "0");
    expect(courseTab).toHaveAttribute("tabindex", "-1");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "练习" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(courseTab).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "练习" })).toHaveFocus();
  });
});
