import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LearningMapPage from "./page";

const mapStylesSource = readFileSync(resolve(process.cwd(), "src/app/map/page.module.css"), "utf8");
const notifyMapReady = vi.fn();
const startHomeTransition = vi.fn(() => true);

vi.mock("@/components/cloud-transition/cloud-transition-provider", () => ({
  useCloudTransition: () => ({ notifyMapReady, startHomeTransition, isTransitioning: false }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, fill: _fill, sizes: _sizes, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; sizes?: string }) => <img alt={alt} {...props} />,
}));

describe("Learning map route", () => {
  beforeEach(() => {
    notifyMapReady.mockReset();
  });

  it("publishes a standalone interactive map page", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/map/page.tsx"))).toBe(true);
  });

  it("starts the cloud transition when returning to the preview home page", () => {
    render(<LearningMapPage />);

    fireEvent.click(screen.getByRole("button", { name: "返回首页" }));

    expect(startHomeTransition).toHaveBeenCalledTimes(1);
  });

  it("keeps the full map visible over a dedicated ocean backdrop", () => {
    expect(mapStylesSource).toContain(".oceanBackdrop");
    expect(mapStylesSource).toContain("background-image:");
    expect(mapStylesSource).toContain("object-fit: contain;");
  });

  it("keeps the hotspot coordinate system inside the same aspect-ratio canvas as the artwork", () => {
    render(<LearningMapPage />);

    const artwork = screen.getByRole("img", { name: "小学学习地图" });
    const canvas = screen.getByTestId("map-canvas");
    const hotspotOverlay = screen.getByLabelText("学习地图热点区域");

    expect(canvas).toContainElement(artwork);
    expect(canvas).toContainElement(hotspotOverlay);
    expect(canvas).toHaveAttribute("data-map-aspect", "1536/1024");
  });

  it("reports readiness after the full map artwork has loaded", () => {
    render(<LearningMapPage />);

    fireEvent.load(screen.getByRole("img", { name: "小学学习地图" }));

    expect(notifyMapReady).toHaveBeenCalledTimes(1);
  });

  it("uses the supplied widescreen ocean backdrop without changing hotspot geometry", () => {
    expect(existsSync(resolve(process.cwd(), "public/assets/learning-map/starbao-learning-ocean-backdrop.png"))).toBe(true);
    expect(mapStylesSource).toContain("starbao-learning-ocean-backdrop.png");
    expect(mapStylesSource).toContain("@media (max-aspect-ratio: 3 / 2)");
  });

  it("renders five independent focusable hotspots with matching visual layers", () => {
    render(<LearningMapPage />);

    expect(screen.queryByRole("heading", { name: "小学学习地图" })).not.toBeInTheDocument();
    expect(mapStylesSource).toContain("width: 100vw;");
    expect(mapStylesSource).toContain("height: 100dvh;");
    expect(mapStylesSource).toContain("object-fit: contain;");
    expect(existsSync(resolve(process.cwd(), "public/assets/learning-map/starbao-learning-islands-transparent-water.png"))).toBe(true);
    expect(screen.getByRole("img", { name: "小学学习地图" })).toHaveAttribute("src", "/assets/learning-map/starbao-learning-islands-transparent-water.png");
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

  it("uses complete transparent region assets for zoom layers instead of clipping the full map", () => {
    render(<LearningMapPage />);

    const zoomLayers = screen.getAllByTestId(/map-region-zoom-/);
    const castleZoom = screen.getByTestId("map-region-zoom-castle");

    expect(zoomLayers.every((layer) => layer.tagName.toLowerCase() === "image")).toBe(true);
    expect(castleZoom).toHaveAttribute("href", "/assets/learning-map/primary-regions/castle-zoom.png");
    expect(castleZoom).not.toHaveAttribute("clip-path");
    expect(document.querySelectorAll('use[href="#learning-map-artwork-source"]')).toHaveLength(0);
    expect(mapStylesSource).toContain("transform-box: fill-box;");
    expect(mapStylesSource).toContain("transform-origin: center;");
  });

  it("keeps the castle's complete cloud silhouette visible before hover", () => {
    render(<LearningMapPage />);

    const castleBase = screen.getByTestId("map-region-base-castle");

    expect(castleBase.tagName.toLowerCase()).toBe("image");
    expect(castleBase).toHaveAttribute("href", "/assets/learning-map/primary-regions/castle-zoom.png");
    expect(screen.getAllByTestId(/map-region-base-/)).toHaveLength(1);
    expect(mapStylesSource).toContain(".regionBase");
  });

  it("keeps focused hotspot artwork at map scale so it stays aligned with the background", () => {
    expect(mapStylesSource).toContain(`.regionZoom[data-active="true"] {
  opacity: 1;
  transform: scale(1);
}`);
    expect(mapStylesSource).not.toContain("transform: scale(1.04);");
    expect(mapStylesSource).not.toContain("transform: scale(1.014);");
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
