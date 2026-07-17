import type { Stage, StagePolicy } from "./domain";

const STAGE_POLICIES: Record<Stage, StagePolicy> = {
  lower_primary: {
    stage: "lower_primary",
    tone: "story",
    explanationDepth: "concrete",
    maxAnswerChars: 220,
    preferredModes: ["voice", "storybook", "game"],
    codeLevel: "none",
  },
  upper_primary: {
    stage: "upper_primary",
    tone: "encouraging",
    explanationDepth: "guided",
    maxAnswerChars: 420,
    preferredModes: ["game", "diagram", "quiz"],
    codeLevel: "blocks",
  },
  middle_school: {
    stage: "middle_school",
    tone: "coach",
    explanationDepth: "conceptual",
    maxAnswerChars: 700,
    preferredModes: ["diagram", "quiz", "code"],
    codeLevel: "guided",
  },
  high_school: {
    stage: "high_school",
    tone: "project",
    explanationDepth: "rigorous",
    maxAnswerChars: 1100,
    preferredModes: ["code", "project", "diagram"],
    codeLevel: "independent",
  },
};

export function getStagePolicy(stage: Stage): StagePolicy {
  const policy = STAGE_POLICIES[stage];
  return { ...policy, preferredModes: [...policy.preferredModes] };
}
