import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GuidedImageClassificationFlow } from "./guided-image-classification-flow";

describe("GuidedImageClassificationFlow", () => {
  it("shows the fixed dataset, separates observation from conclusion, and locks prediction after a run", async () => {
    const user = userEvent.setup();
    const onPredictionChange = vi.fn();
    const onSaveObservation = vi.fn();
    const { rerender } = render(
      <GuidedImageClassificationFlow
        prediction="ball"
        hasPassedRun={false}
        isRunning={false}
        saved={false}
        saveNotice={null}
        onPredictionChange={onPredictionChange}
        onSaveObservation={onSaveObservation}
      />,
    );

    expect(screen.getByLabelText("固定样本集")).toHaveTextContent("image-classifier-lab-v1");
    expect(screen.getByRole("button", { name: "预测 cup" })).toBeEnabled();

    rerender(
      <GuidedImageClassificationFlow
        prediction="ball"
        hasPassedRun
        isRunning={false}
        saved={false}
        saveNotice={null}
        predictionLocked
        onPredictionChange={onPredictionChange}
        onSaveObservation={onSaveObservation}
      />,
    );

    expect(screen.getByRole("button", { name: "预测 cup" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "观察记录" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "实验结论" })).toBeVisible();

    await user.type(screen.getByRole("textbox", { name: "观察记录" }), "我观察到把手线索让杯子更容易被识别。");
    await user.type(screen.getByRole("textbox", { name: "实验结论" }), "固定检查通过 3/3，因此应保留这个指标再解释结果。");
    await user.click(screen.getByRole("button", { name: "保存实验记录" }));

    expect(onSaveObservation).toHaveBeenCalledWith({
      observation: "我观察到把手线索让杯子更容易被识别。",
      conclusion: "固定检查通过 3/3，因此应保留这个指标再解释结果。",
    });
  });
});
