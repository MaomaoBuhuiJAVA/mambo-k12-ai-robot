import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createDefaultLearningState } from "@/lib/learning-store";
import { LearningPathTimeline } from "./learning-path-timeline";

describe("LearningPathTimeline", () => {
  it("shows the real entry task and lets learners expand a locked course", async () => {
    const user = userEvent.setup();
    render(<LearningPathTimeline stage="middle_school" state={createDefaultLearningState()} />);

    expect(screen.getByRole("link", { name: "开始" }))
      .toHaveAttribute("href", "/workspace?course=middle-ai-foundations");
    expect(screen.getByRole("button", { name: /数据与算法：让信息可以计算/ }))
      .toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("需要先完成：人工智能基础小课")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /数据与算法：让信息可以计算/ }));
    expect(screen.getByText("需要先完成：人工智能基础评价")).toBeVisible();
    expect(screen.getAllByText("已锁定").length).toBeGreaterThan(0);
  });

  it("keeps the selected grade in activity links after an external prerequisite is met", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.completedActivityIds = [
      "middle-data-and-algorithms-assessment",
    ];

    render(<LearningPathTimeline grade="middle_2" stage="middle_school" state={state} />);

    expect(screen.getByRole("link", { name: "开始" })).toHaveAttribute(
      "href",
      "/workspace?course=middle-python-basics&stage=middle_school&grade=middle_2",
    );
  });
});
