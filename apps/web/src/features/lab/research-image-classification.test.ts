import { describe, expect, it } from "vitest";

import {
  calculateResearchImageClassificationAttempt,
  evaluateResearchImageClassificationChallenge,
  getResearchChallengeHints,
  RESEARCH_BACKLIT_TARGET_ACCURACY,
} from "./research-image-classification";

const completedAt = "2026-08-22T04:00:00.000Z";

describe("research image classification challenge", () => {
  it("calculates versioned group metrics only from the fixed sample whitelist", () => {
    const attempt = calculateResearchImageClassificationAttempt({
      runId: "attempt-1",
      selectedSampleIds: ["backlit-leaf", "backlit-ball", "backlit-cup"],
      completedAt,
    });

    expect(attempt).toMatchObject({
      indoorAccuracy: 9,
      backlitAccuracy: RESEARCH_BACKLIT_TARGET_ACCURACY,
      overallAccuracy: 8,
      overallCorrect: 16,
      overallTotal: 20,
      overallPercent: 80,
    });
    expect(calculateResearchImageClassificationAttempt({
      runId: "attempt-2",
      selectedSampleIds: ["invented-sample"],
      completedAt,
    })).toBeNull();
  });

  it("requires a comparison, targeted samples, target improvement, and metric-grounded conclusion", () => {
    const control = calculateResearchImageClassificationAttempt({
      runId: "control",
      selectedSampleIds: [],
      completedAt,
    })!;
    const improved = calculateResearchImageClassificationAttempt({
      runId: "improved",
      selectedSampleIds: ["backlit-leaf", "backlit-ball", "backlit-cup"],
      completedAt: "2026-08-22T04:01:00.000Z",
    })!;

    expect(evaluateResearchImageClassificationChallenge(
      [control, improved],
      "我补充了逆光叶子、球和杯子样本，逆光组从 4/10 提升到 7/10，说明应补充逆光场景的样本。",
    )).toMatchObject({ passed: true, remediationActivityId: null });
    expect(evaluateResearchImageClassificationChallenge(
      [control, improved],
      "我补充了逆光样本，表现有所改善。",
    )).toMatchObject({ passed: false, conclusionConsistent: false });
  });

  it("unlocks hints progressively without exposing a complete answer first", () => {
    expect(getResearchChallengeHints([])).toHaveLength(1);
    const attempt = calculateResearchImageClassificationAttempt({ runId: "attempt", selectedSampleIds: [], completedAt })!;
    expect(getResearchChallengeHints([attempt])).toHaveLength(2);
  });
});
