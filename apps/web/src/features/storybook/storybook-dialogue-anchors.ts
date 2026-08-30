import type { StorybookDialogueCue } from "@/data/storybooks";

export type DialogueTailSide = "top" | "right" | "bottom" | "left";

export interface DialoguePlacement {
  left: number;
  top: number;
  width: number;
  tailSide: DialogueTailSide;
  tailOffset: number;
}

const at = (
  left: number,
  top: number,
  width: number,
  tailSide: DialogueTailSide,
  tailOffset: number,
): DialoguePlacement => ({ left, top, width, tailSide, tailOffset });

// Every cue is positioned against its fixed page artwork. Values are percentages of the image box.
export const STORYBOOK_DIALOGUE_PLACEMENTS: Record<string, Record<string, DialoguePlacement>> = {
  "castle-lesson-01": {
    "castle-01-p01-starbao": at(52, 43, 29, "left", 58),
    "castle-01-p02-starbao": at(8, 42, 29, "right", 62),
    "castle-01-p03-starbao": at(12, 42, 28, "right", 66),
    "castle-01-p04-starbao": at(8, 40, 29, "right", 62),
    "castle-01-p05-starbao": at(53, 39, 29, "left", 62),
    "castle-01-p06-starbao": at(8, 41, 29, "right", 62),
    "castle-01-p07-starbao": at(53, 39, 29, "left", 62),
    "castle-01-p08-starbao": at(8, 40, 29, "right", 62),
    "castle-01-p09-ai-sprite": at(61, 22, 28, "left", 58),
    "castle-01-p09-starbao": at(13, 43, 29, "right", 65),
    "castle-01-p10-starbao": at(14, 42, 29, "right", 65),
    "castle-01-p10-narrator": at(34, 14, 32, "bottom", 50),
  },
  "lava-lesson-01": {
    "p01-starbao-1": at(9, 43, 29, "right", 62),
    "p02-starbao-1": at(10, 43, 29, "right", 62),
    "p02-ai_sprite-2": at(67, 22, 27, "left", 58),
    "p03-ai_sprite-1": at(72, 27, 24, "left", 57),
    "p03-starbao-2": at(12, 45, 29, "right", 64),
    "p04-starbao-1": at(52, 27, 31, "bottom", 76),
    "p04-ai_sprite-2": at(5, 28, 27, "right", 58),
    "p05-ai_sprite-1": at(5, 48, 28, "right", 48),
    "p05-starbao-2": at(51, 26, 32, "bottom", 78),
    "p06-starbao-1": at(5, 41, 28, "right", 56),
    "p06-ai_sprite-2": at(52, 18, 27, "bottom", 75),
    "p07-starbao-1": at(46, 28, 31, "bottom", 79),
    "p07-ai_sprite-2": at(5, 32, 28, "right", 62),
    "p08-starbao-1": at(48, 29, 31, "bottom", 78),
    "p08-ai_sprite-2": at(5, 31, 28, "right", 62),
    "p09-starbao-1": at(9, 43, 30, "right", 64),
    "p09-ai_sprite-2": at(62, 27, 29, "left", 58),
    "p10-ai_sprite-1": at(62, 26, 29, "left", 58),
    "p10-starbao-2": at(9, 43, 30, "right", 64),
  },
  "lava-lesson-02": {
    "p01-starbao-1": at(8, 39, 30, "right", 62),
    "p02-starbao-1": at(43, 18, 31, "bottom", 28),
    "p03-starbao-1": at(8, 43, 30, "right", 64),
    "p04-starbao-1": at(8, 43, 30, "right", 64),
    "p05-system-1": at(58, 21, 31, "left", 55),
    "p05-starbao-2": at(8, 44, 30, "right", 64),
    "p06-starbao-1": at(8, 44, 30, "right", 64),
    "p07-starbao-1": at(8, 43, 31, "right", 64),
    "p08-starbao-1": at(47, 38, 31, "bottom", 72),
    "p09-starbao-1": at(7, 40, 30, "right", 61),
    "p10-starbao-1": at(7, 40, 30, "right", 61),
  },
  "lava-lesson-03": {
    "p01-starbao-1": at(37, 39, 31, "right", 64),
    "p02-starbao-1": at(30, 40, 31, "right", 64),
    "p03-starbao-1": at(29, 40, 31, "right", 64),
    "p04-starbao-1": at(12, 42, 31, "right", 64),
    "p05-starbao-1": at(10, 42, 31, "right", 64),
    "p06-starbao-1": at(30, 40, 31, "right", 64),
    "p07-starbao-1": at(31, 40, 31, "right", 64),
    "p08-starbao-1": at(10, 42, 31, "right", 64),
    "p09-starbao-1": at(10, 42, 32, "right", 64),
    "p10-starbao-1": at(10, 42, 31, "right", 64),
  },
  "desert-lesson-07": {
    "p01-starbao-1": at(9, 42, 30, "right", 64),
    "p02-starbao-1": at(8, 44, 29, "right", 64),
    "p02-guardian-2": at(64, 18, 29, "left", 56),
    "p03-starbao-1": at(39, 43, 30, "right", 65),
    "p03-guardian-2": at(6, 19, 29, "right", 56),
    "p04-starbao-1": at(8, 43, 30, "right", 64),
    "p04-starbao-2": at(8, 43, 30, "right", 64),
    "p04-guardian-2": at(64, 19, 29, "left", 56),
    "p05-starbao-1": at(40, 43, 30, "right", 65),
    "p05-guardian-2": at(6, 19, 29, "right", 56),
    "p06-starbao-1": at(40, 43, 30, "right", 65),
    "p06-guardian-2": at(6, 19, 29, "right", 56),
    "p07-starbao-1": at(40, 43, 30, "right", 65),
    "p07-guardian-2": at(6, 19, 29, "right", 56),
    "p08-starbao-1": at(39, 43, 30, "right", 65),
    "p08-guardian-2": at(6, 19, 29, "right", 56),
    "p09-starbao-1": at(9, 43, 30, "right", 64),
    "p09-guardian-2": at(64, 19, 29, "left", 56),
    "p10-starbao-1": at(38, 42, 30, "right", 64),
  },
  "desert-lesson-08": {
    "p01-starbao-1": at(9, 43, 30, "right", 64),
    "p01-guardian-2": at(64, 18, 29, "left", 56),
    "p02-starbao-1": at(9, 43, 30, "right", 64),
    "p02-guardian-2": at(64, 18, 29, "left", 56),
    "p03-starbao-1": at(40, 43, 30, "right", 65),
    "p03-guardian-2": at(6, 18, 29, "right", 56),
    "p04-starbao-1": at(9, 43, 30, "right", 64),
    "p04-guardian-2": at(64, 18, 29, "left", 56),
    "p05-starbao-1": at(40, 43, 30, "right", 65),
    "p05-guardian-2": at(6, 18, 29, "right", 56),
    "p06-starbao-1": at(40, 43, 30, "right", 65),
    "p06-guardian-2": at(6, 18, 29, "right", 56),
    "p07-starbao-1": at(40, 43, 30, "right", 65),
    "p07-guardian-2": at(6, 18, 29, "right", 56),
    "p08-starbao-1": at(40, 43, 30, "right", 65),
    "p08-guardian-2": at(6, 18, 29, "right", 56),
    "p09-starbao-1": at(9, 43, 30, "right", 64),
    "p09-guardian-2": at(64, 18, 29, "left", 56),
    "p10-starbao-1": at(38, 42, 30, "right", 64),
  },
  "desert-lesson-09": {
    "p01-starbao-1": at(9, 43, 30, "right", 64),
    "p01-guardian-2": at(64, 18, 29, "left", 56),
    "p02-starbao-1": at(9, 43, 30, "right", 64),
    "p02-guardian-2": at(64, 18, 29, "left", 56),
    "p03-starbao-1": at(40, 43, 30, "right", 65),
    "p03-guardian-2": at(6, 18, 29, "right", 56),
    "p04-starbao-1": at(9, 43, 30, "right", 64),
    "p04-guardian-2": at(64, 18, 29, "left", 56),
    "p05-starbao-1": at(40, 43, 30, "right", 65),
    "p05-guardian-2": at(6, 18, 29, "right", 56),
    "p06-starbao-1": at(40, 43, 30, "right", 65),
    "p06-guardian-2": at(6, 18, 29, "right", 56),
    "p07-starbao-1": at(40, 43, 30, "right", 65),
    "p07-guardian-2": at(6, 18, 29, "right", 56),
    "p08-starbao-1": at(40, 43, 30, "right", 65),
    "p08-guardian-2": at(6, 18, 29, "right", 56),
    "p09-starbao-1": at(9, 43, 30, "right", 64),
    "p09-guardian-2": at(64, 18, 29, "left", 56),
    "p10-starbao-1": at(38, 42, 30, "right", 64),
  },
};

// The three ancient-tree books were initially assigned the desert IDs. Keep
// their handcrafted dialogue placements when the corrected forest IDs are used.
for (const [legacyId, forestId] of [
  ["desert-lesson-07", "forest-lesson-01"],
  ["desert-lesson-08", "forest-lesson-02"],
  ["desert-lesson-09", "forest-lesson-03"],
] as const) {
  STORYBOOK_DIALOGUE_PLACEMENTS[forestId] = STORYBOOK_DIALOGUE_PLACEMENTS[legacyId]!;
}

const FALLBACK_PLACEMENT: DialoguePlacement = at(6, 8, 32, "bottom", 50);

export function resolveDialoguePlacement(
  storybookId: string,
  dialogue: StorybookDialogueCue,
): DialoguePlacement {
  return STORYBOOK_DIALOGUE_PLACEMENTS[storybookId]?.[dialogue.id] ?? FALLBACK_PLACEMENT;
}
