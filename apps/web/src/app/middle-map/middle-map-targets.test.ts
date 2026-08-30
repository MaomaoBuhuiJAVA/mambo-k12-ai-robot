import { describe, expect, it } from "vitest";

import { getMiddleMapTargetHref } from "./middle-map-targets";

describe("middle map target routing", () => {
  it("builds only the five approved learning routes", () => {
    expect(getMiddleMapTargetHref("stage-progress")).toBe("/learn?stage=middle_school&grade=middle_1&view=courses");
    expect(getMiddleMapTargetHref("course-resources")).toBe("/learn/course/middle-ai-foundations#course-resources");
    expect(getMiddleMapTargetHref("ai-foundations-course")).toBe("/learn/course/middle-ai-foundations");
    expect(getMiddleMapTargetHref("guided-image-lab")).toBe("/lab?stage=middle_school&template=image-classifier&mode=guided");
    expect(getMiddleMapTargetHref("independent-image-lab")).toBe("/lab?stage=middle_school&template=image-classifier&mode=independent");
  });

  it("rejects an unknown target instead of exposing an arbitrary URL", () => {
    expect(() => getMiddleMapTargetHref("https://untrusted.example")).toThrow("Unknown middle map target");
  });
});
