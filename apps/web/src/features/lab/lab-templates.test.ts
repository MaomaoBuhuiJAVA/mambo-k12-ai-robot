import { describe, expect, it } from "vitest";

import { getLabGuidance } from "./lab-templates";

describe("lab templates", () => {
  it("adapts tasks and hints to the selected learning stage", () => {
    const child = getLabGuidance("bubble-sort", "lower_primary");
    const highSchool = getLabGuidance("bubble-sort", "high_school");

    expect(child.task).not.toBe(highSchool.task);
    expect(child.hints[0]).not.toBe(highSchool.hints[0]);
    expect(highSchool.task).toContain("不修改输入");
  });
});
