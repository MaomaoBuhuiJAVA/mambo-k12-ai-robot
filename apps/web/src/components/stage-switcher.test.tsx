import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StageSwitcher } from "./stage-switcher";

describe("StageSwitcher", () => {
  it("reports the high-school stage when its button is selected", async () => {
    const user = userEvent.setup();
    const onStageChange = vi.fn();

    render(
      <StageSwitcher
        selectedStage="lower_primary"
        onStageChange={onStageChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "高中" }));

    expect(onStageChange).toHaveBeenCalledWith("high_school");
  });
});
