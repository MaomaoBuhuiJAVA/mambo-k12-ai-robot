import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IframeRuntimeTransport } from "./iframe-runtime-transport";

const sources = {
  html: "<!doctype html><html><body></body></html>",
  core: "export function parseRunRequest(value) { return value; }",
};

describe("IframeRuntimeTransport", () => {
  it("creates an opaque sandbox and validates source plus random channel token", async () => {
    const onMessage = vi.fn();
    const onError = vi.fn();
    const transport = new IframeRuntimeTransport({
      loadSources: vi.fn(async () => sources),
      tokenFactory: () => "channel-token-1234567890",
    });

    transport.start({ onMessage, onError });

    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe.srcdoc).toBe(sources.html);
    expect(iframe.getAttribute("src")).toBeNull();

    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    fireEvent(
      window,
      new MessageEvent("message", {
        source: window,
        data: { protocol: "mambo-lab-runtime-v1", type: "runtime-bootstrap" },
      }),
    );
    expect(postMessage).not.toHaveBeenCalled();

    fireEvent(
      window,
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { protocol: "mambo-lab-runtime-v1", type: "runtime-bootstrap" },
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      {
        protocol: "mambo-lab-runtime-v1",
        type: "initialize",
        token: "channel-token-1234567890",
        coreSource: sources.core,
      },
      "*",
    );

    fireEvent(
      window,
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          protocol: "mambo-lab-runtime-v1",
          type: "runtime-message",
          token: "wrong-token",
          payload: { type: "ready" },
        },
      }),
    );
    expect(onMessage).not.toHaveBeenCalled();

    fireEvent(
      window,
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: {
          protocol: "mambo-lab-runtime-v1",
          type: "runtime-message",
          token: "channel-token-1234567890",
          payload: { type: "ready" },
        },
      }),
    );
    expect(onMessage).toHaveBeenCalledWith({ type: "ready" });
    expect(onError).not.toHaveBeenCalled();

    transport.destroy();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("loads public runtime assets without credentials", async () => {
    const fetcher = vi.fn(async () => new Response("asset", { status: 200 }));
    const transport = new IframeRuntimeTransport({ fetcher });

    transport.start({ onMessage: vi.fn(), onError: vi.fn() });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/^\/lab-runtime/),
      expect.objectContaining({ credentials: "omit" }),
    );
    transport.destroy();
  });
});
