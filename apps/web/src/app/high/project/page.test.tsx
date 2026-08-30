import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

import HighProjectPage from "./page";

describe("HighProjectPage", () => {
  it("redirects the parameterless legacy entry to the canonical capstone workspace", () => {
    expect(() => HighProjectPage()).toThrow("NEXT_REDIRECT:/learn/project/capstone");
  });
});
