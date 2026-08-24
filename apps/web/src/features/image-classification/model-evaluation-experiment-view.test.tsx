import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ModelEvaluationExperiment } from "./model-evaluation-experiment-view";

describe("ModelEvaluationExperiment", () => {
  it("shows a source-held-out split, both rates, and a confusion matrix", () => {
    render(<ModelEvaluationExperiment />);

    expect(screen.getByRole("heading", { name: "先留出测试集，再让指标解释模型表现" })).toBeVisible();
    expect(screen.getByText("8 张固定样本")).toBeVisible();
    expect(screen.getByText("4 张固定样本")).toBeVisible();
    expect(screen.getByText("准确率").parentElement).toHaveTextContent("50%");
    expect(screen.getByText("错误率").parentElement).toHaveTextContent("50%");
    expect(screen.getByRole("table", { name: "测试集混淆矩阵" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("不代表模型在所有新图片上都同样准确");
  });

  it("recalculates the fixed metrics when the held-out batch changes", async () => {
    const user = userEvent.setup();
    render(<ModelEvaluationExperiment />);

    await user.click(screen.getByRole("button", { name: "常规室内批次" }));
    expect(screen.getByText("准确率").parentElement).toHaveTextContent("100%");
    expect(screen.getByRole("status")).toHaveTextContent("常规室内批次");
  });
});
