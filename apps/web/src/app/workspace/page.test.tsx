import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkspacePage from "./page";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/learning-workspace", () => ({
  LearningWorkspace: (props: Record<string, unknown>) => <output data-testid="workspace-props">{JSON.stringify(props)}</output>,
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
});
