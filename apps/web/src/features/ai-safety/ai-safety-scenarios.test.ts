import { describe, expect, it } from "vitest";

import { AI_SAFETY_SCENARIOS, isSafeScenarioResponse } from "./ai-safety-scenarios";

describe("AI safety scenarios", () => {
  it("covers concrete privacy, authorization, verification, and responsibility decisions", () => {
    expect(AI_SAFETY_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "privacy", "authorization", "verification", "responsibility",
    ]);
  });

  it("requires both the safe action and its supporting evidence", () => {
    const scenario = AI_SAFETY_SCENARIOS[0]!;
    expect(isSafeScenarioResponse(scenario, scenario.action, scenario.reason)).toBe(true);
    expect(isSafeScenarioResponse(scenario, scenario.action, "不相关理由")).toBe(false);
    expect(isSafeScenarioResponse(scenario, "不安全行动", scenario.reason)).toBe(false);
  });
});
