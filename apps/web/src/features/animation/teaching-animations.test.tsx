import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BubbleSortAnimation } from "./bubble-sort-animation";
import { NeuralNetworkAnimation } from "./neural-network-animation";

describe("interactive teaching animations", () => {
  it("lets a learner step and reset bubble sort", async () => {
    const user = userEvent.setup();
    render(<BubbleSortAnimation />);

    expect(screen.getByText("比较第 1 和第 2 个数字")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "单步" }));
    expect(screen.getByText(/本次比较：4 和 1，交换/)).toBeVisible();

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
});
