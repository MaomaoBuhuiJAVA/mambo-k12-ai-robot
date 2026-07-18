import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";
import { loadLearningState } from "@/lib/learning-store";

import { TeachingCanvas } from "./teaching-canvas";

const course = getCourseById("lower-bubble-sort")!;

describe("TeachingCanvas", () => {
  beforeEach(() => localStorage.clear());

  it("opens the requested content tab from a deep link", async () => {
    render(<TeachingCanvas course={course} initialTab="storybook" initialStorybookId="missing" />);

    expect(screen.getByRole("tab", { name: "绘本" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: /绘本阅读器/ })).toBeVisible();
  });

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

  it("shows source-backed facts in the course view", () => {
    render(<TeachingCanvas course={course} />);

    expect(screen.getByRole("heading", { name: "事实依据" })).toBeVisible();
    const fact = screen.getByText(/相邻元素/).closest("li");
    expect(fact).not.toBeNull();
    expect(within(fact!).getByText("[1]")).toBeVisible();
    expect(screen.getByRole("link", { name: /NIST/ })).toHaveAttribute(
      "href",
      "https://www.nist.gov/dads/HTML/bubblesort.html",
    );
  });

  it("renders the real quiz player and persists a submitted answer", async () => {
    const user = userEvent.setup();
    const choice = course.exercises[0];
    if (choice.type !== "single_choice") throw new Error("expected choice");
    render(<TeachingCanvas course={course} />);

    await user.click(screen.getByRole("tab", { name: "练习" }));
    await user.click(screen.getByLabelText(choice.answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));

    expect(screen.getByRole("status")).toHaveTextContent(choice.feedback.correct);
    await waitFor(() => expect(loadLearningState().attempts).toHaveLength(1));
  });
});
