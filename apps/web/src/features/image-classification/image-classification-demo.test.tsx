import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ImageClassificationDemo } from "./image-classification-demo";

describe("ImageClassificationDemo", () => {
  it("shows the fixed input, features, scores, and current prediction at every step", async () => {
    const user = userEvent.setup();
    render(<ImageClassificationDemo />);

    expect(screen.getByText("失物招领图片：蓝色随行杯")).toBeVisible();
    expect(screen.getByRole("heading", { name: "特征表" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "类别分数" })).toBeVisible();
    expect(screen.getByRole("region", { name: "当前预测" })).toHaveTextContent("等待特征");
    expect(screen.getByText("水杯").closest("div")).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: "单步" }));

    expect(screen.getByRole("region", { name: "当前预测" })).toHaveTextContent("水杯");
    expect(screen.getByText("瓶盖线索").closest("div")).toHaveTextContent("检测到清晰的杯盖");
  });

  it("can step through, reset, change speed, and replay the fixed result", async () => {
    const user = userEvent.setup();
    render(<ImageClassificationDemo />);
    const step = screen.getByRole("button", { name: "单步" });

    await user.click(step);
    await user.click(step);
    await user.click(step);
    await user.click(step);

    expect(screen.getByRole("region", { name: "当前预测" })).toHaveTextContent("水杯，领先分数占比 100%");
    expect(step).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "2x" }));
    expect(screen.getByRole("button", { name: "2x" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "重置" }));
    expect(screen.getByText("第 1 步：读取图片输入")).toBeVisible();
    expect(screen.getByRole("button", { name: "播放" })).toBeVisible();
  });
});
