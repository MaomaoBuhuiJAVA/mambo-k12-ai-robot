import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./app-shell";

describe("AppShell progress navigation", () => {
  it("opens the real progress page", () => {
    render(<AppShell><div>workspace</div></AppShell>);
    expect(screen.getByRole("link", { name: /学习进度/ })).toHaveAttribute("href", "/progress");
  });
});
