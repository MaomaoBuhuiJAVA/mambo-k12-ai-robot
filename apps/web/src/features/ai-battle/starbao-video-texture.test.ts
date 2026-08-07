import { afterEach, describe, expect, it, vi } from "vitest";

import { createStarbaoVideoTexture } from "./starbao-video-texture";

function createCanvasContext() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    })),
    imageSmoothingEnabled: false,
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function installVideoMocks() {
  const video = document.createElement("video");
  const originalCreateElement = document.createElement.bind(document);
  let currentTime = 0;
  let nextFrameCallbackId = 1;
  const frameCallbacks = new Map<number, () => void>();

  Object.defineProperties(video, {
    currentTime: {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    },
    readyState: {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    },
    videoHeight: {
      configurable: true,
      value: 1080,
    },
    videoWidth: {
      configurable: true,
      value: 1920,
    },
  });

  const play = vi.spyOn(video, "play").mockResolvedValue(undefined);
  const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
  vi.spyOn(video, "load").mockImplementation(() => undefined);
  Object.defineProperties(video, {
    cancelVideoFrameCallback: {
      configurable: true,
      value: (id: number) => frameCallbacks.delete(id),
    },
    requestVideoFrameCallback: {
      configurable: true,
      value: (callback: () => void) => {
        const id = nextFrameCallbackId++;
        frameCallbacks.set(id, callback);
        return id;
      },
    },
  });

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    if (tagName.toLowerCase() === "video") return video;
    return originalCreateElement(tagName, options);
  }) as typeof document.createElement);
  const context = createCanvasContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);

  return { context, pause, play, video };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createStarbaoVideoTexture", () => {
  it("plays the entrance video once and renders its final frame when playback ends", () => {
    const { context, pause, play, video } = installVideoMocks();
    const refresh = vi.fn();
    const onEnded = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: document.createElement("canvas"),
      refresh,
      onError: vi.fn(),
      onEnded,
    });

    controller.start();
    video.dispatchEvent(new Event("ended"));

    expect(video.loop).toBe(false);
    expect(play).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalled();
    expect(onEnded).toHaveBeenCalledOnce();
    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);

    controller.destroy();
  });

  it("restarts from the first frame after the completed entrance animation", () => {
    const { play, video } = installVideoMocks();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: document.createElement("canvas"),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded: vi.fn(),
    });

    controller.start();
    video.dispatchEvent(new Event("ended"));
    video.currentTime = 4;
    controller.start();

    expect(video.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(2);

    controller.destroy();
  });

  it("preserves the wide source composition so Starbao can enter from the left", () => {
    const { context, video } = installVideoMocks();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: document.createElement("canvas"),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded: vi.fn(),
    });

    controller.start();

    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080, 0, 0, 768, 432);

    controller.destroy();
  });
});
