import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/learning-hub/learning-platform-shell", () => ({
  LearningPlatformShell: ({ children }: { children: ReactNode }) => <div data-testid="learning-shell">{children}</div>,
}));

vi.mock("@/features/learning-hub/course-detail", () => ({
  CourseDetail: ({ course }: { course: { course: { id: string } } }) => <output>{course.course.id}</output>,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));

import CourseDetailPage from "./page";

describe("CourseDetailPage", () => {
  it("validates and passes a configured course to the detail screen", async () => {
    render(await CourseDetailPage({ params: Promise.resolve({ courseId: "middle-ai-foundations" }) }));

    expect(screen.getByText("middle-ai-foundations")).toBeVisible();
  });

  it("rejects a cross-stage course query before rendering", async () => {
    await expect(CourseDetailPage({
      params: Promise.resolve({ courseId: "middle-ai-foundations" }),
      searchParams: Promise.resolve({ stage: "high_school" }),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?stage=high_school&view=path");
  });
});
