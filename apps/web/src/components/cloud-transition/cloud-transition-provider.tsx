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
  CLOUD_REVEAL_DURATION_MS,
  initialCloudTransitionState,
  transitionCloudState,
  type CloudTransitionDestination,
} from "./cloud-transition-machine";
import styles from "./cloud-transition-provider.module.css";

type CloudTransitionContextValue = {
  isTransitioning: boolean;
  notifyMapReady: () => void;
  notifyHomeReady: () => void;
  notifyMiddleMapReady: () => void;
  startMapTransition: () => boolean;
  startHomeTransition: () => boolean;
  startMiddleMapTransition: () => boolean;
};

type CloudLayer = "back" | "middle" | "front";

type CloudInstance = {
  id: string;
  layer: CloudLayer;
  asset: string;
  fill?: boolean;
  edgeCover?: "top" | "top-left" | "top-right";
  mobileOnly?: boolean;
  coverage?: boolean;
  rightCoverage?: boolean;
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

const cloudTransitionPathnames: Record<CloudTransitionDestination, string> = {
  map: "/map",
  home: "/preview",
  "middle-map": "/learn?stage=middle_school&grade=middle_1&view=courses",
};

const cloudTransitionLabels: Record<CloudTransitionDestination, string> = {
  map: "正在前往小学学习地图",
  home: "正在返回首页",
  "middle-map": "正在前往初中学习中心",
};

const coverageCloudAssets = ["cloud-01.png", "cloud-03.png", "cloud-05.png", "cloud-07.png", "cloud-08.png", "cloud-10.png", "cloud-12.png"] as const;
const coverageCloudSizes = ["42vw", "36vw", "48vw", "39vw", "45vw", "34vw", "41vw"] as const;
const coverageRowCount = 6;
const coverageColumnCount = 7;
const coverageColumnStep = 15;

// A denser grid keeps the transition fully covered while making each cloud read as a separate layer.
const coverageCloudInstances: CloudInstance[] = Array.from({ length: coverageRowCount }, (_, row) =>
  Array.from({ length: coverageColumnCount }, (_, column) => {
    const index = row * coverageColumnCount + column;
    const x = -8 + column * coverageColumnStep + (row % 2 === 1 ? 3 : 0);
    const y = -10 + row * 18 + (column % 2 === 1 ? 2 : 0);
    const direction = index % 4;

    return {
      id: `coverage-${row}-${column}`,
      layer: (row < 2 ? "back" : row < 4 ? "middle" : "front") as CloudLayer,
      asset: coverageCloudAssets[index % coverageCloudAssets.length],
      coverage: true,
      size: coverageCloudSizes[(row + column) % coverageCloudSizes.length],
      startX: `${direction === 0 ? x - 44 : direction === 1 ? x + 44 : x}vw`,
      startY: `${direction === 2 ? y - 46 : direction === 3 ? y + 46 : y}vh`,
      coveredX: `${x}vw`,
      coveredY: `${y}vh`,
      exitX: `${direction === 0 ? x + 44 : direction === 1 ? x - 44 : x}vw`,
      exitY: `${direction === 2 ? y + 46 : direction === 3 ? y - 46 : y}vh`,
      coverDelay: `${(index % 9) * 18}ms`,
      revealDelay: `${((coverageRowCount * coverageColumnCount - 1 - index) % 9) * 18}ms`,
      opacity: `${0.82 + ((row + column) % 5) * 0.04}`,
    };
  }),
).flat();

const rightCoverageAssets = ["cloud-03.png", "cloud-12.png", "cloud-07.png", "cloud-10.png", "cloud-05.png", "cloud-08.png"] as const;
const rightCoverageCloudInstances: CloudInstance[] = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 3 }, (_, column) => {
    const index = row * 3 + column;
    const x = 70 + column * 12 + (row % 2 === 0 ? 0 : 2);
    const y = -10 + row * 12;
    const isFront = (row + column) % 2 === 1;

    return {
      id: `right-coverage-${row}-${column}`,
      layer: (isFront ? "front" : "middle") as CloudLayer,
      asset: rightCoverageAssets[index % rightCoverageAssets.length],
      coverage: true,
      rightCoverage: true,
      size: `${34 + ((row + column) % 3) * 2}vw`,
      startX: `${x + 38}vw`,
      startY: `${y - 4}vh`,
      coveredX: `${x}vw`,
      coveredY: `${y}vh`,
      exitX: `${x + 41}vw`,
      exitY: `${y - 2}vh`,
      coverDelay: `${80 + (index % 9) * 14}ms`,
      revealDelay: `${28 + ((26 - index) % 9) * 18}ms`,
      opacity: "1",
    };
  }),
).flat();

