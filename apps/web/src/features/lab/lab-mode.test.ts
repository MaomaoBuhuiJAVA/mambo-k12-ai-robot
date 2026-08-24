import { describe, expect, it } from "vitest";

import { parseLabExperimentMode } from "./lab-mode";

describe("parseLabExperimentMode", () => {
  it("accepts only the configured lab modes", () => {
    expect(parseLabExperimentMode("guided")).toBe("guided");
    expect(parseLabExperimentMode("independent")).toBe("independent");
    expect(parseLabExperimentMode("research")).toBe("research");
    expect(parseLabExperimentMode("project")).toBe("project");
  });

  it("drops unknown and missing query values", () => {
    expect(parseLabExperimentMode("free-form")).toBeUndefined();
    expect(parseLabExperimentMode(undefined)).toBeUndefined();
  });
});
