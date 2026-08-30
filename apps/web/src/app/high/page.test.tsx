import { describe, expect, it, vi } from "vitest";

import HighPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

describe("HighPage", () => {
  it("redirects the legacy entry to the high-school default view", () => {
    expect(() => HighPage()).toThrow("NEXT_REDIRECT:/learn?stage=high_school&view=path");
  });
});
