import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import WorkspacePage from "./page";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/learning-workspace", () => ({
  LearningWorkspace: (props: Record<string, unknown>) => <output data-testid="workspace-props">{JSON.stringify(props)}</output>,
}));

vi.mock("@/features/learning-hub/learning-platform-shell", () => ({
  LearningPlatformShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="learning-shell">{children}</div>
  ),
}));

vi.mock("@/features/learning-hub/lesson-workspace", () => ({
  LessonWorkspace: ({ lesson, initialActivityId }: { lesson: { id: string }; initialActivityId: string }) => (
    <output data-testid="lesson-workspace">{`${lesson.id}:${initialActivityId}`}</output>
  ),
}));

describe("WorkspacePage", () => {
  it("forwards workspace query state instead of redirecting to the homepage", async () => {
    render(await WorkspacePage({
      searchParams: Promise.resolve({
        course: "lower-bubble-sort",
        tab: "storybook",
        work: "storybook-1",
        view: "path",
      }),
    }));

    expect(screen.getByTestId("app-shell")).toBeVisible();
    expect(screen.getByTestId("workspace-props")).toHaveTextContent(JSON.stringify({
      requestedCourseId: "lower-bubble-sort",
      initialCanvasTab: "storybook",
      initialStorybookId: "storybook-1",
      initialMobileView: "path",
    }));
  });

  it("opens a middle/high course bookmark at its first lesson", async () => {
    render(await WorkspacePage({
      searchParams: Promise.resolve({ course: "middle-ai-foundations" }),
    }));

    expect(screen.getByTestId("lesson-workspace")).toHaveTextContent(
      "middle-ai-foundations:concepts:rules-and-models:middle-ai-foundations-lesson",
    );
    expect(screen.getByTestId("learning-shell")).toBeVisible();
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
  });

  it("keeps legacy animation and exercise tabs pointed at the matching activity", async () => {
    const { rerender } = render(await WorkspacePage({
      searchParams: Promise.resolve({ course: "middle-ai-foundations", tab: "animation" }),
    }));

    expect(screen.getByTestId("lesson-workspace")).toHaveTextContent(
      "middle-ai-foundations:concepts:rules-and-models:middle-ai-foundations-demonstration",
    );

    rerender(await WorkspacePage({
      searchParams: Promise.resolve({ course: "middle-ai-foundations", tab: "exercise" }),
    }));
    expect(screen.getByTestId("lesson-workspace")).toHaveTextContent(
      "middle-ai-foundations:evidence:prediction-is-not-fact:middle-ai-foundations-assessment",
    );
    expect(screen.getByTestId("learning-shell")).toBeVisible();
  });
});
