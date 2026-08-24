import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));

import ProjectPage from "./page";

describe("legacy high project route", () => {
  it("redirects a valid project to the canonical learning workspace", async () => {
    await expect(ProjectPage({ params: Promise.resolve({ projectId: "capstone" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/learn/project/capstone");
  });

  it("uses the not-found boundary for unknown project IDs", async () => {
    await expect(ProjectPage({ params: Promise.resolve({ projectId: "unknown" }) }))
      .rejects.toThrow("NOT_FOUND");
  });

  it("rejects a cross-stage query instead of rendering the legacy project", async () => {
    await expect(ProjectPage({
      params: Promise.resolve({ projectId: "capstone" }),
      searchParams: Promise.resolve({ stage: "middle_school" }),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?stage=middle_school&grade=middle_1&view=courses");
  });
});
