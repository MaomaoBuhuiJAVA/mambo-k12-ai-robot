import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/learning-hub/learning-platform-shell", () => ({
  LearningPlatformShell: ({ children }: { children: ReactNode }) => <div data-testid="learning-shell">{children}</div>,
}));

vi.mock("@/features/learning-hub/practice-session", () => ({
  PracticeSession: ({ initialPracticeSet, practiceSetId, stage, remediationActivityId }: { initialPracticeSet: { id: string }; practiceSetId: string; stage: string; remediationActivityId?: string }) => (
    <output>{`${stage}:${practiceSetId}:${initialPracticeSet.id}:${remediationActivityId ?? "none"}`}</output>
  ),
}));

import PracticePage from "./page";

describe("PracticePage", () => {
  it("validates the stage-scoped practice set before opening a session", async () => {
    render(await PracticePage({
      params: Promise.resolve({ practiceSetId: "daily-middle_school" }),
      searchParams: Promise.resolve({ stage: "middle_school" }),
    }));

    expect(screen.getByText("middle_school:daily-middle_school:daily-middle_school:none")).toBeVisible();
  });

  it("passes a validated course remediation activity into the session", async () => {
    render(await PracticePage({
      params: Promise.resolve({ practiceSetId: "course--high-generative-ai-rag" }),
      searchParams: Promise.resolve({ stage: "high_school", remediation: "high-generative-ai-rag-remediation" }),
    }));

    expect(screen.getByText("high_school:course--high-generative-ai-rag:course--high-generative-ai-rag:high-generative-ai-rag-remediation")).toBeVisible();
  });
});
