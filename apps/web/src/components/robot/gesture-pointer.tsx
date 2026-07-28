import { ArrowDown, ArrowUp } from "lucide-react";

import styles from "./robot.module.css";

export type GestureCursor = { x: number; y: number };
export type GesturePointerMode = "pointer" | "scroll" | "scroll_up" | "scroll_down";

export type GesturePointerProps = {
  cursor: GestureCursor | null;
  progress: number;
  mode?: GesturePointerMode;
};

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function GesturePointer({ cursor, progress, mode = "pointer" }: GesturePointerProps) {
  if (!cursor) return null;

  const normalizedProgress = clampUnit(progress);
  const isComplete = normalizedProgress === 1;
  const left = clampUnit(cursor.x) * 100;
  const top = clampUnit(cursor.y) * 100;

  return (
    <div className={styles.gesturePointerOverlay} data-testid="gesture-pointer-overlay">
      <div
        className={styles.gesturePointer}
        data-complete={isComplete || undefined}
        data-mode={mode}
        role="progressbar"
        aria-label="Gesture confirmation progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(normalizedProgress * 100)}
        style={{ left: `${left}%`, top: `${top}%` }}
      >
        <svg className={styles.gesturePointerRing} viewBox="0 0 48 48" aria-hidden="true">
          <circle className={styles.gesturePointerRingTrack} cx="24" cy="24" r={RING_RADIUS} />
          <circle
            className={styles.gesturePointerRingProgress}
            cx="24"
            cy="24"
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - normalizedProgress)}
          />
        </svg>
        {mode === "scroll_up" ? (
          <ArrowUp className={styles.gesturePointerScrollArrow} data-testid="gesture-pointer-scroll-arrow" aria-label="向上滚动" role="img" />
        ) : mode === "scroll_down" ? (
          <ArrowDown className={styles.gesturePointerScrollArrow} data-testid="gesture-pointer-scroll-arrow" aria-label="向下滚动" role="img" />
        ) : (
          <span className={styles.gesturePointerDot} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
