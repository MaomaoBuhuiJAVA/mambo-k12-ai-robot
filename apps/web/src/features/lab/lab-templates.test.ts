import { describe, expect, it } from "vitest";

import { appendDeterministicChecks, getLabGuidance } from "./lab-templates";

describe("lab templates", () => {
  it("appends deterministic checks rather than an AI grading prompt", () => {
    const executable = appendDeterministicChecks(
      "bubble-sort",
      "def bubble_sort(values): return sorted(values)",
    );

    expect(executable).toContain("assert _actual == _expected");
    expect(executable).toContain("_mambo_passed = True");
    expect(executable).not.toMatch(/Gemini|LLM|大模型判分/i);
  });

  it("adapts tasks and hints to the selected learning stage", () => {
    const child = getLabGuidance("bubble-sort", "lower_primary");
    const highSchool = getLabGuidance("bubble-sort", "high_school");

    expect(child.task).not.toBe(highSchool.task);
    expect(child.hints[0]).not.toBe(highSchool.hints[0]);
    expect(highSchool.task).toContain("不修改输入");
  });
});
