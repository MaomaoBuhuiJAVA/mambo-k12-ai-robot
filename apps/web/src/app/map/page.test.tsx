import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LearningMapPage from "./page";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

describe("Learning map route", () => {
  it("publishes a standalone interactive map page", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/map/page.tsx"))).toBe(true);
  });

  it("renders five independent focusable hotspots with matching visual layers", () => {
    render(<LearningMapPage />);

    expect(screen.getByRole("img", { name: "小学学习地图" })).toHaveAttribute("src", "/assets/learning-map/starbao-learning-islands.png");
    expect(screen.getAllByTestId("map-hotspot")).toHaveLength(5);
    expect(screen.getAllByTestId("map-hotspot").every((hotspot) => hotspot.tagName.toLowerCase() === "path")).toBe(true);
    expect(screen.getAllByTestId(/map-region-glow-/)).toHaveLength(5);
    expect(screen.getAllByTestId(/map-region-zoom-/)).toHaveLength(5);
    expect(screen.getByLabelText("森林热点")).toBeInTheDocument();
    expect(screen.getByLabelText("城堡热点")).toBeInTheDocument();
    expect(screen.getByLabelText("科技岛热点")).toBeInTheDocument();
    expect(screen.getByLabelText("沙漠热点")).toBeInTheDocument();
    expect(screen.getByLabelText("火山热点")).toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("only activates the matching region glow and zoom layer when a region is hovered", () => {
    render(<LearningMapPage />);

    const forest = screen.getByLabelText("森林热点");
    const castle = screen.getByLabelText("城堡热点");
    const forestGlow = screen.getByTestId("map-region-glow-forest");
    const forestZoom = screen.getByTestId("map-region-zoom-forest");
    const castleGlow = screen.getByTestId("map-region-glow-castle");
    const castleZoom = screen.getByTestId("map-region-zoom-castle");

    fireEvent.pointerEnter(forest);

    expect(forest).toHaveAttribute("data-active", "true");
    expect(castle).not.toHaveAttribute("data-active", "true");
    expect(forestGlow).toHaveAttribute("data-active", "true");
    expect(forestZoom).toHaveAttribute("data-active", "true");
    expect(castleGlow).not.toHaveAttribute("data-active", "true");
    expect(castleZoom).not.toHaveAttribute("data-active", "true");
  });

  it("keeps the technology island and desert as independent hover targets", () => {
    render(<LearningMapPage />);

    expect(screen.getAllByTestId("map-hotspot")).toHaveLength(5);

    const technology = screen.getByLabelText("科技岛热点");
    const desert = screen.getByLabelText("沙漠热点");

    fireEvent.pointerEnter(technology);

    expect(technology).toHaveAttribute("data-active", "true");
    expect(desert).not.toHaveAttribute("data-active", "true");
  });

  it("activates a region from its direct click target", () => {
    render(<LearningMapPage />);

    const technology = screen.getByLabelText("科技岛热点");
    const technologyGlow = screen.getByTestId("map-region-glow-technology");

    fireEvent.click(technology);

    expect(technology).toHaveAttribute("data-active", "true");
    expect(technologyGlow).toHaveAttribute("data-active", "true");
  });

  it("raises three learning cards over a dimmed map with an expanded gold particle burst", () => {
    render(<LearningMapPage />);

    fireEvent.click(screen.getByLabelText("科技岛热点"));

    expect(screen.getByRole("region", { name: "科技岛学习卡片" })).toBeInTheDocument();
    expect(screen.getByTestId("card-deck-backdrop")).toBeInTheDocument();
    expect(screen.getAllByTestId("learning-card")).toHaveLength(3);
    expect(screen.getAllByTestId("gold-particle")).toHaveLength(48);
    expect(screen.getAllByTestId("learning-card").every((card) => (
      card.querySelectorAll('[data-testid="gold-particle"]').length === 16
    ))).toBe(true);
  });

  it("dismisses the card deck when the dimmed backdrop is clicked", () => {
    render(<LearningMapPage />);

    const technology = document.querySelector('[data-testid="map-hotspot"][data-region="technology"]');
    const technologyGlow = screen.getByTestId("map-region-glow-technology");
    expect(technology).not.toBeNull();
    fireEvent.click(technology!);

    fireEvent.click(screen.getByRole("button", { name: "关闭学习卡片" }));

    expect(screen.queryByTestId("card-deck-backdrop")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("learning-card")).toHaveLength(0);
    expect(technologyGlow).not.toHaveAttribute("data-active", "true");
  });
});
