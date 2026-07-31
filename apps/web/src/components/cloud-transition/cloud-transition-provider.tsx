"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  CLOUD_COVER_DURATION_MS,
  CLOUD_MAXIMUM_HOLD_MS,
  CLOUD_MINIMUM_HOLD_MS,
  CLOUD_REVEAL_DURATION_MS,
  initialCloudTransitionState,
  transitionCloudState,
} from "./cloud-transition-machine";
import styles from "./cloud-transition-provider.module.css";

type CloudTransitionContextValue = {
  isTransitioning: boolean;
  notifyMapReady: () => void;
  startMapTransition: () => boolean;
};

type CloudLayer = "back" | "middle" | "front";

type CloudInstance = {
  id: string;
  layer: CloudLayer;
  sprite: string;
  size: string;
  startX: string;
  startY: string;
  coveredX: string;
  coveredY: string;
  exitX: string;
  exitY: string;
  coverDelay: string;
  revealDelay: string;
  opacity: string;
};

type CloudStyle = CSSProperties & Record<`--${string}`, string>;

const CloudTransitionContext = createContext<CloudTransitionContextValue | null>(null);

const cloudInstances: readonly CloudInstance[] = [
  { id: "back-northwest", layer: "back", sprite: "0 0", size: "72vw", startX: "-76vw", startY: "-32vh", coveredX: "-24vw", coveredY: "-20vh", exitX: "-78vw", exitY: "-34vh", coverDelay: "0ms", revealDelay: "30ms", opacity: "0.56" },
  { id: "back-northeast", layer: "back", sprite: "50% 0", size: "72vw", startX: "106vw", startY: "-30vh", coveredX: "45vw", coveredY: "-19vh", exitX: "108vw", exitY: "-32vh", coverDelay: "15ms", revealDelay: "0ms", opacity: "0.53" },
  { id: "back-southwest", layer: "back", sprite: "25% 0", size: "70vw", startX: "-72vw", startY: "90vh", coveredX: "-25vw", coveredY: "43vh", exitX: "-74vw", exitY: "94vh", coverDelay: "35ms", revealDelay: "70ms", opacity: "0.52" },
  { id: "back-southeast", layer: "back", sprite: "100% 0", size: "75vw", startX: "105vw", startY: "86vh", coveredX: "42vw", coveredY: "42vh", exitX: "109vw", exitY: "90vh", coverDelay: "25ms", revealDelay: "45ms", opacity: "0.55" },
  { id: "back-center", layer: "back", sprite: "75% 0", size: "74vw", startX: "116vw", startY: "28vh", coveredX: "12vw", coveredY: "7vh", exitX: "118vw", exitY: "27vh", coverDelay: "65ms", revealDelay: "105ms", opacity: "0.48" },
  { id: "middle-north", layer: "middle", sprite: "50% 25%", size: "50vw", startX: "20vw", startY: "-56vh", coveredX: "20vw", coveredY: "-11vh", exitX: "18vw", exitY: "-58vh", coverDelay: "45ms", revealDelay: "90ms", opacity: "0.91" },
  { id: "middle-west", layer: "middle", sprite: "0 25%", size: "55vw", startX: "-60vw", startY: "12vh", coveredX: "-12vw", coveredY: "12vh", exitX: "-63vw", exitY: "9vh", coverDelay: "70ms", revealDelay: "125ms", opacity: "0.94" },
  { id: "middle-east", layer: "middle", sprite: "75% 25%", size: "56vw", startX: "109vw", startY: "6vh", coveredX: "53vw", coveredY: "11vh", exitX: "112vw", exitY: "2vh", coverDelay: "25ms", revealDelay: "55ms", opacity: "0.95" },
  { id: "middle-south", layer: "middle", sprite: "50% 50%", size: "59vw", startX: "20vw", startY: "116vh", coveredX: "20vw", coveredY: "44vh", exitX: "22vw", exitY: "119vh", coverDelay: "85ms", revealDelay: "115ms", opacity: "0.91" },
  { id: "middle-center-left", layer: "middle", sprite: "25% 25%", size: "48vw", startX: "-52vw", startY: "42vh", coveredX: "10vw", coveredY: "29vh", exitX: "-55vw", exitY: "44vh", coverDelay: "105ms", revealDelay: "130ms", opacity: "0.87" },
  { id: "middle-center-right", layer: "middle", sprite: "25% 50%", size: "49vw", startX: "112vw", startY: "39vh", coveredX: "43vw", coveredY: "27vh", exitX: "115vw", exitY: "42vh", coverDelay: "95ms", revealDelay: "80ms", opacity: "0.9" },
  { id: "front-northwest", layer: "front", sprite: "0 50%", size: "36vw", startX: "-43vw", startY: "-36vh", coveredX: "3vw", coveredY: "-3vh", exitX: "-46vw", exitY: "-38vh", coverDelay: "95ms", revealDelay: "145ms", opacity: "1" },
  { id: "front-northeast", layer: "front", sprite: "100% 50%", size: "37vw", startX: "109vw", startY: "-33vh", coveredX: "58vw", coveredY: "-1vh", exitX: "112vw", exitY: "-35vh", coverDelay: "80ms", revealDelay: "30ms", opacity: "0.99" },
  { id: "front-west", layer: "front", sprite: "0 75%", size: "34vw", startX: "-40vw", startY: "49vh", coveredX: "6vw", coveredY: "31vh", exitX: "-43vw", exitY: "52vh", coverDelay: "115ms", revealDelay: "150ms", opacity: "0.98" },
  { id: "front-east", layer: "front", sprite: "75% 75%", size: "35vw", startX: "108vw", startY: "47vh", coveredX: "60vw", coveredY: "31vh", exitX: "111vw", exitY: "50vh", coverDelay: "100ms", revealDelay: "45ms", opacity: "0.98" },
  { id: "front-southwest", layer: "front", sprite: "25% 75%", size: "37vw", startX: "-42vw", startY: "92vh", coveredX: "8vw", coveredY: "54vh", exitX: "-45vw", exitY: "96vh", coverDelay: "120ms", revealDelay: "155ms", opacity: "0.98" },
  { id: "front-southeast", layer: "front", sprite: "100% 75%", size: "36vw", startX: "108vw", startY: "92vh", coveredX: "58vw", coveredY: "52vh", exitX: "112vw", exitY: "96vh", coverDelay: "110ms", revealDelay: "65ms", opacity: "0.97" },
];

