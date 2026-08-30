import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

import MiddleSchoolMapPage from "./page";

describe("MiddleSchoolMapPage", () => {
  it("redirects the retired map entry to the unified middle-school learning hub", () => {
    expect(() => MiddleSchoolMapPage()).toThrow(
      "NEXT_REDIRECT:/learn?stage=middle_school&grade=middle_1&view=courses",
    );
  });
});
