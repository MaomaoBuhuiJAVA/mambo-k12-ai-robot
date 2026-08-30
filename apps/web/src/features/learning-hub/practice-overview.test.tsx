import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDefaultLearningState } from "@/lib/learning-store";
import { PracticeOverview } from "./practice-overview";

describe("PracticeOverview", () => {
  it("renders real practice categories and keeps empty remediation unavailable", () => {
    render(<PracticeOverview stage="middle_school" state={createDefaultLearningState()} />);

    expect(screen.getByRole("heading", { name: "选择一组练习开始" })).toBeVisible();
    expect(screen.getByRole("link", { name: "初一每日 5 题：开始练习" })).toHaveAttribute(
      "href",
      "/learn/practice/daily-middle_school?stage=middle_school&grade=middle_1",
    );
    expect(screen.getByText("尚未形成需要补救的错误证据。")).toBeVisible();
    expect(screen.getByText("暂不可用")).toBeVisible();
    expect(screen.getByRole("list", { name: "初一每日 5 题题型" })).toBeVisible();
    expect(screen.getByText(/5 题 · 约 15 分钟/)).toBeVisible();
  });
});
