import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BubbleSortAnimation } from "./bubble-sort-animation";
import { NeuralNetworkAnimation } from "./neural-network-animation";

describe("interactive teaching animations", () => {
  afterEach(() => vi.useRealTimers());
  it("lets a learner step and reset bubble sort", async () => {
    const user = userEvent.setup();
    render(<BubbleSortAnimation />);

    expect(screen.getByText("比较第 1 和第 2 个数字")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "单步" }));
    expect(screen.getByText(/本次比较：4 和 1，交换/)).toBeVisible();
    expect(screen.getAllByLabelText(/正在比较/)).toHaveLength(2);
    expect(screen.getByLabelText(/位置 1，数字 1，正在比较/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "重置" }));
    expect(screen.getByText("比较第 1 和第 2 个数字")).toBeVisible();
  });

  it("exposes accessible controls and layer-by-layer neural-network progress", async () => {
    const user = userEvent.setup();
    render(<NeuralNetworkAnimation />);

    expect(screen.getByRole("group", { name: "神经网络动画控制" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "单步" }));
    expect(screen.getAllByText("第 1 层：输入像素")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "2 倍速" }));
    expect(screen.getByRole("button", { name: "2 倍速" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("returns the play control to its resting state after automatic completion", async () => {
    vi.useFakeTimers();
    render(<NeuralNetworkAnimation />);

    fireEvent.click(screen.getByRole("button", { name: "播放" }));
    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(screen.getByRole("button", { name: "播放" })).toBeVisible();
    expect(screen.getByText("预测完成：最像一只猫")).toBeVisible();
  });

  it("adapts bubble-sort explanations for young learners and high school", () => {
    const lower = render(<BubbleSortAnimation stage="lower_primary" />);
    expect(screen.getByText(/相邻的两个数字泡泡/)).toBeVisible();
    lower.unmount();

    render(<BubbleSortAnimation stage="high_school" />);
    expect(screen.getByText(/时间复杂度/)).toBeVisible();
    expect(screen.getAllByText(/边界/).length).toBeGreaterThan(0);
  });

  it("uses rigorous feature and probability language for high-school neural networks", () => {
    const lower = render(<NeuralNetworkAnimation stage="lower_primary" />);
    expect(screen.getAllByText(/明暗小格子/).length).toBeGreaterThan(0);
    lower.unmount();

    render(<NeuralNetworkAnimation stage="high_school" />);
    expect(screen.getAllByText(/特征向量/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/类别概率/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/小帮手|投票/)).not.toBeInTheDocument();
  });

  it("finishes a full bubble-sort playback without showing a phantom round", () => {
    vi.useFakeTimers();
    render(<BubbleSortAnimation stage="middle_school" />);

    fireEvent.click(screen.getByRole("button", { name: "播放" }));
    act(() => vi.advanceTimersByTime(8_000));

    expect(screen.getAllByLabelText(/^位置 .*，已就位$/)).toHaveLength(4);
    expect(screen.getAllByText("排序完成")).toHaveLength(2);
    expect(screen.getByLabelText("已就位数量")).toHaveTextContent("4");
    expect(screen.queryByText("第 4 轮")).not.toBeInTheDocument();
  });

  it("groups the speed choices with an accessible name", () => {
    render(<BubbleSortAnimation />);
    expect(screen.getByRole("group", { name: "播放速度" })).toBeVisible();
  });
});
