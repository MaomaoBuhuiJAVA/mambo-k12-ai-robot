import { describe, expect, it } from "vitest";

import type { Stage } from "./domain";
import { getStagePolicy } from "./stage-policy";

const stages = [
  "lower_primary",
  "upper_primary",
  "middle_school",
  "high_school",
] as const satisfies readonly Stage[];

describe("getStagePolicy", () => {
  it("uses short, story-led interactions for lower primary students", () => {
    expect(getStagePolicy("lower_primary")).toMatchObject({
      tone: "story",
      maxAnswerChars: 220,
      preferredModes: ["voice", "storybook", "game"],
    });
  });

  it("defines a materially different policy for every stage", () => {
    const policies = stages.map((stage) => getStagePolicy(stage));

    expect(new Set(policies.map((policy) => JSON.stringify(policy))).size).toBe(
      stages.length,
    );
    expect(policies.map((policy) => policy.stage)).toEqual(stages);
  });

  it("favors code and project work for high school students", () => {
    const policy = getStagePolicy("high_school");

    expect(policy.tone).toBe("project");
    expect(policy.preferredModes).toEqual(
      expect.arrayContaining(["code", "project"]),
    );
    expect(policy.codeLevel).toBe("independent");
  });
});
