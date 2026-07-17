"use client";

import { useEffect, useMemo, useState } from "react";

import type { Stage } from "@/lib/domain";

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

export function BubbleSortAnimation({ stage = "lower_primary" }: { stage?: Stage }) {
  const [state, setState] = useState<BubbleSortMachine>(() => createBubbleSortMachine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<AnimationSpeed>(1);

  const isComplete = state.sortedFrom <= 1;
  const isActivelyPlaying = isPlaying && !isComplete;
  useEffect(() => {
    if (!isActivelyPlaying) return;
    const timer = window.setInterval(() => setState(nextBubbleSortFrame), INTERVAL_BY_SPEED[speed]);
    return () => window.clearInterval(timer);
  }, [isActivelyPlaying, speed]);

  const narration = useMemo(() => buildNarration(state, stage), [stage, state]);
  const comparedIndexes = state.lastComparedIndexes ?? [0, 1];

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
        <span className="teaching-animation__status" aria-live="polite">{isComplete ? "排序完成" : `第 ${state.pass + 1} 轮`}</span>
      </div>

      <div className="bubble-stage" aria-label="冒泡排序数字列">
        {state.values.map((value, index) => {
          const isCompared = !isComplete && comparedIndexes.includes(index);
          const isSorted = isComplete || index >= state.sortedFrom;
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
        <div><dt>已就位</dt><dd aria-label="已就位数量">{isComplete ? state.values.length : state.values.length - state.sortedFrom}</dd></div>
      </dl>
      <p className="teaching-animation__hint">{stageHint(stage)}</p>
      <AnimationControls
        isPlaying={isActivelyPlaying}
        speed={speed}
        label="冒泡排序动画控制"
        onTogglePlay={() => {
          if (isComplete) {
            setState(resetBubbleSortMachine);
            setIsPlaying(true);
            return;
          }
          setIsPlaying((value) => !value);
        }}
        onStep={step}
        onReset={reset}
        onSpeedChange={setSpeed}
      />
    </section>
  );
}

function buildNarration(state: BubbleSortMachine, stage: Stage) {
  if (state.lastAction === "ready") {
    return { title: "比较第 1 和第 2 个数字", detail: readyDetail(stage) };
  }
  if (state.lastAction === "complete") {
    return { title: "排序完成", detail: "每个数字都已经找到自己的位置。" };
  }

  const detail = comparisonDetail(stage, state.lastAction === "swap");
  const [left, right] = state.lastCompared ?? [state.values[0], state.values[1]];
  return { title: `本次比较：${left} 和 ${right}，${state.lastAction === "swap" ? "交换" : "不交换"}`, detail };
}

function readyDetail(stage: Stage): string {
  if (stage === "lower_primary") return "先看相邻的两个数字泡泡，左边更大就交换。";
  if (stage === "upper_primary") return "先应用相邻比较规则，再记录这一对是否发生交换。";
  if (stage === "middle_school") return "追踪当前比较索引和数组状态，说明交换怎样改变后续数据流。";
  return "检查循环边界与比较区间，并记录本轮尚未就位的参数范围。";
}

function comparisonDetail(stage: Stage, swapped: boolean): string {
  if (stage === "lower_primary") return swapped ? "左边泡泡更大，交换位置。" : "顺序正确，泡泡留在原位。";
  if (stage === "upper_primary") return swapped ? "符合“左大右小就交换”的规则。" : "不满足交换条件，继续检查下一对。";
  if (stage === "middle_school") return swapped ? "条件为真，两个数组元素交换，比较索引继续右移。" : "条件为假，数组状态不变，数据流进入下一次比较。";
  return swapped ? "比较分支触发交换；该操作保持已排序区间之外的不变式。" : "比较分支不交换；当前顺序满足升序不变式。";
}

function stageHint(stage: Stage): string {
  if (stage === "lower_primary") return "一次只看两个邻居。每轮把最大的数字泡泡送到右边。";
  if (stage === "upper_primary") return "规则：比较相邻项，左边更大就交换；每轮可少检查一个已就位位置。";
  if (stage === "middle_school") return "观察比较索引、数组数据流和交换原因；一轮结束后更新未排序区间。";
  return "标准冒泡排序的时间复杂度为 O(n²)；循环边界每轮收缩，并可用无交换条件提前结束。";
}
