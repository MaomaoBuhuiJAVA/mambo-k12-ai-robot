// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3010/"}

import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RobotGestureProvider } from "./robot-gesture-provider";

describe("RobotGestureProvider outside the board loopback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not call a local hand endpoint when mounted from a nonlocal address", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    render(<RobotGestureProvider><span>remote classroom</span></RobotGestureProvider>);
    await act(async () => { await Promise.resolve(); });

    expect(fetch).not.toHaveBeenCalledWith("/_mambo/hand/start", expect.anything());
    expect(fetch).not.toHaveBeenCalledWith("/_mambo/hand/status", expect.anything());
  });
});
