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

  it("maps every battle module to spawn and defeat videos", () => {
    const expectedAnimations = {
      "castle-1": {
        spawn: "/assets/game/enemy-videos/castle-guardian-spawn.mp4",
        defeat: "/assets/game/enemy-videos/castle-guardian-defeat.mp4",
      },
      "core-lab": {
        spawn: "/assets/game/enemy-videos/core-automaton-spawn.mp4",
        defeat: "/assets/game/enemy-videos/core-automaton-defeat.mp4",
      },
      "desert-temple": {
        spawn: "/assets/game/enemy-videos/desert-sphinx-spawn.mp4",
        defeat: "/assets/game/enemy-videos/desert-sphinx-defeat.mp4",
      },
      "lava-cavern": {
        spawn: "/assets/game/enemy-videos/lava-serpent-spawn.mp4",
        defeat: "/assets/game/enemy-videos/lava-serpent-defeat.mp4",
      },
      "tree-sanctuary": {
        spawn: "/assets/game/enemy-videos/tree-guardian-spawn.mp4",
        defeat: "/assets/game/enemy-videos/tree-guardian-defeat.mp4",
      },
    } as const;
    type ModuleWithAnimations = ReturnType<typeof resolveAiBattleModule> & { enemyAnimations?: unknown };

    for (const [moduleId, animations] of Object.entries(expectedAnimations)) {
      expect((resolveAiBattleModule(moduleId) as ModuleWithAnimations).enemyAnimations).toEqual(animations);
    }
  });
});
