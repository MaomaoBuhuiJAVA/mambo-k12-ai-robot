import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CASTLE_LESSON_01, LAVA_LESSON_01 } from "@/data/storybooks";
import { readImportedStorybookProgress } from "./imported-storybook-progress";

import {
  DIALOGUE_CHARACTER_INTERVAL_MS,
  ImportedStorybookPlayer,
} from "./imported-storybook-player";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ImportedStorybookPlayer", () => {
  it("places the narration and streamed character dialogue over the original storybook page", async () => {
    vi.useFakeTimers();
    render(<ImportedStorybookPlayer storybook={CASTLE_LESSON_01} />);

    const image = screen.getByRole("img", { name: /浮岛城堡前/ });
    expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain("/assets/storybooks/castle-lesson-01/page-01.jpeg");
    expect(screen.getByLabelText("本页旁白")).toHaveTextContent("神秘的图案城堡");
    const firstBubble = screen.getByText("星宝").closest("article");
    expect(firstBubble).toHaveAttribute("data-speaker", "starbao");
    expect(firstBubble).not.toHaveTextContent("|");
    const pictureNavigation = screen.getByRole("navigation", { name: "绘本翻页" });
    expect(pictureNavigation.parentElement).toContainElement(image);
    expect(screen.getByRole("link", { name: "退出绘本" })).toHaveAttribute("href", "/map");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DIALOGUE_CHARACTER_INTERVAL_MS * 10);
    });
    expect(firstBubble).toHaveTextContent("哇");

    for (let index = 0; index < 8; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    }
    expect(screen.getByText("AI 小精灵").closest("article")).toHaveAttribute("data-speaker", "ai_sprite");
  });

  it("shows the supplied interaction only on pages that define one", async () => {
    const user = userEvent.setup();
    render(<ImportedStorybookPlayer storybook={CASTLE_LESSON_01} />);

    expect(screen.queryByLabelText("互动小问答")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(screen.getByLabelText("本页旁白")).toHaveTextContent("第一步：先看颜色");
    await user.click(screen.getByRole("button", { name: "答案：先看颜色" }));
    expect(screen.getByRole("status")).toHaveTextContent("回答正确");
  });

  it("restores the last page after the reader is reopened", async () => {
    const user = userEvent.setup();
    const first = render(<ImportedStorybookPlayer storybook={CASTLE_LESSON_01} />);
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    first.unmount();

    render(<ImportedStorybookPlayer storybook={CASTLE_LESSON_01} />);
    await waitFor(() => {
      expect(screen.getByLabelText("本页旁白")).toHaveTextContent("推开城堡大门");
    });
  });

  it("supports keyboard activation for page navigation", async () => {
    const user = userEvent.setup();
    render(<ImportedStorybookPlayer storybook={CASTLE_LESSON_01} />);

    const next = screen.getByRole("button", { name: "下一页" });
    next.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("本页旁白")).toHaveTextContent("布满花纹的大门");
  });

  it("keeps the closing narration cue in the image-bottom translucent panel", async () => {
    vi.useFakeTimers();
    render(<ImportedStorybookPlayer storybook={CASTLE_LESSON_01} />);

    for (let index = 0; index < 9; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    }
    expect(screen.getByLabelText("本页旁白")).toHaveTextContent("城门上的图案忽然亮起了温暖的金光");

    // Each character schedules its next update after React commits, so advance
    // one tick at a time until the narrator has started.
    for (let tick = 0; tick < 250; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DIALOGUE_CHARACTER_INTERVAL_MS);
      });
      if (screen.getByLabelText("本页旁白").textContent?.includes("按顺序观察、只相信事实、用统一标准对比")) break;
    }

    const narration = screen.getByLabelText("本页旁白");
    expect(narration).toHaveTextContent("旁白");
    expect(narration).toHaveTextContent("按顺序观察、只相信事实、用统一标准对比");
    expect(document.querySelector('[data-speaker="narrator"]')).not.toBeInTheDocument();
  });

  it("uses the page-specific bubble anchor when the characters change sides", () => {
    render(<ImportedStorybookPlayer storybook={LAVA_LESSON_01} />);

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    }
    const aiBubble = screen.getByText("AI 小精灵").closest("article");
    expect(aiBubble).toHaveAttribute("data-tail", "right");
    expect(aiBubble?.getAttribute("style")).toContain("--bubble-left: 5%");
    expect(aiBubble?.getAttribute("style")).toContain("--bubble-top: 48%");
    expect(aiBubble?.getAttribute("style")).toContain("--bubble-width: 28%");
  });

  it("records explicit completion on the last page and returns to the map", async () => {
    const user = userEvent.setup();
    render(<ImportedStorybookPlayer storybook={CASTLE_LESSON_01} />);

    for (let index = 0; index < 9; index += 1) {
      await user.click(screen.getByRole("button", { name: "下一页" }));
    }
    await user.click(screen.getByRole("button", { name: "完成本绘本" }));

    expect(screen.getByText("这本绘本已完成")).toBeVisible();
    expect(screen.getByRole("link", { name: /返回学习地图/ })).toHaveAttribute("href", "/map");
    expect(readImportedStorybookProgress(CASTLE_LESSON_01.id, 10, localStorage).completed).toBe(true);
  });
});
