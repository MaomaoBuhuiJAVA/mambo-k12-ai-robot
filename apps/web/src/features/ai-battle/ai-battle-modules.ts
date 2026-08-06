export interface AiBattleModule {
  readonly id: string;
  readonly enemyName: string;
  readonly arenaAsset: string;
  readonly enemyAsset: string;
  readonly enemyScale: number;
  readonly enemySpriteSheets?: AiBattleEnemySpriteSheets;
}

export interface AiBattleEnemySpriteSheets {
  readonly spawn: string;
  readonly defeat: string;
}

interface ConfiguredAiBattleModule extends AiBattleModule {
  readonly aliases?: readonly string[];
}

const AI_BATTLE_MODULE_CONFIGS: readonly ConfiguredAiBattleModule[] = [
  {
    id: "castle-1",
    aliases: ["module-1"],
    enemyName: "城堡守卫",
    arenaAsset: "/assets/game/battle-castle-one.jpg",
    enemyAsset: "/assets/game/enemy-castle-guardian.png",
    enemyScale: 1.16,
    enemySpriteSheets: {
      spawn: "/assets/game/enemy-sprites/castle-guardian-spawn.png",
      defeat: "/assets/game/enemy-sprites/castle-guardian-defeat.png",
    },
  },
  {
    id: "core-lab",
    aliases: ["castle-2", "module-2"],
    enemyName: "数据核心守卫",
    arenaAsset: "/assets/game/battle-core-lab.jpg",
    enemyAsset: "/assets/game/enemy-core-automaton.png",
    enemyScale: 1.25,
    enemySpriteSheets: {
      spawn: "/assets/game/enemy-sprites/core-automaton-spawn.png",
      defeat: "/assets/game/enemy-sprites/core-automaton-defeat.png",
    },
  },
  {
    id: "desert-temple",
    aliases: ["castle-3", "module-3"],
    enemyName: "沙漠石像守卫",
    arenaAsset: "/assets/game/battle-desert-temple.jpg",
    enemyAsset: "/assets/game/enemy-desert-sphinx.png",
    enemyScale: 1.42,
    enemySpriteSheets: {
      spawn: "/assets/game/enemy-sprites/desert-sphinx-spawn.png",
      defeat: "/assets/game/enemy-sprites/desert-sphinx-defeat.png",
    },
  },
  {
    id: "lava-cavern",
    aliases: ["castle-4", "module-4"],
    enemyName: "熔岩巨龙",
    arenaAsset: "/assets/game/battle-lava-cavern.jpg",
    enemyAsset: "/assets/game/enemy-lava-serpent.png",
    enemyScale: 1.25,
    enemySpriteSheets: {
      spawn: "/assets/game/enemy-sprites/lava-serpent-spawn.png",
      defeat: "/assets/game/enemy-sprites/lava-serpent-defeat.png",
    },
  },
  {
    id: "tree-sanctuary",
    aliases: ["castle-5", "module-5"],
    enemyName: "古树守卫",
    arenaAsset: "/assets/game/battle-tree-sanctuary.jpg",
    enemyAsset: "/assets/game/enemy-tree-guardian.png",
    enemyScale: 1.26,
    enemySpriteSheets: {
      spawn: "/assets/game/enemy-sprites/tree-guardian-spawn.png",
      defeat: "/assets/game/enemy-sprites/tree-guardian-defeat.png",
    },
  },
];

export const DEFAULT_AI_BATTLE_MODULE = AI_BATTLE_MODULE_CONFIGS[0];

export function resolveAiBattleModule(moduleId: string | undefined): AiBattleModule {
  const normalizedModuleId = moduleId?.trim().toLowerCase();
  if (!normalizedModuleId) return DEFAULT_AI_BATTLE_MODULE;

  return AI_BATTLE_MODULE_CONFIGS.find((battleModule) => (
    battleModule.id === normalizedModuleId || battleModule.aliases?.includes(normalizedModuleId)
  )) ?? DEFAULT_AI_BATTLE_MODULE;
}
