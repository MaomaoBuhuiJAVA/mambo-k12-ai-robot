import { describe, expect, it } from "vitest";

import { resolveAiBattleModule } from "./ai-battle-modules";

describe("AI battle module sizing", () => {
  it("uses enlarged enemy scales for every battle module", () => {
    expect(resolveAiBattleModule("castle-1").enemyScale).toBe(1.16);
    expect(resolveAiBattleModule("core-lab").enemyScale).toBe(1.25);
    expect(resolveAiBattleModule("desert-temple").enemyScale).toBe(1.42);
    expect(resolveAiBattleModule("lava-cavern").enemyScale).toBe(1.25);
    expect(resolveAiBattleModule("tree-sanctuary").enemyScale).toBe(1.26);
  });

  it("maps every battle module to spawn and defeat sprite sheets", () => {
    const expectedSheets = {
      "castle-1": {
        spawn: "/assets/game/enemy-sprites/castle-guardian-spawn.png",
        defeat: "/assets/game/enemy-sprites/castle-guardian-defeat.png",
      },
      "core-lab": {
        spawn: "/assets/game/enemy-sprites/core-automaton-spawn.png",
        defeat: "/assets/game/enemy-sprites/core-automaton-defeat.png",
      },
      "desert-temple": {
        spawn: "/assets/game/enemy-sprites/desert-sphinx-spawn.png",
        defeat: "/assets/game/enemy-sprites/desert-sphinx-defeat.png",
      },
      "lava-cavern": {
        spawn: "/assets/game/enemy-sprites/lava-serpent-spawn.png",
        defeat: "/assets/game/enemy-sprites/lava-serpent-defeat.png",
      },
      "tree-sanctuary": {
        spawn: "/assets/game/enemy-sprites/tree-guardian-spawn.png",
        defeat: "/assets/game/enemy-sprites/tree-guardian-defeat.png",
      },
    } as const;
    type ModuleWithSpriteSheets = ReturnType<typeof resolveAiBattleModule> & { enemySpriteSheets?: unknown };

    for (const [moduleId, sheets] of Object.entries(expectedSheets)) {
      expect((resolveAiBattleModule(moduleId) as ModuleWithSpriteSheets).enemySpriteSheets).toEqual(sheets);
    }
  });
});