const cloudInstances: readonly CloudInstance[] = [
  { id: "back-northwest", layer: "back", asset: "cloud-01.png", size: "72vw", startX: "-76vw", startY: "-32vh", coveredX: "-24vw", coveredY: "-20vh", exitX: "-78vw", exitY: "-34vh", coverDelay: "0ms", revealDelay: "30ms", opacity: "0.68" },
  { id: "back-northeast", layer: "back", asset: "cloud-03.png", size: "72vw", startX: "106vw", startY: "-30vh", coveredX: "45vw", coveredY: "-19vh", exitX: "108vw", exitY: "-32vh", coverDelay: "15ms", revealDelay: "0ms", opacity: "0.68" },
  { id: "back-southwest", layer: "back", asset: "cloud-05.png", size: "70vw", startX: "-72vw", startY: "90vh", coveredX: "-25vw", coveredY: "43vh", exitX: "-74vw", exitY: "94vh", coverDelay: "35ms", revealDelay: "70ms", opacity: "0.68" },
  { id: "back-southeast", layer: "back", asset: "cloud-08.png", size: "75vw", startX: "105vw", startY: "86vh", coveredX: "42vw", coveredY: "42vh", exitX: "109vw", exitY: "90vh", coverDelay: "25ms", revealDelay: "45ms", opacity: "0.68" },
  { id: "back-center", layer: "back", asset: "cloud-07.png", size: "74vw", startX: "116vw", startY: "28vh", coveredX: "12vw", coveredY: "7vh", exitX: "118vw", exitY: "27vh", coverDelay: "65ms", revealDelay: "105ms", opacity: "0.7" },
  { id: "back-fill-top", layer: "back", asset: "cloud-06.png", fill: true, size: "132vw", startX: "-20vw", startY: "-76vh", coveredX: "-13vw", coveredY: "-15vh", exitX: "-22vw", exitY: "-80vh", coverDelay: "40ms", revealDelay: "90ms", opacity: "0.78" },
  { id: "back-fill-left", layer: "back", asset: "cloud-05.png", fill: true, size: "120vw", startX: "-108vw", startY: "22vh", coveredX: "-42vw", coveredY: "13vh", exitX: "-112vw", exitY: "19vh", coverDelay: "60ms", revealDelay: "135ms", opacity: "0.78" },
  { id: "back-fill-right", layer: "back", asset: "cloud-08.png", fill: true, size: "120vw", startX: "108vw", startY: "21vh", coveredX: "42vw", coveredY: "13vh", exitX: "112vw", exitY: "19vh", coverDelay: "50ms", revealDelay: "45ms", opacity: "0.78" },
  { id: "back-fill-center", layer: "back", asset: "cloud-06.png", fill: true, size: "150vw", startX: "-24vw", startY: "-74vh", coveredX: "-25vw", coveredY: "18vh", exitX: "-26vw", exitY: "-78vh", coverDelay: "75ms", revealDelay: "105ms", opacity: "0.76" },
  { id: "back-fill-bottom", layer: "back", asset: "cloud-07.png", fill: true, size: "135vw", startX: "-20vw", startY: "112vh", coveredX: "-15vw", coveredY: "48vh", exitX: "-20vw", exitY: "116vh", coverDelay: "70ms", revealDelay: "115ms", opacity: "0.8" },
  { id: "middle-north", layer: "middle", asset: "cloud-07.png", size: "50vw", startX: "20vw", startY: "-56vh", coveredX: "20vw", coveredY: "-11vh", exitX: "18vw", exitY: "-58vh", coverDelay: "45ms", revealDelay: "90ms", opacity: "0.91" },
  { id: "middle-west", layer: "middle", asset: "cloud-05.png", size: "55vw", startX: "-60vw", startY: "12vh", coveredX: "-12vw", coveredY: "12vh", exitX: "-63vw", exitY: "9vh", coverDelay: "70ms", revealDelay: "125ms", opacity: "0.94" },
  { id: "middle-east", layer: "middle", asset: "cloud-08.png", size: "56vw", startX: "109vw", startY: "6vh", coveredX: "53vw", coveredY: "11vh", exitX: "112vw", exitY: "2vh", coverDelay: "25ms", revealDelay: "55ms", opacity: "0.95" },
  { id: "middle-south", layer: "middle", asset: "cloud-10.png", size: "59vw", startX: "20vw", startY: "116vh", coveredX: "20vw", coveredY: "44vh", exitX: "22vw", exitY: "119vh", coverDelay: "85ms", revealDelay: "115ms", opacity: "0.91" },
  { id: "middle-center-left", layer: "middle", asset: "cloud-06.png", size: "48vw", startX: "-52vw", startY: "42vh", coveredX: "10vw", coveredY: "29vh", exitX: "-55vw", exitY: "44vh", coverDelay: "105ms", revealDelay: "130ms", opacity: "0.87" },
  { id: "middle-center-right", layer: "middle", asset: "cloud-11.png", size: "49vw", startX: "112vw", startY: "39vh", coveredX: "43vw", coveredY: "27vh", exitX: "115vw", exitY: "42vh", coverDelay: "95ms", revealDelay: "80ms", opacity: "0.9" },
  { id: "middle-top-center", layer: "middle", asset: "cloud-02.png", size: "62vw", startX: "20vw", startY: "-58vh", coveredX: "20vw", coveredY: "-7vh", exitX: "20vw", exitY: "-60vh", coverDelay: "55ms", revealDelay: "100ms", opacity: "0.94" },
  { id: "middle-center-west", layer: "middle", asset: "cloud-06.png", size: "60vw", startX: "-64vw", startY: "31vh", coveredX: "14vw", coveredY: "18vh", exitX: "-67vw", exitY: "31vh", coverDelay: "88ms", revealDelay: "125ms", opacity: "0.95" },
  { id: "middle-center-east", layer: "middle", asset: "cloud-07.png", size: "60vw", startX: "111vw", startY: "29vh", coveredX: "42vw", coveredY: "18vh", exitX: "114vw", exitY: "29vh", coverDelay: "78ms", revealDelay: "78ms", opacity: "0.95" },
  { id: "middle-bottom-center", layer: "middle", asset: "cloud-05.png", size: "65vw", startX: "18vw", startY: "117vh", coveredX: "17vw", coveredY: "46vh", exitX: "18vw", exitY: "120vh", coverDelay: "100ms", revealDelay: "118ms", opacity: "0.95" },
  { id: "front-center", layer: "front", asset: "cloud-10.png", size: "42vw", startX: "28vw", startY: "115vh", coveredX: "29vw", coveredY: "38vh", exitX: "28vw", exitY: "118vh", coverDelay: "128ms", revealDelay: "155ms", opacity: "0.99" },
  { id: "front-northwest", layer: "front", asset: "cloud-09.png", size: "36vw", startX: "-43vw", startY: "-36vh", coveredX: "3vw", coveredY: "-3vh", exitX: "-46vw", exitY: "-38vh", coverDelay: "95ms", revealDelay: "145ms", opacity: "1" },
  { id: "front-northeast", layer: "front", asset: "cloud-12.png", size: "37vw", startX: "109vw", startY: "-33vh", coveredX: "58vw", coveredY: "-1vh", exitX: "112vw", exitY: "-35vh", coverDelay: "80ms", revealDelay: "30ms", opacity: "0.99" },
  { id: "front-corner-northwest", layer: "front", asset: "cloud-01.png", size: "58vw", startX: "-62vw", startY: "-33vh", coveredX: "-11vw", coveredY: "-11vh", exitX: "-65vw", exitY: "-35vh", coverDelay: "120ms", revealDelay: "175ms", opacity: "0.98" },
  { id: "front-corner-northeast", layer: "front", asset: "cloud-03.png", size: "58vw", startX: "107vw", startY: "-32vh", coveredX: "54vw", coveredY: "-11vh", exitX: "110vw", exitY: "-34vh", coverDelay: "112ms", revealDelay: "22ms", opacity: "0.98" },
  { id: "front-west", layer: "front", asset: "cloud-09.png", size: "34vw", startX: "-40vw", startY: "49vh", coveredX: "6vw", coveredY: "31vh", exitX: "-43vw", exitY: "52vh", coverDelay: "115ms", revealDelay: "150ms", opacity: "0.98" },
  { id: "front-east", layer: "front", asset: "cloud-11.png", size: "35vw", startX: "108vw", startY: "47vh", coveredX: "60vw", coveredY: "31vh", exitX: "111vw", exitY: "50vh", coverDelay: "100ms", revealDelay: "45ms", opacity: "0.98" },
  { id: "front-southwest", layer: "front", asset: "cloud-10.png", size: "37vw", startX: "-42vw", startY: "92vh", coveredX: "8vw", coveredY: "54vh", exitX: "-45vw", exitY: "96vh", coverDelay: "120ms", revealDelay: "155ms", opacity: "0.98" },
  { id: "front-southeast", layer: "front", asset: "cloud-12.png", size: "36vw", startX: "108vw", startY: "92vh", coveredX: "58vw", coveredY: "52vh", exitX: "112vw", exitY: "96vh", coverDelay: "110ms", revealDelay: "65ms", opacity: "0.97" },
  { id: "front-corner-southwest", layer: "front", asset: "cloud-05.png", size: "60vw", startX: "-63vw", startY: "101vh", coveredX: "-12vw", coveredY: "46vh", exitX: "-66vw", exitY: "104vh", coverDelay: "135ms", revealDelay: "180ms", opacity: "0.98" },
  { id: "front-corner-southeast", layer: "front", asset: "cloud-08.png", size: "60vw", startX: "106vw", startY: "100vh", coveredX: "53vw", coveredY: "46vh", exitX: "109vw", exitY: "103vh", coverDelay: "125ms", revealDelay: "18ms", opacity: "0.98" },
  { id: "front-edge-top", layer: "front", asset: "cloud-05.png", edgeCover: "top", size: "78vw", startX: "-7vw", startY: "-76vh", coveredX: "-7vw", coveredY: "-18vh", exitX: "-8vw", exitY: "-79vh", coverDelay: "115ms", revealDelay: "160ms", opacity: "1" },
  { id: "front-edge-top-left", layer: "front", asset: "cloud-05.png", edgeCover: "top-left", size: "72vw", startX: "-60vw", startY: "-74vh", coveredX: "-46vw", coveredY: "-24vh", exitX: "-62vw", exitY: "-77vh", coverDelay: "100ms", revealDelay: "145ms", opacity: "1" },
  { id: "front-edge-top-right", layer: "front", asset: "cloud-08.png", edgeCover: "top-right", size: "72vw", startX: "106vw", startY: "-74vh", coveredX: "46vw", coveredY: "-24vh", exitX: "110vw", exitY: "-77vh", coverDelay: "90ms", revealDelay: "35ms", opacity: "1" },
  { id: "mobile-edge-left", layer: "front", asset: "cloud-05.png", mobileOnly: true, size: "115vw", startX: "-78vw", startY: "5vh", coveredX: "-62vw", coveredY: "-8vh", exitX: "-81vw", exitY: "-12vh", coverDelay: "145ms", revealDelay: "155ms", opacity: "1" },
  { id: "mobile-edge-right", layer: "front", asset: "cloud-08.png", mobileOnly: true, size: "115vw", startX: "120vw", startY: "5vh", coveredX: "62vw", coveredY: "-8vh", exitX: "123vw", exitY: "-12vh", coverDelay: "135ms", revealDelay: "45ms", opacity: "1" },
  { id: "mobile-edge-bottom-left", layer: "front", asset: "cloud-05.png", mobileOnly: true, size: "125vw", startX: "-76vw", startY: "55vh", coveredX: "-60vw", coveredY: "58vh", exitX: "-79vw", exitY: "61vh", coverDelay: "150ms", revealDelay: "165ms", opacity: "1" },
  { id: "mobile-edge-bottom-right", layer: "front", asset: "cloud-12.png", mobileOnly: true, size: "125vw", startX: "120vw", startY: "55vh", coveredX: "60vw", coveredY: "58vh", exitX: "123vw", exitY: "61vh", coverDelay: "140ms", revealDelay: "55ms", opacity: "1" },
  { id: "mobile-edge-bottom-center", layer: "front", asset: "cloud-05.png", mobileOnly: true, size: "125vw", startX: "-40vw", startY: "70vh", coveredX: "-40vw", coveredY: "66vh", exitX: "-42vw", exitY: "72vh", coverDelay: "155ms", revealDelay: "175ms", opacity: "1" },
  ...coverageCloudInstances,
  ...rightCoverageCloudInstances,
];

