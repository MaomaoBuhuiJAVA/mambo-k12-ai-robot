"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Cloud,
  Send,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import styles from "./page.module.css";
import { StarbaoSprite, type StarbaoMood } from "@/components/starbao/starbao-sprite";
import StarJourneyCard from "@/components/star-journey-card/StarJourneyCard";
import { useCloudTransition } from "@/components/cloud-transition/cloud-transition-provider";
import { resolvePetPanelPosition, type PetPanelPosition } from "./pet-panel-position";
import { resolvePatrolMotionState, type PatrolMotionState } from "./patrol-motion";
import { GESTURE_NAVIGATE_EVENT, type GestureNavigationDirection } from "@/components/robot/robot-gesture-provider";
import { useSharedStarbaoConversation } from "@/features/starbao/use-shared-starbao-conversation";
import type { Stage } from "@/lib/domain";
import { workspaceHref } from "@/lib/workspace-route";

type FloorId = "explore" | "create" | "future";
type PetMood = Exclude<StarbaoMood, "walk">;
type PetChatAnchor = "launcher" | "reference";
type EntryDialog = "programming" | "future" | null;
type LabFamiliarity = "first_steps" | "guided" | "ready";
type HomepageFeature = "voice" | "storybook" | "coding";
type PetPosition = { x: number; y: number };
type PatrolPlayback = "running" | "paused" | "stopped";
type PetPanelDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  moved: boolean;
  element: HTMLDivElement;
  cleanup?: () => void;
};
type PetPatrolDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  width: number;
  height: number;
  moved: boolean;
  element: HTMLButtonElement;
};

const floors: Array<{
  id: FloorId;
  level: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  modules: string[];
  cardFocus: string;
  courseId: string;
}> = [
  {
    id: "explore",
    level: "01",
    title: "?????",
    subtitle: "?????",
    description: "??????????????????????",
    accent: "sun",
    modules: ["????", "????", "????"],
    cardFocus: "?? ? ?? ? ??",
    courseId: "lower-bubble-sort",
  },
  {
    id: "create",
    level: "02",
    title: "?????",
    subtitle: "?????",
    description: "??????????????????????",
    accent: "mint",
    modules: ["????", "????", "????"],
    cardFocus: "?? ? ?? ? ??",
    courseId: "upper-loop-maze",
  },
  {
    id: "future",
    level: "03",
    title: "?????",
    subtitle: "?? ? ??",
    description: "?????????????????????????",
    accent: "violet",
    modules: ["????", "????", "????"],
    cardFocus: "?? ? ?? ? ??",
    courseId: "middle-neural-signals",
  },
];

const labStageOptions: Array<{ id: Stage; label: string; detail: string }> = [
  { id: "lower_primary", label: "?????", detail: "????????????" },
  { id: "upper_primary", label: "?????", detail: "??????????" },
  { id: "middle_school", label: "??", detail: "??????????" },
  { id: "high_school", label: "??", detail: "??????????" },
];

const labFamiliarityOptions: Array<{ id: LabFamiliarity; label: string; detail: string }> = [
  { id: "first_steps", label: "?????", detail: "???????????" },
  { id: "guided", label: "?????", detail: "??????????" },
  { id: "ready", label: "?????", detail: "???????????" },
];

const storyPreviewPages = [
  {
    title: "???????",
    narration: "??????????????????",
    scene: "????",
  },
  {
    title: "???????",
    narration: "?????????????????",
    scene: "??",
  },
  {
    title: "??????",
    narration: "????????????????????",
    scene: "????",
  },
] as const;

const homepageFeatureTargets: Record<HomepageFeature, string> = {
  voice: "voice-dialogue",
  storybook: "storybook-reading",
  coding: "coding-practice",
};

const PET_PANEL_PREFERRED_HEIGHT = 382;
const PET_SLEEP_DELAY_MS = 30_000;

const schoolStages = [
  {
    id: "primary",
    image: "/assets/learning-stages/primary-reading.png",
    buttonLabel: "??",
  },
  {
    id: "middle",
    image: "/assets/learning-stages/middle-writing.png",
    buttonLabel: "??",
  },
  {
    id: "high",
    image: "/assets/learning-stages/high-coding.png",
    buttonLabel: "??",
  },
] as const;

