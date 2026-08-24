import type { ExperimentMode } from "@/lib/domain";

export const LAB_EXPERIMENT_MODES = [
  "guided",
  "independent",
  "research",
  "project",
] as const satisfies readonly ExperimentMode[];

export function parseLabExperimentMode(value: string | undefined): ExperimentMode | undefined {
  return LAB_EXPERIMENT_MODES.find((mode) => mode === value);
}
