"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, BookOpenCheck, LockKeyhole, Swords } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { useCloudTransition } from "@/components/cloud-transition/cloud-transition-provider";
import {
  isPrimaryMapBattleUnlocked,
  PRIMARY_MAP_STORYBOOK_MODULES,
  type PrimaryMapRegionId,
  type PrimaryMapStorybookCard,
} from "@/data/storybooks/primary-map-storybooks";
import { readCompletedImportedStorybookIds } from "@/features/storybook/imported-storybook-progress";
import styles from "./page.module.css";
import regionLayout from "./region-layout.json";

type MapRegionId = PrimaryMapRegionId;

type MapRegion = {
  id: MapRegionId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  path: string;
};

const mapWidth = regionLayout.mapWidth;
const mapHeight = regionLayout.mapHeight;
const glowPadding = 80;
const mapArtworkSrc = "/assets/learning-map/starbao-learning-islands-transparent-water.png";

const regionLabels: Record<MapRegionId, string> = {
  forest: "森林热点",
  castle: "城堡热点",
  technology: "科技岛热点",
  desert: "沙漠热点",
  volcano: "火山热点",
};

type CardEdgeParticle = {
  delay: number;
  originX: string;
  originY: string;
  scale: number;
  x: string;
  y: string;
};

const particlesPerCard = 16;
const cardEdgeParticles: readonly (readonly CardEdgeParticle[])[] = Array.from(
  { length: 3 },
  (_, cardIndex) => Array.from({ length: particlesPerCard }, (_, index) => {
    const exposedEdges = [
      [0, 3, 2],
      [0, 2],
      [0, 1, 2],
    ] as const;
    const cardEdges = exposedEdges[cardIndex];
    const edge = cardEdges[index % cardEdges.length];
    const edgeProgress = 10 + ((index * 29 + cardIndex * 17) % 81);
    const edgeOrigins = [
      { x: edgeProgress, y: 0, angle: -90 },
      { x: 100, y: edgeProgress, angle: 0 },
      { x: edgeProgress, y: 100, angle: 90 },
      { x: 0, y: edgeProgress, angle: 180 },
    ] as const;
    const origin = edgeOrigins[edge];
    const angle = (origin.angle + ((index * 37 + cardIndex * 23) % 75) - 37) * (Math.PI / 180);
    const distance = 7 + ((index * 7 + cardIndex * 5) % 12) * 0.8;

    return {
      delay: (index * 17 + cardIndex * 23) % 72,
      originX: `${origin.x}%`,
      originY: `${origin.y}%`,
      scale: 0.46 + ((index * 5 + cardIndex * 2) % 6) * 0.11,
      x: `${Math.cos(angle) * distance}cqw`,
      y: `${Math.sin(angle) * distance}cqw`,
    };
  }),
);

// These bounds and hit-target paths are generated from the supplied primary-school SVG mask.
const mapRegions: MapRegion[] = regionLayout.regions.map((region) => {
  const id = region.id as MapRegionId;
  return { ...region, id, label: regionLabels[id] };
});
const persistentBaseRegions = mapRegions.filter((region) => region.id === "castle");

function regionAsset(id: MapRegionId, suffix: "mask" | "zoom") {
  return `/assets/learning-map/primary-regions/${id}-${suffix}.png`;
}

