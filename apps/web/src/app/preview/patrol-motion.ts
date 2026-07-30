export const PATROL_CYCLE_MS = 17_280;

const OUTBOUND_START_MS = PATROL_CYCLE_MS * 0.25;
const OUTBOUND_END_MS = PATROL_CYCLE_MS * 0.375;
const RETURN_START_MS = PATROL_CYCLE_MS * 0.5625;
const RETURN_END_MS = PATROL_CYCLE_MS * 0.6875;

export type PatrolMotionState = {
  state: "idle" | "moving";
  direction: "left" | "right";
};

function resolvePatrolPhase(elapsedMs: number): number {
  return ((elapsedMs % PATROL_CYCLE_MS) + PATROL_CYCLE_MS) % PATROL_CYCLE_MS;
}

export function resolvePatrolMotionState(elapsedMs: number): PatrolMotionState {
  const phase = resolvePatrolPhase(elapsedMs);

  if (phase >= OUTBOUND_START_MS && phase < OUTBOUND_END_MS) {
    return { state: "moving", direction: "right" };
  }

  if (phase >= RETURN_START_MS && phase < RETURN_END_MS) {
    return { state: "moving", direction: "left" };
  }

  return { state: "idle", direction: "right" };
}
