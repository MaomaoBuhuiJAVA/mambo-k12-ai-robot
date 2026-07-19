import { describe, expect, it } from "vitest";

import { resolvePetPanelLeft } from "./pet-panel-position";

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
});
