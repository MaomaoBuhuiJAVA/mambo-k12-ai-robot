import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/learning-hub/learning-platform-shell", () => ({
  LearningPlatformShell: (props: Record<string, unknown>) => (
    <output data-testid="learning-platform-shell-props">{JSON.stringify(props)}</output>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

import LearnPage from "./page";

describe("LearnPage", () => {
  it("passes a supported stage and view query to the learning platform shell", async () => {
    render(await LearnPage({
      searchParams: Promise.resolve({ stage: "high_school", view: "practice" }),
    }));

    expect(screen.getByTestId("learning-platform-shell-props")).toHaveTextContent(
      JSON.stringify({ initialStage: "high_school", initialView: "practice" }),
    );
  });

  it("redirects unsupported query values to a safe learning path", async () => {
    await expect(LearnPage({
      searchParams: Promise.resolve({ stage: "untrusted", view: "unknown" }),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?stage=middle_school&grade=middle_1&view=courses");
  });
});
