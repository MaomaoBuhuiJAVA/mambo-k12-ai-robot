import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProgressPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ProgressPage", () => {
  beforeEach(() => window.localStorage.clear());

  it("opens the unified learner profile for an accepted middle-school stage query", async () => {
    render(await ProgressPage({
      searchParams: Promise.resolve({ stage: "middle_school" }),
    }));

    expect(await screen.findByRole("heading", { name: "个人画像" })).toBeVisible();
    expect(screen.getByRole("button", { name: "年级 · 初一" })).toBeVisible();
  });

  it("redirects the unscoped legacy entry to the unified learner profile", async () => {
    await expect(ProgressPage({
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?view=profile");
  });

  it("redirects an arbitrary stage value instead of rendering an unscoped dashboard", async () => {
    await expect(ProgressPage({
      searchParams: Promise.resolve({ stage: "untrusted" }),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?view=profile");
  });
});
