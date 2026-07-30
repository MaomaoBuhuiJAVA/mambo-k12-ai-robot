"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";

import styles from "./page.module.css";
import regionLayout from "./region-layout.json";

type MapRegionId = "forest" | "castle" | "technology" | "desert" | "volcano";

type MapRegion = {
  id: MapRegionId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  path: string;
};

type LearningCard = {
  eyebrow: string;
  title: string;
};

const mapWidth = regionLayout.mapWidth;
const mapHeight = regionLayout.mapHeight;
const glowPadding = 80;

const regionLabels: Record<MapRegionId, string> = {
  forest: "森林热点",
  castle: "城堡热点",
  technology: "科技岛热点",
  desert: "沙漠热点",
  volcano: "火山热点",
};

const regionNames: Record<MapRegionId, string> = {
  forest: "森林",
  castle: "城堡",
  technology: "科技岛",
  desert: "沙漠",
  volcano: "火山",
};

const learningCards: Record<MapRegionId, readonly LearningCard[]> = {
  forest: [
    { eyebrow: "故事", title: "绘本漫游" },
    { eyebrow: "观察", title: "自然任务" },
    { eyebrow: "互动", title: "问答挑战" },
  ],
  castle: [
    { eyebrow: "机关", title: "逻辑探索" },
    { eyebrow: "关卡", title: "故事任务" },
    { eyebrow: "创造", title: "创意工坊" },
  ],
  technology: [
    { eyebrow: "实验", title: "AI实验" },
    { eyebrow: "装置", title: "智能装置" },
    { eyebrow: "未来", title: "未来任务" },
  ],
  desert: [
    { eyebrow: "遗迹", title: "解谜探险" },
    { eyebrow: "文明", title: "沙海故事" },
    { eyebrow: "发现", title: "探索挑战" },
  ],
  volcano: [
    { eyebrow: "实验", title: "火山观察" },
    { eyebrow: "能量", title: "动力任务" },
    { eyebrow: "安全", title: "防护挑战" },
  ],
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

function regionAsset(id: MapRegionId, suffix: "mask" | "zoom") {
  return `/assets/learning-map/primary-regions/${id}-${suffix}.png`;
}

export default function LearningMapPage() {
  const [activeRegion, setActiveRegion] = useState<MapRegionId | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<MapRegionId | null>(null);
  const [deckLaunchKey, setDeckLaunchKey] = useState(0);

  function selectRegion(id: MapRegionId) {
    setActiveRegion(id);
    setSelectedRegion(id);
    setDeckLaunchKey((current) => current + 1);
  }

  function dismissDeck() {
    setActiveRegion(null);
    setSelectedRegion(null);
  }

  return (
    <main className={styles.page}>
      <section className={styles.mapSection} aria-labelledby="learning-map-title">
        <div className={styles.heading}>
          <p>星宝世界</p>
          <h1 id="learning-map-title">小学学习地图</h1>
        </div>

        <div className={styles.mapStage}>
          <Image
            className={styles.mapArtwork}
            src="/assets/learning-map/starbao-learning-islands.png"
            alt="小学学习地图"
            width={mapWidth}
            height={mapHeight}
            priority
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

          {selectedRegion ? (
            <section
              aria-label={`${regionNames[selectedRegion]}学习卡片`}
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

              <div className={styles.cardDeckCards}>
                {learningCards[selectedRegion].map((card, index) => (
                  <article
                    className={styles.learningCard}
                    data-testid="learning-card"
                    key={card.title}
                    style={{ "--card-index": index } as CSSProperties}
                  >
                    <div className={styles.cardFace}>
                      <span className={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</span>
                      <p>{card.eyebrow}</p>
                      <h2>{card.title}</h2>
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
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
