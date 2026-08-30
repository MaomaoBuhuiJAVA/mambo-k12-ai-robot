import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/learning-hub/learning-platform-shell", () => ({
  LearningPlatformShell: ({ children }: { children: ReactNode }) => <div data-testid="learning-shell">{children}</div>,
}));

vi.mock("@/features/learning-hub/lesson-workspace", () => ({
  LessonWorkspace: ({ initialActivityId, lesson }: { initialActivityId?: string; lesson: { id: string } }) => (
    <output>{`${lesson.id}:${initialActivityId ?? "none"}`}</output>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));

import LessonWorkspacePage from "./page";

describe("LessonWorkspacePage", () => {
  it("passes a valid lesson and its requested activity to the workspace", async () => {
    render(await LessonWorkspacePage({
      params: Promise.resolve({ lessonId: "middle-ai-foundations%3Aconcepts%3Arules-and-models" }),
      searchParams: Promise.resolve({ activity: "middle-ai-foundations-lesson" }),
    }));

    expect(screen.getByText(
      "middle-ai-foundations:concepts:rules-and-models:middle-ai-foundations-lesson",
    )).toBeVisible();
  });

  it("rejects an explicit cross-stage lesson query", async () => {
    await expect(LessonWorkspacePage({
      params: Promise.resolve({ lessonId: "middle-ai-foundations%3Aconcepts%3Arules-and-models" }),
      searchParams: Promise.resolve({ stage: "high_school" }),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?stage=high_school&view=path");
  });
});
