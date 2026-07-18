export type GestureName = "open_palm" | "fist" | "none";

export type GestureObservation = {
  gesture: GestureName;
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
};

export type GestureEvent =
  | { type: "cursor_move"; x: number; y: number }
  | { type: "progress"; value: number }
  | { type: "click"; x: number; y: number }
  | { type: "tracking_lost" };

type GestureOptions = {
  dwellMs?: number;
  smoothing?: number;
  confidenceThreshold?: number;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export class GestureController {
  private readonly dwellMs: number;
  private readonly smoothing: number;
  private readonly confidenceThreshold: number;
  private cursor: { x: number; y: number } | null = null;
  private fistStartedAt: number | null = null;
  private clicked = false;
  private tracking = false;

  constructor(options: GestureOptions = {}) {
    this.dwellMs = Math.max(1, options.dwellMs ?? 1200);
    this.smoothing = clamp(options.smoothing ?? 0.35);
    this.confidenceThreshold = clamp(options.confidenceThreshold ?? 0.55);
  }

  update(observation: GestureObservation): GestureEvent[] {
    const events: GestureEvent[] = [];
    const valid = observation.confidence >= this.confidenceThreshold && observation.gesture !== "none";
    if (!valid) {
      if (this.tracking) events.push({ type: "tracking_lost" });
      this.tracking = false;
      this.fistStartedAt = null;
      this.clicked = false;
      if (this.cursor !== null) events.push({ type: "progress", value: 0 });
      return events;
    }

    this.tracking = true;
    const point = { x: clamp(observation.x), y: clamp(observation.y) };
    if (observation.gesture === "open_palm") {
      if (!this.cursor) {
        this.cursor = point;
      } else {
        this.cursor = {
          x: this.cursor.x + (point.x - this.cursor.x) * this.smoothing,
          y: this.cursor.y + (point.y - this.cursor.y) * this.smoothing,
        };
      }
      this.fistStartedAt = null;
      this.clicked = false;
      events.push({ type: "cursor_move", x: this.cursor.x, y: this.cursor.y });
      events.push({ type: "progress", value: 0 });
      return events;
    }

    if (!this.cursor) this.cursor = point;

    if (this.fistStartedAt === null) {
      this.fistStartedAt = observation.timestamp;
      events.push({ type: "progress", value: 0 });
      return events;
    }

    if (this.clicked) return events;
    const progress = clamp((observation.timestamp - this.fistStartedAt) / this.dwellMs);
    events.push({ type: "progress", value: progress });
    if (progress >= 1 && this.cursor) {
      this.clicked = true;
      events.push({ type: "click", x: this.cursor.x, y: this.cursor.y });
    }
    return events;
  }

  reset(): void {
    this.cursor = null;
    this.fistStartedAt = null;
    this.clicked = false;
    this.tracking = false;
  }
}
