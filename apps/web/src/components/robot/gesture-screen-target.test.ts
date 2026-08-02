import { describe, expect, it } from "vitest";

import { findGestureInteractiveTarget, normalizedPointToViewport } from "./gesture-screen-target";

describe("gesture-screen-target", () => {
  it("maps a normalized hand point into the full viewport", () => {
    expect(normalizedPointToViewport({ x: 0.25, y: 0.75 }, { width: 800, height: 480 })).toEqual({
      x: 200,
      y: 360,
    });
  });

  it("finds a button when the browser hit-tests one of its SVG descendants", () => {
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    button.append(icon);

    expect(findGestureInteractiveTarget(icon)).toBe(button);
  });

  it("ignores disabled HTML controls", () => {
    const button = document.createElement("button");
    button.disabled = true;

    expect(findGestureInteractiveTarget(button)).toBeNull();
  });

  it("ignores aria-disabled links and role buttons", () => {
    const link = document.createElement("a");
    link.setAttribute("aria-disabled", "true");
    const roleButton = document.createElement("div");
    roleButton.setAttribute("role", "button");
    roleButton.setAttribute("aria-disabled", "true");

    expect(findGestureInteractiveTarget(link)).toBeNull();
    expect(findGestureInteractiveTarget(roleButton)).toBeNull();
  });
});
