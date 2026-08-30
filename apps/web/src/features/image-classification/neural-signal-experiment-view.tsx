"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import {
  calculateNeuralSignalResult,
  DEFAULT_NEURAL_PIXELS,
  NEURAL_CONNECTIONS,
  NEURAL_PIXEL_INPUTS,
  NEURAL_SIGNAL_PRESETS,
  type NeuralPixelId,
} from "./neural-signal-experiment";
import styles from "./neural-signal-experiment.module.css";

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function NeuralSignalExperiment() {
  const [pixels, setPixels] = useState<Readonly<Record<NeuralPixelId, number>>>(DEFAULT_NEURAL_PIXELS);
  const result = useMemo(() => calculateNeuralSignalResult(pixels), [pixels]);
  const maxScore = Math.max(...result.scores.map((score) => Math.abs(score.value)), 1);

  function changePixel(pixelId: NeuralPixelId, value: number) {
    setPixels((current) => ({ ...current, [pixelId]: value }));
  }

  return (
    <section className={styles.experiment} aria-labelledby="neural-signal-experiment-title">
      <header className={styles.header}>
        <div>
          <p>星宝前向传播实验</p>
          <h3 id="neural-signal-experiment-title">像素如何穿过加权连接变成类别分数</h3>
        </div>
        <SlidersHorizontal size={21} aria-hidden="true" />
      </header>

      <div className={styles.presets} role="group" aria-label="像素输入预设">
        {Object.entries(NEURAL_SIGNAL_PRESETS).map(([id, preset]) => (
          <button key={id} type="button" onClick={() => setPixels(preset.pixels)}>{preset.label}</button>
        ))}
        <button type="button" onClick={() => setPixels(DEFAULT_NEURAL_PIXELS)}><RotateCcw size={15} aria-hidden="true" /> 重置</button>
      </div>

      <div className={styles.pipeline}>
        <section className={styles.inputs} aria-labelledby="pixel-inputs-title">
          <h4 id="pixel-inputs-title">1. 像素输入</h4>
          {NEURAL_PIXEL_INPUTS.map((pixel) => (
            <label key={pixel.id}>
              <span><strong>{pixel.label}</strong><small>{pixel.description}</small></span>
              <output htmlFor={`${pixel.id}-slider`}>{format(result.pixels[pixel.id])}</output>
              <input
                id={`${pixel.id}-slider`}
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={result.pixels[pixel.id]}
                aria-label={`${pixel.label}强度`}
                onChange={(event) => changePixel(pixel.id, Number(event.target.value))}
              />
            </label>
          ))}
        </section>

        <section className={styles.connections} aria-labelledby="weighted-connections-title">
          <h4 id="weighted-connections-title">2. 加权连接</h4>
          <p>每条连接把像素强度乘以固定权重，再累加到对应类别。</p>
          <ul>
            {NEURAL_CONNECTIONS.map((connection) => {
              const pixel = NEURAL_PIXEL_INPUTS.find((item) => item.id === connection.pixelId)!;
              const contribution = result.pixels[connection.pixelId] * connection.weight;
              return <li key={`${connection.pixelId}-${connection.label}`}>
                <span>{pixel.label} → {connection.label}</span>
                <strong>{format(result.pixels[connection.pixelId])} × {format(connection.weight)} = {format(contribution)}</strong>
              </li>;
            })}
          </ul>
        </section>

        <section className={styles.scores} aria-labelledby="category-scores-title">
          <h4 id="category-scores-title">3. 类别分数</h4>
          {result.scores.map((score) => (
            <div key={score.label} className={styles.score} data-leading={score.label === result.prediction || undefined}>
              <span>{score.label}</span>
              <span className={styles.scoreTrack} aria-hidden="true"><span style={{ width: `${Math.abs(score.value) / maxScore * 100}%` }} /></span>
              <strong>{format(score.value)}</strong>
            </div>
          ))}
          <div className={styles.prediction} role="status" aria-label="当前分类预测" aria-live="polite">
            <span>当前最高分预测</span>
            <strong>{result.prediction}</strong>
            <p>{result.explanation}</p>
          </div>
        </section>
      </div>
    </section>
  );
}
