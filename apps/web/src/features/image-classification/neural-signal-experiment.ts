export type NeuralSignalLabel = "铅笔" | "书本";
export type NeuralPixelId = "top-edge" | "vertical-stroke" | "page-stripes";

export interface NeuralPixelInput {
  readonly id: NeuralPixelId;
  readonly label: string;
  readonly description: string;
}

export interface NeuralConnection {
  readonly pixelId: NeuralPixelId;
  readonly label: NeuralSignalLabel;
  readonly weight: number;
}

export interface NeuralSignalScore {
  readonly label: NeuralSignalLabel;
  readonly value: number;
}

export interface NeuralSignalResult {
  readonly pixels: Readonly<Record<NeuralPixelId, number>>;
  readonly scores: readonly NeuralSignalScore[];
  readonly prediction: NeuralSignalLabel;
  readonly explanation: string;
}

export const NEURAL_SIGNAL_LABELS: readonly NeuralSignalLabel[] = ["铅笔", "书本"];

export const NEURAL_PIXEL_INPUTS: readonly NeuralPixelInput[] = [
  { id: "top-edge", label: "顶部边缘像素", description: "细长物体顶部的亮暗变化。" },
  { id: "vertical-stroke", label: "竖直笔画像素", description: "图片中连续的竖直线条。" },
  { id: "page-stripes", label: "书页条纹像素", description: "封面或书页平行条纹。" },
];

export const NEURAL_CONNECTIONS: readonly NeuralConnection[] = [
  { pixelId: "top-edge", label: "铅笔", weight: 1.2 },
  { pixelId: "top-edge", label: "书本", weight: -0.3 },
  { pixelId: "vertical-stroke", label: "铅笔", weight: 1.8 },
  { pixelId: "vertical-stroke", label: "书本", weight: -0.2 },
  { pixelId: "page-stripes", label: "铅笔", weight: -0.5 },
  { pixelId: "page-stripes", label: "书本", weight: 1.9 },
];

export const NEURAL_SIGNAL_PRESETS = {
  pencil: {
    label: "竖线物体预设",
    pixels: { "top-edge": 0.9, "vertical-stroke": 0.9, "page-stripes": 0.1 },
  },
  book: {
    label: "页面封面预设",
    pixels: { "top-edge": 0.2, "vertical-stroke": 0.1, "page-stripes": 0.9 },
  },
} as const satisfies Readonly<Record<string, { label: string; pixels: Readonly<Record<NeuralPixelId, number>> }>>;

export const DEFAULT_NEURAL_PIXELS = NEURAL_SIGNAL_PRESETS.pencil.pixels;

function clampPixel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeNeuralPixels(
  value: Partial<Record<NeuralPixelId, number>>,
): Readonly<Record<NeuralPixelId, number>> {
  return Object.fromEntries(
    NEURAL_PIXEL_INPUTS.map((pixel) => [pixel.id, clampPixel(value[pixel.id] ?? 0)]),
  ) as Record<NeuralPixelId, number>;
}

export function calculateNeuralSignalResult(
  input: Partial<Record<NeuralPixelId, number>> = DEFAULT_NEURAL_PIXELS,
): NeuralSignalResult {
  const pixels = normalizeNeuralPixels(input);
  const scores = NEURAL_SIGNAL_LABELS.map((label) => ({
    label,
    value: round(NEURAL_CONNECTIONS
      .filter((connection) => connection.label === label)
      .reduce((total, connection) => total + pixels[connection.pixelId] * connection.weight, 0)),
  }));
  const [first, second] = scores;
  const prediction = first.value >= second.value ? first.label : second.label;
  const other = prediction === first.label ? second : first;
  const winner = prediction === first.label ? first : second;

  return {
    pixels,
    scores,
    prediction,
    explanation: `${winner.label} 当前分数 ${winner.value}，高于 ${other.label} 的 ${other.value}。这只是当前输入与权重计算出的预测，需要用真实标签或新证据核对。`,
  };
}
