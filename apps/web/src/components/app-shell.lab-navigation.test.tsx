import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./app-shell";

describe("AppShell lab navigation", () => {
  it("returns to the public homepage from the brand", () => {
    render(<AppShell><div>workspace</div></AppShell>);

    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/preview");
  });

  it("opens the real Python laboratory page", () => {
    render(<AppShell><div>workspace</div></AppShell>);

    expect(screen.getByRole("link", { name: /编程实验/ })).toHaveAttribute("href", "/lab");
  });

  it("opens the course path inside the dedicated workspace route", () => {
    render(<AppShell><div>workspace</div></AppShell>);

    expect(screen.getByRole("link", { name: "课程" })).toHaveAttribute(
      "href",
      "/workspace?view=path#course-rail",
    );
  });

  it("opens today's learning workspace without relying on the homepage route", () => {
    render(<AppShell><div>workspace</div></AppShell>);

    expect(screen.getByRole("link", { name: "今日学习" })).toHaveAttribute(
      "href",
      "/workspace#workspace",
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
