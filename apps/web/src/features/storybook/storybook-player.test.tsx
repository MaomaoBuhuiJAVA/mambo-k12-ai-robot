import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getCourseById } from "@/data/curriculum";

import { StorybookPlayer } from "./storybook-player";
import { createSeedStorybook } from "./storybook";

const course = getCourseById("lower-bubble-sort")!;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("StorybookPlayer", () => {
  it("turns pages and gives explicit answer feedback", async () => {
    const user = userEvent.setup();
    render(<StorybookPlayer course={course} />);

    expect(screen.getByText("第 1 / 4 页")).toBeVisible();
    const firstScene = screen.getByRole("img", { name: /数字泡泡相邻排队/ });
    const firstSource = firstScene.getAttribute("src");
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByText("第 2 / 4 页")).toBeVisible();
    expect(screen.getByRole("img", { name: /神经网络示意场景/ }).getAttribute("src")).not.toBe(firstSource);

    const answer = screen.getAllByRole("button", { name: /答案：/ })[0];
    await user.click(answer);
    expect(screen.getByRole("status")).toHaveTextContent(/正确|再想一想/);
  });

  it("saves, restores, reads aloud, and can regenerate", async () => {
    const user = userEvent.setup();
    const speak = vi.fn();
    const cancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak, cancel } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      source: "seed",
      storybook: {
        title: "新绘本",
        summary: "重新生成的版本",
        pages: course.storybook.map((page) => ({
          title: page.title,
          narration: page.narration,
          scene: page.scene,
          interactiveQuestion: {
            prompt: page.interaction,
            options: ["先观察", "随便猜"],
            answer: "先观察",
            correctFeedback: "正确。",
            incorrectFeedback: "再观察一次。",
          },
        })),
      },
    }), { headers: { "content-type": "application/json" } }));

    const { unmount } = render(<StorybookPlayer course={course} />);
    await user.click(screen.getByRole("button", { name: "朗读本页" }));
    expect(speak).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "保存绘本" }));
    expect(localStorage.getItem("mambo.storybooks.v1")).toContain(course.id);
    unmount();

    render(<StorybookPlayer course={course} />);
    expect(screen.getByText("已保存 1 个版本")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重新生成" }));
    expect(await screen.findByText("新绘本")).toBeVisible();
  });

  it("preserves saved storybooks that belong to other courses", async () => {
    const user = userEvent.setup();
    const otherCourse = getCourseById("upper-loop-maze");
    if (!otherCourse) throw new Error("other fixture course missing");
    localStorage.setItem("mambo.storybooks.v1", JSON.stringify([{
      id: "other-version",
      courseId: otherCourse.id,
      savedAt: "2026-07-17T08:00:00.000Z",
      storybook: createSeedStorybook(otherCourse),
    }]));

    render(<StorybookPlayer course={course} />);
    await user.click(screen.getByRole("button", { name: "保存绘本" }));

    const stored = JSON.parse(localStorage.getItem("mambo.storybooks.v1") ?? "[]") as Array<{ courseId: string }>;
    expect(stored.map((item) => item.courseId)).toEqual(expect.arrayContaining([course.id, otherCourse.id]));
  });
});
