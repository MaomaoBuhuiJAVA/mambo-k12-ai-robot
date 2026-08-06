import { keyEdgeConnectedBlackPixels } from "./starbao-video-keyer";

export const ENEMY_VIDEO_FRAME_SIZE = 512;

export interface EnemyVideoTextureController {
  readonly video: HTMLVideoElement;
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

interface CreateEnemyVideoTextureOptions {
  readonly source: string;
  readonly canvas: HTMLCanvasElement;
  readonly refresh: () => void;
  readonly onEnded: () => void;
}

export function createEnemyVideoTexture({
  source,
  canvas,
  refresh,
  onEnded,
}: CreateEnemyVideoTextureOptions): EnemyVideoTextureController {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Unable to create the enemy animation canvas context.");
  }

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = source;
  video.setAttribute("aria-hidden", "true");

  let playing = false;
  let animationFrameId: number | null = null;
  let videoFrameCallbackId: number | null = null;

  const renderFrame = () => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    context.clearRect(0, 0, ENEMY_VIDEO_FRAME_SIZE, ENEMY_VIDEO_FRAME_SIZE);
    context.drawImage(video, 0, 0, ENEMY_VIDEO_FRAME_SIZE, ENEMY_VIDEO_FRAME_SIZE);
    const frame = context.getImageData(0, 0, ENEMY_VIDEO_FRAME_SIZE, ENEMY_VIDEO_FRAME_SIZE);
    keyEdgeConnectedBlackPixels(frame.data, ENEMY_VIDEO_FRAME_SIZE, ENEMY_VIDEO_FRAME_SIZE, 32);
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

  const handleEnded = () => {
    playing = false;
    cancelScheduledFrame();
    renderFrame();
    onEnded();
  };

  const start = () => {
    cancelScheduledFrame();
    playing = true;
    try {
      video.currentTime = 0;
    } catch {
      // The media element may not have metadata yet; playback will still start at its current time.
    }
    scheduleFrame();
    void video.play().catch(() => {
      playing = false;
      cancelScheduledFrame();
      onEnded();
    });
  };

  const stop = () => {
    playing = false;
    cancelScheduledFrame();
    video.pause();
  };

  video.addEventListener("ended", handleEnded);
  video.load();

  return {
    video,
    start,
    stop,
    destroy() {
      stop();
      video.removeEventListener("ended", handleEnded);
      video.removeAttribute("src");
      video.load();
    },
  };
}
