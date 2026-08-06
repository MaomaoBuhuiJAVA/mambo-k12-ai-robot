import knowledgeBoltAsset from "@/assets/game/knowledge-bolt.svg";

import type { BattleAnimationEvent } from "./ai-battle-engine";
import { DEFAULT_AI_BATTLE_MODULE, type AiBattleModule } from "./ai-battle-modules";
import {
  createTransparentSpriteSheetCanvas,
  ENEMY_ANIMATION_RANGES,
  SPRITE_SHEET_GRID,
  type EnemyAnimationState,
} from "./ai-battle-sprite-sheet";

const SCENE_KEY = "ai-battle-arena";
const ARENA_TEXTURE = "ai-battle-arena-background";
const PLAYER_TEXTURE = "ai-battle-starbao";
const PLAYER_SPRITE_SHEET = "/assets/game/starbao-sprite-sheet.png";
const PLAYER_IDLE_FRAME = 16;
const PLAYER_SPAWN_END_FRAME = 7;
const ENEMY_REFERENCE_TEXTURE = "ai-battle-enemy-reference";
const ENEMY_SPAWN_SOURCE_TEXTURE = "ai-battle-enemy-spawn-source";
const ENEMY_DEFEAT_SOURCE_TEXTURE = "ai-battle-enemy-defeat-source";
const ENEMY_SPAWN_TEXTURE = "ai-battle-enemy-spawn";
const ENEMY_DEFEAT_TEXTURE = "ai-battle-enemy-defeat";
const BOLT_TEXTURE = "ai-battle-knowledge-bolt";
const ENEMY_SCALE_BOOST = 1.18;
type PhaserRuntime = typeof import("phaser");

export interface AiBattleArenaController {
  emit: (events: readonly BattleAnimationEvent[]) => void;
  idle: () => void;
  reset: () => void;
  destroy: () => void;
}

export async function mountAiBattleArena(
  parent: HTMLElement,
  battleModule: AiBattleModule = DEFAULT_AI_BATTLE_MODULE,
): Promise<AiBattleArenaController> {
  const Phaser = await import("phaser");
  let sendEvent: ((event: BattleAnimationEvent | "idle" | "reset") => void) | null = null;
  const BattleScene = createBattleScene(Phaser, battleModule, (emit) => {
    sendEvent = emit;
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 640,
    transparent: true,
    pixelArt: true,
    audio: {
      noAudio: true,
    },
    render: {
      antialias: false,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%",
    },
    scene: [BattleScene],
  });

  return {
    emit(events) {
      events.forEach((event) => sendEvent?.(event));
    },
    idle() {
      sendEvent?.("idle");
    },
    reset() {
      sendEvent?.("reset");
    },
    destroy() {
      sendEvent = null;
      game.destroy(true);
    },
  };
}

