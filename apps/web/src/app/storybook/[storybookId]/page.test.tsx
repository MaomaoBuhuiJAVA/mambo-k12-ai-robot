import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImportedStorybookPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

describe("ImportedStorybookPage", () => {
  it("opens the canonical castle reader by its stable content ID", async () => {
    render(await ImportedStorybookPage({ params: Promise.resolve({ storybookId: "castle-lesson-01" }) }));
    expect(screen.getByRole("region", { name: /星宝城堡 AI绘本阅读器/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
  });

  it("uses the not-found boundary for unknown storybooks", async () => {
    await expect(ImportedStorybookPage({ params: Promise.resolve({ storybookId: "missing" }) })).rejects.toThrow("NOT_FOUND");
  });
});
