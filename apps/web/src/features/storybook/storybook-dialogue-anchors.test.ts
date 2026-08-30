import { describe, expect, it } from "vitest";

import { IMPORTED_STORYBOOKS } from "@/data/storybooks";

import {
  STORYBOOK_DIALOGUE_PLACEMENTS,
  resolveDialoguePlacement,
} from "./storybook-dialogue-anchors";

describe("storybook dialogue anchors", () => {
  it("defines an explicit position and tail target for every imported dialogue cue", () => {
    for (const storybook of IMPORTED_STORYBOOKS) {
      for (const page of storybook.pages) {
        for (const dialogue of page.dialogue) {
          const placement = STORYBOOK_DIALOGUE_PLACEMENTS[storybook.id]?.[dialogue.id];
          expect(placement, `${storybook.id}/${dialogue.id}`).toBeDefined();
          expect(placement?.left).toBeGreaterThanOrEqual(0);
          expect((placement?.left ?? 100) + (placement?.width ?? 100)).toBeLessThanOrEqual(100);
          expect(placement?.top).toBeGreaterThanOrEqual(0);
          expect(placement?.tailOffset).toBeGreaterThanOrEqual(0);
          expect(placement?.tailOffset).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("keeps the two speakers apart on the lava cave photo-request page", () => {
    const page = IMPORTED_STORYBOOKS.find((storybook) => storybook.id === "lava-lesson-01")?.pages[4];
    expect(page).toBeDefined();
    const [aiSprite, starbao] = page!.dialogue;
    expect(resolveDialoguePlacement("lava-lesson-01", aiSprite!)).toMatchObject({ left: 5, top: 48, tailSide: "right" });
    expect(resolveDialoguePlacement("lava-lesson-01", starbao!)).toMatchObject({ left: 51, top: 26, tailSide: "bottom" });
  });
});
