"use client";

import { Pause, Play, RotateCcw, Sparkles, StepForward } from "lucide-react";
import { useEffect, useState } from "react";

import {
  CLASSIFICATION_FEATURES,
  FIXED_IMAGE_SAMPLE,
  createImageClassificationFrame,
  nextImageClassificationFrame,
} from "./image-classification-engine";
import styles from "./image-classification-demo.module.css";

type DemoSpeed = 0.5 | 1 | 2;

const INTERVAL_BY_SPEED: Readonly<Record<DemoSpeed, number>> = {
  0.5: 1500,
  1: 900,
  2: 450,
};

const SPEED_OPTIONS: readonly DemoSpeed[] = [0.5, 1, 2];

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function ImageClassificationDemo() {
  const [frame, setFrame] = useState(() => createImageClassificationFrame());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<DemoSpeed>(1);
  const isActivelyPlaying = isPlaying && !frame.complete;

  useEffect(() => {
    if (!isActivelyPlaying) return;
    const interval = window.setInterval(() => {
      setFrame((current) => nextImageClassificationFrame(current));
    }, INTERVAL_BY_SPEED[speed]);
    return () => window.clearInterval(interval);
  }, [isActivelyPlaying, speed]);

  function reset() {
    setIsPlaying(false);
    setFrame(createImageClassificationFrame());
  }

  function togglePlayback() {
    if (frame.complete) {
      setFrame(createImageClassificationFrame());
      setIsPlaying(true);
      return;
    }
    setIsPlaying((playing) => !playing);
  }

  return (
    <section className={styles.demo} aria-label="星宝图像分类演示">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>星宝示范：固定样本，固定计算</p>
          <h3>{frame.title}</h3>
        </div>
        <span className={styles.stepCount} aria-live="polite">{frame.index + 1} / 5</span>
      </header>

      <div className={styles.content}>
        <article className={styles.sample} aria-label="图像输入">
          <span className={styles.sampleIcon} aria-hidden="true" />
          <div>
            <p className={styles.label}>输入图片</p>
            <strong>{FIXED_IMAGE_SAMPLE.title}</strong>
            <p>{FIXED_IMAGE_SAMPLE.description}</p>
          </div>
        </article>

        <div className={styles.calculation}>
          <section className={styles.section} aria-labelledby="feature-table-title">
            <h4 id="feature-table-title">特征表</h4>
            <div className={styles.featureList}>
              {CLASSIFICATION_FEATURES.map((feature) => {
                const processed = frame.processedFeatureIds.includes(feature.id);
                return (
                  <div className={styles.featureRow} data-processed={processed} key={feature.id}>
                    <div>
                      <span className={styles.featureName}>{feature.label}</span>
                      <span className={styles.featureStatus}>{processed ? feature.description : "等待本步骤计算"}</span>
                    </div>
                    <strong className={styles.featureValue}>{formatNumber(frame.featureValues[feature.id])}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="score-table-title">
            <h4 id="score-table-title">类别分数</h4>
            <div className={styles.scoreList}>
              {frame.scores.map((score) => {
                const width = Math.min(100, Math.abs(score.value) / 5 * 100);
                return (
                  <div className={styles.scoreRow} key={score.label}>
                    <span className={styles.featureName}>{score.label}</span>
                    <span className={styles.scoreTrack} aria-hidden="true">
                      <span className={styles.scoreFill} data-negative={score.value < 0} style={{ width: `${width}%` }} />
                    </span>
                    <strong className={styles.scoreValue}>{formatNumber(score.value)}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <section className={styles.prediction} aria-label="当前预测" aria-live="polite">
        <Sparkles className={styles.predictionIcon} size={20} aria-hidden="true" />
        <div>
          <p className={styles.label}>当前预测</p>
          <h4>{frame.prediction.label ?? "等待特征"}{frame.complete ? `，领先分数占比 ${Math.round(frame.prediction.scoreShare * 100)}%` : ""}</h4>
          <p>{frame.prediction.explanation}</p>
        </div>
      </section>

      <div className={styles.caption} aria-live="polite">
        <Sparkles className={styles.captionIcon} size={19} aria-hidden="true" />
        <p>{frame.narration}</p>
      </div>

      <div className={styles.controls} aria-label="图像分类演示控制">
        <button className={styles.primary} type="button" onClick={togglePlayback}>
          {isActivelyPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {isActivelyPlaying ? "暂停" : frame.complete ? "重新播放" : "播放"}
        </button>
        <button type="button" onClick={() => setFrame((current) => nextImageClassificationFrame(current))} disabled={frame.complete}>
          <StepForward size={16} aria-hidden="true" />
          单步
        </button>
        <button type="button" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" />
          重置
        </button>
        <div className={styles.speed} role="group" aria-label="播放速度">
          <span>速度</span>
          {SPEED_OPTIONS.map((option) => (
            <button key={option} type="button" aria-pressed={speed === option} onClick={() => setSpeed(option)}>
              {option}x
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