const thinkingGhostCells = [
  "top0",
  "top1",
  "top2",
  "top3",
  "top4",
  "st0",
  "st1",
  "st2",
  "st3",
  "st4",
  "st5",
  "an1",
  "an2",
  "an3",
  "an4",
  "an5",
  "an6",
  "an7",
  "an8",
  "an9",
  "an10",
  "an11",
  "an12",
  "an13",
  "an14",
  "an15",
  "an16",
  "an17",
  "an18",
] as const;

function StarbaoThinkingIndicator() {
  return (
    <div className={styles.starbaoThinking} role="status" aria-live="polite" aria-label="Starbao is thinking">
      <span className={styles.starbaoThinkingGhost} data-testid="starbao-thinking-ghost" aria-hidden="true">
        <span className={styles.starbaoThinkingGhostShadow} />
        <span className={styles.starbaoThinkingGhostScale}>
          <span className={styles.starbaoThinkingGhostBody}>
            {thinkingGhostCells.map((cell) => (
              <span className={styles.starbaoThinkingGhostCell} data-cell={cell} key={cell} style={{ gridArea: cell }} />
            ))}
            <span className={styles.starbaoThinkingGhostEye} />
            <span className={`${styles.starbaoThinkingGhostEye} ${styles.starbaoThinkingGhostEyeRight}`} />
            <span className={styles.starbaoThinkingGhostPupil} />
            <span className={`${styles.starbaoThinkingGhostPupil} ${styles.starbaoThinkingGhostPupilRight}`} />
          </span>
        </span>
      </span>
    </div>
  );
}

function usePatrolMotionState(
  patrolRef: RefObject<HTMLDivElement | null>,
  playback: PatrolPlayback,
): PatrolMotionState {
  const [motionState, setMotionState] = useState<PatrolMotionState>({ state: "idle", direction: "right" });
  const motionStateRef = useRef<PatrolMotionState>(motionState);
  const fallbackStartedAtRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const patrol = patrolRef.current;
    const applyMotionState = (next: PatrolMotionState) => {
      const previous = motionStateRef.current;
      if (previous.state === next.state && previous.direction === next.direction) return;

      motionStateRef.current = next;
      patrol?.setAttribute("data-patrol-state", next.state);
      patrol?.setAttribute("data-patrol-direction", next.direction);
      setMotionState(next);
    };

    if (playback !== "running") {
      fallbackStartedAtRef.current = null;
      applyMotionState({ state: "idle", direction: "right" });
      return;
    }

    fallbackStartedAtRef.current = window.performance.now();
    let animationFrame = 0;
    const syncMotionState = () => {
      const animation = patrol?.getAnimations?.()[0];
      const currentTime = animation?.currentTime;
      const elapsedMs = typeof currentTime === "number" && Number.isFinite(currentTime)
        ? currentTime
        : window.performance.now() - (fallbackStartedAtRef.current ?? window.performance.now());

      applyMotionState(resolvePatrolMotionState(elapsedMs));
      animationFrame = window.requestAnimationFrame(syncMotionState);
    };

    syncMotionState();
    return () => window.cancelAnimationFrame(animationFrame);
  }, [patrolRef, playback]);

  return motionState;
}

