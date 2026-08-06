import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AiBattlePage from "./page";

vi.mock("@/features/ai-battle/ai-battle-game", () => ({
  AiBattleGame: ({ battleModule }: { battleModule?: { id: string } }) => (
    <div data-battle-module={battleModule?.id ?? "not-provided"}>AI battle component</div>
  ),
}));

describe("AiBattlePage", () => {
  it("passes the requested battle module to the reusable game", async () => {
    render(await AiBattlePage({
      searchParams: Promise.resolve({ module: "core-lab" }),
    }));

    expect(screen.getByRole("main")).toHaveTextContent("AI battle component");
    expect(screen.getByText("AI battle component")).toHaveAttribute("data-battle-module", "core-lab");
  });

  it("uses the first castle battle when the module is not recognized", async () => {
    render(await AiBattlePage({
      searchParams: Promise.resolve({ module: "unknown-area" }),
    }));

    expect(screen.getByText("AI battle component")).toHaveAttribute("data-battle-module", "castle-1");
  });
});
