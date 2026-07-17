import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";
import { loadLearningState } from "@/lib/learning-store";
import { LearningWorkspace } from "./learning-workspace";

const lowerCourse = getCourseById("lower-bubble-sort")!;

describe("LearningWorkspace", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("filters courses by stage and selects that stage's featured course", async () => {
    const user = userEvent.setup();

    render(<LearningWorkspace />);

    expect(
      screen.getByRole("heading", { name: "冒泡排序", level: 1 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "初中" }));

    const courseList = screen.getByRole("list", { name: "初中课程" });
    expect(within(courseList).getByText("图像分类与神经网络")).toBeVisible();
    expect(within(courseList).getByText("数据偏差侦探社")).toBeVisible();
    expect(within(courseList).queryByText("冒泡排序")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "图像分类与神经网络",
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("updates the classroom and teaching canvas when a course is selected", async () => {
    const user = userEvent.setup();

    render(<LearningWorkspace />);

    await user.click(
      screen.getByRole("button", { name: /图片标签小侦探/ }),
    );

    expect(
      screen.getByRole("heading", { name: "图片标签小侦探", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("说出图片中能看见的两个特征")).toBeVisible();
    expect(screen.getByText("先看再命名")).toBeVisible();
    expect(screen.getByText("校园物品图片卡")).toBeVisible();
  });

  it("submits a learner message and appends a deterministic reply", async () => {
    const user = userEvent.setup();

    render(<LearningWorkspace />);

    const input = screen.getByRole("textbox", { name: "给 Mambo 发消息" });
    await user.type(input, "为什么要比较相邻数字？");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    expect(screen.getByText("为什么要比较相邻数字？")).toBeVisible();
    expect(screen.getByText(/我们继续围绕“冒泡排序”/)).toBeVisible();
    expect(input).toHaveValue("");
  });

  it("switches the teaching canvas tab", async () => {
    const user = userEvent.setup();

    render(<LearningWorkspace />);

    await user.click(screen.getByRole("tab", { name: "练习" }));

    expect(screen.getByRole("tab", { name: "练习" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText("比较 4 和 2 时，为了从小到大排列应该怎样做？"),
    ).toBeVisible();
    const choice = lowerCourse.exercises[0];
    if (choice.type !== "single_choice") throw new Error("expected choice");
    await user.click(screen.getByLabelText(choice.answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    expect(loadLearningState().attempts).toHaveLength(1);
  });

  it("reaches the real animation, storybook, and material download tools", async () => {
    const user = userEvent.setup();
    render(<LearningWorkspace />);

    await user.click(screen.getByRole("tab", { name: "动画" }));
    expect(screen.getByRole("region", { name: "冒泡排序交互动画" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "绘本" }));
    expect(screen.getByRole("region", { name: /绘本阅读器/ })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "资源" }));
    expect(screen.getByRole("button", { name: "下载 Word 讲义" })).toBeVisible();
  });
});
