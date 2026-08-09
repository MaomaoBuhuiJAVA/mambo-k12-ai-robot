import { keyEdgeConnectedCheckerboardPixels } from "./starbao-video-keyer";

export const STARBAO_VIDEO_FRAME_WIDTH = 768;
export const STARBAO_VIDEO_FRAME_HEIGHT = 432;
export const STARBAO_IDLE_VIDEO_FRAME_SIZE = 512;

export type StarbaoVideoFrameMode = "full" | "center-square";

export interface StarbaoVideoTextureController {
  readonly video: HTMLVideoElement;
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

interface CreateStarbaoVideoTextureOptions {
  readonly source: string;
  readonly canvas: HTMLCanvasElement;
  readonly refresh: () => void;
  readonly onError: () => void;
  readonly onEnded?: () => void;
  readonly onFrame?: (currentTime: number, duration: number) => void;
  readonly loop?: boolean;
  readonly frameMode?: StarbaoVideoFrameMode;
  readonly frameOffsetX?: number;
}

export function createStarbaoVideoTexture({
  source,
  canvas,
  refresh,
  onError,
  onEnded,
  onFrame,
  loop = false,
  frameMode = "full",
  frameOffsetX = 0,
}: CreateStarbaoVideoTextureOptions): StarbaoVideoTextureController {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to create the Starbao video canvas context.");
  context.imageSmoothingEnabled = false;

  const createVideo = () => {
    const nextVideo = document.createElement("video");
    nextVideo.muted = true;
    nextVideo.loop = loop;
    nextVideo.playsInline = true;
    nextVideo.preload = "auto";
    nextVideo.src = source;
    nextVideo.setAttribute("aria-hidden", "true");
    nextVideo.load();
    return nextVideo;
  };

  let video = createVideo();
  let hasStarted = false;
  let playing = false;
  let destroyed = false;
  let playbackRun = 0;
  let scheduledFrame:
    | { readonly kind: "animation"; readonly id: number }
    | { readonly kind: "video"; readonly id: number; readonly video: HTMLVideoElement }
    | null = null;
  let removeMediaListeners: (() => void) | null = null;

  const renderFrame = (frameVideo: HTMLVideoElement) => {
    if (frameVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const videoWidth = frameVideo.videoWidth || canvasWidth;
    const videoHeight = frameVideo.videoHeight || canvasHeight;
    const sourceSize = Math.min(videoWidth, videoHeight);
    const sourceWidth = frameMode === "center-square" ? sourceSize : videoWidth;
    const sourceHeight = frameMode === "center-square" ? sourceSize : videoHeight;
    const sourceX = frameMode === "center-square" ? Math.max(0, (videoWidth - sourceSize) / 2) : 0;
    const sourceY = frameMode === "center-square" ? Math.max(0, (videoHeight - sourceSize) / 2) : 0;
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.drawImage(
      frameVideo,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      frameOffsetX,
      0,
      canvasWidth,
      canvasHeight,
    );
    const frame = context.getImageData(0, 0, canvasWidth, canvasHeight);
    keyEdgeConnectedCheckerboardPixels(frame.data, canvasWidth, canvasHeight);
    context.putImageData(frame, 0, 0);
    refresh();
    onFrame?.(frameVideo.currentTime, frameVideo.duration);
  };

  const cancelScheduledFrame = () => {
    const frame = scheduledFrame;
    scheduledFrame = null;
    if (!frame) return;
    if (frame.kind === "animation") {
      window.cancelAnimationFrame(frame.id);
      return;
    }
    const videoWithCallback = frame.video as HTMLVideoElement & {
        cancelVideoFrameCallback?: (handle: number) => void;
    };
    videoWithCallback.cancelVideoFrameCallback?.(frame.id);
  };

  const clearMediaListeners = () => {
    removeMediaListeners?.();
    removeMediaListeners = null;
  };

  const isActiveRun = (run: number, runVideo: HTMLVideoElement) => !destroyed && playing && playbackRun === run && video === runVideo;

  const scheduleFrame = (run: number, runVideo: HTMLVideoElement) => {
    if (!isActiveRun(run, runVideo)) return;
    renderFrame(runVideo);
    const videoWithCallback = runVideo as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
    };
    if (videoWithCallback.requestVideoFrameCallback) {
      const frame = {
        kind: "video" as const,
        id: videoWithCallback.requestVideoFrameCallback(() => {
          if (scheduledFrame === frame) scheduledFrame = null;
          scheduleFrame(run, runVideo);
        }),
        video: runVideo,
      };
      scheduledFrame = frame;
      return;
    }
    const frame = {
      kind: "animation" as const,
      id: window.requestAnimationFrame(() => {
        if (scheduledFrame === frame) scheduledFrame = null;
        scheduleFrame(run, runVideo);
      }),
    };
    scheduledFrame = frame;
  };

  const handleError = (run: number, runVideo: HTMLVideoElement) => {
    if (!isActiveRun(run, runVideo)) return;
    playing = false;
    cancelScheduledFrame();
    clearMediaListeners();
    onError();
  };

  const handleEnded = (run: number, runVideo: HTMLVideoElement) => {
    if (!isActiveRun(run, runVideo) || loop) return;
    playing = false;
    cancelScheduledFrame();
    clearMediaListeners();
    runVideo.pause();
    renderFrame(runVideo);
    onEnded?.();
  };

  const disposeVideo = (videoToDispose: HTMLVideoElement) => {
    videoToDispose.pause();
    videoToDispose.removeAttribute("src");
    videoToDispose.load();
  };

  const start = () => {
    if (destroyed) return;
    stop();
    if (hasStarted) {
      disposeVideo(video);
      video = createVideo();
    }
    hasStarted = true;
    const run = ++playbackRun;
    const runVideo = video;
    playing = true;
    try {
      runVideo.currentTime = 0;
    } catch {
      // Metadata may not be available yet; playback will start when it is ready.
    }
    const onRunError = () => handleError(run, runVideo);
    const onRunEnded = () => handleEnded(run, runVideo);
    runVideo.addEventListener("error", onRunError);
    runVideo.addEventListener("ended", onRunEnded);
    removeMediaListeners = () => {
      runVideo.removeEventListener("error", onRunError);
      runVideo.removeEventListener("ended", onRunEnded);
    };
    scheduleFrame(run, runVideo);
    void runVideo.play().catch(() => handleError(run, runVideo));
  };

  const stop = () => {
    playbackRun += 1;
    playing = false;
    cancelScheduledFrame();
    clearMediaListeners();
    video.pause();
  };

  return {
    get video() {
      return video;
    },
    start,
    stop,
    destroy() {
      destroyed = true;
      stop();
      disposeVideo(video);
    },
  };
}
