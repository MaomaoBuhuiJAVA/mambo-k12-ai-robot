"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  Cloud,
  GraduationCap,
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

type FloorId = "explore" | "create" | "future";
type PetMood = Exclude<StarbaoMood, "walk">;
type PetChatAnchor = "launcher" | "reference";
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
    title: "小小探索家",
    subtitle: "小学低年级",
    description: "从故事、声音和颜色开始，发现身边的人工智能。",
    accent: "sun",
    modules: ["绘本课堂", "声音游戏", "看图发现"],
    cardFocus: "故事 · 声音 · 观察",
    courseId: "lower-bubble-sort",
  },
  {
    id: "create",
    level: "02",
    title: "创意实验室",
    subtitle: "小学高年级",
    description: "把好奇心变成动画、实验和第一段会运行的代码。",
    accent: "mint",
    modules: ["动画课堂", "编程练习", "知识闯关"],
    cardFocus: "动画 · 编程 · 实验",
    courseId: "upper-loop-maze",
  },
  {
    id: "future",
    level: "03",
    title: "未来研究所",
    subtitle: "初中 · 高中",
    description: "理解算法、模型和真实世界里的项目，做出自己的答案。",
    accent: "violet",
    modules: ["算法实验", "模型观察", "项目学习"],
    cardFocus: "算法 · 模型 · 项目",
    courseId: "middle-neural-signals",
  },
];

const storyPreviewPages = [
  {
    title: "数字泡泡出发了",
    narration: "先看看谁和谁站在一起，再决定下一步。",
    scene: "相邻比较",
  },
  {
    title: "换个位置试试看",
    narration: "当左边更大时，让两颗泡泡交换位置。",
    scene: "交换",
  },
  {
    title: "排好队的秘密",
    narration: "重复观察，直到每颗泡泡都找到自己的位置。",
    scene: "从小到大",
  },
] as const;

const PET_PANEL_PREFERRED_HEIGHT = 382;
const PET_SLEEP_DELAY_MS = 30_000;

