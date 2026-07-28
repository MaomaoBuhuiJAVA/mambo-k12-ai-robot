import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { handOverlayGeometry } from "./hand-overlay";
import type { Landmark } from "./hand-tracker";

const landmarks: Landmark[] = Array.from({ length: 21 }, (_, index) => ({ x: index / 20, y: index / 20 }));

describe("handOverlayGeometry", () => {
  it("returns 21 landmark dots and the wrist-to-finger skeleton", () => {
    const geometry = handOverlayGeometry(landmarks);

    expect(geometry.points).toHaveLength(21);
    expect(geometry.connections).toContainEqual([0, 1]);
    expect(geometry.connections).toContainEqual([0, 5]);
    expect(geometry.connections).toContainEqual([19, 20]);
  });

  it("does not draw a partial hand as a skeleton", () => {
    expect(handOverlayGeometry(landmarks.slice(0, 20))).toEqual({ points: [], connections: [] });
  });

  it("layers the canvas above the transformed camera preview", () => {
    const stylesheet = readFileSync("src/components/robot/robot.module.css", "utf-8");

    expect(stylesheet).toMatch(/\.handOverlay\s*\{[\s\S]*?z-index:\s*1;/);
  });

  it("keeps the robot controls in the 800 by 480 hardware layout", () => {
    const stylesheet = readFileSync("src/components/robot/robot.module.css", "utf-8");

    expect(stylesheet).toMatch(/@media \(max-height:\s*560px\) and \(min-width:\s*761px\)\s*\{[\s\S]*?\.contentGrid\s*\{[^}]*grid-template-columns:[^;]*minmax[^;]*minmax[^;]*minmax/);
    expect(stylesheet).toMatch(/@media \(max-height:\s*560px\) and \(min-width:\s*761px\)\s*\{[\s\S]*?\.controlRail\s*\{[^}]*grid-column:\s*auto;/);
  });

  it("keeps the display commands reachable beside hand controls on the 800 by 480 screen", () => {
    const stylesheet = readFileSync("src/components/robot/robot.module.css", "utf-8");

    expect(stylesheet).toMatch(/@media \(max-height:\s*560px\) and \(min-width:\s*761px\)\s*\{[\s\S]*?\.compactDeviceActions\s*\{[^}]*display:\s*grid;/);
    expect(stylesheet).toMatch(/@media \(max-height:\s*560px\) and \(min-width:\s*761px\)\s*\{[\s\S]*?\.deviceCard\s*\{[^}]*display:\s*block;/);
  });
});
