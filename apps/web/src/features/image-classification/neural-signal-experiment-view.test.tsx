import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { NeuralSignalExperiment } from "./neural-signal-experiment-view";

describe("NeuralSignalExperiment", () => {
  it("exposes pixels, weighted connections, category scores, and a prediction caveat", () => {
    render(<NeuralSignalExperiment />);

    expect(screen.getByRole("heading", { name: "像素如何穿过加权连接变成类别分数" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "1. 像素输入" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "2. 加权连接" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "3. 类别分数" })).toBeVisible();
    expect(screen.getByRole("status", { name: "当前分类预测" })).toHaveTextContent("最高分预测铅笔");
    expect(screen.getByRole("status", { name: "当前分类预测" })).toHaveTextContent("需要用真实标签或新证据核对");
  });

  it("updates the deterministic class score after an accessible pixel preset", async () => {
    const user = userEvent.setup();
    render(<NeuralSignalExperiment />);

    await user.click(screen.getByRole("button", { name: "页面封面预设" }));
    expect(screen.getByRole("status", { name: "当前分类预测" })).toHaveTextContent("最高分预测书本");
    expect(screen.getByRole("slider", { name: "书页条纹像素强度" })).toHaveValue("0.9");
  });
});
