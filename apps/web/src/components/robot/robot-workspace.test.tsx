import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { RobotWorkspace } from "./robot-workspace";

describe("RobotWorkspace", () => {
  it("renders the robot classroom controls in the first viewport", () => {
    render(<RobotWorkspace />);

    expect(screen.getByRole("heading", { name: "Mambo 机器人课堂" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始说话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开启手势" })).toBeInTheDocument();
    expect(screen.getByText("张手移动 · 握拳确认")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "输入问题" })).toBeInTheDocument();
  });
});
