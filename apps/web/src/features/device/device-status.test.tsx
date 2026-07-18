import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeviceStatus } from "./device-status";

function response(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
}

describe("DeviceStatus", () => {
  beforeEach(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows a stable loading status before the first response", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(<DeviceStatus />);

    expect(screen.getByText("检查机器人")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在检查机器人连接");
  });

  it("shows the connected robot and reveals only normalized details", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({
      status: "online",
      name: "orangepi4pro",
      online: true,
      lastSeenAt: "2026-07-18T08:00:00Z",
      capabilities: ["camera", "audio", "npu"],
    })));

    render(<DeviceStatus />);

    expect(await screen.findByText("机器人已连接")).toBeInTheDocument();
    fireEvent.click(screen.getByText("机器人已连接"));
    expect(screen.getByText("orangepi4pro")).toBeInTheDocument();
    expect(screen.getByText(/摄像头/)).toBeInTheDocument();
    expect(screen.getByText(/音频/)).toBeInTheDocument();
    expect(screen.getByText(/NPU/)).toBeInTheDocument();
    expect(screen.getByText(/最后心跳/)).toBeInTheDocument();
  });

  it.each(["offline", "unavailable", "unconfigured", "configured"] as const)(
    "keeps teaching available in %s state",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn(() => response({
        status,
        name: status === "offline" ? "orangepi4pro" : null,
        online: false,
        lastSeenAt: status === "offline" ? "2026-07-18T08:00:00Z" : null,
        capabilities: [],
      })));

      render(<DeviceStatus />);

      expect(await screen.findByText("网页模式")).toBeInTheDocument();
      expect(screen.getByText("教学不受影响")).toBeInTheDocument();
    },
  );

  it("falls back to webpage mode for network and malformed response failures", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => response({ token: "bad shape" }));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<DeviceStatus />);

    expect(await screen.findByText("网页模式")).toBeInTheDocument();
    first.unmount();
    render(<DeviceStatus />);
    expect(await screen.findByText("网页模式")).toBeInTheDocument();
  });

  it("polls every 18 seconds only while visible and never overlaps requests", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementation(() => response({
        status: "online",
        name: "robot",
        online: true,
        lastSeenAt: "2026-07-18T08:00:00Z",
        capabilities: [],
      }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DeviceStatus />);
    await act(() => vi.advanceTimersByTimeAsync(36_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.(await response({
        status: "online",
        name: "robot",
        online: true,
        lastSeenAt: "2026-07-18T08:00:00Z",
        capabilities: [],
      }));
    });
    await act(() => vi.advanceTimersByTimeAsync(18_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(() => vi.advanceTimersByTimeAsync(18_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts the active request and removes polling when unmounted", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<DeviceStatus />);

    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(36_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
