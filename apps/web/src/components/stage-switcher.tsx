"use client";

import type { Stage } from "@/lib/domain";

export const STAGE_OPTIONS: ReadonlyArray<{
  value: Stage;
  label: string;
}> = [
  { value: "lower_primary", label: "小学低段" },
  { value: "upper_primary", label: "小学高段" },
  { value: "middle_school", label: "初中" },
  { value: "high_school", label: "高中" },
];

interface StageSwitcherProps {
  selectedStage: Stage;
  onStageChange: (stage: Stage) => void;
}

export function StageSwitcher({
  selectedStage,
  onStageChange,
}: StageSwitcherProps) {
  return (
    <div className="stage-switcher" aria-label="选择学习阶段">
      <span className="stage-switcher__label">学习阶段</span>
      <div className="stage-switcher__options">
        {STAGE_OPTIONS.map((option) => (
          <button
            className="stage-switcher__button"
            type="button"
            aria-pressed={selectedStage === option.value}
            key={option.value}
            onClick={() => onStageChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
