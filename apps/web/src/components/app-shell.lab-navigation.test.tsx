import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./app-shell";

describe("AppShell lab navigation", () => {
  it("opens the real Python laboratory page", () => {
    render(<AppShell><div>workspace</div></AppShell>);

    expect(screen.getByRole("link", { name: /编程实验/ })).toHaveAttribute("href", "/lab");
  });
});
