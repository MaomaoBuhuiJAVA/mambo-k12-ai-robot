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

function createVideoCanvas(width = 768, height = 432) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function installVideoMocks({
  duration = 4.69,
  videoHeight = 1080,
  videoWidth = 1920,
}: {
  duration?: number;
  videoHeight?: number;
  videoWidth?: number;
} = {}) {
  const originalCreateElement = document.createElement.bind(document);
  let nextFrameCallbackId = 1;
  const frameCallbacks = new Map<number, () => void>();
  const videos: HTMLVideoElement[] = [];
  const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const pause = vi.fn();

  const createMockVideo = () => {
    const video = originalCreateElement("video");
    let currentTime = 0;

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
      duration: {
        configurable: true,
        value: duration,
      },
      videoHeight: {
        configurable: true,
        value: videoHeight,
      },
      videoWidth: {
        configurable: true,
        value: videoWidth,
      },
    });

    vi.spyOn(video, "play").mockImplementation(play);
    vi.spyOn(video, "pause").mockImplementation(pause);
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
    videos.push(video);
    return video;
  };

  const video = createMockVideo();
  let initialVideoAvailable = true;

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    if (tagName.toLowerCase() === "video") {
      if (initialVideoAvailable) {
        initialVideoAvailable = false;
        return video;
      }
      return createMockVideo();
    }
    return originalCreateElement(tagName, options);
  }) as typeof document.createElement);
  const context = createCanvasContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);

  const emitNextVideoFrame = () => {
    const callback = frameCallbacks.values().next().value as (() => void) | undefined;
    callback?.();
  };

  return { context, emitNextVideoFrame, pause, play, video, videos };
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
      canvas: createVideoCanvas(),
      refresh,
      onError: vi.fn(),
      onEnded,
    });

    controller.start();
    video.currentTime = 4.69;
    video.dispatchEvent(new Event("ended"));

    expect(video.loop).toBe(false);
    expect(play).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalled();
    expect(onEnded).toHaveBeenCalledOnce();
    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);

    controller.destroy();
  });

  it("completes an entrance from the browser ended event even when its reported time is rounded below duration", () => {
    const { video } = installVideoMocks();
    const onEnded = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded,
    });

    controller.start();
    video.currentTime = 4.6;
    video.dispatchEvent(new Event("ended"));

    expect(onEnded).toHaveBeenCalledOnce();

    controller.destroy();
  });

  it("restarts from the first frame after the completed entrance animation", () => {
    const { play, video } = installVideoMocks();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded: vi.fn(),
    });

    controller.start();
    video.currentTime = 4.69;
    video.dispatchEvent(new Event("ended"));
    controller.start();
    const restartedVideo = controller.video;

    expect(restartedVideo).not.toBe(video);
    expect(restartedVideo.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(2);

    controller.destroy();
  });

  it("ignores a preload error before a playback run starts", () => {
    const { video } = installVideoMocks();
    const onError = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance-idle.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError,
      onEnded: vi.fn(),
      loop: true,
    });

    video.dispatchEvent(new Event("error"));

    expect(onError).not.toHaveBeenCalled();

    controller.destroy();
  });

  it("ignores media events delivered after a stopped playback run", () => {
    const { video } = installVideoMocks();
    const onError = vi.fn();
    const onEnded = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError,
      onEnded,
    });

    controller.start();
    controller.stop();
    video.dispatchEvent(new Event("error"));
    video.dispatchEvent(new Event("ended"));

    expect(onError).not.toHaveBeenCalled();
    expect(onEnded).not.toHaveBeenCalled();

    controller.destroy();
  });

  it("ignores a rejected play request after that run has been stopped", async () => {
    const { play } = installVideoMocks();
    const onError = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError,
      onEnded: vi.fn(),
    });
    play.mockRejectedValueOnce(new Error("The play request was interrupted by pause()."));

    controller.start();
    controller.stop();
    await Promise.resolve();

    expect(onError).not.toHaveBeenCalled();

    controller.destroy();
  });

  it("does not complete a newly restarted entrance from an old ended event", () => {
    const { video } = installVideoMocks();
    const onEnded = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded,
    });

    controller.start();
    controller.stop();
    controller.start();
    const restartedVideo = controller.video;
    video.currentTime = 4.69;
    video.dispatchEvent(new Event("ended"));

    expect(onEnded).not.toHaveBeenCalled();

    restartedVideo.currentTime = 4.69;
    restartedVideo.dispatchEvent(new Event("ended"));

    expect(onEnded).toHaveBeenCalledOnce();

    controller.destroy();
  });

  it("ignores a late error from the old video after a restart", () => {
    const { video } = installVideoMocks();
    const onError = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError,
      onEnded: vi.fn(),
    });

    controller.start();
    controller.stop();
    controller.start();
    video.dispatchEvent(new Event("error"));

    expect(onError).not.toHaveBeenCalled();

    controller.destroy();
  });

  it("does not restart a destroyed controller", () => {
    const { play } = installVideoMocks();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded: vi.fn(),
    });

    controller.destroy();
    controller.start();

    expect(play).not.toHaveBeenCalled();
  });

  it("preserves the wide source composition so Starbao can enter from the left", () => {
    const { context, video } = installVideoMocks();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded: vi.fn(),
    });

    controller.start();

    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080, 0, 0, 768, 432);

    controller.destroy();
  });

  it("loops the idle video without completing the entrance callback", () => {
    const { video } = installVideoMocks();
    const onEnded = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance-idle.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded,
      loop: true,
    });

    controller.start();
    video.dispatchEvent(new Event("ended"));

    expect(video.loop).toBe(true);
    expect(onEnded).not.toHaveBeenCalled();

    controller.destroy();
  });

  it("uses the matching square crop and offset for the looping idle pose", () => {
    const { context, video } = installVideoMocks({ videoWidth: 1280, videoHeight: 720 });
    const canvas = createVideoCanvas(512, 512);
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance-idle.mp4",
      canvas,
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded: vi.fn(),
      frameMode: "center-square",
      frameOffsetX: 57,
    });

    controller.start();

    expect(context.drawImage).toHaveBeenCalledWith(video, 280, 0, 720, 720, 57, 0, 512, 512);

    controller.destroy();
  });

  it("reports entrance playback time so the visible layer can travel in sync", () => {
    const { emitNextVideoFrame, video } = installVideoMocks();
    const onFrame = vi.fn();
    const controller = createStarbaoVideoTexture({
      source: "/assets/game/starbao-entrance.mp4",
      canvas: createVideoCanvas(),
      refresh: vi.fn(),
      onError: vi.fn(),
      onEnded: vi.fn(),
      onFrame,
    });

    controller.start();
    video.currentTime = 0.75;
    emitNextVideoFrame();

    expect(onFrame).toHaveBeenLastCalledWith(0.75, 4.69);

    controller.destroy();
  });
});
