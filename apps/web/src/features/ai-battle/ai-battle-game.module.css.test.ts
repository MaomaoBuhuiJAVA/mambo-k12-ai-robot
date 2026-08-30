import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/features/ai-battle/ai-battle-game.module.css"), "utf8");

function rule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`\\.${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  expect(match, `Missing .${selector} rule`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("AI battle story dialogue layout", () => {
  it("keeps desktop speaker artwork larger and roughly half outside the dialogue panel", () => {
    expect(rule("storyPortrait")).toContain("left: clamp(-165px, -12vw, -124px)");
    expect(rule("storyPortrait")).toContain("width: clamp(304px, 32vw, 382px)");
    expect(rule("storyPortrait")).toContain("height: clamp(294px, 33vw, 348px)");
    expect(rule("storyPortrait[data-speaker=\"starbao\"]")).toContain("width: clamp(300px, 30vw, 352px)");
    expect(rule("storyContent")).toContain("margin-left: clamp(140px, 15vw, 210px)");
  });

  it("places a speaking enemy on the right and reserves matching text space", () => {
    expect(rule("storyPortrait[data-speaker=\"enemy\"]")).toContain("right: clamp(-165px, -12vw, -124px)");
    expect(rule("storyPanel[data-speaker=\"enemy\"] .storyContent")).toContain("margin-right: clamp(140px, 15vw, 210px)");
    expect(rule("storyPanel[data-speaker=\"enemy\"] .storyResultIcon")).toContain("left: 30px");
  });

  it("shows Starbao's high-resolution open-eyed idle still without a sprite-sheet crop", () => {
    const storyShipImage = rule("storyStarbaoShip img");

    expect(storyShipImage).toContain("top: 0");
    expect(storyShipImage).toContain("width: 100%");
    expect(storyShipImage).toContain("height: 100%");
    expect(storyShipImage).toContain("object-fit: contain");
    expect(storyShipImage).toContain("image-rendering: auto");
    expect(storyShipImage).not.toContain("width: 800%");
    expect(storyShipImage).not.toContain("height: 400%");
  });
});
