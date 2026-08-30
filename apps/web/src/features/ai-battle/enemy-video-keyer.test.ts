import { afterEach, describe, expect, it, vi } from "vitest";

import { createEnemyVideoTexture } from "./enemy-video-keyer";

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  return canvas;
}

function installVideoMock() {
  const originalCreateElement = document.createElement.bind(document);
  const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const audioPlay = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const videos: HTMLVideoElement[] = [];
  const audios: HTMLAudioElement[] = [];

  const createMockVideo = () => {
    const video = originalCreateElement("video");
    Object.defineProperties(video, {
      readyState: { configurable: true, value: HTMLMediaElement.HAVE_CURRENT_DATA },
      videoHeight: { configurable: true, value: 512 },
      videoWidth: { configurable: true, value: 512 },
      requestVideoFrameCallback: { configurable: true, value: vi.fn(() => 1) },
      cancelVideoFrameCallback: { configurable: true, value: vi.fn() },
    });
    vi.spyOn(video, "play").mockImplementation(play);
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    vi.spyOn(video, "load").mockImplementation(() => undefined);
    videos.push(video);
    return video;
  };

  const createMockAudio = () => {
    const audio = originalCreateElement("audio");
    vi.spyOn(audio, "play").mockImplementation(audioPlay);
    vi.spyOn(audio, "pause").mockImplementation(() => undefined);
    vi.spyOn(audio, "load").mockImplementation(() => undefined);
    audios.push(audio);
    return audio;
  };

  vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => (
    tagName.toLowerCase() === "video"
      ? createMockVideo()
      : tagName.toLowerCase() === "audio"
        ? createMockAudio()
        : originalCreateElement(tagName, options)
  )) as typeof document.createElement);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    })),
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D);

  return { play, audioPlay, videos, audios };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createEnemyVideoTexture", () => {
  it("starts the matching sound while keeping the visual video muted", () => {
    const { audioPlay, audios, videos } = installVideoMock();
    const controller = createEnemyVideoTexture({
      source: "/assets/game/enemy-videos/castle-guardian-spawn.mp4",
      audioSource: "/assets/game/enemy-audio/castle-guardian-spawn.m4a",
      canvas: createCanvas(),
      refresh: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn(),
    });

    controller.start();

    expect(videos[0]?.muted).toBe(true);
    expect(audios[0]?.src).toContain("/assets/game/enemy-audio/castle-guardian-spawn.m4a");
    expect(audioPlay).toHaveBeenCalledOnce();

    controller.stop();

    expect(audios[0]?.pause).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it("ignores rejected sound playback without failing the visual animation", async () => {
    const { audioPlay } = installVideoMock();
    const onError = vi.fn();
    audioPlay.mockRejectedValueOnce(new Error("sound playback blocked"));
    const controller = createEnemyVideoTexture({
      source: "/assets/game/enemy-videos/castle-guardian-spawn.mp4",
      audioSource: "/assets/game/enemy-audio/castle-guardian-spawn.m4a",
      canvas: createCanvas(),
      refresh: vi.fn(),
      onEnded: vi.fn(),
      onError,
    });

    controller.start();
    await Promise.resolve();

    expect(onError).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("reports rejected playback as an error instead of a completed entrance", async () => {
    const { play } = installVideoMock();
    const onEnded = vi.fn();
    const onError = vi.fn();
    play.mockRejectedValueOnce(new Error("playback blocked"));
    const controller = createEnemyVideoTexture({
      source: "/assets/game/enemy-videos/castle-guardian-spawn.mp4",
      canvas: createCanvas(),
      refresh: vi.fn(),
      onEnded,
      onError,
    });

    controller.start();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    expect(onError).toHaveBeenCalledOnce();
    expect(onEnded).not.toHaveBeenCalled();

    controller.destroy();
  });

  it("ignores an ended event from a stopped entrance after restarting", () => {
    installVideoMock();
    const onEnded = vi.fn();
    const controller = createEnemyVideoTexture({
      source: "/assets/game/enemy-videos/castle-guardian-spawn.mp4",
      canvas: createCanvas(),
      refresh: vi.fn(),
      onEnded,
      onError: vi.fn(),
    });

    controller.start();
    const firstVideo = controller.video;
    controller.stop();
    controller.start();
    const restartedVideo = controller.video;

    expect(restartedVideo).not.toBe(firstVideo);

    firstVideo.dispatchEvent(new Event("ended"));

    expect(onEnded).not.toHaveBeenCalled();

    restartedVideo.dispatchEvent(new Event("ended"));

    expect(onEnded).toHaveBeenCalledOnce();
    controller.destroy();
  });
});
