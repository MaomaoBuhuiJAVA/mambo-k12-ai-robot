import { describe, expect, it } from "vitest";

import { workspaceHref } from "./workspace-route";

describe("workspaceHref", () => {
  it("opens a selected course in the dedicated workspace route", () => {
    expect(workspaceHref({ course: "lower-bubble-sort", hash: "workspace" })).toBe(
      "/workspace?course=lower-bubble-sort#workspace",
    );
  });

  it("preserves the route state used by saved storybooks", () => {
    expect(workspaceHref({
      course: "lower-picture-labels",
      tab: "storybook",
      work: "storybook-1",
      hash: "teaching-canvas",
    })).toBe("/workspace?course=lower-picture-labels&tab=storybook&work=storybook-1#teaching-canvas");
  });

  it("keeps the course-path navigation inside the workspace route", () => {
    expect(workspaceHref({ view: "path", hash: "course-rail" })).toBe(
      "/workspace?view=path#course-rail",
    );
  });
});