const schoolStages = [
  {
    id: "primary",
    image: "/assets/learning-stages/primary-reading.png",
    buttonLabel: "小学",
    subtitle: "故事与发现",
    description: "从绘本、地图和知识战斗开始。",
    href: "/map",
    icon: BookOpen,
  },
  {
    id: "middle",
    image: "/assets/learning-stages/middle-writing.png",
    buttonLabel: "初中",
    subtitle: "算法与模型",
    description: "通过课程、练习和实验建立 AI 基础。",
    href: "/learn?stage=middle_school&grade=middle_1&view=courses",
    icon: GraduationCap,
  },
  {
    id: "high",
    image: "/assets/learning-stages/high-coding.png",
    buttonLabel: "高中",
    subtitle: "代码与项目",
    description: "用数据、指标和项目证据完成研究。",
    href: "/learn?stage=high_school&view=path",
    icon: Code2,
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
  const [storyPreviewPage, setStoryPreviewPage] = useState(0);
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
        <Link className={styles.homeBrand} href="/preview">
          <strong>星宝课堂</strong>
        </Link>
        <nav className={styles.navLinks} aria-label="首页导航">
          <Link className={styles.navLinkActive} href="/preview">主页</Link>
          <Link href="/learn?stage=middle_school&grade=middle_1&view=path">学习</Link>
          <Link href="/learn/tutor/middle-ai-foundations%3Aconcepts%3Arules-and-models?stage=middle_school&grade=middle_1">AI 导师</Link>
          <details className={styles.homeGradeMenu}>
            <summary>年级</summary>
            <div className={styles.homeGradeMenuPanel}>
              <Link href="/map">小学</Link>
              <Link href="/learn?stage=middle_school&grade=middle_1&view=courses">初中</Link>
              <Link href="/learn?stage=high_school&view=path">高中</Link>
            </div>
          </details>
          <Link href="/learn?stage=high_school&view=path">项目</Link>
        </nav>
      </header>

      <section className={styles.hero} id="top" ref={heroRef}>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleOutline}>从小教到大</span>
            <span className={styles.heroTitleSolid}>Ai学习伙伴-星宝</span>
          </h1>
          <p>从认识世界，到创造作品，再到研究未来。选择适合你的学习阶段，和星星一起开始今天的探索。</p>
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
            title="点击和星宝聊天"
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
          <h2 id="scene-gallery-title">从绘本到编程，星宝如影随形</h2>
        </div>
        <div className={styles.exhibitHall} role="region" aria-label="成长展厅">
          {schoolStages.map((stage, index) => {
            const StageIcon = stage.icon;
            return (
            <Link
              className={styles.exhibitBay}
              data-stage={stage.id}
              href={stage.href}
              key={stage.id}
              aria-label={`${stage.buttonLabel}，${stage.subtitle}，进入学习中心`}
            >
              <span className={styles.exhibitArtwork} aria-hidden="true">
                <Image src={stage.image} alt="" width={982} height={1024} sizes="(max-width: 680px) 72vw, 420px" loading={stage.id === "primary" ? "eager" : "lazy"} />
              </span>
              <div className={styles.exhibitFooter}>
                <div className={styles.exhibitMeta}>
                  <span className={styles.exhibitBayNumber}>0{index + 1}</span>
                  <span className={styles.exhibitStageSubtitle}>{stage.subtitle}</span>
                  <strong className={styles.exhibitStageLabel}>{stage.buttonLabel}</strong>
                  <small className={styles.exhibitStageDescription}>{stage.description}</small>
                </div>
                <span className={styles.exhibitStageAction}><StageIcon aria-hidden="true" size={16} />进入</span>
              </div>
            </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.featureIntro} id="classroom">
        <div>
          <h2>学习不是一张卡片<br /><em>而是一段会发生的旅程</em></h2>
          <p>声音、故事和动手实验在同一座学习屋里接力发生。往下走，每一站都可以直接开始，不需要离开首页。</p>
        </div>
        <ol className={styles.featureIndex} aria-label="学习功能顺序">
          <li><span>01</span><strong>智能语音对话</strong></li>
          <li><span>02</span><strong>绘本动画阅读</strong></li>
          <li><span>03</span><strong>编程实操训练</strong></li>
        </ol>
      </section>

      <section className={`${styles.featureModule} ${styles.voiceModule}`} id="voice-dialogue">
        <div className={styles.featureModuleInner}>
          <div className={styles.moduleCopy}>
            <h2>一句话开门，<br /><em>星宝就开始陪你想</em></h2>
            <p>把不懂的地方说出来，星宝会沿着你正在学的内容继续追问、解释，或带你回到刚才的故事。</p>
          </div>
          <div className={`${styles.featureScene} ${styles.voiceScene}`} role="group" aria-label="星宝聊天窗口预览">
            <Image
              className={styles.featureScreenshot}
              src="/assets/chat/starbao-dialogue-preview.png"
              alt="星宝聊天窗口截图"
              width={446}
              height={477}
            />
          </div>
        </div>
      </section>

      <section className={`${styles.featureModule} ${styles.storyModule}`} id="storybook-reading">
        <div className={`${styles.featureModuleInner} ${styles.featureModuleInnerReverse}`}>
          <div className={styles.moduleCopy}>
            <h2>把抽象的知识，<br /><em>读成会动的故事</em></h2>
            <p>一页只讲一个动作：观察、比较、交换。读到关键处，角色会停下来等你说出下一步。</p>
          </div>
          <div className={`${styles.featureScene} ${styles.storyScene}`} role="group" aria-label="互动绘本预览">
            <div className={styles.sceneTopbar}><span>STORY BOOK</span><strong>第 {storyPreviewPage + 1} / {storyPreviewPages.length} 页</strong></div>
            <div className={styles.storyBookFrame}>
              <div className={styles.storyIllustration}><span>{activeStory.scene}</span><i>3</i><i>1</i><i>2</i></div>
              <div className={styles.storyPageCopy}><small>冒泡排序探险记</small><h3>{activeStory.title}</h3><p>{activeStory.narration}</p></div>
              <div className={styles.storyControls}>
                <button type="button" onClick={() => setStoryPreviewPage((page) => Math.max(0, page - 1))} disabled={storyPreviewPage === 0} aria-label="上一页"><ArrowLeft size={16} /></button>
                <span>{activeStory.scene}</span>
                <button type="button" onClick={() => setStoryPreviewPage((page) => Math.min(storyPreviewPages.length - 1, page + 1))} disabled={storyPreviewPage === storyPreviewPages.length - 1} aria-label="下一页"><ArrowRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.featureModule} ${styles.codingModule}`} id="coding-practice">
        <div className={styles.featureModuleInner}>
          <div className={styles.moduleCopy}>
            <h2>把刚刚想明白的事，<br /><em>变成能运行的代码</em></h2>
            <p>先选好年级和熟悉程度，学习屋会把同一个问题换成适合现在的提示、任务和挑战。</p>
          </div>
          <div className={`${styles.featureScene} ${styles.codingScene}`} role="group" aria-label="Python 终端预览">
            <div className={`${styles.sceneTopbar} ${styles.terminalTopbar}`}><span><i></i><i></i><i></i>TERMINAL</span><strong>Python 3.12</strong></div>
            <div className={styles.codeWorkbench}>
              <div className={styles.codeGutter}>{codingLines.map((_, index) => <span key={index}>{index + 1}</span>)}</div>
              <code>{codingLines.map((line, index) => <span key={index}>{line}</span>)}</code>
            </div>
            <div className={styles.codingMatch}><span>{`>>> ${codingTemplate} · choose a learning path`}</span><strong>ready</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.robotSection} id="robot">
        <div className={styles.robotCopy}>
          <h2>星星不只是一个头像，<br /><em>它住在你的学习桌上</em></h2>
          <p>它会留在这张首页里。你可以随时打开对话、查看 OrangePi 的在线状态，或者继续刚才停下来的学习。</p>
        </div>
        <div className={styles.robotStage}>
          <div className={styles.pixelWoodFrame}>
            <button className={styles.referencePet} type="button" ref={referencePetRef} onClick={handleReferencePetClick} aria-expanded={petOpen} aria-label={petOpen ? "关闭星宝对话" : "打开星宝对话"}>
              <StarbaoSprite mood="idle" />
            </button>
          </div>
        </div>
      </section>

      {petOpen ? (
        <aside className={`${styles.petPanel} ${petPanelPosition ? styles.petPanelAttached : ""} ${petPanelDragging ? styles.petPanelDragging : ""}`} style={petPanelStyle} ref={petPanelRef} aria-label="星星智能体面板">
          <div
            className={styles.petPanelHeader}
            data-testid="starbao-chat-drag-handle"
            onPointerDown={handlePetPanelPointerDown}
            onPointerMove={handlePetPanelPointerMove}
            onPointerUp={handlePetPanelPointerUp}
            onPointerCancel={handlePetPanelPointerUp}
            onLostPointerCapture={() => finishPetPanelDrag()}
            title="拖动聊天窗口"
          >
            <div className={`${styles.petIdentity} ${styles.petIdentityStar}`}><span className={`${styles.petMini} ${styles.petMiniSprite}`}><StarbaoSprite mood={starbaoSending ? "thinking" : "idle"} /></span><span><strong>星宝</strong><small>学习伙伴 · 在线</small></span></div>
            <button className={styles.iconButton} type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setPetOpen(false); setPetPanelPosition(null); setPetPanelDetached(false); }} aria-label="关闭"><X size={18} /></button>
          </div>
          <div className={styles.messageList} ref={messageListRef}>
            {starbaoLoading ? <p className={styles.petChatStatus}>正在连接星宝...</p> : null}
            {starbaoMessages.map((message) => (
              <div
                className={`${styles.message} ${message.role === "user" ? styles.messageUser : ""}`}
                key={message.messageId}
              >
                <span className={styles.petMessageMeta}>
                  {message.origin === "web" ? "网页输入" : message.origin === "asr" ? "香橙派语音" : message.origin === "orangepi" ? "香橙派输入" : "星宝"}
                </span>
                {message.content}
              </div>
            ))}
            {starbaoSending ? <StarbaoThinkingIndicator /> : null}
            {starbaoError ? <p className={styles.petChatStatus} role="alert">星宝暂时无法同步，请稍后再试。</p> : null}
          </div>
          <div className={styles.petComposer}><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} placeholder="和星宝说点什么" aria-label="和星宝说点什么" /><button type="button" onClick={() => void sendMessage()} aria-label="发送" disabled={starbaoSending || !draft.trim()}><Send size={16} /></button></div>
        </aside>
      ) : null}
    </main>
  );
}