export default function PreviewPage() {
  const router = useRouter();
  const { notifyHomeReady } = useCloudTransition();
  const activeFloor: FloorId = "explore";
  const [petOpen, setPetOpen] = useState(false);
  const [petChatAnchor, setPetChatAnchor] = useState<PetChatAnchor>("launcher");
  const [petMood, setPetMood] = useState<PetMood>("idle");
  const [petPanelPosition, setPetPanelPosition] = useState<PetPanelPosition | null>(null);
  const [petPanelDragging, setPetPanelDragging] = useState(false);
  const [petPanelDetached, setPetPanelDetached] = useState(false);
  const [petPatrolPosition, setPetPatrolPosition] = useState<PetPosition | null>(null);
  const [petPatrolDragging, setPetPatrolDragging] = useState(false);
  const [draft, setDraft] = useState("");
  const {
    messages: starbaoMessages,
    isLoading: starbaoLoading,
    isSending: starbaoSending,
    error: starbaoError,
    sendTurn: sendStarbaoTurn,
  } = useSharedStarbaoConversation();
  const [entryDialog, setEntryDialog] = useState<EntryDialog>(null);
  const [labStage, setLabStage] = useState<Stage>("lower_primary");
  const [labFamiliarity, setLabFamiliarity] = useState<LabFamiliarity>("first_steps");
  const [activeFeature, setActiveFeature] = useState<HomepageFeature>("voice");
  const [storyPreviewPage, setStoryPreviewPage] = useState(0);
  const [codingMatched, setCodingMatched] = useState(false);
  const petPanelDragRef = useRef<PetPanelDrag | null>(null);
  const petPatrolDragRef = useRef<PetPatrolDrag | null>(null);
  const petPatrolDidDragRef = useRef(false);
  const heroRef = useRef<HTMLElement>(null);
  const heroPetPatrolRef = useRef<HTMLDivElement>(null);
  const petLauncherRef = useRef<HTMLButtonElement>(null);
  const referencePetRef = useRef<HTMLButtonElement>(null);
  const petPanelRef = useRef<HTMLElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const petMoodTimerRef = useRef<number | null>(null);
  const petWaitingTimerRef = useRef<number | null>(null);
  const petMoodRef = useRef<PetMood>("idle");
  const patrolPlayback: PatrolPlayback = petMood === "sleep"
    ? "stopped"
    : petPatrolDragging || (petOpen && petChatAnchor === "launcher")
      ? "paused"
      : "running";
  const heroPetPatrolPaused = patrolPlayback !== "running";
  const { state: heroPetPatrolState, direction: heroPetPatrolDirection } = usePatrolMotionState(heroPetPatrolRef, patrolPlayback);
  useEffect(() => {
    notifyHomeReady();
  }, [notifyHomeReady]);
  const setPetMoodIfChanged = useCallback((mood: PetMood) => {
    if (petMoodRef.current === mood) return;
    petMoodRef.current = mood;
    setPetMood(mood);
  }, []);

  useEffect(() => {
    petWaitingTimerRef.current = window.setTimeout(() => setPetMoodIfChanged("sleep"), PET_SLEEP_DELAY_MS);
    return () => {
      if (petMoodTimerRef.current) window.clearTimeout(petMoodTimerRef.current);
      if (petWaitingTimerRef.current) window.clearTimeout(petWaitingTimerRef.current);
    };
  }, [setPetMoodIfChanged]);

  useEffect(() => {
    if (!entryDialog) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEntryDialog(null);
    };
    window.addEventListener("keydown", dismissOnEscape);
    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [entryDialog]);

  useEffect(() => {
    const navigateStorybook = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: GestureNavigationDirection }>).detail?.direction;
      if (direction === "previous") {
        setStoryPreviewPage((page) => Math.max(0, page - 1));
      } else if (direction === "next") {
        setStoryPreviewPage((page) => Math.min(storyPreviewPages.length - 1, page + 1));
      }
    };
    window.addEventListener(GESTURE_NAVIGATE_EVENT, navigateStorybook);
    return () => window.removeEventListener(GESTURE_NAVIGATE_EVENT, navigateStorybook);
  }, []);

  useLayoutEffect(() => {
    if (!petOpen) return;
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [petOpen, starbaoMessages.length, starbaoSending]);

  const getPetPanelPosition = useCallback((position: PetPosition, petWidth: number, petHeight: number) => {
    const panel = petPanelRef.current;
    if (!panel) return null;

    const panelWidth = panel.offsetWidth;
    return resolvePetPanelPosition({
      petX: position.x,
      petY: position.y,
      petWidth,
      petHeight,
      panelWidth,
      panelHeight: PET_PANEL_PREFERRED_HEIGHT,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }, []);

  const updatePetPanelPosition = useCallback(() => {
    if (petPanelDetached) {
      const panel = petPanelRef.current;
      if (!panel) return;

      setPetPanelPosition((previous) => {
        if (!previous) return previous;
        const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
        const height = Math.min(previous.height, Math.max(0, window.innerHeight - 16));
        const maxTop = Math.max(8, window.innerHeight - height - 8);
        const left = Math.min(maxLeft, Math.max(8, previous.left));
        const top = Math.min(maxTop, Math.max(8, previous.top));
        return previous.left === left && previous.top === top && previous.height === height && previous.placement === "below"
          ? previous
          : { left, top, height, placement: "below" };
      });
      return;
    }

    const pet = petChatAnchor === "reference" ? referencePetRef.current : petLauncherRef.current;
    if (!petOpen || !pet) return;

    const petRect = pet.getBoundingClientRect();
    const next = getPetPanelPosition({ x: petRect.left, y: petRect.top }, petRect.width, petRect.height);
    if (!next) return;

    setPetPanelPosition((previous) => {
      return previous && previous.left === next.left && previous.top === next.top && previous.height === next.height && previous.placement === next.placement ? previous : next;
    });
  }, [getPetPanelPosition, petChatAnchor, petOpen, petPanelDetached]);

  useLayoutEffect(() => {
    if (!petOpen) return;
    updatePetPanelPosition();
    window.addEventListener("resize", updatePetPanelPosition);
    return () => window.removeEventListener("resize", updatePetPanelPosition);
  }, [petOpen, updatePetPanelPosition]);

  function schedulePetWaiting() {
    if (petWaitingTimerRef.current) window.clearTimeout(petWaitingTimerRef.current);
    petWaitingTimerRef.current = window.setTimeout(() => {
      petWaitingTimerRef.current = null;
      setPetMoodIfChanged("sleep");
    }, PET_SLEEP_DELAY_MS);
  }

  function playPetMood(mood: PetMood, duration = 900, resumeSleep = true) {
    if (petMoodTimerRef.current) window.clearTimeout(petMoodTimerRef.current);
    if (petWaitingTimerRef.current) window.clearTimeout(petWaitingTimerRef.current);
    petMoodTimerRef.current = null;
    petWaitingTimerRef.current = null;
    setPetMoodIfChanged(mood);
    if (duration > 0) {
      petMoodTimerRef.current = window.setTimeout(() => {
        petMoodTimerRef.current = null;
        setPetMoodIfChanged("idle");
        if (resumeSleep) schedulePetWaiting();
      }, duration);
    } else if (resumeSleep) {
      schedulePetWaiting();
    }
  }

  function togglePetChat(anchor: PetChatAnchor = "launcher") {
    const nextOpen = !petOpen || petChatAnchor !== anchor;
    if (nextOpen) {
      setPetChatAnchor(anchor);
      setPetPanelDetached(false);
    }
    setPetOpen(nextOpen);
    if (!nextOpen) {
      setPetPanelPosition(null);
      setPetChatAnchor("launcher");
      setPetPanelDetached(false);
    }
    playPetMood("idle", 0);
  }

  function handlePetClick() {
    if (petPatrolDidDragRef.current) {
      petPatrolDidDragRef.current = false;
      return;
    }
    togglePetChat("launcher");
  }

  function handlePetPatrolPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.isPrimary === false) return;

    const patrol = heroPetPatrolRef.current;
    const hero = heroRef.current;
    if (!patrol || !hero) return;

    const heroRect = hero.getBoundingClientRect();
    const patrolRect = patrol.getBoundingClientRect();
    const startPosition = { x: patrolRect.left - heroRect.left, y: patrolRect.top - heroRect.top };
    petPatrolDidDragRef.current = false;
    petPatrolDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: startPosition.x,
      startTop: startPosition.y,
      width: patrol.offsetWidth,
      height: patrol.offsetHeight,
      moved: false,
      element: event.currentTarget,
    };
    // Freeze the patrol at its visible position before any pointer movement.
    setPetPatrolPosition(startPosition);
    setPetPatrolDragging(true);
    playPetMood("idle", 0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updatePetPatrolDrag(clientX: number, clientY: number, pointerId: number) {
    const drag = petPatrolDragRef.current;
    const hero = heroRef.current;
    if (!drag || drag.pointerId !== pointerId || !hero) return;

    const distance = Math.hypot(clientX - drag.startX, clientY - drag.startY);
    if (distance <= 3) return;

    drag.moved = true;
    petPatrolDidDragRef.current = true;
    const edgeGap = 8;
    const maxLeft = Math.max(edgeGap, hero.clientWidth - drag.width - edgeGap);
    const maxTop = Math.max(edgeGap, hero.clientHeight - drag.height - edgeGap);
    setPetPatrolPosition({
      x: Math.min(maxLeft, Math.max(edgeGap, drag.startLeft + clientX - drag.startX)),
      y: Math.min(maxTop, Math.max(edgeGap, drag.startTop + clientY - drag.startY)),
    });
    schedulePetWaiting();
    window.requestAnimationFrame(updatePetPanelPosition);
  }

  function finishPetPatrolDrag(pointerId: number) {
    const drag = petPatrolDragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;

    petPatrolDragRef.current = null;
    setPetPatrolDragging(false);
    if (drag.element.hasPointerCapture(pointerId)) {
      drag.element.releasePointerCapture(pointerId);
    }
    window.requestAnimationFrame(updatePetPanelPosition);
  }

  function handlePetPatrolPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    updatePetPatrolDrag(event.clientX, event.clientY, event.pointerId);
  }

  function handlePetPatrolPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    finishPetPatrolDrag(event.pointerId);
  }

  function handleReferencePetClick() {
    togglePetChat("reference");
  }

  function handlePetPanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const panel = petPanelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const onWindowMove = (moveEvent: MouseEvent) => updatePetPanelDrag(moveEvent.clientX, moveEvent.clientY);
    const onWindowUp = () => finishPetPanelDrag();
    petPanelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
      element: event.currentTarget,
      cleanup: () => {
        window.removeEventListener("mousemove", onWindowMove);
        window.removeEventListener("mouseup", onWindowUp);
      },
    };
    window.addEventListener("mousemove", onWindowMove);
    window.addEventListener("mouseup", onWindowUp);
    setPetPanelDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function updatePetPanelDrag(clientX: number, clientY: number, pointerId?: number) {
    const drag = petPanelDragRef.current;
    if (!drag || (typeof pointerId === "number" && drag.pointerId !== pointerId)) return;

    const distance = Math.hypot(clientX - drag.startX, clientY - drag.startY);
    if (distance <= 3) return;

    drag.moved = true;
    const maxLeft = Math.max(8, window.innerWidth - drag.width - 8);
    const height = Math.min(drag.height, Math.max(0, window.innerHeight - 16));
    const maxTop = Math.max(8, window.innerHeight - height - 8);
    setPetPanelDetached(true);
    setPetPanelPosition({
      left: Math.min(maxLeft, Math.max(8, clientX - drag.offsetX)),
      top: Math.min(maxTop, Math.max(8, clientY - drag.offsetY)),
      height,
      placement: "below",
    });
  }

  function finishPetPanelDrag(pointerId?: number) {
    const drag = petPanelDragRef.current;
    if (!drag || (typeof pointerId === "number" && drag.pointerId !== pointerId)) return;

    petPanelDragRef.current = null;
    setPetPanelDragging(false);
    drag.cleanup?.();
    if (typeof pointerId === "number" && drag.element.hasPointerCapture(pointerId)) {
      drag.element.releasePointerCapture(pointerId);
    }
  }

  function handlePetPanelPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    updatePetPanelDrag(event.clientX, event.clientY, event.pointerId);
  }

  function handlePetPanelPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    finishPetPanelDrag(typeof event.pointerId === "number" ? event.pointerId : undefined);
  }

  const petPanelStyle = petPanelPosition ? {
    left: `${petPanelPosition.left}px`,
    top: `${petPanelPosition.top}px`,
    height: `${petPanelPosition.height}px`,
    minHeight: "0",
    right: "auto",
    bottom: "auto",
    transform: "none",
  } : undefined;
  const heroPetPatrolStyle = petPatrolPosition ? {
    left: `${petPatrolPosition.x}px`,
    top: `${petPatrolPosition.y}px`,
  } : undefined;

  function openFutureStage(stage: "middle_school" | "high_school") {
    setEntryDialog(null);
    const courseId = stage === "middle_school" ? "middle-neural-signals" : "high-bubble-analysis";
    router.push(workspaceHref({ course: courseId, hash: "workspace" }));
  }

  function scrollToFeature(feature: HomepageFeature) {
    setActiveFeature(feature);
    window.requestAnimationFrame(() => {
      document.getElementById(homepageFeatureTargets[feature])?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openStorybook() {
    playPetMood("drawing", 1300);
    scrollToFeature("storybook");
  }

  function enterProgrammingLab() {
    setCodingMatched(true);
    setEntryDialog(null);
    router.push(`/lab?stage=${labStage}&familiarity=${labFamiliarity}`);
  }

  async function sendMessage() {
    const value = draft.trim();
    if (!value || starbaoSending) return;
    const floor = floors.find((item) => item.id === activeFloor) ?? floors[0];
    const stage: Stage = floor.id === "explore"
      ? "lower_primary"
      : floor.id === "create"
        ? "upper_primary"
        : "middle_school";
    setDraft("");
    playPetMood("thinking", 0, false);
    try {
      await sendStarbaoTurn({
        text: value,
        stage,
        courseId: floor.courseId,
        origin: "web",
      });
      playPetMood("idle", 0);
    } catch {
      playPetMood("idle", 0);
    }
  }

  const activeStory = storyPreviewPages[storyPreviewPage]!;
  const selectedStage = labStageOptions.find((option) => option.id === labStage)!;
  const codingTemplate = "Hello World";
  const codingLines = ['print("Hello, World!")'];

  return (
    <main className={styles.page}>
      <div className={styles.skyLayer} aria-hidden="true">
        <span className={`${styles.star} ${styles.starOne}`}><Star size={18} fill="currentColor" /></span>
        <span className={`${styles.star} ${styles.starTwo}`}><Sparkles size={14} /></span>
        <span className={`${styles.star} ${styles.starThree}`}><Star size={12} fill="currentColor" /></span>
        <span className={`${styles.star} ${styles.starFour}`}><Sparkles size={20} /></span>
        <div className={`${styles.cloud} ${styles.cloudLeft}`}><Cloud size={62} fill="currentColor" /></div>
        <div className={`${styles.cloud} ${styles.cloudRight}`}><Cloud size={86} fill="currentColor" /></div>
      </div>

      <header className={styles.navbar}>
        <nav className={styles.navLinks} aria-label="????">
          <button className={activeFeature === "coding" ? styles.navLinkActive : ""} type="button" onClick={() => scrollToFeature("coding")}>?????</button>
          <button className={activeFeature === "storybook" ? styles.navLinkActive : ""} type="button" onClick={openStorybook}>????</button>
          <button className={activeFeature === "voice" ? styles.navLinkActive : ""} type="button" onClick={() => scrollToFeature("voice")}>??</button>
        </nav>
      </header>

      <section className={styles.hero} id="top" ref={heroRef}>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleOutline}>?????</span>
            <span className={styles.heroTitleSolid}>Ai????-??</span>
          </h1>
          <p>???????????????????????????????????????????</p>
        </div>
        <div
          className={`${styles.heroPetPatrol} ${heroPetPatrolPaused ? styles.heroPetPatrolPaused : ""} ${petPatrolDragging ? styles.heroPetPatrolDragging : ""}`}
          data-pet-mood={petMood}
          data-patrol-state={heroPetPatrolState}
          data-patrol-direction={heroPetPatrolDirection}
          ref={heroPetPatrolRef}
          style={heroPetPatrolStyle}
        >
          <button
            className={`${styles.petLauncher} ${petOpen ? styles.petLauncherOpen : ""} ${petPatrolDragging ? styles.petLauncherDragging : ""}`}
            ref={petLauncherRef}
            type="button"
            onClick={handlePetClick}
            onPointerDown={handlePetPatrolPointerDown}
            onPointerMove={handlePetPatrolPointerMove}
            onPointerUp={handlePetPatrolPointerUp}
            onPointerCancel={handlePetPatrolPointerUp}
            onMouseEnter={() => { if (!petOpen) playPetMood("idle", 0); }}
            aria-label={petOpen ? "Close star chat" : "Open star chat"}
            title="???????"
          >
            <span className={styles.petPatrolSprite} aria-hidden="true">
              <span className={styles.petPatrolIdle}>
                <StarbaoSprite mood={petMood} />
              </span>
              <span className={styles.petPatrolWalk}>
                <StarbaoSprite mood="walk" />
              </span>
            </span>
          </button>
        </div>
        <div className={styles.heroJourney}>
          <StarJourneyCard />
        </div>
      </section>

      <section className={styles.sceneGallery} aria-labelledby="scene-gallery-title">
        <div className={styles.sceneGalleryHeader}>
          <h2 id="scene-gallery-title">?????????????</h2>
        </div>
        <div className={styles.exhibitHall} role="region" aria-label="????">
          {schoolStages.map((stage, index) => (
            <article
              className={styles.exhibitBay}
              data-stage={stage.id}
              key={stage.id}
            >
              <span className={styles.exhibitArtwork} aria-hidden="true">
                <Image src={stage.image} alt="" width={982} height={1024} sizes="(max-width: 680px) 72vw, 420px" loading={stage.id === "primary" ? "eager" : "lazy"} />
              </span>
              <div className={styles.exhibitFooter}>
                <div className={styles.exhibitMeta}>
                  <span className={styles.exhibitBayNumber}>0{index + 1}</span>
                </div>
                <span className={styles.exhibitStageLabel}>{stage.buttonLabel}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.featureIntro} id="classroom">
        <div>
          <h2>????????<br /><em>??????????</em></h2>
          <p>??????????????????????????????????????????????</p>
        </div>
        <ol className={styles.featureIndex} aria-label="??????">
          <li><span>01</span><strong>??????</strong></li>
          <li><span>02</span><strong>??????</strong></li>
          <li><span>03</span><strong>??????</strong></li>
        </ol>
      </section>

      <section className={`${styles.featureModule} ${styles.voiceModule}`} id="voice-dialogue">
        <div className={styles.featureModuleInner}>
          <div className={styles.moduleCopy}>
            <h2>??????<br /><em>????????</em></h2>
            <p>?????????????????????????????????????????</p>
          </div>
          <div className={`${styles.featureScene} ${styles.voiceScene}`} role="group" aria-label="????????">
            <Image
              className={styles.featureScreenshot}
              src="/assets/chat/starbao-dialogue-preview.png"
              alt="????????"
              width={446}
              height={477}
            />
          </div>
        </div>
      </section>

      <section className={`${styles.featureModule} ${styles.storyModule}`} id="storybook-reading">
        <div className={`${styles.featureModuleInner} ${styles.featureModuleInnerReverse}`}>
          <div className={styles.moduleCopy}>
            <h2>???????<br /><em>???????</em></h2>
            <p>??????????????????????????????????????</p>
          </div>
          <div className={`${styles.featureScene} ${styles.storyScene}`} role="group" aria-label="??????">
            <div className={styles.sceneTopbar}><span>STORY BOOK</span><strong>? {storyPreviewPage + 1} / {storyPreviewPages.length} ?</strong></div>
            <div className={styles.storyBookFrame}>
              <div className={styles.storyIllustration}><span>{activeStory.scene}</span><i>3</i><i>1</i><i>2</i></div>
              <div className={styles.storyPageCopy}><small>???????</small><h3>{activeStory.title}</h3><p>{activeStory.narration}</p></div>
              <div className={styles.storyControls}>
                <button type="button" onClick={() => setStoryPreviewPage((page) => Math.max(0, page - 1))} disabled={storyPreviewPage === 0} aria-label="???"><ArrowLeft size={16} /></button>
                <span>{activeStory.scene}</span>
                <button type="button" onClick={() => setStoryPreviewPage((page) => Math.min(storyPreviewPages.length - 1, page + 1))} disabled={storyPreviewPage === storyPreviewPages.length - 1} aria-label="???"><ArrowRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.featureModule} ${styles.codingModule}`} id="coding-practice">
        <div className={styles.featureModuleInner}>
          <div className={styles.moduleCopy}>
            <h2>?????????<br /><em>????????</em></h2>
            <p>?????????????????????????????????????</p>
          </div>
          <div className={`${styles.featureScene} ${styles.codingScene}`} role="group" aria-label="Python ????">
            <div className={`${styles.sceneTopbar} ${styles.terminalTopbar}`}><span><i></i><i></i><i></i>TERMINAL</span><strong>Python 3.12</strong></div>
            <div className={styles.codeWorkbench}>
              <div className={styles.codeGutter}>{codingLines.map((_, index) => <span key={index}>{index + 1}</span>)}</div>
              <code>{codingLines.map((line, index) => <span key={index}>{line}</span>)}</code>
            </div>
            <div className={styles.codingMatch} data-ready={codingMatched}><span>{codingMatched ? `>>> ready: ${selectedStage.label} ? ${codingTemplate}` : ">>> waiting for stage selection"}</span><strong>{codingMatched ? "run exercise" : "idle"}</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.robotSection} id="robot">
        <div className={styles.robotCopy}>
          <h2>??????????<br /><em>?????????</em></h2>
          <p>?????????????????????? OrangePi ???????????????????</p>
        </div>
        <div className={styles.robotStage}>
          <div className={styles.pixelWoodFrame}>
            <button className={styles.referencePet} type="button" ref={referencePetRef} onClick={handleReferencePetClick} aria-expanded={petOpen} aria-label={petOpen ? "??????" : "??????"}>
              <StarbaoSprite mood="idle" />
            </button>
          </div>
        </div>
      </section>

      {entryDialog ? (
        <div className={styles.entryBackdrop} role="presentation" onClick={() => setEntryDialog(null)}>
          {entryDialog === "programming" ? (
            <section className={styles.entryDialog} role="dialog" aria-modal="true" aria-labelledby="programming-dialog-title" onClick={(event) => event.stopPropagation()}>
              <div className={styles.entryDialogHeader}>
                <div><span>?????</span><h2 id="programming-dialog-title">??????????</h2></div>
                <button className={styles.entryClose} type="button" onClick={() => setEntryDialog(null)} aria-label="??"><X size={18} /></button>
              </div>
              <p className={styles.entryDialogLead}>?????????????????????????? Python ???</p>
              <fieldset className={styles.choiceGroup}>
                <legend>???????????</legend>
                <div className={styles.stageChoices}>
                  {labStageOptions.map((option) => (
                    <button className={labStage === option.id ? styles.choiceActive : ""} type="button" key={option.id} aria-pressed={labStage === option.id} onClick={() => setLabStage(option.id)}>
                      <strong>{option.label}</strong><small>{option.detail}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className={styles.choiceGroup}>
                <legend>??????????</legend>
                <div className={styles.familiarityChoices}>
                  {labFamiliarityOptions.map((option) => (
                    <button className={labFamiliarity === option.id ? styles.choiceActive : ""} type="button" key={option.id} aria-pressed={labFamiliarity === option.id} onClick={() => setLabFamiliarity(option.id)}>
                      <strong>{option.label}</strong><small>{option.detail}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className={styles.entryDialogActions}>
                <button className={styles.dialogCancel} type="button" onClick={() => setEntryDialog(null)}>????</button>
                <button className={styles.dialogConfirm} type="button" onClick={enterProgrammingLab}>?????? <ArrowRight size={16} /></button>
              </div>
            </section>
          ) : (
            <section className={styles.entryDialog} role="dialog" aria-modal="true" aria-labelledby="future-dialog-title" onClick={(event) => event.stopPropagation()}>
              <div className={styles.entryDialogHeader}>
                <div><span>?????</span><h2 id="future-dialog-title">????????</h2></div>
                <button className={styles.entryClose} type="button" onClick={() => setEntryDialog(null)} aria-label="??"><X size={18} /></button>
              </div>
              <p className={styles.entryDialogLead}>???????????????????????????????????????</p>
              <div className={styles.futureStageChoices}>
                <button type="button" onClick={() => openFutureStage("middle_school")}><span><strong>?????</strong><small>????????????</small></span><ArrowRight size={20} /></button>
                <button type="button" onClick={() => openFutureStage("high_school")}><span><strong>?????</strong><small>?????????????</small></span><ArrowRight size={20} /></button>
              </div>
            </section>
          )}
        </div>
      ) : null}

      {petOpen ? (
        <aside className={`${styles.petPanel} ${petPanelPosition ? styles.petPanelAttached : ""} ${petPanelDragging ? styles.petPanelDragging : ""}`} style={petPanelStyle} ref={petPanelRef} aria-label="???????">
          <div
            className={styles.petPanelHeader}
            data-testid="starbao-chat-drag-handle"
            onPointerDown={handlePetPanelPointerDown}
            onPointerMove={handlePetPanelPointerMove}
            onPointerUp={handlePetPanelPointerUp}
            onPointerCancel={handlePetPanelPointerUp}
            onLostPointerCapture={() => finishPetPanelDrag()}
            title="??????"
          >
            <div className={`${styles.petIdentity} ${styles.petIdentityStar}`}><span className={`${styles.petMini} ${styles.petMiniSprite}`}><StarbaoSprite mood={starbaoSending ? "thinking" : "idle"} /></span><span><strong>??</strong><small>???? ? ??</small></span></div>
            <button className={styles.iconButton} type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setPetOpen(false); setPetPanelPosition(null); setPetPanelDetached(false); }} aria-label="??"><X size={18} /></button>
          </div>
          <div className={styles.messageList} ref={messageListRef}>
            {starbaoLoading ? <p className={styles.petChatStatus}>??????...</p> : null}
            {starbaoMessages.map((message) => (
              <div
                className={`${styles.message} ${message.role === "user" ? styles.messageUser : ""}`}
                key={message.messageId}
              >
                <span className={styles.petMessageMeta}>
                  {message.origin === "web" ? "????" : message.origin === "asr" ? "?????" : message.origin === "orangepi" ? "?????" : "??"}
                </span>
                {message.content}
              </div>
            ))}
            {starbaoSending ? <StarbaoThinkingIndicator /> : null}
            {starbaoError ? <p className={styles.petChatStatus} role="alert">???????????????</p> : null}
          </div>
          <div className={styles.petComposer}><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} placeholder="???????" aria-label="???????" /><button type="button" onClick={() => void sendMessage()} aria-label="??" disabled={starbaoSending || !draft.trim()}><Send size={16} /></button></div>
        </aside>
      ) : null}
    </main>
  );
}
