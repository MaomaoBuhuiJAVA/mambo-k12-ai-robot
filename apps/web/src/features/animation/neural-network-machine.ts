export type NeuralLayer = "none" | "input" | "hidden" | "output" | "complete";

export interface NeuralNetworkMachine {
  readonly frameIndex: number;
  readonly activeLayer: NeuralLayer;
  readonly pixels: readonly number[];
  readonly features: readonly string[];
  readonly probabilities: readonly { label: string; value: number }[];
}

const PROBABILITIES = [
  { label: "猫", value: 0.82 },
  { label: "狗", value: 0.13 },
  { label: "鸟", value: 0.05 },
] as const;

export function createNeuralNetworkMachine(): NeuralNetworkMachine {
  return {
    frameIndex: 0,
    activeLayer: "none",
    pixels: [0.15, 0.72, 0.9, 0.36, 0.58, 0.21, 0.81, 0.44, 0.66],
    features: ["耳朵形状", "眼睛位置", "胡须线条"],
    probabilities: PROBABILITIES,
  };
}

export function nextNeuralNetworkFrame(
  state: NeuralNetworkMachine,
): NeuralNetworkMachine {
  const layers: readonly NeuralLayer[] = ["input", "hidden", "output", "complete"];
  const nextIndex = Math.min(state.frameIndex + 1, layers.length);
  return {
    ...state,
    frameIndex: nextIndex,
    activeLayer: layers[nextIndex - 1] ?? "complete",
  };
}

export function resetNeuralNetworkMachine(_state?: NeuralNetworkMachine): NeuralNetworkMachine {
  void _state;
  return createNeuralNetworkMachine();
}
