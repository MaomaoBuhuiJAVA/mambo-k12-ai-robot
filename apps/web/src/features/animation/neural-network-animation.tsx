"use client";

import { useEffect, useState } from "react";

import { AnimationControls, type AnimationSpeed } from "./animation-controls";
import {
  createNeuralNetworkMachine,
  nextNeuralNetworkFrame,
  resetNeuralNetworkMachine,
  type NeuralLayer,
  type NeuralNetworkMachine,
} from "./neural-network-machine";

const INTERVAL_BY_SPEED: Record<AnimationSpeed, number> = { 0.5: 1400, 1: 800, 2: 400 };

export function NeuralNetworkAnimation() {
  const [state, setState] = useState<NeuralNetworkMachine>(() => createNeuralNetworkMachine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<AnimationSpeed>(1);
  const isComplete = state.activeLayer === "complete";

  useEffect(() => {
    if (!isPlaying || isComplete) return;
    const timer = window.setInterval(() => setState(nextNeuralNetworkFrame), INTERVAL_BY_SPEED[speed]);
    return () => window.clearInterval(timer);
  }, [isComplete, isPlaying, speed]);

  function reset() {
    setIsPlaying(false);
    setState(resetNeuralNetworkMachine);
  }

  return (
    <section className="teaching-animation" aria-label="神经网络交互动画">
      <div className="teaching-animation__heading">
        <div>
          <p className="teaching-animation__eyebrow">图像分类演示</p>
          <h3>像素怎样变成分类答案</h3>
        </div>
        <span className="teaching-animation__status" aria-live="polite">{layerLabel(state.activeLayer)}</span>
      </div>

      <div className="network-stage" aria-label="神经网络逐层计算图">
        <NetworkColumn title="第 1 层：输入像素" active={state.activeLayer === "input"} lit={state.frameIndex >= 1}>
          <div className="pixel-grid">{state.pixels.map((pixel, index) => <span key={index} style={{ opacity: pixel }} />)}</div>
        </NetworkColumn>
        <span className="network-stage__arrow" aria-hidden="true">→</span>
        <NetworkColumn title="第 2 层：隐藏特征" active={state.activeLayer === "hidden"} lit={state.frameIndex >= 2}>
          {state.features.map((feature) => <span className="feature-node" key={feature}>{feature}</span>)}
        </NetworkColumn>
        <span className="network-stage__arrow" aria-hidden="true">→</span>
        <NetworkColumn title="第 3 层：类别概率" active={state.activeLayer === "output"} lit={state.frameIndex >= 3}>
          {state.probabilities.map((probability) => <span className="probability-node" key={probability.label}>{probability.label} <b>{Math.round(probability.value * 100)}%</b></span>)}
        </NetworkColumn>
      </div>

      <div className="teaching-animation__narration" aria-live="polite">
        <strong>{narrationFor(state.activeLayer)}</strong>
        <p>这是一张简化的示意图：每一层只把上一层的信息整理成更容易判断的线索。</p>
      </div>
      <p className="teaching-animation__hint">把图像想成许多明暗小格子。网络先看格子，再找线索，最后比较每一种类别的可能性。</p>
      <AnimationControls
        isPlaying={isPlaying}
        speed={speed}
        label="神经网络动画控制"
        onTogglePlay={() => setIsPlaying((value) => !value)}
        onStep={() => setState(nextNeuralNetworkFrame)}
        onReset={reset}
        onSpeedChange={setSpeed}
      />
    </section>
  );
}

function NetworkColumn({ title, active, lit, children }: { title: string; active: boolean; lit: boolean; children: React.ReactNode }) {
  return <div className="network-column" data-active={active || undefined} data-lit={lit || undefined}><h4>{title}</h4><div className="network-column__nodes">{children}</div></div>;
}

function layerLabel(layer: NeuralLayer) {
  return layer === "none" ? "准备开始" : layer === "complete" ? "预测完成" : `正在点亮：${layer === "input" ? "输入" : layer === "hidden" ? "特征" : "类别"}`;
}

function narrationFor(layer: NeuralLayer) {
  if (layer === "input") return "第 1 层：输入像素";
  if (layer === "hidden") return "第 2 层：寻找有用线索";
  if (layer === "output") return "第 3 层：比较类别概率";
  if (layer === "complete") return "预测完成：最像一只猫";
  return "按单步，看看信息如何一层层传递";
}
