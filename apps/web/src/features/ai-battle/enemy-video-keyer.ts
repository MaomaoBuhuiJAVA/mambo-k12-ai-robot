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
  readonly audioSource?: string;
  readonly canvas: HTMLCanvasElement;
  readonly refresh: () => void;
  readonly onEnded: () => void;
  readonly onError: () => void;
}

export function createEnemyVideoTexture({
  source,
  audioSource,
  canvas,
  refresh,
  onEnded,
  onError,
}: CreateEnemyVideoTextureOptions): EnemyVideoTextureController {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Unable to create the enemy animation canvas context.");
  }

  const createVideo = () => {
    const nextVideo = document.createElement("video");
    nextVideo.muted = true;
    nextVideo.playsInline = true;
    nextVideo.preload = "auto";
    nextVideo.src = source;
    nextVideo.setAttribute("aria-hidden", "true");
    nextVideo.load();
    return nextVideo;
  };

  const createAudio = () => {
    if (!audioSource) return null;
    const nextAudio = document.createElement("audio");
    nextAudio.preload = "auto";
    nextAudio.src = audioSource;
    nextAudio.setAttribute("aria-hidden", "true");
    nextAudio.load();
    return nextAudio;
  };

  let video = createVideo();
  const audio = createAudio();
  let hasStarted = false;
  let playing = false;
  let audioPlaying = false;
  let destroyed = false;
  let playbackRun = 0;
  let scheduledFrame:
    | { readonly kind: "animation"; readonly id: number }
    | { readonly kind: "video"; readonly id: number; readonly video: HTMLVideoElement }
    | null = null;
  let removeMediaListeners: (() => void) | null = null;

  const renderFrame = (frameVideo: HTMLVideoElement) => {
    if (frameVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    context.clearRect(0, 0, ENEMY_VIDEO_FRAME_SIZE, ENEMY_VIDEO_FRAME_SIZE);
    context.drawImage(frameVideo, 0, 0, ENEMY_VIDEO_FRAME_SIZE, ENEMY_VIDEO_FRAME_SIZE);
    const frame = context.getImageData(0, 0, ENEMY_VIDEO_FRAME_SIZE, ENEMY_VIDEO_FRAME_SIZE);
    keyEdgeConnectedBlackPixels(frame.data, ENEMY_VIDEO_FRAME_SIZE, ENEMY_VIDEO_FRAME_SIZE, 32);
    context.putImageData(frame, 0, 0);
    refresh();
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

  const stopAudio = () => {
    if (!audio || !audioPlaying) return;
    audioPlaying = false;
    audio.pause();
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

  const handleEnded = (run: number, runVideo: HTMLVideoElement) => {
    if (!isActiveRun(run, runVideo)) return;
    playing = false;
    cancelScheduledFrame();
    clearMediaListeners();
    runVideo.pause();
    stopAudio();
    renderFrame(runVideo);
    onEnded();
  };

  const handleError = (run: number, runVideo: HTMLVideoElement) => {
    if (!isActiveRun(run, runVideo)) return;
    playing = false;
    cancelScheduledFrame();
    clearMediaListeners();
    stopAudio();
    onError();
  };

  const disposeVideo = (videoToDispose: HTMLVideoElement) => {
    videoToDispose.pause();
    videoToDispose.removeAttribute("src");
    videoToDispose.load();
  };

  const disposeAudio = () => {
    if (!audio) return;
    stopAudio();
    audio.removeAttribute("src");
    audio.load();
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
    cancelScheduledFrame();
    playing = true;
    try {
      runVideo.currentTime = 0;
    } catch {
      // The media element may not have metadata yet; playback will still start at its current time.
    }
    const runAudio = audio;
    if (runAudio) {
      try {
        runAudio.currentTime = 0;
      } catch {
        // The audio element may not have metadata yet; playback will still start at its current time.
      }
      audioPlaying = true;
      void runAudio.play().catch(() => {
        if (playbackRun === run) audioPlaying = false;
      });
    }
    const onRunEnded = () => handleEnded(run, runVideo);
    const onRunError = () => handleError(run, runVideo);
    runVideo.addEventListener("ended", onRunEnded);
    runVideo.addEventListener("error", onRunError);
    removeMediaListeners = () => {
      runVideo.removeEventListener("ended", onRunEnded);
      runVideo.removeEventListener("error", onRunError);
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
    stopAudio();
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
      disposeAudio();
    },
  };
}
