import knowledgeBoltAsset from "@/assets/game/knowledge-bolt.svg";

import type { BattleAnimationEvent } from "./ai-battle-engine";
import { DEFAULT_AI_BATTLE_MODULE, type AiBattleModule } from "./ai-battle-modules";
import {
  createEnemyVideoTexture,
  ENEMY_VIDEO_FRAME_SIZE,
  type EnemyVideoTextureController,
} from "./enemy-video-keyer";
import { PLAYER_ANIMATION_RANGES, SPRITE_SHEET_GRID } from "./ai-battle-sprite-sheet";
import {
  createStarbaoVideoTexture,
  STARBAO_VIDEO_FRAME_SIZE,
  type StarbaoVideoTextureController,
} from "./starbao-video-texture";

const SCENE_KEY = "ai-battle-arena";
const ARENA_TEXTURE = "ai-battle-arena-background";
const PLAYER_TEXTURE = "ai-battle-starbao";
const PLAYER_SPRITE_SHEET = "/assets/game/starbao-sprite-sheet.png";
const PLAYER_VIDEO_TEXTURE = "ai-battle-starbao-video";
const PLAYER_VIDEO_SOURCE = "/assets/game/starbao-entrance-idle.mp4";
const PLAYER_DEFEAT_TEXTURE = "ai-battle-starbao-defeat";
const PLAYER_DEFEAT_SPRITE_SHEET = "/assets/game/starbao-defeat-sprite-sheet.png";
const ENEMY_REFERENCE_TEXTURE = "ai-battle-enemy-reference";
const ENEMY_SPAWN_VIDEO_TEXTURE = "ai-battle-enemy-spawn-video";
const ENEMY_DEFEAT_VIDEO_TEXTURE = "ai-battle-enemy-defeat-video";
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
      this.load.spritesheet(PLAYER_DEFEAT_TEXTURE, PLAYER_DEFEAT_SPRITE_SHEET, {
        frameWidth: SPRITE_SHEET_GRID.frameWidth,
        frameHeight: SPRITE_SHEET_GRID.frameHeight,
      });
      this.load.image(ENEMY_REFERENCE_TEXTURE, battleModule.enemyAsset);
      this.load.svg(BOLT_TEXTURE, assetUrl(knowledgeBoltAsset));
    }

    create() {
      const playerSpawnAnimationKey = `${SCENE_KEY}-starbao-spawn`;
      const playerIdleAnimationKey = `${SCENE_KEY}-starbao-idle`;
      const playerDefeatAnimationKey = `${SCENE_KEY}-starbao-defeat`;
      const playerSpawnRange = PLAYER_ANIMATION_RANGES.spawn;
      const playerIdleRange = PLAYER_ANIMATION_RANGES.idle;
      const playerDefeatRange = PLAYER_ANIMATION_RANGES.defeat;
      this.anims.create({
        key: playerSpawnAnimationKey,
        frames: this.anims.generateFrameNumbers(PLAYER_TEXTURE, { start: playerSpawnRange.start, end: playerSpawnRange.end }),
        frameRate: playerSpawnRange.frameRate,
        repeat: playerSpawnRange.repeat,
      });
      this.anims.create({
        key: playerIdleAnimationKey,
        frames: this.anims.generateFrameNumbers(PLAYER_TEXTURE, { start: playerIdleRange.start, end: playerIdleRange.end }),
        frameRate: playerIdleRange.frameRate,
        repeat: playerIdleRange.repeat,
      });
      this.anims.create({
        key: playerDefeatAnimationKey,
        frames: this.anims.generateFrameNumbers(PLAYER_DEFEAT_TEXTURE, { start: playerDefeatRange.start, end: playerDefeatRange.end }),
        frameRate: playerDefeatRange.frameRate,
        repeat: playerDefeatRange.repeat,
      });

      const background = this.add.image(0, 0, ARENA_TEXTURE).setOrigin(0.5, 0.5);
      const player = this.add.sprite(0, 0, PLAYER_TEXTURE, 0).setOrigin(0.5, 1);
      const playerDefeat = this.add.sprite(0, 0, PLAYER_DEFEAT_TEXTURE, 0).setOrigin(0.5, 1).setVisible(false);
      const playerVideoCanvas = document.createElement("canvas");
      playerVideoCanvas.width = STARBAO_VIDEO_FRAME_SIZE;
      playerVideoCanvas.height = STARBAO_VIDEO_FRAME_SIZE;
      const playerVideoCanvasTexture = this.textures.addCanvas(PLAYER_VIDEO_TEXTURE, playerVideoCanvas);
      if (!playerVideoCanvasTexture) throw new Error("Unable to create the Starbao video texture.");
      playerVideoCanvasTexture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      const playerVideo = this.add.image(0, 0, PLAYER_VIDEO_TEXTURE).setOrigin(0.5, 1).setVisible(false);
      let usePlayerVideo = true;
      const playerVideoController: StarbaoVideoTextureController = createStarbaoVideoTexture({
        source: PLAYER_VIDEO_SOURCE,
        canvas: playerVideoCanvas,
        refresh: () => playerVideoCanvasTexture.refresh(),
        onError: () => {
          usePlayerVideo = false;
          playerVideo.setVisible(false);
          player.setVisible(true).setAlpha(1).play(playerSpawnAnimationKey);
        },
      });
      const playerGlow = this.add.star(0, 0, 5, 9, 22, 0xF6D062, 0.22).setBlendMode(Phaser.BlendModes.ADD);
      const enemyContainer = this.add.container(0, 0);
      const enemyGlow = this.add.star(0, 0, 5, 9, 22, 0xFF9368, 0.2).setBlendMode(Phaser.BlendModes.ADD);
      const enemy = this.add.image(0, 0, ENEMY_REFERENCE_TEXTURE).setOrigin(0.5, 1);
      const createVideoTexture = (textureKey: string, source: string, onEnded: () => void) => {
        const canvas = document.createElement("canvas");
        canvas.width = ENEMY_VIDEO_FRAME_SIZE;
        canvas.height = ENEMY_VIDEO_FRAME_SIZE;
        const canvasTexture = this.textures.addCanvas(textureKey, canvas);
        if (!canvasTexture) throw new Error(`Unable to create the enemy animation texture: ${textureKey}`);
        canvasTexture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        const controller = createEnemyVideoTexture({
          source,
          canvas,
          refresh: () => canvasTexture.refresh(),
          onEnded,
        });
        return controller;
      };
      enemyContainer.add(enemyGlow);
      enemyContainer.add(enemy);
      const enemyVideo = this.add.image(0, 0, ENEMY_SPAWN_VIDEO_TEXTURE).setOrigin(0.5, 1).setVisible(false);
      enemyContainer.add(enemyVideo);
      const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const fast = reducedMotion ? 1 : 120;
      const normal = reducedMotion ? 1 : 250;
      const attackImpactDelay = reducedMotion ? 1 : (fast + 70) * 2 + normal + 70;
      let pendingVictoryExplosion: { remove: (dispatchCallback?: boolean) => void } | null = null;
      let enemyExitRequested = false;

      const layout = (width = this.scale.width, height = this.scale.height) => {
        const backgroundScale = Math.max(width / background.width, height / background.height);
        background.setPosition(width / 2, height / 2).setDisplaySize(background.width * backgroundScale, background.height * backgroundScale);
        const characterScale = Math.max(0.34, Math.min(width / 1280, height / 640) * 1.05);
        const playerX = width * 0.24;
        const baseline = height * 0.965;
        const enemyReferenceWidth = this.textures.get(ENEMY_REFERENCE_TEXTURE).getSourceImage().width;
        const requestedEnemyScale = characterScale * battleModule.enemyScale * ENEMY_SCALE_BOOST;
        const maxEnemyScale = Math.max(
          0.3,
          Math.min(
            (width * 0.46) / enemyReferenceWidth,
            (height * 0.72) / enemy.height,
          ),
        );
        const enemyScale = Math.min(requestedEnemyScale, maxEnemyScale);

        player.setPosition(playerX, baseline).setScale(characterScale);
        playerVideo.setPosition(playerX, baseline).setScale(characterScale * SPRITE_SHEET_GRID.frameWidth / STARBAO_VIDEO_FRAME_SIZE);
        playerDefeat.setPosition(playerX, baseline).setScale(characterScale);
        enemy.setPosition(0, 0).setScale(enemyScale);
        enemyVideo.setPosition(0, 0).setScale(enemyScale * enemyReferenceWidth / ENEMY_VIDEO_FRAME_SIZE);
        const enemyX = Math.min(
          width * 0.77,
          width - enemy.displayWidth / 2 - Math.max(12, width * 0.02),
        );
        enemyContainer.setPosition(enemyX, baseline);
        playerGlow.setPosition(playerX, baseline - 88 * characterScale).setScale(characterScale * 1.4);
        const visibleEnemyHeight = enemyVideo.visible ? enemyVideo.displayHeight : enemy.displayHeight;
        enemyGlow.setPosition(0, -Math.max(112 * characterScale, visibleEnemyHeight * 0.42)).setScale(characterScale * 1.55);
      };

      const enemyImpactY = () => enemyContainer.y - Math.max(112, (enemyVideo.visible ? enemyVideo.displayHeight : enemy.displayHeight) * 0.5);

      const resetCharacters = () => {
        pendingVictoryExplosion?.remove(false);
        pendingVictoryExplosion = null;
        enemyExitRequested = false;
        this.tweens.killTweensOf([player, playerVideo, playerDefeat, enemyContainer, playerGlow, enemyGlow]);
        player.clearTint().setVisible(true).setAlpha(1).setAngle(0).setScale(1).stop().setFrame(0);
        playerVideo.clearTint().setVisible(false).setAlpha(1).setAngle(0).setScale(1);
        playerDefeat.clearTint().setVisible(false).setAlpha(1).setAngle(0).setScale(1).stop().setFrame(0);
        enemyContainer.setVisible(true).setAlpha(1).setAngle(0);
        enemySpawnVideo.stop();
        enemyDefeatVideo.stop();
        enemy.clearTint().setVisible(false).setAlpha(1).setAngle(0).setScale(1);
        enemyVideo.setTexture(ENEMY_SPAWN_VIDEO_TEXTURE).setVisible(true).setAlpha(1).setAngle(0).setScale(1);
        enemySpawnVideo.start();
        if (usePlayerVideo) {
          player.setVisible(false);
          playerVideo.setVisible(true);
          playerVideoController.start();
        } else {
          player.play(playerSpawnAnimationKey);
        }
        playerGlow.setVisible(true).setAlpha(0.22);
        enemyGlow.setAlpha(0.2);
        layout();
      };

      const showPlayerForCombat = () => {
        player.setVisible(!usePlayerVideo).setAlpha(1);
        playerVideo.setVisible(usePlayerVideo).setAlpha(1);
        playerDefeat.setVisible(false).setAlpha(1);
        playerGlow.setVisible(true).setAlpha(0.22);
      };

      const hidePlayerForIdle = () => {
        player.setVisible(!usePlayerVideo).setAlpha(1);
        playerVideo.setVisible(usePlayerVideo).setAlpha(1);
        playerGlow.setVisible(true).setAlpha(0.16);
        if (!usePlayerVideo) player.play(playerIdleAnimationKey, true);
      };

      const playerMotionTarget = () => usePlayerVideo ? playerVideo : player;

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
        enemySpawnVideo.stop();
        enemyDefeatVideo.stop();
        enemyVideo.setVisible(false);
        enemy.setVisible(true);
        moveEnemyOut();
      };

      const playEnemyDefeat = () => {
        enemyExitRequested = true;
        enemySpawnVideo.stop();
        enemy.setVisible(false);
        enemyVideo.setTexture(ENEMY_DEFEAT_VIDEO_TEXTURE).setVisible(true).setAlpha(1).setAngle(0);
        enemyDefeatVideo.start();
        layout();
      };

      const enemySpawnVideo: EnemyVideoTextureController = createVideoTexture(
        ENEMY_SPAWN_VIDEO_TEXTURE,
        battleModule.enemyAnimations.spawn,
        () => {
          enemyVideo.setVisible(false);
          enemy.setVisible(true);
          layout();
        },
      );
      const enemyDefeatVideo: EnemyVideoTextureController = createVideoTexture(
        ENEMY_DEFEAT_VIDEO_TEXTURE,
        battleModule.enemyAnimations.defeat,
        () => {
          enemyVideo.setVisible(false);
          enemy.setVisible(false);
          if (enemyExitRequested) moveEnemyOut();
        },
      );

      const cleanupEnemyVideos = () => {
        enemySpawnVideo.destroy();
        enemyDefeatVideo.destroy();
        playerVideoController.destroy();
      };

      this.events.once("shutdown", cleanupEnemyVideos);

      player.on("animationcomplete", (animation: { key: string }) => {
        if (animation.key === playerSpawnAnimationKey) {
          player.play(playerIdleAnimationKey);
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
        enemy.setVisible(false);
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
          targets: playerMotionTarget(),
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
              targets: playerMotionTarget(),
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
          targets: [playerMotionTarget(), playerGlow],
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
            targets: [playerMotionTarget(), playerGlow],
            y: "-=20",
            duration: normal,
            yoyo: true,
            repeat: 2,
            ease: "Sine.easeInOut",
          });
        });
      };

      const defeat = () => {
        playerVideoController.stop();
        playerVideo.setVisible(false);
        player.setVisible(false).stop();
        playerDefeat.setVisible(true).setAlpha(1).setAngle(0).play(playerDefeatAnimationKey);
        playerGlow.setVisible(true).setAlpha(0.22);
        playEnemyExit();
        this.tweens.add({
          targets: [enemyVideo, enemyGlow],
          scale: "+=0.12",
          duration: normal,
          yoyo: true,
          repeat: 2,
          ease: "Sine.easeInOut",
        });
      };

      layout();
      hidePlayerForIdle();
      enemy.setVisible(false);
      enemyVideo.setTexture(ENEMY_SPAWN_VIDEO_TEXTURE);
      enemyVideo.setVisible(true);
      enemySpawnVideo.start();
      if (usePlayerVideo) {
        player.setVisible(false);
        playerVideo.setVisible(true);
        playerVideoController.start();
      } else {
        player.play(playerSpawnAnimationKey);
      }
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