function cloudStyle(cloud: CloudInstance): CloudStyle {
  return {
    "--cloud-size": cloud.size,
    "--cloud-start-x": cloud.startX,
    "--cloud-start-y": cloud.startY,
    "--cloud-covered-x": cloud.coveredX,
    "--cloud-covered-y": cloud.coveredY,
    "--cloud-exit-x": cloud.exitX,
    "--cloud-exit-y": cloud.exitY,
    "--cloud-cover-delay": cloud.coverDelay,
    "--cloud-reveal-delay": cloud.revealDelay,
    "--cloud-opacity": cloud.opacity,
    "--cloud-sprite": cloud.sprite,
  };
}

export function CloudTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(transitionCloudState, initialCloudTransitionState);
  const startLockRef = useRef(false);
  const isTransitioning = state.phase !== "idle";

  const startMapTransition = useCallback(() => {
    if (startLockRef.current || state.phase !== "idle") return false;

    startLockRef.current = true;
    dispatch({ type: "START" });
    return true;
  }, [state.phase]);

  const notifyMapReady = useCallback(() => {
    dispatch({ type: "MAP_READY" });
  }, []);

  useEffect(() => {
    router.prefetch("/map");

    const image = new Image();
    image.src = "/assets/cloud-transition/cloud-spritesheet.png";
  }, [router]);

  useEffect(() => {
    if (state.phase === "idle") startLockRef.current = false;
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "covering") return;

    const timer = window.setTimeout(() => {
      dispatch({ type: "COVERED" });
      router.push("/map");
    }, CLOUD_COVER_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [router, state.phase]);

  useEffect(() => {
    if (state.phase !== "holding") return;

    const minimumHoldTimer = window.setTimeout(
      () => dispatch({ type: "MINIMUM_HOLD_ELAPSED" }),
      CLOUD_MINIMUM_HOLD_MS,
    );
    const maximumHoldTimer = window.setTimeout(
      () => dispatch({ type: "MAXIMUM_HOLD_ELAPSED" }),
      CLOUD_MAXIMUM_HOLD_MS,
    );

    return () => {
      window.clearTimeout(minimumHoldTimer);
      window.clearTimeout(maximumHoldTimer);
    };
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "revealing") return;

    const timer = window.setTimeout(() => {
      dispatch({ type: "REVEAL_FINISHED" });
    }, CLOUD_REVEAL_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [state.phase]);

  const contextValue = useMemo<CloudTransitionContextValue>(() => ({
    isTransitioning,
    notifyMapReady,
    startMapTransition,
  }), [isTransitioning, notifyMapReady, startMapTransition]);

  return (
    <CloudTransitionContext.Provider value={contextValue}>
      {children}
      {isTransitioning ? (
        <div
          aria-busy="true"
          aria-label="正在前往小学学习地图"
          className={styles.overlay}
          data-phase={state.phase}
          data-testid="cloud-transition-overlay"
          role="status"
        >
          {cloudInstances.map((cloud) => (
            <span
              aria-hidden="true"
              className={styles.cloud}
              data-layer={cloud.layer}
              data-testid="cloud-transition-cloud"
              key={cloud.id}
              style={cloudStyle(cloud)}
            />
          ))}
        </div>
      ) : null}
    </CloudTransitionContext.Provider>
  );
}

export function useCloudTransition(): CloudTransitionContextValue {
  const context = useContext(CloudTransitionContext);
  if (!context) {
    throw new Error("useCloudTransition must be used within CloudTransitionProvider");
  }
  return context;
}
