import { keyEdgeConnectedCheckerboardPixels } from "./starbao-video-keyer";

export const STARBAO_VIDEO_FRAME_SIZE = 512;

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
}

export function createStarbaoVideoTexture({
  source,
  canvas,
  refresh,
  onError,
}: CreateStarbaoVideoTextureOptions): StarbaoVideoTextureController {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to create the Starbao video canvas context.");
  context.imageSmoothingEnabled = false;

  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = source;
  video.setAttribute("aria-hidden", "true");

  let playing = false;
  let animationFrameId: number | null = null;
  let videoFrameCallbackId: number | null = null;

  const renderFrame = () => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const sourceSize = Math.min(video.videoWidth || 720, video.videoHeight || 720);
    const sourceX = Math.max(0, (video.videoWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (video.videoHeight - sourceSize) / 2);
    context.clearRect(0, 0, STARBAO_VIDEO_FRAME_SIZE, STARBAO_VIDEO_FRAME_SIZE);
    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      STARBAO_VIDEO_FRAME_SIZE,
      STARBAO_VIDEO_FRAME_SIZE,
    );
    const frame = context.getImageData(0, 0, STARBAO_VIDEO_FRAME_SIZE, STARBAO_VIDEO_FRAME_SIZE);
    keyEdgeConnectedCheckerboardPixels(frame.data, STARBAO_VIDEO_FRAME_SIZE, STARBAO_VIDEO_FRAME_SIZE);
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
  video.load();

  return {
    video,
    start,
    stop,
    destroy() {
      stop();
      video.removeEventListener("error", handleError);
      video.removeAttribute("src");
      video.load();
    },
  };
}
