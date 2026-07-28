export type GestureName = "open_palm" | "fist" | "v_sign" | "pinky_up" | "thumb_up" | "none";

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
  | { type: "scroll"; deltaY: number }
  | { type: "navigate"; direction: "previous" | "next" }
  | { type: "tracking_lost" };

type GestureOptions = {
  dwellMs?: number;
  smoothing?: number;
  confidenceThreshold?: number;
  scrollVelocity?: number;
  navigationReleaseMs?: number;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const V_SIGN_STABLE_MS = 200;
const V_SIGN_UPPER_ZONE = 0.4;
const V_SIGN_LOWER_ZONE = 0.6;
const NAVIGATION_DWELL_MS = 350;
const DEFAULT_SCROLL_VELOCITY = 0.3;
const MAX_SCROLL_PAUSE_MS = 250;
const DEFAULT_NAVIGATION_RELEASE_MS = 120;

type NavigationGesture = "pinky_up" | "thumb_up";

export class GestureController {
  private readonly dwellMs: number;
  private readonly smoothing: number;
  private readonly confidenceThreshold: number;
  private readonly scrollVelocity: number;
  private readonly navigationReleaseMs: number;
  private cursor: { x: number; y: number } | null = null;
  private fistStartedAt: number | null = null;
  private clicked = false;
  private tracking = false;
  private requiresOpenPalm = true;
  private vSignStartedAt: number | null = null;
  private lastVSignTimestamp: number | null = null;
  private navigationGesture: NavigationGesture | null = null;
  private navigationStartedAt: number | null = null;
  private navigationLocked = false;
  private navigationReleaseStartedAt: number | null = null;

  constructor(options: GestureOptions = {}) {
    this.dwellMs = Math.max(1, options.dwellMs ?? 1200);
    this.smoothing = clamp(options.smoothing ?? 0.35);
    this.confidenceThreshold = clamp(options.confidenceThreshold ?? 0.55);
    this.scrollVelocity = Math.max(0, options.scrollVelocity ?? DEFAULT_SCROLL_VELOCITY);
    this.navigationReleaseMs = Math.max(1, options.navigationReleaseMs ?? DEFAULT_NAVIGATION_RELEASE_MS);
  }

  update(observation: GestureObservation): GestureEvent[] {
    const events: GestureEvent[] = [];
    const valid = observation.confidence >= this.confidenceThreshold && observation.gesture !== "none";
    if (!valid) {
      if (this.tracking) {
        events.push({ type: "tracking_lost" });
        this.requiresOpenPalm = true;
      }
      this.tracking = false;
      this.fistStartedAt = null;
      this.clicked = false;
      if (this.cursor !== null) events.push({ type: "progress", value: 0 });
      this.cursor = null;
      this.resetVSign();
      this.cancelNavigationDwell();
      this.cancelNavigationRelease();
      return events;
    }

    this.tracking = true;
    const point = { x: clamp(observation.x), y: clamp(observation.y) };
    if (observation.gesture === "open_palm") {
      this.resetVSign();
      this.updateNavigationRelease(observation.timestamp);
      this.requiresOpenPalm = false;
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

    if (observation.gesture === "v_sign") {
      this.clearFistDwell(events);
      this.cancelNavigationDwell();
      this.cancelNavigationRelease();
      this.requiresOpenPalm = true;
      return this.updateVSign(point, observation.timestamp, events);
    }

    if (observation.gesture === "pinky_up" || observation.gesture === "thumb_up") {
      this.clearFistDwell(events);
      this.resetVSign();
      this.cancelNavigationRelease();
      return this.updateNavigation(observation.gesture, observation.timestamp, events);
    }

    this.resetVSign();
    this.cancelNavigationDwell();
    this.cancelNavigationRelease();
    if (this.requiresOpenPalm) return events;
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
    this.requiresOpenPalm = true;
    this.resetVSign();
    this.releaseNavigation();
  }

  private clearFistDwell(events: GestureEvent[]): void {
    const hadFistDwell = this.fistStartedAt !== null || this.clicked;
    this.fistStartedAt = null;
    this.clicked = false;
    if (hadFistDwell) events.push({ type: "progress", value: 0 });
  }

  private resetVSign(): void {
    this.vSignStartedAt = null;
    this.lastVSignTimestamp = null;
  }

  private updateVSign(point: { x: number; y: number }, timestamp: number, events: GestureEvent[]): GestureEvent[] {
    if (this.vSignStartedAt === null) {
      this.vSignStartedAt = timestamp;
      this.lastVSignTimestamp = timestamp;
      return events;
    }

    const previousTimestamp = this.lastVSignTimestamp ?? timestamp;
    this.lastVSignTimestamp = timestamp;
    if (timestamp - this.vSignStartedAt <= V_SIGN_STABLE_MS) return events;

    const elapsedMs = Math.max(0, timestamp - previousTimestamp);
    if (
      elapsedMs === 0
      || elapsedMs > MAX_SCROLL_PAUSE_MS
      || (point.y >= V_SIGN_UPPER_ZONE && point.y <= V_SIGN_LOWER_ZONE)
    ) return events;

    const direction = point.y < V_SIGN_UPPER_ZONE ? -1 : 1;
    events.push({ type: "scroll", deltaY: direction * this.scrollVelocity * elapsedMs / 1_000 });
    return events;
  }

  private releaseNavigation(): void {
    this.cancelNavigationDwell();
    this.navigationLocked = false;
    this.cancelNavigationRelease();
  }

  private cancelNavigationDwell(): void {
    this.navigationGesture = null;
    this.navigationStartedAt = null;
  }

  private cancelNavigationRelease(): void {
    this.navigationReleaseStartedAt = null;
  }

  private updateNavigationRelease(timestamp: number): void {
    if (!this.navigationLocked) {
      this.cancelNavigationDwell();
      return;
    }

    if (this.navigationReleaseStartedAt === null) {
      this.navigationReleaseStartedAt = timestamp;
      return;
    }

    if (timestamp - this.navigationReleaseStartedAt >= this.navigationReleaseMs) this.releaseNavigation();
  }

  private updateNavigation(gesture: NavigationGesture, timestamp: number, events: GestureEvent[]): GestureEvent[] {
    if (this.navigationLocked) return events;

    if (this.navigationGesture !== gesture || this.navigationStartedAt === null) {
      this.navigationGesture = gesture;
      this.navigationStartedAt = timestamp;
      return events;
    }

    if (timestamp - this.navigationStartedAt < NAVIGATION_DWELL_MS) return events;

    this.navigationLocked = true;
    events.push({ type: "navigate", direction: gesture === "pinky_up" ? "previous" : "next" });
    return events;
  }
}
