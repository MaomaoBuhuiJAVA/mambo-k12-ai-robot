import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core-api", () => ({
  getDeviceStatus: vi.fn(),
}));

import { getDeviceStatus } from "@/lib/core-api";

import { GET } from "./route";

describe("GET /api/device", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns only the normalized device contract with no-store", async () => {
    vi.stubEnv("CORE_API_ADMIN_TOKEN", "never-send-this-to-the-browser");
    vi.mocked(getDeviceStatus).mockResolvedValue({
      status: "online",
      name: "orangepi4pro",
      online: true,
      lastSeenAt: "2026-07-18T08:00:00Z",
      capabilities: ["camera", "audio"],
    });

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(body)).toEqual({
      status: "online",
      name: "orangepi4pro",
      online: true,
      lastSeenAt: "2026-07-18T08:00:00Z",
      capabilities: ["camera", "audio"],
    });
    expect(body).not.toContain("never-send-this-to-the-browser");
  });

  it("sanitizes an unexpected adapter failure", async () => {
    vi.mocked(getDeviceStatus).mockRejectedValue(new Error("secret upstream detail"));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "unavailable",
      name: null,
      online: false,
      lastSeenAt: null,
      capabilities: [],
    });
  });
});
