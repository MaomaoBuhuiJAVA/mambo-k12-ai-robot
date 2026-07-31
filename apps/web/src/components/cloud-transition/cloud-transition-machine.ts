export const CLOUD_COVER_DURATION_MS = 550;
export const CLOUD_MINIMUM_HOLD_MS = 2_000;
export const CLOUD_MAXIMUM_HOLD_MS = 5_000;
export const CLOUD_REVEAL_DURATION_MS = 650;

export type CloudTransitionPhase = "idle" | "covering" | "holding" | "revealing";

export type CloudTransitionState = {
  phase: CloudTransitionPhase;
  mapReady: boolean;
  minimumHoldElapsed: boolean;
};

export type CloudTransitionEvent =
  | { type: "START" }
  | { type: "COVERED" }
  | { type: "MAP_READY" }
  | { type: "MINIMUM_HOLD_ELAPSED" }
  | { type: "MAXIMUM_HOLD_ELAPSED" }
  | { type: "REVEAL_FINISHED" };

export const initialCloudTransitionState: CloudTransitionState = {
  phase: "idle",
  mapReady: false,
  minimumHoldElapsed: false,
};

function revealWhenReady(state: CloudTransitionState): CloudTransitionState {
  return state.mapReady && state.minimumHoldElapsed
    ? { ...state, phase: "revealing" }
    : state;
}

export function transitionCloudState(
  state: CloudTransitionState,
  event: CloudTransitionEvent,
): CloudTransitionState {
  switch (event.type) {
    case "START":
      return state.phase === "idle"
        ? { phase: "covering", mapReady: false, minimumHoldElapsed: false }
        : state;
    case "COVERED":
      return state.phase === "covering"
        ? { phase: "holding", mapReady: false, minimumHoldElapsed: false }
        : state;
    case "MAP_READY":
      return state.phase === "holding"
        ? revealWhenReady({ ...state, mapReady: true })
        : state;
    case "MINIMUM_HOLD_ELAPSED":
      return state.phase === "holding"
        ? revealWhenReady({ ...state, minimumHoldElapsed: true })
        : state;
    case "MAXIMUM_HOLD_ELAPSED":
      return state.phase === "holding"
        ? { ...state, phase: "revealing" }
        : state;
    case "REVEAL_FINISHED":
      return state.phase === "revealing" ? initialCloudTransitionState : state;
  }
}
