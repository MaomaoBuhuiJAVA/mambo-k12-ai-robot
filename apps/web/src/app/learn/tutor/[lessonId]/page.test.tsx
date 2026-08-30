import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));

vi.mock("@/features/learning-hub/learning-platform-shell", () => ({
  LearningPlatformShell: ({ children }: { children: ReactNode }) => <div data-testid="learning-shell">{children}</div>,
}));

vi.mock("@/features/ai-tutor/tutor-theater", () => ({
  TutorTheater: ({ lesson }: { lesson: { id: string } }) => <output>{lesson.id}</output>,
}));

import TutorPage from "./page";

describe("TutorPage", () => {
  it("decodes a configured lesson before opening the tutor theater", async () => {
    render(await TutorPage({
      params: Promise.resolve({ lessonId: "middle-ai-foundations%3Aconcepts%3Arules-and-models" }),
    }));

    expect(screen.getByText("middle-ai-foundations:concepts:rules-and-models")).toBeVisible();
  });

  it("redirects an unconfigured lesson ID to a safe learning path", async () => {
    await expect(TutorPage({ params: Promise.resolve({ lessonId: "missing" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/learn?stage=middle_school&grade=middle_1&view=courses");
  });

  it("rejects an explicit cross-stage tutor query", async () => {
    await expect(TutorPage({
      params: Promise.resolve({ lessonId: "middle-ai-foundations%3Aconcepts%3Arules-and-models" }),
      searchParams: Promise.resolve({ stage: "high_school" }),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?stage=high_school&view=path");
  });
});
