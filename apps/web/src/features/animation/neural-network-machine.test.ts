import { describe, expect, it } from "vitest";

import {
  createNeuralNetworkMachine,
  nextNeuralNetworkFrame,
  resetNeuralNetworkMachine,
} from "./neural-network-machine";

describe("neural-network animation machine", () => {
  it("lights input, hidden features, then class probabilities in a fixed order", () => {
    let state = createNeuralNetworkMachine();

    state = nextNeuralNetworkFrame(state);
    expect(state.activeLayer).toBe("input");
    expect(state.frameIndex).toBe(1);

    state = nextNeuralNetworkFrame(state);
    expect(state.activeLayer).toBe("hidden");

    state = nextNeuralNetworkFrame(state);
    expect(state.activeLayer).toBe("output");
    expect(state.probabilities).toEqual([
      { label: "猫", value: 0.82 },
      { label: "狗", value: 0.13 },
      { label: "鸟", value: 0.05 },
    ]);
  });

  it("resets the visualization to its initial, unlit state", () => {
    const initial = createNeuralNetworkMachine();
    const progressed = nextNeuralNetworkFrame(initial);

    expect(resetNeuralNetworkMachine(progressed)).toEqual(initial);
  });
});