export default function LearningMapPage() {
  const router = useRouter();
  const { isTransitioning, notifyMapReady, startHomeTransition } = useCloudTransition();
  const [activeRegion, setActiveRegion] = useState<MapRegionId | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<MapRegionId | null>(null);
  const [deckLaunchKey, setDeckLaunchKey] = useState(0);
  const [mapImageLoaded, setMapImageLoaded] = useState(false);
  const [completedStorybookIds, setCompletedStorybookIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (mapImageLoaded) notifyMapReady();
  }, [mapImageLoaded, notifyMapReady]);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      setCompletedStorybookIds(new Set(readCompletedImportedStorybookIds(window.localStorage)));
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  function selectRegion(id: MapRegionId) {
    setActiveRegion(id);
    setSelectedRegion(id);
    setDeckLaunchKey((current) => current + 1);
  }

  function dismissDeck() {
    setActiveRegion(null);
    setSelectedRegion(null);
  }

  function returnToHome() {
    startHomeTransition();
  }

  function openStorybook(card: PrimaryMapStorybookCard) {
    if (!card.available) return;
    router.push(`/storybook/${card.storybookId}`);
  }

  const selectedModule = selectedRegion ? PRIMARY_MAP_STORYBOOK_MODULES[selectedRegion] : null;
  const completedStorybookCount = selectedModule
    ? selectedModule.storybooks.filter((storybook) => completedStorybookIds.has(storybook.storybookId)).length
    : 0;
  const battleUnlocked = selectedModule
    ? isPrimaryMapBattleUnlocked(selectedModule, completedStorybookIds)
    : false;

  return (
    <main className={styles.page}>
      <section className={styles.mapSection} aria-label="小学学习地图">
        <div className={styles.mapStage}>
          <div aria-hidden="true" className={styles.oceanBackdrop} />
          <button
            aria-label="返回首页"
            className={styles.returnLink}
            disabled={isTransitioning}
            onClick={returnToHome}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            <span>返回首页</span>
          </button>
          <div
            className={styles.mapCanvas}
            data-map-aspect={`${mapWidth}/${mapHeight}`}
            data-testid="map-canvas"
          >
            <Image
              className={styles.mapArtwork}
              src={mapArtworkSrc}
              alt="小学学习地图"
              fill
              onLoad={() => setMapImageLoaded(true)}
              priority
              sizes="100vw"
            />
            <svg className={styles.hotspotOverlay} viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-label="学习地图热点区域">
            <defs>
              {mapRegions.map((region) => (
                <filter
                  colorInterpolationFilters="sRGB"
                  filterUnits="userSpaceOnUse"
                  height={region.height + glowPadding * 2}
                  id={`map-region-glow-${region.id}`}
                  key={region.id}
                  width={region.width + glowPadding * 2}
                  x={region.x - glowPadding}
                  y={region.y - glowPadding}
                >
                  <feGaussianBlur in="SourceAlpha" result="nearBlur" stdDeviation="7" />
                  <feComposite in="nearBlur" in2="SourceAlpha" operator="out" result="nearOuterGlow" />
                  <feFlood floodColor="#fffdec" floodOpacity="1" result="nearGlowColor" />
                  <feComposite in="nearGlowColor" in2="nearOuterGlow" operator="in" result="nearGlow" />
                  <feGaussianBlur in="SourceAlpha" result="farBlur" stdDeviation="22" />
                  <feComposite in="farBlur" in2="SourceAlpha" operator="out" result="farOuterGlow" />
                  <feFlood floodColor="#72e6ff" floodOpacity="0.94" result="farGlowColor" />
                  <feComposite in="farGlowColor" in2="farOuterGlow" operator="in" result="farGlow" />
                  <feMerge>
                    <feMergeNode in="farGlow" />
                    <feMergeNode in="nearGlow" />
                  </feMerge>
                </filter>
              ))}
            </defs>

            <g aria-hidden="true">
              {persistentBaseRegions.map((region) => {
                const isActive = activeRegion === region.id || selectedRegion === region.id;
                return (
                  <image
                    className={styles.regionBase}
                    data-active={isActive ? "true" : undefined}
                    data-region={region.id}
                    data-testid={`map-region-base-${region.id}`}
                    height={region.height}
                    href={regionAsset(region.id, "zoom")}
                    key={`base-${region.id}`}
                    pointerEvents="none"
                    width={region.width}
                    x={region.x}
                    y={region.y}
                  />
                );
              })}
              {mapRegions.map((region) => {
                const isActive = activeRegion === region.id || selectedRegion === region.id;
                return (
                  <image
                    className={styles.regionGlow}
                    data-active={isActive ? "true" : undefined}
                    data-region={region.id}
                    data-testid={`map-region-glow-${region.id}`}
                    filter={`url(#map-region-glow-${region.id})`}
                    height={region.height}
                    href={regionAsset(region.id, "mask")}
                    key={`glow-${region.id}`}
                    pointerEvents="none"
                    width={region.width}
                    x={region.x}
                    y={region.y}
                  />
                );
              })}
              {mapRegions.map((region) => {
                const isActive = activeRegion === region.id || selectedRegion === region.id;
                return (
                  <image
                    className={styles.regionZoom}
                    data-active={isActive ? "true" : undefined}
                    data-region={region.id}
                    data-testid={`map-region-zoom-${region.id}`}
                    height={region.height}
                    href={regionAsset(region.id, "zoom")}
                    key={`zoom-${region.id}`}
                    pointerEvents="none"
                    width={region.width}
                    x={region.x}
                    y={region.y}
                  />
                );
              })}
            </g>

            {mapRegions.map((region) => {
              const isActive = activeRegion === region.id || selectedRegion === region.id;
              return (
                <path
                  aria-label={region.label}
                  className={styles.hotspot}
                  data-active={isActive ? "true" : undefined}
                  data-region={region.id}
                  data-testid="map-hotspot"
                  d={region.path}
                  fill="transparent"
                  fillRule="evenodd"
                  focusable="true"
                  key={`hotspot-${region.id}`}
                  onBlur={() => setActiveRegion((current) => current === region.id ? null : current)}
                  onClick={() => selectRegion(region.id)}
                  onFocus={() => setActiveRegion(region.id)}
                  onPointerEnter={() => setActiveRegion(region.id)}
                  onPointerLeave={() => setActiveRegion((current) => current === region.id ? null : current)}
                  role="button"
                  tabIndex={0}
                />
              );
            })}
            </svg>
          </div>

          {selectedRegion && selectedModule ? (
            <section
              aria-label={`${selectedModule.regionName}绘本卡片`}
              className={styles.cardDeck}
              key={`${selectedRegion}-${deckLaunchKey}`}
            >
              <button
                aria-label="关闭学习卡片"
                className={styles.cardDeckBackdrop}
                data-testid="card-deck-backdrop"
                onClick={dismissDeck}
                type="button"
              />

              <div className={styles.cardDeckContent}>
                <header className={styles.cardDeckHeader}>
                  <div>
                    <span>{selectedModule.regionName}学习</span>
                    <h2>完成三本绘本，解锁怪兽战斗</h2>
                  </div>
                  <strong>{completedStorybookCount} / 3</strong>
                </header>

                <div className={styles.cardDeckCards}>
                  {selectedModule.storybooks.map((card, index) => {
                    const completed = completedStorybookIds.has(card.storybookId);
                    const statusLabel = completed ? "已完成" : card.available ? "开始学习" : "内容待接入";
                    return (
                      <button
                        aria-label={`${String(index + 1).padStart(2, "0")} ${card.title}，${statusLabel}`}
                        className={styles.learningCard}
                        data-status={completed ? "completed" : card.available ? "available" : "pending"}
                        data-testid="learning-card"
                        disabled={!card.available}
                        key={card.storybookId}
                        onClick={() => openStorybook(card)}
                        style={{ "--card-index": index } as CSSProperties}
                        type="button"
                      >
                        <div className={styles.cardFace}>
                          <div className={styles.cardTopline}>
                            <span className={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</span>
                            <span className={styles.cardStatus} data-status={completed ? "completed" : card.available ? "available" : "pending"}>
                              {completed ? <BookOpenCheck aria-hidden="true" size={14} /> : !card.available ? <LockKeyhole aria-hidden="true" size={14} /> : null}
                              {statusLabel}
                            </span>
                          </div>
                          {card.coverSrc ? (
                            <span className={styles.cardPreview} aria-hidden="true">
                              <Image alt="" fill sizes="180px" src={card.coverSrc} />
                            </span>
                          ) : (
                            <span className={styles.cardPlaceholder} aria-hidden="true"><LockKeyhole size={26} /></span>
                          )}
                          <div className={styles.cardCopy}>
                            <p>绘本 {index + 1}</p>
                            <h3>{card.title}</h3>
                          </div>
                        </div>
                        {cardEdgeParticles[index].map((particle, particleIndex) => (
                          <span
                            aria-hidden="true"
                            className={styles.goldParticle}
                            data-testid="gold-particle"
                            key={particleIndex}
                            style={{
                              "--particle-delay": `${840 + index * 90 + particle.delay}ms`,
                              "--particle-origin-x": particle.originX,
                              "--particle-origin-y": particle.originY,
                              "--particle-scale": particle.scale,
                              "--particle-x": particle.x,
                              "--particle-y": particle.y,
                            } as CSSProperties}
                          />
                        ))}
                      </button>
                    );
                  })}
                </div>

                <footer className={styles.cardDeckFooter}>
                  {battleUnlocked ? (
                    <button type="button" onClick={() => router.push(`/ai-battle?module=${selectedModule.battleModuleId}`)}>
                      <Swords aria-hidden="true" size={18} />挑战怪兽
                    </button>
                  ) : (
                    <p><LockKeyhole aria-hidden="true" size={15} />还需完成 {3 - completedStorybookCount} 本绘本才能挑战怪兽</p>
                  )}
                </footer>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
