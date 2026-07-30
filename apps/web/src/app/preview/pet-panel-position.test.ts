import { describe, expect, it } from "vitest";

import { resolvePetPanelLeft, resolvePetPanelPosition } from "./pet-panel-position";

describe("resolvePetPanelLeft", () => {
  it("keeps a right-edge panel moving with the dragged pet", () => {
    expect(resolvePetPanelLeft({
      petX: 1206,
      petWidth: 96,
      panelWidth: 360,
      viewportWidth: 1440,
      offsetX: -261,
    })).toBe(945);
  });

  it("opens the panel above the mobile hero pet without covering it", () => {
    const position = resolvePetPanelPosition({
      petX: 20,
      petY: 246,
      petWidth: 82,
      petHeight: 90,
      panelWidth: 398,
      panelHeight: 382,
      viewportWidth: 428,
      viewportHeight: 578,
    });

    expect(position).toMatchObject({ left: 15, top: 15, height: 219, placement: "above" });
    expect(position.top + position.height).toBeLessThanOrEqual(246 - 12);
  });

  it("uses a side placement when it keeps the full chat panel beside the hero pet", () => {
    const position = resolvePetPanelPosition({
      petX: 60,
      petY: 299,
      petWidth: 92,
      petHeight: 100,
      panelWidth: 360,
      panelHeight: 382,
      viewportWidth: 882,
      viewportHeight: 698,
    });

    expect(position).toMatchObject({ left: 164, top: 299, height: 382, placement: "right" });
    expect(position.left).toBeGreaterThanOrEqual(60 + 92 + 12);
    expect(position.left + 360).toBeLessThanOrEqual(882 - 15);
    expect(position.top + position.height).toBeLessThanOrEqual(698 - 15);
  });

  it("keeps a panel inside the viewport below a pet near the top", () => {
    const position = resolvePetPanelPosition({
      petX: 120,
      petY: 50,
      petWidth: 96,
      petHeight: 104,
      panelWidth: 360,
      panelHeight: 382,
      viewportWidth: 1440,
      viewportHeight: 900,
    });

    expect(position).toMatchObject({ placement: "below", top: 166, height: 382 });
    expect(position.left).toBeGreaterThanOrEqual(15);
    expect(position.left + 360).toBeLessThanOrEqual(1440 - 15);
    expect(position.top + position.height).toBeLessThanOrEqual(900 - 15);
  });
});