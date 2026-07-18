import type { GestureName, GestureObservation } from "./gesture-controller";

export type Landmark = { x: number; y: number; z?: number };

type LandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Landmark[][] };
  close: () => void;
};

type HandObservationHandler = (observation: GestureObservation) => void;

const FINGER_CHAINS = [
  [8, 6, 5],
  [12, 10, 9],
  [16, 14, 13],
  [20, 18, 17],
] as const;

const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

function confidenceFor(extended: number, folded: number): number {
  if (extended >= 3) return Math.min(0.98, 0.62 + extended * 0.09);
  if (folded >= 3) return Math.min(0.98, 0.62 + folded * 0.09);
  return 0.35;
}

export function classifyHandLandmarks(landmarks: Landmark[]): { gesture: GestureName; confidence: number } {
  if (landmarks.length < 21) return { gesture: "none", confidence: 0 };
  const wrist = landmarks[0];
  let extended = 0;
  let folded = 0;
  for (const [tipIndex, pipIndex] of FINGER_CHAINS) {
    const tipDistance = distance(landmarks[tipIndex], wrist);
    const pipDistance = distance(landmarks[pipIndex], wrist);
    if (tipDistance > pipDistance * 1.12) extended += 1;
    if (tipDistance < pipDistance * 1.02) folded += 1;
  }
  if (extended >= 3) return { gesture: "open_palm", confidence: confidenceFor(extended, folded) };
  if (folded >= 3) return { gesture: "fist", confidence: confidenceFor(extended, folded) };
  return { gesture: "none", confidence: confidenceFor(extended, folded) };
}

export function observationFromLandmarks(landmarkSets: Landmark[][], timestamp: number): GestureObservation {
  const landmarks = landmarkSets[0];
  if (!landmarks || landmarks.length < 21) {
    return { gesture: "none", x: 0.5, y: 0.5, confidence: 0, timestamp };
  }
  const palmIndices = [0, 5, 9, 13, 17];
  const center = palmIndices.reduce(
    (total, index) => ({ x: total.x + landmarks[index].x / palmIndices.length, y: total.y + landmarks[index].y / palmIndices.length }),
    { x: 0, y: 0 },
  );
  const classification = classifyHandLandmarks(landmarks);
  return {
    gesture: classification.gesture,
    x: Math.min(1, Math.max(0, 1 - center.x)),
    y: Math.min(1, Math.max(0, center.y)),
    confidence: classification.confidence,
    timestamp,
  };
}

export const HAND_LANDMARK_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
export const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

export class BrowserHandTracker {
  private animationFrame: number | null = null;
  private running = false;

  constructor(
    private readonly landmarker: LandmarkerLike,
    private readonly video: HTMLVideoElement,
    private readonly onObservation: HandObservationHandler,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    const detect = () => {
      if (!this.running) return;
      if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const timestamp = performance.now();
        const result = this.landmarker.detectForVideo(this.video, timestamp);
        this.onObservation(observationFromLandmarks(result.landmarks ?? [], timestamp));
      }
      this.animationFrame = requestAnimationFrame(detect);
    };
    this.animationFrame = requestAnimationFrame(detect);
  }

  stop(): void {
    this.running = false;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.landmarker.close();
  }
}

export async function createBrowserHandTracker(
  video: HTMLVideoElement,
  onObservation: HandObservationHandler,
): Promise<BrowserHandTracker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_LANDMARK_MODEL_URL },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });
  return new BrowserHandTracker(landmarker, video, onObservation);
}
