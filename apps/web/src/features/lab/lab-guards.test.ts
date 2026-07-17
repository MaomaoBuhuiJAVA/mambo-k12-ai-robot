import { describe, expect, it } from "vitest";

import { createOutputCollector, findForbiddenImport } from "./lab-guards";

describe("lab worker guards", () => {
  it("allows the small course library list and rejects every other import", () => {
    expect(findForbiddenImport("import math\nfrom statistics import mean")).toBeNull();
    expect(findForbiddenImport("import os")).toBe("os");
    expect(findForbiddenImport("import math, os")).toBe("os");
    expect(findForbiddenImport("module = __import__('os')")).toBe("__import__");
  });

  it("bounds many small output events and adds one truncation notice", () => {
    const collector = createOutputCollector();
    for (let index = 0; index < 500; index += 1) {
      collector.capture("stdout", String(index));
    }

    expect(collector.entries.length).toBeLessThanOrEqual(200);
    expect(collector.entries.filter((entry) => entry.text.includes("省略"))).toHaveLength(1);
  });
});
