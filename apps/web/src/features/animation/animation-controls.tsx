"use client";

import { Pause, Play, RotateCcw, StepForward } from "lucide-react";

export type AnimationSpeed = 0.5 | 1 | 2;

interface AnimationControlsProps {
  readonly isPlaying: boolean;
  readonly speed: AnimationSpeed;
  readonly label: string;
  readonly onTogglePlay: () => void;
  readonly onStep: () => void;
  readonly onReset: () => void;
  readonly onSpeedChange: (speed: AnimationSpeed) => void;
}

export function AnimationControls({
  isPlaying,
  speed,
  label,
  onTogglePlay,
  onStep,
  onReset,
  onSpeedChange,
}: AnimationControlsProps) {
  return (
    <div className="teaching-animation__controls" role="group" aria-label={label}>
      <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? "暂停" : "播放"}>
        {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        <span>{isPlaying ? "暂停" : "播放"}</span>
      </button>
      <button type="button" onClick={onStep} aria-label="单步">
        <StepForward size={16} aria-hidden="true" />
        <span>单步</span>
      </button>
      <button type="button" onClick={onReset} aria-label="重置">
        <RotateCcw size={16} aria-hidden="true" />
        <span>重置</span>
      </button>
      <div className="teaching-animation__speed" role="group" aria-label="播放速度">
        {([0.5, 1, 2] as const).map((option) => {
          const name = option === 0.5 ? "0.5 倍速" : option === 1 ? "1 倍速" : "2 倍速";
          return (
            <button
              type="button"
              key={option}
              aria-pressed={speed === option}
              onClick={() => onSpeedChange(option)}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
