import { describe, expect, it } from "vitest";

import { IMPORTED_STORYBOOKS } from "./index";
import {
  isPrimaryMapBattleUnlocked,
  PRIMARY_MAP_STORYBOOK_MODULES,
} from "./primary-map-storybooks";

describe("primary map storybook modules", () => {
  it("assigns exactly three storybooks and one battle to each map region", () => {
    expect(Object.values(PRIMARY_MAP_STORYBOOK_MODULES)).toHaveLength(5);
    for (const storybookModule of Object.values(PRIMARY_MAP_STORYBOOK_MODULES)) {
      expect(storybookModule.storybooks).toHaveLength(3);
      expect(storybookModule.battleModuleId.length).toBeGreaterThan(0);
    }
  });

  it("only marks storybooks with imported manifests as available", () => {
    const availableIds = Object.values(PRIMARY_MAP_STORYBOOK_MODULES)
      .flatMap((module) => module.storybooks)
      .filter((storybook) => storybook.available)
      .map((storybook) => storybook.storybookId);

    expect(availableIds).toEqual(IMPORTED_STORYBOOKS.map((storybook) => storybook.id));
  });

  it("unlocks a battle only after all three regional storybooks are complete", () => {
    const castle = PRIMARY_MAP_STORYBOOK_MODULES.castle;
    expect(isPrimaryMapBattleUnlocked(castle, new Set(["castle-lesson-01", "castle-lesson-02"]))).toBe(false);
    expect(isPrimaryMapBattleUnlocked(castle, new Set(castle.storybooks.map((storybook) => storybook.storybookId)))).toBe(true);
  });
});
