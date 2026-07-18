import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDeviceStatus } from "./core-api";

const NOW = "2026-07-18T08:00:00Z";

function upstreamDevice(overrides: Record<string, unknown> = {}) {
  return {
    device_id: "orangepi4pro-dev-01",
    online: true,
    first_seen_at: "2026-07-17T08:00:00Z",
    last_seen_at: NOW,
    connected_at: "2026-07-18T07:55:00Z",
    disconnected_at: null,
    agent_version: "0.1.0",
    platform: "Linux-aarch64",
    capabilities: ["audio", "camera", "display", "npu", "shell"],
    latest_status: { hostname: "orangepi4pro", cpu_load_1m: 0.25 },
    hardware: {
      camera: { available: true, device: "/dev/video0" },
      display: { available: true, name: ":0" },
      mouse: { available: true, backend: "xtest" },
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("getDeviceStatus", () => {
  beforeEach(() => {
    vi.stubEnv("CORE_API_URL", "http://192.168.1.18:8000/");
    vi.stubEnv("CORE_API_ADMIN_TOKEN", "server-admin-secret");
    vi.stubEnv("CORE_DEVICE_ID", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns a minimized online device and sends the admin token only upstream", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      items: [upstreamDevice()],
      count: 1,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDeviceStatus()).resolves.toEqual({
      status: "online",
      name: "orangepi4pro",
      online: true,
      lastSeenAt: NOW,
      capabilities: ["audio", "camera", "display", "npu"],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://192.168.1.18:8000/api/v1/devices",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer server-admin-secret",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("keeps real agent commands and removes control characters from the display name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      items: [upstreamDevice({
        capabilities: ["ping", "get_status", "unknown-command"],
        latest_status: { hostname: "classroom\u0000\nrobot" },
      })],
      count: 1,
    })));

    await expect(getDeviceStatus()).resolves.toMatchObject({
      name: "classroom robot",
      capabilities: ["ping", "get_status"],
    });
  });

  it("normalizes an offline device without exposing its raw status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      items: [upstreamDevice({
        online: false,
        latest_status: { hostname: "classroom-robot", private_note: "do not expose" },
      })],
      count: 1,
    })));

    const result = await getDeviceStatus();

    expect(result).toEqual({
      status: "offline",
      name: "classroom-robot",
      online: false,
      lastSeenAt: NOW,
      capabilities: ["audio", "camera", "display", "npu"],
    });
    expect(JSON.stringify(result)).not.toContain("private_note");
  });

  it("reports configured when no device has registered", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ items: [], count: 0 })));

    await expect(getDeviceStatus()).resolves.toEqual({
      status: "configured",
      name: null,
      online: false,
      lastSeenAt: null,
      capabilities: [],
    });
  });

  it("selects CORE_DEVICE_ID and reports configured when that device is missing", async () => {
    vi.stubEnv("CORE_DEVICE_ID", "wanted-device");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      items: [upstreamDevice()],
      count: 1,
    })));

    await expect(getDeviceStatus()).resolves.toMatchObject({
      status: "configured",
      name: null,
      online: false,
    });
  });

  it("reports unconfigured without making a request when either setting is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CORE_API_ADMIN_TOKEN", "");

    await expect(getDeviceStatus()).resolves.toMatchObject({
      status: "unconfigured",
      online: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("times out after three seconds and reports unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    })));

    const pending = getDeviceStatus();
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(pending).resolves.toMatchObject({ status: "unavailable", online: false });
  });

  it.each([401, 500])("sanitizes upstream HTTP %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream secret", { status })));

    const result = await getDeviceStatus();

    expect(result).toMatchObject({ status: "unavailable", online: false });
    expect(JSON.stringify(result)).not.toContain("upstream secret");
  });

  it("sanitizes invalid JSON and schema mismatches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ token: "leak" }], count: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDeviceStatus()).resolves.toMatchObject({ status: "unavailable" });
    await expect(getDeviceStatus()).resolves.toMatchObject({ status: "unavailable" });
  });

  it("rejects a non-JSON upstream response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [upstreamDevice()],
      count: 1,
    }), {
      status: 200,
      headers: { "content-type": "text/html" },
    })));

    await expect(getDeviceStatus()).resolves.toMatchObject({ status: "unavailable" });
  });

  it("rejects an oversized upstream body", async () => {
    const oversized = JSON.stringify({ padding: "x".repeat(128 * 1024) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(oversized, {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    await expect(getDeviceStatus()).resolves.toMatchObject({ status: "unavailable" });
  });

  it("requires HTTPS on Vercel while allowing local LAN HTTP in development", async () => {
    vi.stubEnv("VERCEL", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDeviceStatus()).resolves.toMatchObject({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not treat VERCEL=0 as production", async () => {
    vi.stubEnv("VERCEL", "0");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      items: [upstreamDevice()],
      count: 1,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDeviceStatus()).resolves.toMatchObject({ status: "online" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("combines a caller abort signal with its timeout", async () => {
    const caller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    })));

    const pending = getDeviceStatus({ signal: caller.signal });
    caller.abort(new DOMException("caller left", "AbortError"));

    await expect(pending).resolves.toMatchObject({ status: "unavailable" });
  });
});
