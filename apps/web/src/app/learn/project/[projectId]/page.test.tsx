import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));

vi.mock("@/features/learning-hub/learning-platform-shell", () => ({
  LearningPlatformShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/projects/project-workspace", () => ({
  ProjectWorkspace: ({ projectId }: { projectId: string }) => <output>{projectId}</output>,
}));

import LearnProjectPage from "./page";

describe("LearnProjectPage", () => {
  it("opens the canonical capstone workspace", async () => {
    render(await LearnProjectPage({ params: Promise.resolve({ projectId: "capstone" }) }));
    expect(screen.getByText("capstone")).toBeVisible();
  });

  it("rejects a cross-stage project query", async () => {
    await expect(LearnProjectPage({
      params: Promise.resolve({ projectId: "capstone" }),
      searchParams: Promise.resolve({ stage: "middle_school" }),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?stage=middle_school&grade=middle_1&view=courses");
  });
});
