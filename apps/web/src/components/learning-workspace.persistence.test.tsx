import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadLearningState } from "@/lib/learning-store";
import { LearningWorkspace } from "./learning-workspace";

describe("LearningWorkspace persisted navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("你好", { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens a whitelisted course from the progress recommendation query", async () => {
    render(<LearningWorkspace requestedCourseId="high-image-model-audit" />);
    expect(await screen.findByRole("heading", { name: "图像分类系统审计", level: 1 })).toBeVisible();
    expect(screen.getByRole("button", { name: "高中" })).toHaveAttribute("aria-pressed", "true");
    expect(loadLearningState()).toMatchObject({ profile: { stage: "high_school" }, lastCourseId: "high-image-model-audit" });
  });

  it("ignores an unknown course query", async () => {
    render(<LearningWorkspace requestedCourseId="javascript:alert(1)" />);
    expect(await screen.findByRole("heading", { name: "冒泡排序", level: 1 })).toBeVisible();
  });

  it("persists the selected stage and its featured course", async () => {
    const user = userEvent.setup();
    render(<LearningWorkspace />);
    await user.click(screen.getByRole("button", { name: "初中" }));

    await waitFor(() => {
      const state = loadLearningState();
      expect(state.profile.stage).toBe("middle_school");
      expect(state.lastCourseId).toBe("middle-neural-signals");
    });
  });
});
