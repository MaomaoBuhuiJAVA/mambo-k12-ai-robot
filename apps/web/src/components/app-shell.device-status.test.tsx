import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/device/device-status", () => ({
  DeviceStatus: () => <div>device-status-control</div>,
}));

import { AppShell } from "./app-shell";

describe("AppShell device status", () => {
  it("places the same-origin device control in the application header", () => {
    render(<AppShell><main>workspace</main></AppShell>);

    const banner = screen.getByRole("banner");
    expect(within(banner).getByText("device-status-control")).toBeInTheDocument();
  });
});
