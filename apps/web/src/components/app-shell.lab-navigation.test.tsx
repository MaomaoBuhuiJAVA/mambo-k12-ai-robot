import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./app-shell";

describe("AppShell lab navigation", () => {
  it("opens the real Python laboratory page", () => {
    render(<AppShell><div>workspace</div></AppShell>);

    expect(screen.getByRole("link", { name: /编程实验/ })).toHaveAttribute("href", "/lab");
  });

  it("opens the course path instead of pointing at an already-visible anchor", () => {
    render(<AppShell><div>workspace</div></AppShell>);

    expect(screen.getByRole("link", { name: "课程" })).toHaveAttribute(
      "href",
      "/?view=path#course-rail",
    );
  });

  it("opens saved works from the progress page", () => {
    render(<AppShell><div>workspace</div></AppShell>);

    expect(screen.getByRole("link", { name: "作品" })).toHaveAttribute(
      "href",
      "/progress#works",
    );
  });
});
