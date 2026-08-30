export interface AiBattleModule {
  readonly id: string;
  readonly enemyName: string;
  readonly arenaAsset: string;
  readonly enemyAsset: string;
  readonly enemyScale: number;
  readonly enemyAnimations: AiBattleEnemyAnimations;
  readonly enemyAudio?: AiBattleEnemyAudio;
}

export interface AiBattleEnemyAnimations {
  readonly spawn: string;
  readonly defeat: string;
}

export interface AiBattleEnemyAudio {
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
    enemyAnimations: {
      spawn: "/assets/game/enemy-videos/castle-guardian-spawn.mp4",
      defeat: "/assets/game/enemy-videos/castle-guardian-defeat.mp4",
    },
    enemyAudio: {
      spawn: "/assets/game/enemy-audio/castle-guardian-spawn.m4a",
      defeat: "/assets/game/enemy-audio/castle-guardian-defeat.m4a",
    },
  },
  {
    id: "core-lab",
    aliases: ["castle-2", "module-2"],
    enemyName: "数据核心守卫",
    arenaAsset: "/assets/game/battle-core-lab.jpg",
    enemyAsset: "/assets/game/enemy-core-automaton.png",
    enemyScale: 1.25,
    enemyAnimations: {
      spawn: "/assets/game/enemy-videos/core-automaton-spawn.mp4",
      defeat: "/assets/game/enemy-videos/core-automaton-defeat.mp4",
    },
    enemyAudio: {
      spawn: "/assets/game/enemy-audio/core-automaton-spawn.m4a",
      defeat: "/assets/game/enemy-audio/core-automaton-defeat.m4a",
    },
  },
  {
    id: "desert-temple",
    aliases: ["castle-3", "module-3"],
    enemyName: "沙漠石像守卫",
    arenaAsset: "/assets/game/battle-desert-temple.jpg",
    enemyAsset: "/assets/game/enemy-desert-sphinx.png",
    enemyScale: 1.42,
    enemyAnimations: {
      spawn: "/assets/game/enemy-videos/desert-sphinx-spawn.mp4",
      defeat: "/assets/game/enemy-videos/desert-sphinx-defeat.mp4",
    },
    enemyAudio: {
      spawn: "/assets/game/enemy-audio/desert-sphinx-spawn.m4a",
      defeat: "/assets/game/enemy-audio/desert-sphinx-defeat.m4a",
    },
  },
  {
    id: "lava-cavern",
    aliases: ["castle-4", "module-4"],
    enemyName: "熔岩巨龙",
    arenaAsset: "/assets/game/battle-lava-cavern.jpg",
    enemyAsset: "/assets/game/enemy-lava-serpent.png",
    enemyScale: 1.25,
    enemyAnimations: {
      spawn: "/assets/game/enemy-videos/lava-serpent-spawn.mp4",
      defeat: "/assets/game/enemy-videos/lava-serpent-defeat.mp4",
    },
    enemyAudio: {
      spawn: "/assets/game/enemy-audio/lava-serpent-spawn.m4a",
      defeat: "/assets/game/enemy-audio/lava-serpent-defeat.m4a",
    },
  },
  {
    id: "tree-sanctuary",
    aliases: ["castle-5", "module-5"],
    enemyName: "古树守卫",
    arenaAsset: "/assets/game/battle-tree-sanctuary.jpg",
    enemyAsset: "/assets/game/enemy-tree-guardian.png",
    enemyScale: 1.26,
    enemyAnimations: {
      spawn: "/assets/game/enemy-videos/tree-guardian-spawn.mp4",
      defeat: "/assets/game/enemy-videos/tree-guardian-defeat.mp4",
    },
    enemyAudio: {
      spawn: "/assets/game/enemy-audio/tree-guardian-spawn.m4a",
      defeat: "/assets/game/enemy-audio/tree-guardian-defeat.m4a",
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