function createBattleScene(
  Phaser: PhaserRuntime,
  battleModule: AiBattleModule,
  onReady: (emit: (event: BattleAnimationEvent | "idle" | "reset") => void) => void,
) {
  return class AiBattleScene extends Phaser.Scene {
    constructor() {
      super(SCENE_KEY);
    }

    preload() {
      this.load.image(ARENA_TEXTURE, battleModule.arenaAsset);
      this.load.spritesheet(PLAYER_TEXTURE, PLAYER_SPRITE_SHEET, {
        frameWidth: SPRITE_SHEET_GRID.frameWidth,
        frameHeight: SPRITE_SHEET_GRID.frameHeight,
      });
      this.load.image(ENEMY_REFERENCE_TEXTURE, battleModule.enemyAsset);
      if (battleModule.enemySpriteSheets) {
        this.load.image(ENEMY_SPAWN_SOURCE_TEXTURE, battleModule.enemySpriteSheets.spawn);
        this.load.image(ENEMY_DEFEAT_SOURCE_TEXTURE, battleModule.enemySpriteSheets.defeat);
      }
      this.load.svg(BOLT_TEXTURE, assetUrl(knowledgeBoltAsset));
    }

    create() {
      const playerSpawnAnimationKey = `${SCENE_KEY}-starbao-spawn`;
      this.anims.create({
        key: playerSpawnAnimationKey,
        frames: this.anims.generateFrameNumbers(PLAYER_TEXTURE, { start: 0, end: PLAYER_SPAWN_END_FRAME }),
        frameRate: 12,
        repeat: 0,
      });

      const registerSpriteSheet = (sourceKey: string, outputKey: string) => {
        const sourceTexture = this.textures.get(sourceKey);
        const sourceImage = sourceTexture.getSourceImage();
        if (!(sourceImage instanceof HTMLImageElement || sourceImage instanceof HTMLCanvasElement)) return null;

        const cleanedCanvas = createTransparentSpriteSheetCanvas(sourceImage);
        const canvasTexture = this.textures.addCanvas(outputKey, cleanedCanvas);
        if (!canvasTexture) return null;

        const spriteSheet = this.textures.addSpriteSheet("", canvasTexture, SPRITE_SHEET_GRID);
        spriteSheet?.setFilter(Phaser.Textures.FilterMode.NEAREST);
        return spriteSheet;
      };

      const spawnTexture = battleModule.enemySpriteSheets
        ? registerSpriteSheet(ENEMY_SPAWN_SOURCE_TEXTURE, ENEMY_SPAWN_TEXTURE)
        : null;
      const defeatTexture = battleModule.enemySpriteSheets
        ? registerSpriteSheet(ENEMY_DEFEAT_SOURCE_TEXTURE, ENEMY_DEFEAT_TEXTURE)
        : null;
      const enemyAnimationKeys = spawnTexture && defeatTexture
        ? {
            spawn: `${SCENE_KEY}-${battleModule.id}-spawn`,
            defeat: `${SCENE_KEY}-${battleModule.id}-defeat`,
            exit: `${SCENE_KEY}-${battleModule.id}-exit`,
          }
        : null;

      if (enemyAnimationKeys) {
        const textureByState: Record<EnemyAnimationState, string> = {
          spawn: ENEMY_SPAWN_TEXTURE,
          defeat: ENEMY_DEFEAT_TEXTURE,
          exit: ENEMY_DEFEAT_TEXTURE,
        };
        const states: EnemyAnimationState[] = ["spawn", "defeat", "exit"];
        states.forEach((state) => {
          const range = ENEMY_ANIMATION_RANGES[state];
          this.anims.create({
            key: enemyAnimationKeys[state],
            frames: this.anims.generateFrameNumbers(textureByState[state], { start: range.start, end: range.end }),
            frameRate: range.frameRate,
            repeat: range.repeat,
          });
        });
      }

      const background = this.add.image(0, 0, ARENA_TEXTURE).setOrigin(0.5, 0.5);
      const player = this.add.sprite(0, 0, PLAYER_TEXTURE, 0).setOrigin(0.5, 1);
      const playerGlow = this.add.star(0, 0, 5, 9, 22, 0xF6D062, 0.22).setBlendMode(Phaser.BlendModes.ADD);
      const enemyContainer = this.add.container(0, 0);
      const enemyGlow = this.add.star(0, 0, 5, 9, 22, 0xFF9368, 0.2).setBlendMode(Phaser.BlendModes.ADD);
      const enemy = this.add.sprite(0, 0, ENEMY_REFERENCE_TEXTURE).setOrigin(0.5, 1);
      if (enemyAnimationKeys) enemy.setTexture(ENEMY_SPAWN_TEXTURE, 0);
      enemyContainer.add(enemyGlow);
      enemyContainer.add(enemy);
      const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const fast = reducedMotion ? 1 : 120;
      const normal = reducedMotion ? 1 : 250;
      const attackImpactDelay = reducedMotion ? 1 : (fast + 70) * 2 + normal + 70;
      let pendingVictoryExplosion: { remove: (dispatchCallback?: boolean) => void } | null = null;
      let enemyExitRequested = false;
      let showingIdleReference = false;

      const layout = (width = this.scale.width, height = this.scale.height) => {
        const backgroundScale = Math.max(width / background.width, height / background.height);
        background.setPosition(width / 2, height / 2).setDisplaySize(background.width * backgroundScale, background.height * backgroundScale);
        const characterScale = Math.max(0.34, Math.min(width / 1280, height / 640) * 1.05);
        const playerX = width * 0.24;
        const baseline = height * 0.965;
        const enemyReferenceWidth = this.textures.get(ENEMY_REFERENCE_TEXTURE).getSourceImage().width;
        const usesAnimatedSpriteSheet = Boolean(enemyAnimationKeys) && !showingIdleReference;
        const spriteSheetScale = usesAnimatedSpriteSheet ? enemyReferenceWidth / SPRITE_SHEET_GRID.frameWidth : 1;
        const enemyFrameWidth = usesAnimatedSpriteSheet ? SPRITE_SHEET_GRID.frameWidth : enemy.width;
        const enemyFrameHeight = usesAnimatedSpriteSheet ? SPRITE_SHEET_GRID.frameHeight : enemy.height;
        const requestedEnemyScale = characterScale * battleModule.enemyScale * spriteSheetScale * ENEMY_SCALE_BOOST;
        const maxEnemyScale = Math.max(
          0.3,
          Math.min(
            (width * 0.46) / enemyFrameWidth,
            (height * 0.72) / enemyFrameHeight,
          ),
        );
        const enemyScale = Math.min(requestedEnemyScale, maxEnemyScale);

        player.setPosition(playerX, baseline).setScale(characterScale);
        enemy.setPosition(0, 0).setScale(enemyScale);
        const enemyX = Math.min(
          width * 0.77,
          width - enemy.displayWidth / 2 - Math.max(12, width * 0.02),
        );
        enemyContainer.setPosition(enemyX, baseline);
        playerGlow.setPosition(playerX, baseline - 88 * characterScale).setScale(characterScale * 1.4);
        enemyGlow.setPosition(0, -Math.max(112 * characterScale, enemy.displayHeight * 0.42)).setScale(characterScale * 1.55);
      };

      const enemyImpactY = () => enemyContainer.y - Math.max(112, enemy.displayHeight * 0.5);

      const resetCharacters = () => {
        pendingVictoryExplosion?.remove(false);
        pendingVictoryExplosion = null;
        enemyExitRequested = false;
        showingIdleReference = false;
        this.tweens.killTweensOf([player, enemyContainer, playerGlow, enemyGlow]);
        player.clearTint().setVisible(true).setAlpha(1).setAngle(0).setScale(1).stop().setFrame(0);
        enemyContainer.setVisible(true).setAlpha(1).setAngle(0);
        enemy.clearTint().setVisible(true).setAlpha(1).setAngle(0).setScale(1).stop();
        if (enemyAnimationKeys) enemy.setTexture(ENEMY_SPAWN_TEXTURE, 0).play(enemyAnimationKeys.spawn);
        player.play(playerSpawnAnimationKey);
        playerGlow.setVisible(true).setAlpha(0.22);
        enemyGlow.setAlpha(0.2);
        layout();
      };

      const showPlayerForCombat = () => {
        player.setVisible(true).setAlpha(1);
        playerGlow.setVisible(true).setAlpha(0.22);
      };

      const hidePlayerForIdle = () => {
        player.setVisible(true).setAlpha(1);
        playerGlow.setVisible(true).setAlpha(0.16);
      };

      const moveEnemyOut = () => {
        this.tweens.killTweensOf(enemyContainer);
        this.tweens.add({
          targets: enemyContainer,
          x: enemyContainer.x + Math.max(this.scale.width * 0.36, 360),
          duration: normal + 320,
          ease: "Cubic.easeIn",
          onComplete: () => enemyContainer.setVisible(false),
        });
      };

      const playEnemyExit = () => {
        enemyExitRequested = true;
        if (enemyAnimationKeys) {
          showingIdleReference = false;
          enemyContainer.setVisible(true).setAlpha(1);
          enemy.play(enemyAnimationKeys.exit);
          layout();
          return;
        }
        moveEnemyOut();
      };

      const playEnemyDefeat = () => {
        enemyExitRequested = true;
        if (enemyAnimationKeys) {
          showingIdleReference = false;
          enemyContainer.setVisible(true).setAlpha(1);
          enemy.play(enemyAnimationKeys.defeat);
          layout();
          return;
        }
        enemy.setVisible(false);
        moveEnemyOut();
      };

      if (enemyAnimationKeys) {
        enemy.on("animationcomplete", (animation: { key: string }) => {
          if (animation.key === enemyAnimationKeys.spawn) {
            showingIdleReference = true;
            enemy.stop().setTexture(ENEMY_REFERENCE_TEXTURE);
            layout();
          } else if (animation.key === enemyAnimationKeys.defeat && enemyExitRequested) {
            enemy.play(enemyAnimationKeys.exit);
          } else if (animation.key === enemyAnimationKeys.exit) {
            moveEnemyOut();
          }
        });
      }

      player.on("animationcomplete", (animation: { key: string }) => {
        if (animation.key === playerSpawnAnimationKey) {
          player.stop().setFrame(PLAYER_IDLE_FRAME);
        }
      });

      const createImpact = (x: number, y: number, color: number) => {
        const impact = this.add.star(x, y, 6, 8, 24, color, 0.95).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: impact,
          scale: 2.6,
          alpha: 0,
          angle: 100,
          duration: normal,
          ease: "Quad.easeOut",
          onComplete: () => impact.destroy(),
        });
      };

      const createEnemyExplosion = () => {
        const explosionX = enemyContainer.x;
        const explosionY = enemyImpactY();
        this.tweens.killTweensOf(enemyContainer);
        if (!enemyAnimationKeys) enemy.setVisible(false);
        enemyGlow.setAlpha(0);

        const core = this.add.star(explosionX, explosionY, 10, 18, 44, 0xFFF2A5, 1).setBlendMode(Phaser.BlendModes.ADD);
        const shockwave = this.add.star(explosionX, explosionY, 12, 20, 56, 0xFF8B3D, 0.8).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: core,
          scale: 3.6,
          alpha: 0,
          angle: 130,
          duration: normal + 220,
          ease: "Quad.easeOut",
          onComplete: () => core.destroy(),
        });
        this.tweens.add({
          targets: shockwave,
          scale: 4.8,
          alpha: 0,
          duration: normal + 300,
          ease: "Cubic.easeOut",
          onComplete: () => shockwave.destroy(),
        });

        for (let index = 0; index < 14; index += 1) {
          const angle = (Math.PI * 2 * index) / 14;
          const distance = 58 + (index % 4) * 19;
          const shard = this.add.image(explosionX, explosionY, BOLT_TEXTURE)
            .setScale(0.11 + (index % 3) * 0.035)
            .setAngle((angle * 180) / Math.PI + 18)
            .setTint(index % 2 === 0 ? 0xFFF2A5 : 0xFF8B3D)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: shard,
            x: explosionX + Math.cos(angle) * distance,
            y: explosionY + Math.sin(angle) * distance,
            scale: 0.04,
            alpha: 0,
            duration: normal + 240 + (index % 3) * 55,
            ease: "Quad.easeOut",
            onComplete: () => shard.destroy(),
          });
        }
      };

      const fireBolt = (fromX: number, fromY: number, toX: number, toY: number, impactColor: number) => {
        const bolt = this.add.image(fromX, fromY, BOLT_TEXTURE).setScale(0.22).setAngle(-18);
        this.tweens.add({
          targets: bolt,
          x: toX,
          y: toY,
          angle: 42,
          duration: normal + 70,
          ease: "Cubic.easeIn",
          onComplete: () => {
            bolt.destroy();
            createImpact(toX, toY, impactColor);
          },
        });
      };

      const playerAttack = () => {
        showPlayerForCombat();
        const startX = player.x;
        const startY = player.y;
        this.tweens.add({
          targets: player,
          x: startX + 42,
          y: startY - 14,
          angle: -8,
          duration: fast + 70,
          yoyo: true,
          ease: "Sine.easeOut",
          onComplete: () => {
            fireBolt(player.x + 42, player.y - 90, enemyContainer.x - 22, enemyImpactY(), 0xF6D062);
            this.tweens.add({
              targets: enemyContainer,
              x: enemyContainer.x + 18,
              duration: fast + 100,
              yoyo: true,
              repeat: 2,
              ease: "Sine.easeInOut",
            });
          },
        });
      };

      const enemyAttack = () => {
        showPlayerForCombat();
        const startX = enemyContainer.x;
        const startY = enemyContainer.y;
        this.tweens.add({
          targets: enemyContainer,
          x: startX - 42,
          y: startY - 12,
          angle: 8,
          duration: fast + 70,
          yoyo: true,
          ease: "Sine.easeOut",
          onComplete: () => {
            fireBolt(enemyContainer.x - 42, enemyImpactY() + 20, player.x + 10, player.y - 80, 0xFF9368);
            this.tweens.add({
              targets: player,
              x: player.x - 14,
              duration: fast + 100,
              yoyo: true,
              repeat: 2,
              ease: "Sine.easeInOut",
            });
          },
        });
      };

      const heal = () => {
        showPlayerForCombat();
        const glow = this.add.image(player.x, player.y - 72, BOLT_TEXTURE).setScale(0.12).setAlpha(0.75);
        this.tweens.add({
          targets: [player, playerGlow],
          scale: "+=0.16",
          duration: normal,
          yoyo: true,
          ease: "Sine.easeInOut",
        });
        this.tweens.add({
          targets: glow,
          y: player.y - 178,
          scale: 0.42,
          alpha: 0,
          duration: normal + 170,
          ease: "Quad.easeOut",
          onComplete: () => glow.destroy(),
        });
      };

      const victory = () => {
        showPlayerForCombat();
        pendingVictoryExplosion?.remove(false);
        pendingVictoryExplosion = this.time.delayedCall(attackImpactDelay, () => {
          pendingVictoryExplosion = null;
          createEnemyExplosion();
          playEnemyDefeat();
          this.tweens.add({
            targets: [player, playerGlow],
            y: "-=20",
            duration: normal,
            yoyo: true,
            repeat: 2,
            ease: "Sine.easeInOut",
          });
        });
      };

      const defeat = () => {
        showPlayerForCombat();
        playEnemyExit();
        this.tweens.add({
          targets: player,
          alpha: 0.46,
          angle: -12,
          y: player.y + 26,
          duration: normal + 150,
          ease: "Cubic.easeIn",
        });
        this.tweens.add({
          targets: [enemy, enemyGlow],
          scale: "+=0.12",
          duration: normal,
          yoyo: true,
          repeat: 2,
          ease: "Sine.easeInOut",
        });
      };

      layout();
      hidePlayerForIdle();
      player.play(playerSpawnAnimationKey);
      if (enemyAnimationKeys) enemy.play(enemyAnimationKeys.spawn);
      this.scale.on("resize", (size: Phaser.Structs.Size) => layout(size.width, size.height));
      this.events.on("player-attack", playerAttack);
      this.events.on("enemy-attack", enemyAttack);
      this.events.on("heal", heal);
      this.events.on("victory", victory);
      this.events.on("defeat", defeat);
      this.events.on("idle", hidePlayerForIdle);
      this.events.on("reset", resetCharacters);
      onReady((event) => this.events.emit(event));
    }
  };
}

function assetUrl(asset: { src: string } | string): string {
  return typeof asset === "string" ? asset : asset.src;
}
