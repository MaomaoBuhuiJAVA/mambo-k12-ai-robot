"use client";

import { useEffect, useMemo, useState } from "react";

import { AnimationControls, type AnimationSpeed } from "./animation-controls";
import {
  createBubbleSortMachine,
  nextBubbleSortFrame,
  resetBubbleSortMachine,
  type BubbleSortMachine,
} from "./bubble-sort-machine";

const INTERVAL_BY_SPEED: Record<AnimationSpeed, number> = {
  0.5: 1400,
  1: 800,
  2: 400,
};

export function BubbleSortAnimation() {
  const [state, setState] = useState<BubbleSortMachine>(() => createBubbleSortMachine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<AnimationSpeed>(1);

  const isComplete = state.sortedFrom <= 1;
  useEffect(() => {
    if (!isPlaying || isComplete) return;
    const timer = window.setInterval(() => setState(nextBubbleSortFrame), INTERVAL_BY_SPEED[speed]);
    return () => window.clearInterval(timer);
  }, [isComplete, isPlaying, speed]);

  const narration = useMemo(() => buildNarration(state), [state]);
  const comparedIndexes = [state.comparisonIndex, state.comparisonIndex + 1];

  function step() {
    setState(nextBubbleSortFrame);
  }

  function reset() {
    setIsPlaying(false);
    setState(resetBubbleSortMachine);
  }

  return (
    <section className="teaching-animation" aria-label="冒泡排序交互动画">
      <div className="teaching-animation__heading">
        <div>
          <p className="teaching-animation__eyebrow">排序演示</p>
          <h3>让最大的数字走到右边</h3>
        </div>
        <span className="teaching-animation__status" aria-live="polite">第 {state.pass + 1} 轮</span>
      </div>

      <div className="bubble-stage" aria-label="冒泡排序数字列">
        {state.values.map((value, index) => {
          const isCompared = !isComplete && comparedIndexes.includes(index);
          const isSorted = index >= state.sortedFrom;
          return (
            <div
              className="bubble-stage__item"
              data-compared={isCompared || undefined}
              data-sorted={isSorted || undefined}
              key={`${value}-${index}`}
              aria-label={`位置 ${index + 1}，数字 ${value}${isCompared ? "，正在比较" : ""}${isSorted ? "，已就位" : ""}`}
            >
              {value}
            </div>
          );
        })}
      </div>

      <div className="teaching-animation__narration" aria-live="polite">
        <strong>{narration.title}</strong>
        <p>{narration.detail}</p>
      </div>
      <dl className="teaching-animation__metrics" aria-label="排序统计">
        <div><dt>比较</dt><dd>{state.comparisons}</dd></div>
        <div><dt>交换</dt><dd>{state.swaps}</dd></div>
        <div><dt>已就位</dt><dd>{state.values.length - state.sortedFrom}</dd></div>
      </dl>
      <p className="teaching-animation__hint">从相邻两个数字开始。左边更大时交换，一轮结束后最大数会留在最右边。</p>
      <AnimationControls
        isPlaying={isPlaying}
        speed={speed}
        label="冒泡排序动画控制"
        onTogglePlay={() => setIsPlaying((value) => !value)}
        onStep={step}
        onReset={reset}
        onSpeedChange={setSpeed}
      />
    </section>
  );
}

function buildNarration(state: BubbleSortMachine) {
  if (state.lastAction === "ready") {
    return { title: "比较第 1 和第 2 个数字", detail: "先看相邻的一对数字，决定是否交换位置。" };
  }
  if (state.lastAction === "complete") {
    return { title: "排序完成", detail: "每个数字都已经找到自己的位置。" };
  }

  const detail = state.lastAction === "swap" ? "左边较大，所以交换。" : "左边不大于右边，保持原位。";
  const [left, right] = state.lastCompared ?? [state.values[0], state.values[1]];
  return { title: `本次比较：${left} 和 ${right}，${state.lastAction === "swap" ? "交换" : "不交换"}`, detail };
}
