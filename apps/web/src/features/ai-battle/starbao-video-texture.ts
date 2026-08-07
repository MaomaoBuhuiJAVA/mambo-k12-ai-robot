import { keyEdgeConnectedCheckerboardPixels } from "./starbao-video-keyer";

export const STARBAO_VIDEO_FRAME_WIDTH = 768;
export const STARBAO_VIDEO_FRAME_HEIGHT = 432;

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
  readonly onEnded: () => void;
}

export function createStarbaoVideoTexture({
  source,
  canvas,
  refresh,
  onError,
  onEnded,
}: CreateStarbaoVideoTextureOptions): StarbaoVideoTextureController {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to create the Starbao video canvas context.");
  context.imageSmoothingEnabled = false;

  const video = document.createElement("video");
  video.muted = true;
  video.loop = false;
  video.playsInline = true;
  video.preload = "auto";
  video.src = source;
  video.setAttribute("aria-hidden", "true");

  let playing = false;
  let animationFrameId: number | null = null;
  let videoFrameCallbackId: number | null = null;

  const renderFrame = () => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const sourceWidth = video.videoWidth || 1920;
    const sourceHeight = video.videoHeight || 1080;
    context.clearRect(0, 0, STARBAO_VIDEO_FRAME_WIDTH, STARBAO_VIDEO_FRAME_HEIGHT);
    context.drawImage(
      video,
      0,
      0,
      sourceWidth,
      sourceHeight,
      0,
      0,
      STARBAO_VIDEO_FRAME_WIDTH,
      STARBAO_VIDEO_FRAME_HEIGHT,
    );
    const frame = context.getImageData(0, 0, STARBAO_VIDEO_FRAME_WIDTH, STARBAO_VIDEO_FRAME_HEIGHT);
    keyEdgeConnectedCheckerboardPixels(frame.data, STARBAO_VIDEO_FRAME_WIDTH, STARBAO_VIDEO_FRAME_HEIGHT);
    context.putImageData(frame, 0, 0);
    refresh();
  };

  const cancelScheduledFrame = () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (videoFrameCallbackId !== null) {
      const videoWithCallback = video as HTMLVideoElement & {
        cancelVideoFrameCallback?: (handle: number) => void;
      };
      videoWithCallback.cancelVideoFrameCallback?.(videoFrameCallbackId);
      videoFrameCallbackId = null;
    }
  };

  const scheduleFrame = () => {
    if (!playing) return;
    renderFrame();
    const videoWithCallback = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
    };
    if (videoWithCallback.requestVideoFrameCallback) {
      videoFrameCallbackId = videoWithCallback.requestVideoFrameCallback(() => {
        videoFrameCallbackId = null;
        scheduleFrame();
      });
      return;
    }
    animationFrameId = window.requestAnimationFrame(() => {
      animationFrameId = null;
      scheduleFrame();
    });
  };

  const handleError = () => {
    playing = false;
    cancelScheduledFrame();
    onError();
  };

  const handleEnded = () => {
    playing = false;
    cancelScheduledFrame();
    video.pause();
    renderFrame();
    onEnded();
  };

  const start = () => {
    cancelScheduledFrame();
    playing = true;
    try {
      video.currentTime = 0;
    } catch {
      // Metadata may not be available yet; playback will start when it is ready.
    }
    scheduleFrame();
    void video.play().catch(handleError);
  };

  const stop = () => {
    playing = false;
    cancelScheduledFrame();
    video.pause();
  };

  video.addEventListener("error", handleError);
  video.addEventListener("ended", handleEnded);
  video.load();

  return {
    video,
    start,
    stop,
    destroy() {
      stop();
      video.removeEventListener("error", handleError);
      video.removeEventListener("ended", handleEnded);
      video.removeAttribute("src");
      video.load();
    },
  };
}
