import { describe, expect, it } from "vitest";

import {
  ENEMY_ANIMATION_RANGES,
  PLAYER_ANIMATION_RANGES,
  SPRITE_SHEET_GRID,
  hasTransparentSpriteSheetPixels,
  isCheckerboardBackgroundPixel,
  isMagentaBackgroundPixel,
} from "./ai-battle-sprite-sheet";

describe("enemy sprite sheets", () => {
  it("describes the supplied 8 by 4 sprite grid", () => {
    expect(SPRITE_SHEET_GRID).toEqual({ columns: 8, rows: 4, frameWidth: 182, frameHeight: 180 });
  });

  it("keeps the resting frame static and state ranges ordered", () => {
    expect(ENEMY_ANIMATION_RANGES).toEqual({
      spawn: { start: 0, end: 23, frameRate: 12, repeat: 0 },
      defeat: { start: 0, end: 23, frameRate: 12, repeat: 0 },
      exit: { start: 24, end: 31, frameRate: 12, repeat: 0 },
    });
  });

  it("separates checkerboard background colors from gray stone sprite colors", () => {
    const checkerboard = {
      dark: [144, 144, 142],
      light: [242, 242, 238],
    } as const;

    expect(isMagentaBackgroundPixel(255, 0, 255)).toBe(true);
    expect(isMagentaBackgroundPixel(215, 105, 191)).toBe(true);
    expect(isMagentaBackgroundPixel(178, 178, 176)).toBe(false);

    expect(isCheckerboardBackgroundPixel(146, 146, 144, checkerboard.dark)).toBe(true);
    expect(isCheckerboardBackgroundPixel(244, 244, 240, checkerboard.light)).toBe(true);
    expect(isCheckerboardBackgroundPixel(178, 178, 176, checkerboard.dark)).toBe(false);
  });

  it("preserves sprites that already contain transparent PNG pixels", () => {
    expect(hasTransparentSpriteSheetPixels(new Uint8ClampedArray([
      255, 255, 255, 255,
      240, 240, 240, 127,
      0, 0, 0, 0,
    ]))).toBe(true);
    expect(hasTransparentSpriteSheetPixels(new Uint8ClampedArray([
      255, 255, 255, 255,
      240, 240, 240, 255,
    ]))).toBe(false);
  });
});

describe("Starbao battle sprite sheet", () => {
  it("defines a looping idle range after the spawn frames", () => {
    expect(PLAYER_ANIMATION_RANGES).toEqual({
      spawn: { start: 0, end: 7, frameRate: 12, repeat: 0 },
      idle: { start: 16, end: 23, frameRate: 8, repeat: -1 },
    });
  });
});
