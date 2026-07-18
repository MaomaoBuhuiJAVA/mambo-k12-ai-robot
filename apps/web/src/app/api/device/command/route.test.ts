// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core-proxy", () => ({
  proxyCore: vi.fn(),
}));

import { proxyCore } from "@/lib/core-proxy";

import { POST } from "./route";

describe("POST /api/device/command", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("issues a fixed display command for the configured device", async () => {
    vi.stubEnv("CORE_DEVICE_ID", "orangepi4pro-dev-01");
    vi.mocked(proxyCore).mockResolvedValue(
      new Response(JSON.stringify({ command_id: "cmd-1", state: "sent" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await POST(new Request("http://localhost/api/device/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "set_display_mode", arguments: { mode: "presentation" } }),
    }));

    expect(response.status).toBe(200);
    expect(vi.mocked(proxyCore).mock.calls[0][0]).toBe("/api/v1/devices/orangepi4pro-dev-01/commands");
    await expect(response.json()).resolves.toEqual({ command_id: "cmd-1", state: "sent" });
  });

  it("rejects arbitrary paths and commands before contacting Core", async () => {
    const response = await POST(new Request("http://localhost/api/device/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "run_shell", arguments: { command: "rm -rf /" } }),
    }));

    expect(response.status).toBe(400);
    expect(proxyCore).not.toHaveBeenCalled();
  });
});
