import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DataBiasMetricsComparison } from "./data-bias-metrics-view";

describe("DataBiasMetricsComparison", () => {
  it("shows why the overall baseline can hide a weak subgroup", () => {
    render(<DataBiasMetricsComparison />);

    expect(screen.getByRole("heading", { name: "总体分数不错，也要看谁被模型持续认错" })).toBeVisible();
    expect(screen.getByText("总体准确率").parentElement).toHaveTextContent("65%");
    expect(screen.getByText("逆光组（需优先检查）")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("总体是 65%，但逆光组只有 4/10");
  });

  it("re-evaluates the same fixed groups after targeted resampling", async () => {
    const user = userEvent.setup();
    render(<DataBiasMetricsComparison />);

    await user.click(screen.getByRole("button", { name: "补充逆光样本后" }));
    expect(screen.getByText("总体准确率").parentElement).toHaveTextContent("80%");
    expect(screen.getByRole("status")).toHaveTextContent("逆光组升至 7/10");
    expect(screen.getByText("室内明亮组").parentElement).toHaveTextContent("9/10");
  });
});