function scaledCloudSize(cloud: CloudInstance): string {
  const size = Number.parseFloat(cloud.size);
  const scale = cloud.coverage ? 0.7 : cloud.fill ? 0.3 : cloud.mobileOnly ? 0.42 : 0.48;
  return Number.isFinite(size) ? `${Math.max(8, Math.round(size * scale))}vw` : cloud.size;
}

function cloudStyle(cloud: CloudInstance): CloudStyle {
  return {
    "--cloud-size": scaledCloudSize(cloud),
    "--cloud-start-x": cloud.startX,
    "--cloud-start-y": cloud.startY,
    "--cloud-covered-x": cloud.coveredX,
    "--cloud-covered-y": cloud.coveredY,
    "--cloud-exit-x": cloud.exitX,
    "--cloud-exit-y": cloud.exitY,
    "--cloud-cover-delay": cloud.coverDelay,
    "--cloud-reveal-delay": cloud.revealDelay,
    "--cloud-opacity": cloud.opacity,
  };
}

export function CloudTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(transitionCloudState, initialCloudTransitionState);
  const startLockRef = useRef(false);
  const isTransitioning = state.phase !== "idle";

  const startTransition = useCallback((destination: CloudTransitionDestination) => {
    if (startLockRef.current || state.phase !== "idle") return false;

    startLockRef.current = true;
    dispatch({ type: "START", destination });
    return true;
  }, [state.phase]);

  const startMapTransition = useCallback(() => startTransition("map"), [startTransition]);
  const startHomeTransition = useCallback(() => startTransition("home"), [startTransition]);
  const startMiddleMapTransition = useCallback(() => startTransition("middle-map"), [startTransition]);

  const notifyPageReady = useCallback((destination: CloudTransitionDestination) => {
    dispatch({ type: "PAGE_READY", destination });
  }, []);

  const notifyMapReady = useCallback(() => {
    notifyPageReady("map");
  }, [notifyPageReady]);

  const notifyHomeReady = useCallback(() => {
    notifyPageReady("home");
  }, [notifyPageReady]);

  const notifyMiddleMapReady = useCallback(() => {
    notifyPageReady("middle-map");
  }, [notifyPageReady]);

  useEffect(() => {
    for (const pathname of Object.values(cloudTransitionPathnames)) {
      router.prefetch(pathname);
    }

    for (const asset of new Set(cloudInstances.map((cloud) => cloud.asset))) {
      const image = new Image();
      image.src = `/assets/cloud-transition/${asset}`;
    }
  }, [router]);

  useEffect(() => {
    if (state.phase === "idle") startLockRef.current = false;
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "covering") return;
    const destination = state.destination;
    if (!destination) return;

    const timer = window.setTimeout(() => {
      dispatch({ type: "COVERED" });
      router.push(cloudTransitionPathnames[destination]);
      // The retired map route has no page-ready handshake anymore. Mark the
      // canonical learning hub ready immediately so the overlay cannot wait
      // for the maximum hold timeout.
      if (destination === "middle-map") {
        dispatch({ type: "PAGE_READY", destination });
      }
    }, CLOUD_COVER_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [router, state.destination, state.phase]);

  useEffect(() => {
    if (state.phase !== "holding") return;

    const maximumHoldTimer = window.setTimeout(
      () => dispatch({ type: "MAXIMUM_HOLD_ELAPSED" }),
      CLOUD_MAXIMUM_HOLD_MS,
    );

    return () => {
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
    notifyHomeReady,
    notifyMiddleMapReady,
    startMapTransition,
    startHomeTransition,
    startMiddleMapTransition,
  }), [
    isTransitioning,
    notifyHomeReady,
    notifyMapReady,
    notifyMiddleMapReady,
    startHomeTransition,
    startMapTransition,
    startMiddleMapTransition,
  ]);

  return (
    <CloudTransitionContext.Provider value={contextValue}>
      {children}
      {isTransitioning ? (
        <div
          aria-busy="true"
          aria-label={state.destination ? cloudTransitionLabels[state.destination] : "正在切换学习场景"}
          className={styles.overlay}
          data-phase={state.phase}
          data-destination={state.destination ?? undefined}
          data-testid="cloud-transition-overlay"
          role="status"
        >
          <span aria-hidden="true" className={styles.cloudVeil} data-testid="cloud-transition-veil" />
          {cloudInstances.map((cloud) => (
            <span
              aria-hidden="true"
              className={styles.cloud}
              data-layer={cloud.layer}
              data-fill={cloud.fill ? "true" : undefined}
              data-edge-seal={cloud.edgeCover}
              data-mobile-seal={cloud.mobileOnly ? "true" : undefined}
              data-coverage={cloud.coverage ? "true" : undefined}
              data-right-coverage={cloud.rightCoverage ? "true" : undefined}
              data-testid="cloud-transition-cloud"
              key={cloud.id}
              style={cloudStyle(cloud)}
            >
              {/* The transition reuses one local sprite family across the animated cloud layers. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className={styles.cloudSprite}
                data-testid="cloud-transition-sprite"
                src={`/assets/cloud-transition/${cloud.asset}`}
              />
            </span>
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
