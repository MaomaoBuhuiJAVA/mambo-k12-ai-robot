export const CLOUD_COVER_DURATION_MS = 550;
export const CLOUD_MAXIMUM_HOLD_MS = 5_000;
export const CLOUD_REVEAL_DURATION_MS = 650;

export type CloudTransitionPhase = "idle" | "covering" | "holding" | "revealing";
export type CloudTransitionDestination = "map" | "home";

export type CloudTransitionState = {
  phase: CloudTransitionPhase;
  destination: CloudTransitionDestination | null;
  pageReady: boolean;
};

export type CloudTransitionEvent =
  | { type: "START"; destination: CloudTransitionDestination }
  | { type: "COVERED" }
  | { type: "PAGE_READY"; destination: CloudTransitionDestination }
  | { type: "MAXIMUM_HOLD_ELAPSED" }
  | { type: "REVEAL_FINISHED" };

export const initialCloudTransitionState: CloudTransitionState = {
  phase: "idle",
  destination: null,
  pageReady: false,
};

export function transitionCloudState(
  state: CloudTransitionState,
  event: CloudTransitionEvent,
): CloudTransitionState {
  switch (event.type) {
    case "START":
      return state.phase === "idle"
        ? { phase: "covering", destination: event.destination, pageReady: false }
        : state;
    case "COVERED":
      return state.phase === "covering"
        ? { ...state, phase: "holding", pageReady: false }
        : state;
    case "PAGE_READY":
      return state.phase === "holding" && state.destination === event.destination
        ? { ...state, phase: "revealing", pageReady: true }
        : state;
    case "MAXIMUM_HOLD_ELAPSED":
      return state.phase === "holding"
        ? { ...state, phase: "revealing" }
        : state;
    case "REVEAL_FINISHED":
      return state.phase === "revealing" ? initialCloudTransitionState : state;
  }
}
