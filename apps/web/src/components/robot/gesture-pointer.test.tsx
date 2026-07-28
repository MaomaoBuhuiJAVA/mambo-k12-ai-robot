import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import styles from "./robot.module.css";
import { GesturePointer } from "./gesture-pointer";

const robotStylesheet = readFileSync(resolve(process.cwd(), "src/components/robot/robot.module.css"), "utf8");

describe("GesturePointer", () => {
  it("renders nothing when there is no tracked cursor", () => {
    const { container } = render(<GesturePointer cursor={null} progress={0.5} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("places the pointer in a fixed full-screen overlay using normalized coordinates", () => {
    render(<GesturePointer cursor={{ x: 0.25, y: 0.75 }} progress={0.25} />);

    expect(screen.getByTestId("gesture-pointer-overlay")).toHaveClass(styles.gesturePointerOverlay);
    expect(screen.getByRole("progressbar")).toHaveStyle({ left: "25%", top: "75%" });
  });

  it("exposes normalized confirmation progress as a percentage", () => {
    render(<GesturePointer cursor={{ x: 0.5, y: 0.5 }} progress={0.42} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemin", "0");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
  });

  it("marks the pointer complete when confirmation reaches one", () => {
    render(<GesturePointer cursor={{ x: 0.5, y: 0.5 }} progress={1} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("data-complete", "true");
  });

  it("exposes a distinct scroll mode for V-sign page navigation", () => {
    render(<GesturePointer cursor={{ x: 0.5, y: 0.5 }} progress={0} mode="scroll" />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("data-mode", "scroll");
  });

  it("shows an arrow matching the active scroll direction", () => {
    const { rerender } = render(<GesturePointer cursor={{ x: 0.5, y: 0.5 }} progress={0} mode="scroll_up" />);

    expect(screen.getByRole("img", { name: "向上滚动" })).toHaveAttribute("data-testid", "gesture-pointer-scroll-arrow");

    rerender(<GesturePointer cursor={{ x: 0.5, y: 0.5 }} progress={0} mode="scroll_down" />);
    expect(screen.getByRole("img", { name: "向下滚动" })).toHaveAttribute("data-testid", "gesture-pointer-scroll-arrow");
  });

  it("keeps a completed confirmation green even when the pointer was previously in scroll mode", () => {
    render(<GesturePointer cursor={{ x: 0.5, y: 0.5 }} progress={1} mode="scroll" />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("data-complete", "true");
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-mode", "scroll");
    expect(robotStylesheet).toContain('.gesturePointer[data-mode="scroll"][data-complete="true"] .gesturePointerRingProgress');
    expect(robotStylesheet).toContain('.gesturePointer[data-mode="scroll"][data-complete="true"] .gesturePointerDot');
  });

  it("defines normal pointer colors with fallbacks outside the robot page", () => {
    expect(robotStylesheet).toContain("stroke: var(--robot-gold, #f4c758);");
    expect(robotStylesheet).toContain("border: 3px solid var(--robot-parchment, #f7f2d7);");
    expect(robotStylesheet).toContain("box-shadow: 0 0 0 2px var(--robot-ink, #17203c), 2px 2px 0 var(--robot-shadow, #101a33);");
    expect(robotStylesheet).toContain("background: var(--robot-gold, #f4c758);");
    expect(robotStylesheet).toContain("stroke: #2dd4bf;");
    expect(robotStylesheet).toContain("stroke: #68d391;");
  });
});
