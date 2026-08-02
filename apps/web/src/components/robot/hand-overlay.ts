import type { GestureName } from "./gesture-controller";
import type { Landmark } from "./hand-tracker";

export type HandOverlayFrame = {
  landmarks: Landmark[];
  observation: {
    gesture: GestureName;
    confidence: number;
  };
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
] as const;

export function handOverlayGeometry(landmarks: Landmark[]): { points: Landmark[]; connections: readonly (readonly [number, number])[] } {
  if (landmarks.length < 21) return { points: [], connections: [] };
  return { points: landmarks, connections: HAND_CONNECTIONS };
}

function labelFor(gesture: GestureName, hasHand: boolean): string {
  if (!hasHand) return "未检测到手";
  if (gesture === "open_palm") return "张开手掌";
  if (gesture === "fist") return "握拳确认";
  return "识别到手";
}

export function clearHandOverlay(canvas: HTMLCanvasElement | null): void {
  const context = canvas?.getContext("2d");
  if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawHandOverlay(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  frame: HandOverlayFrame,
): void {
  if (!canvas || video.videoWidth === 0 || video.videoHeight === 0) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return;

  const geometry = handOverlayGeometry(frame.landmarks);
  const color = frame.observation.gesture === "fist" ? "#f4c84a" : "#36c6ac";
  const toX = (point: Landmark) => (1 - point.x) * canvas.width;
  const toY = (point: Landmark) => point.y * canvas.height;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(23, 32, 30, 0.72)";
  context.fillRect(8, 8, 104, 24);
  context.fillStyle = "#ffffff";
  context.font = "600 14px sans-serif";
  context.fillText(labelFor(frame.observation.gesture, geometry.points.length > 0), 14, 24);

  if (geometry.points.length === 0) return;

  context.strokeStyle = color;
  context.lineWidth = Math.max(2, canvas.width / 240);
  context.lineCap = "round";
  for (const [from, to] of geometry.connections) {
    context.beginPath();
    context.moveTo(toX(geometry.points[from]), toY(geometry.points[from]));
    context.lineTo(toX(geometry.points[to]), toY(geometry.points[to]));
    context.stroke();
  }

  const radius = Math.max(3, canvas.width / 160);
  for (const point of geometry.points) {
    context.beginPath();
    context.fillStyle = "#ffffff";
    context.arc(toX(point), toY(point), radius, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = Math.max(1.5, canvas.width / 360);
    context.arc(toX(point), toY(point), radius, 0, Math.PI * 2);
    context.stroke();
  }
}
