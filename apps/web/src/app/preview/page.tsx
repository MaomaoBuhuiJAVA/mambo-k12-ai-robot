"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Cloud,
  Code2,
  Cpu,
  FlaskConical,
  Headphones,
  MessageCircle,
  Mic,
  MonitorCog,
  Radio,
  Send,
  Settings2,
  Sparkles,
  Star,
  Volume2,
  X,
} from "lucide-react";

import styles from "./page.module.css";
import { resolvePetPanelLeft } from "./pet-panel-position";
import type { Stage } from "@/lib/domain";

type FloorId = "explore" | "create" | "future";
type PetMood = "idle" | "running-right" | "running-left" | "waving" | "jumping" | "waiting" | "running" | "review";
type PetChatAnchor = "launcher" | "reference";
type EntryDialog = "programming" | "future" | null;
type LabFamiliarity = "first_steps" | "guided" | "ready";
type HomepageFeature = "voice" | "storybook" | "coding";
type PetPosition = { x: number; y: number };
type PetPanelPosition = { left: number; top: number; placement: "above" | "below" };
type PetDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  moved: boolean;
  cleanup?: () => void;
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

const labStageOptions: Array<{ id: Stage; label: string; detail: string }> = [
  { id: "lower_primary", label: "小学低年级", detail: "从图像、声音和小游戏开始" },
  { id: "upper_primary", label: "小学高年级", detail: "把想法写成第一段代码" },
  { id: "middle_school", label: "初中", detail: "理解算法和模型的规则" },
  { id: "high_school", label: "高中", detail: "完成更完整的分析挑战" },
];

const labFamiliarityOptions: Array<{ id: LabFamiliarity; label: string; detail: string }> = [
  { id: "first_steps", label: "第一次尝试", detail: "先用可视化线索理解步骤" },
  { id: "guided", label: "会一点基础", detail: "带着分级提示完成练习" },
  { id: "ready", label: "想独立挑战", detail: "直接进入算法或模型任务" },
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

const homepageFeatureTargets: Record<HomepageFeature, string> = {
  voice: "voice-dialogue",
  storybook: "storybook-reading",
  coding: "coding-practice",
};

const petReplies = [
  "我在这里！我们可以先选一层学习屋。",
  "想做一个会动的动画，还是试试第一段 Python？",
  "你的 OrangePi 现在是演示在线状态，可以随时叫醒我。",
];

const starScenes = [
  {
    id: "rain",
    label: "雨夜街道",
    title: "把好奇心点亮",
    detail: "雨水、霓虹和一颗会挥手的星星。",
    image: "/assets/star-scene-rain.jpg",
    tone: "rain",
  },
  {
    id: "moon",
    label: "月球观测",
    title: "从远处看世界",
    detail: "在月面停一会儿，再想一个更大的问题。",
    image: "/assets/star-scene-moon.jpg",
    tone: "moon",
  },
  {
    id: "rooftop",
    label: "城市屋顶",
    title: "今晚也要挥手",
    detail: "站在城市上方，给下一次冒险打个招呼。",
    image: "/assets/star-scene-rooftop.jpg",
    tone: "rooftop",
  },
] as const;

export default function PreviewPage() {
  const router = useRouter();
  const [activeFloor, setActiveFloor] = useState<FloorId>("explore");
  const [petOpen, setPetOpen] = useState(false);
  const [petChatAnchor, setPetChatAnchor] = useState<PetChatAnchor>("launcher");
  const [petMood, setPetMood] = useState<PetMood>("idle");
  const [petPosition, setPetPosition] = useState<PetPosition | null>(null);
  const [petDragging, setPetDragging] = useState(false);
  const [petPanelPosition, setPetPanelPosition] = useState<PetPanelPosition | null>(null);
  const [petTab, setPetTab] = useState<"chat" | "device">("chat");
  const [draft, setDraft] = useState("");
  const [entryDialog, setEntryDialog] = useState<EntryDialog>(null);
  const [labStage, setLabStage] = useState<Stage>("lower_primary");
  const [labFamiliarity, setLabFamiliarity] = useState<LabFamiliarity>("first_steps");
  const [activeFeature, setActiveFeature] = useState<HomepageFeature>("voice");
  const [storyPreviewPage, setStoryPreviewPage] = useState(0);
  const [voicePreviewActive, setVoicePreviewActive] = useState(false);
  const [codingMatched, setCodingMatched] = useState(false);
  const petDragRef = useRef<PetDrag | null>(null);
  const petLauncherRef = useRef<HTMLButtonElement>(null);
  const referencePetRef = useRef<HTMLButtonElement>(null);
  const petPanelRef = useRef<HTMLElement>(null);
  const petPanelOffsetXRef = useRef<number | null>(null);
  const petMotionFrameRef = useRef<number | null>(null);
  const pendingPetPositionRef = useRef<PetPosition | null>(null);
  const petSuppressClickRef = useRef(false);
  const petMoodTimerRef = useRef<number | null>(null);
  const petWaitingTimerRef = useRef<number | null>(null);
  const petMoodRef = useRef<PetMood>("idle");
  const [messages, setMessages] = useState([
    { from: "pet", text: "你好，我是星星。今天想去哪一层？" },
    { from: "user", text: "我想先看看这座学习屋。" },
  ]);

  const setPetMoodIfChanged = useCallback((mood: PetMood) => {
    if (petMoodRef.current === mood) return;
    petMoodRef.current = mood;
    setPetMood(mood);
  }, []);

  useEffect(() => {
    petWaitingTimerRef.current = window.setTimeout(() => setPetMoodIfChanged("waiting"), 6500);
    return () => {
      if (petMoodTimerRef.current) window.clearTimeout(petMoodTimerRef.current);
      if (petWaitingTimerRef.current) window.clearTimeout(petWaitingTimerRef.current);
      if (petMotionFrameRef.current !== null) window.cancelAnimationFrame(petMotionFrameRef.current);
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

  const getPetPanelPosition = useCallback((position: PetPosition, petWidth: number, petHeight: number) => {
    const panel = petPanelRef.current;
    if (!panel) return null;

    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const gap = 12;
    const left = resolvePetPanelLeft({
      petX: position.x,
      petWidth,
      panelWidth,
      viewportWidth: window.innerWidth,
    });
    const canOpenAbove = position.y >= panelHeight + gap;
    const canOpenBelow = window.innerHeight - (position.y + petHeight) >= panelHeight + gap;
    const placement: PetPanelPosition["placement"] = canOpenAbove || !canOpenBelow ? "above" : "below";

    return {
      left,
      top: placement === "above" ? position.y - gap : position.y + petHeight + gap,
      placement,
    };
  }, []);

  const applyPetPosition = useCallback((position: PetPosition, petWidth: number, petHeight: number) => {
    const pet = petLauncherRef.current;
    if (!pet) return null;

    pet.style.left = `${position.x}px`;
    pet.style.top = `${position.y}px`;
    pet.style.right = "auto";
    pet.style.bottom = "auto";

    if (!petOpen || petChatAnchor !== "launcher") return null;
    const panel = petPanelRef.current;
    const panelPosition = getPetPanelPosition(position, petWidth, petHeight);
    if (!panel || !panelPosition) return null;

    const panelOffsetX = petPanelOffsetXRef.current;
    if (typeof panelOffsetX === "number") {
      panelPosition.left = resolvePetPanelLeft({
        petX: position.x,
        petWidth,
        panelWidth: panel.offsetWidth,
        viewportWidth: window.innerWidth,
        offsetX: panelOffsetX,
      });
    }

    panel.style.left = `${panelPosition.left}px`;
    panel.style.top = `${panelPosition.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.transform = panelPosition.placement === "above" ? "translateY(-100%)" : "none";

    return panelPosition;
  }, [getPetPanelPosition, petChatAnchor, petOpen]);

  const updatePetPanelPosition = useCallback(() => {
    const pet = petChatAnchor === "reference" ? referencePetRef.current : petLauncherRef.current;
    if (!petOpen || !pet) return;

    const petRect = pet.getBoundingClientRect();
    const next = getPetPanelPosition({ x: petRect.left, y: petRect.top }, petRect.width, petRect.height);
    if (!next) return;

    if (petChatAnchor === "launcher" && petPanelOffsetXRef.current !== null) {
      next.left = resolvePetPanelLeft({
        petX: petRect.left,
        petWidth: petRect.width,
        panelWidth: petPanelRef.current?.offsetWidth ?? 0,
        viewportWidth: window.innerWidth,
        offsetX: petPanelOffsetXRef.current,
      });
    }

    setPetPanelPosition((previous) => {
      return previous && previous.left === next.left && previous.top === next.top && previous.placement === next.placement ? previous : next;
    });
  }, [getPetPanelPosition, petChatAnchor, petOpen]);

  useLayoutEffect(() => {
    if (!petOpen) return;
    updatePetPanelPosition();
    window.addEventListener("resize", updatePetPanelPosition);
    return () => window.removeEventListener("resize", updatePetPanelPosition);
  }, [petOpen, petPosition, updatePetPanelPosition]);

  function schedulePetWaiting() {
    if (petWaitingTimerRef.current) window.clearTimeout(petWaitingTimerRef.current);
    petWaitingTimerRef.current = window.setTimeout(() => {
      if (!petDragRef.current) setPetMoodIfChanged("waiting");
    }, 6500);
  }

  function playPetMood(mood: PetMood, duration = 900) {
    if (petMoodTimerRef.current) window.clearTimeout(petMoodTimerRef.current);
    setPetMoodIfChanged(mood);
    if (duration > 0) {
      petMoodTimerRef.current = window.setTimeout(() => setPetMoodIfChanged("idle"), duration);
    }
    schedulePetWaiting();
  }

  function togglePetChat(anchor: PetChatAnchor = "launcher") {
    const nextOpen = !petOpen || petChatAnchor !== anchor;
    if (nextOpen) {
      setPetChatAnchor(anchor);
      setPetTab("chat");
      if (anchor !== "launcher") petPanelOffsetXRef.current = null;
    }
    setPetOpen(nextOpen);
    if (!nextOpen) {
      setPetPanelPosition(null);
      setPetChatAnchor("launcher");
      petPanelOffsetXRef.current = null;
    }
    playPetMood(nextOpen ? "waving" : "idle", nextOpen ? 1200 : 0);
  }

  function openPetPanel(tab: "chat" | "device", anchor: PetChatAnchor = "launcher") {
    setPetChatAnchor(anchor);
    setPetTab(tab);
    setPetOpen(true);
    if (anchor !== "launcher") petPanelOffsetXRef.current = null;
    playPetMood("waving", 1200);
  }

  function handlePetClick() {
    if (petSuppressClickRef.current) {
      petSuppressClickRef.current = false;
      return;
    }
    togglePetChat("launcher");
  }

  function handleReferencePetClick() {
    togglePetChat("reference");
  }

  function handlePetPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const panelRect = petOpen && petChatAnchor === "launcher"
      ? petPanelRef.current?.getBoundingClientRect()
      : null;
    const panelOffsetX = panelRect ? panelRect.left - rect.left : undefined;
    petPanelOffsetXRef.current = panelOffsetX ?? null;
    const onWindowMove = (moveEvent: MouseEvent) => updatePetDrag(moveEvent.clientX, moveEvent.clientY);
    const onWindowUp = () => finishPetDrag();
    pendingPetPositionRef.current = { x: rect.left, y: rect.top };
    petDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
      cleanup: () => {
        window.removeEventListener("mousemove", onWindowMove);
        window.removeEventListener("mouseup", onWindowUp);
      },
    };
    window.addEventListener("mousemove", onWindowMove);
    window.addEventListener("mouseup", onWindowUp);
    setPetDragging(true);
    if (petMoodTimerRef.current) window.clearTimeout(petMoodTimerRef.current);
    if (petWaitingTimerRef.current) window.clearTimeout(petWaitingTimerRef.current);
    setPetMoodIfChanged("running-right");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function updatePetDrag(clientX: number, clientY: number, pointerId?: number) {
    const drag = petDragRef.current;
    if (!drag || (typeof pointerId === "number" && drag.pointerId !== pointerId)) return;
    if (clientX === drag.lastX && clientY === drag.lastY) return;
    const distance = Math.hypot(clientX - drag.startX, clientY - drag.startY);
    if (distance > 7) drag.moved = true;
    if (!drag.moved) return;

    const maxX = Math.max(8, window.innerWidth - drag.width - 8);
    const maxY = Math.max(8, window.innerHeight - drag.height - 8);
    pendingPetPositionRef.current = {
      x: Math.min(maxX, Math.max(8, clientX - drag.offsetX)),
      y: Math.min(maxY, Math.max(8, clientY - drag.offsetY)),
    };

    if (petMotionFrameRef.current === null) {
      petMotionFrameRef.current = window.requestAnimationFrame(() => {
        petMotionFrameRef.current = null;
        const position = pendingPetPositionRef.current;
        if (position) applyPetPosition(position, drag.width, drag.height);
      });
    }

    const dx = clientX - drag.lastX;
    const dy = clientY - drag.lastY;
    if (Math.abs(dx) > Math.abs(dy) * 1.12) setPetMoodIfChanged(dx >= 0 ? "running-right" : "running-left");
    else setPetMoodIfChanged(dy < 0 ? "jumping" : "waving");
    drag.lastX = clientX;
    drag.lastY = clientY;
  }

  function handlePetPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    updatePetDrag(event.clientX, event.clientY, event.pointerId);
    event.preventDefault();
  }

  function finishPetDrag(pointerId?: number) {
    const drag = petDragRef.current;
    const element = petLauncherRef.current;
    if (!drag || (typeof pointerId === "number" && drag.pointerId !== pointerId)) return;
    petDragRef.current = null;
    if (petMotionFrameRef.current !== null) {
      window.cancelAnimationFrame(petMotionFrameRef.current);
      petMotionFrameRef.current = null;
    }
    const finalPosition = pendingPetPositionRef.current;
    pendingPetPositionRef.current = null;
    if (drag.moved && finalPosition) {
      const panelPosition = applyPetPosition(finalPosition, drag.width, drag.height);
      setPetPosition(finalPosition);
      if (panelPosition) setPetPanelPosition(panelPosition);
    }
    setPetDragging(false);
    drag.cleanup?.();
    if (element && typeof pointerId === "number" && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    if (drag.moved) {
      petSuppressClickRef.current = true;
      window.setTimeout(() => { petSuppressClickRef.current = false; }, 250);
      playPetMood("idle", 0);
    } else {
      schedulePetWaiting();
    }
  }

  function handlePetPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    finishPetDrag(typeof event.pointerId === "number" ? event.pointerId : undefined);
  }

  const petLauncherStyle = petPosition ? {
    left: `${petPosition.x}px`,
    top: `${petPosition.y}px`,
    right: "auto",
    bottom: "auto",
  } : undefined;
  const petPanelStyle = petPanelPosition ? {
    left: `${petPanelPosition.left}px`,
    top: `${petPanelPosition.top}px`,
    right: "auto",
    bottom: "auto",
    transform: petPanelPosition.placement === "above" ? "translateY(-100%)" : "none",
  } : undefined;

  function previewFloor(id: FloorId) {
    setActiveFloor(id);
  }

  function openFloor(id: FloorId) {
    previewFloor(id);
    if (id === "future") {
      setEntryDialog("future");
      return;
    }
    const floor = floors.find((item) => item.id === id);
    if (floor) router.push(`/?course=${floor.courseId}#workspace`);
  }

  function openFutureStage(stage: "middle_school" | "high_school") {
    setEntryDialog(null);
    const courseId = stage === "middle_school" ? "middle-neural-signals" : "high-bubble-analysis";
    router.push(`/?course=${courseId}#workspace`);
  }

  function scrollToFeature(feature: HomepageFeature) {
    setActiveFeature(feature);
    window.requestAnimationFrame(() => {
      document.getElementById(homepageFeatureTargets[feature])?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openStorybook() {
    scrollToFeature("storybook");
  }

  function openProgrammingDialog() {
    setEntryDialog("programming");
  }

  function enterProgrammingLab() {
    setCodingMatched(true);
    setEntryDialog(null);
    router.push(`/lab?stage=${labStage}&familiarity=${labFamiliarity}`);
  }

  function startVoiceDialogue() {
    const nextActive = !voicePreviewActive;
    setVoicePreviewActive(nextActive);
    setActiveFeature("voice");
    if (nextActive) {
      openPetPanel("chat");
      return;
    }
    setPetOpen(false);
    setPetPanelPosition(null);
    setPetChatAnchor("launcher");
  }

  function showRobotDeviceStatus() {
    openPetPanel("device", "reference");
  }

  function sendMessage() {
    const value = draft.trim();
    if (!value) return;
    setMessages((current) => [
      ...current,
      { from: "user", text: value },
      { from: "pet", text: petReplies[current.length % petReplies.length] },
    ]);
    setDraft("");
  }

  const activeStory = storyPreviewPages[storyPreviewPage]!;
  const selectedStage = labStageOptions.find((option) => option.id === labStage)!;
  const codingTemplate = labFamiliarity === "first_steps" ? "图像分类" : "冒泡排序";
  const codingLines = labFamiliarity === "first_steps"
    ? ["def classify_image(features):", "    scores = {\"leaf\": 0, \"ball\": 0}", "    # 找到图像里的线索", "    return max(scores, key=scores.get)"]
    : ["def bubble_sort(values):", "    result = values[:]", "    # 比较相邻的两个数字", "    return result"];

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
        <a className={styles.navPet} href="#robot" aria-label="星宝">
          <Image src="/assets/starbao-nav-peek.png" alt="挥手的星宝" width={426} height={693} priority />
        </a>
        <nav className={styles.navLinks} aria-label="首页导航">
          <button className={activeFeature === "coding" ? styles.navLinkActive : ""} type="button" onClick={() => scrollToFeature("coding")}>编程实验室</button>
          <button className={activeFeature === "storybook" ? styles.navLinkActive : ""} type="button" onClick={openStorybook}>动漫绘本</button>
          <button className={activeFeature === "voice" ? styles.navLinkActive : ""} type="button" onClick={() => scrollToFeature("voice")}>星宝</button>
        </nav>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <div className={styles.heroKicker}><span></span> 给每个好奇心一间房</div>
          <h1>一座会长大的<br /><em>星云学习屋</em></h1>
          <p>从认识世界，到创造作品，再到研究未来。选择适合你的楼层，和星星一起开始今天的探索。</p>
          <div className={styles.heroActions}>
            <button className={styles.primaryAction} type="button" onClick={() => openFloor("explore")}>
              开始探索 <ArrowRight size={18} />
            </button>
          </div>
          <div className={styles.heroNote}><Radio size={14} /> 星星机器人 · 演示在线</div>
        </div>

        <div className={styles.houseScene} id="house">
          <div className={styles.houseBackdrop} aria-hidden="true">
            <Image className={styles.houseSprite} src="/assets/external/gothicvania/house-b.png" alt="" width={210} height={244} loading="eager" unoptimized />
          </div>
          <div className={styles.houseGlow} aria-hidden="true"></div>
          <div className={styles.moon}><Star size={23} fill="currentColor" /></div>
          <div className={styles.houseRoof} aria-hidden="true">
            <div className={styles.roofStar}><Star size={38} fill="currentColor" /></div>
            <span className={styles.roofLine}></span>
          </div>
          <div className={`${styles.floorStack} ${styles[`active-${activeFloor}`]}`}>
            {floors.slice().reverse().map((floor) => {
              return (
                <button
                  className={`${styles.floor} ${styles[floor.accent]} ${activeFloor === floor.id ? styles.floorActive : ""}`}
                  key={floor.id}
                  type="button"
                  onClick={() => openFloor(floor.id)}
                  onFocus={() => previewFloor(floor.id)}
                  onMouseEnter={() => previewFloor(floor.id)}
                  aria-label={`${floor.title}，${floor.subtitle}，${floor.cardFocus}`}
                >
                  <span className={styles.floorCard}>
                    <span className={styles.floorLevel}>{floor.level}</span>
                    <span className={`${styles.floorIcon} ${styles[`floorIcon-${floor.id}`]}`} aria-hidden="true" />
                    <span className={styles.floorWords}>
                      <strong>{floor.title}</strong>
                      <small>{floor.subtitle}</small>
                      <em>{floor.cardFocus}</em>
                    </span>
                    <span className={`${styles.roomScene} ${styles[`room-${floor.id}`]}`} aria-hidden="true" />
                    <span className={styles.floorArrow}><ChevronRight size={20} /></span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.houseBase} aria-hidden="true">
            <span className={styles.window}><span></span><span></span></span>
            <span className={styles.door}><span></span></span>
            <span className={styles.flowerFlower}><Star size={20} fill="currentColor" /></span>
          </div>
          <div className={styles.pathLine} aria-hidden="true"><span></span><span></span><span></span></div>
          <div className={styles.floorHint}><span className={styles.hintDot}></span> 点击楼层，进入对应的学习屋</div>
          <a className={styles.houseExploreLink} href="#classroom">看看里面有什么 <ArrowDown size={16} /></a>
        </div>
      </section>

      <section className={styles.floorDetail} aria-live="polite">
        <div>
          <span className={styles.detailNumber}>当前选择 · {floors.find((floor) => floor.id === activeFloor)?.level}</span>
          <h2>{floors.find((floor) => floor.id === activeFloor)?.title}</h2>
          <p>{floors.find((floor) => floor.id === activeFloor)?.description}</p>
        </div>
        <div className={styles.moduleLine}>
          {floors.find((floor) => floor.id === activeFloor)?.modules.map((module) => <span key={module}><Check size={13} /> {module}</span>)}
          <button type="button" onClick={() => openFloor(activeFloor)}>进入学习屋 <ArrowRight size={15} /></button>
          <button className={styles.moduleChatButton} type="button" onClick={() => togglePetChat("launcher")}><MessageCircle size={15} /> 问问星宝</button>
        </div>
      </section>

      <section className={styles.sceneGallery} aria-labelledby="scene-gallery-title">
        <div className={styles.sceneGalleryHeader}>
          <div>
            <span className={styles.sectionKicker}><Star size={13} fill="currentColor" /> 星宝的像素旅程</span>
            <h2 id="scene-gallery-title">同一个星星人，<em>在不同地方继续发光</em></h2>
          </div>
          <span className={styles.galleryCounter}>03 / SCENES</span>
        </div>
        <div className={styles.sceneGalleryGrid}>
          {starScenes.map((scene, index) => (
            <article className={`${styles.sceneCard} ${styles[`sceneCard-${scene.tone}`]}`} key={scene.id}>
              <div className={styles.sceneCardMedia}>
                <Image src={scene.image} alt={`${scene.label}中的星宝`} width={384} height={480} loading="lazy" />
                <span className={styles.sceneCardIndex}>0{index + 1}</span>
                <span className={styles.sceneCardSticker}><Star size={12} fill="currentColor" /> 星宝</span>
              </div>
              <div className={styles.sceneCardBody}>
                <span>{scene.label}</span>
                <h3>{scene.title}</h3>
                <p>{scene.detail}</p>
                <button className={styles.sceneCardAction} type="button" onClick={() => openPetPanel("chat", "launcher")}>
                  <MessageCircle size={13} /> 问问星宝 <ArrowRight size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.featureIntro} id="classroom">
        <div>
          <span className={styles.sectionKicker}>网站功能</span>
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
            <span className={styles.sectionKicker}>01 · 智能语音对话</span>
            <h2>一句话开门，<br /><em>星宝就开始陪你想</em></h2>
            <p>把不懂的地方说出来，星宝会沿着你正在学的内容继续追问、解释，或带你回到刚才的故事。</p>
            <div className={styles.moduleTags}><span><Mic size={15} /> 听见问题</span><span><MessageCircle size={15} /> 接着追问</span><span><Volume2 size={15} /> 讲给你听</span></div>
            <div className={styles.moduleActions}>
              <button className={styles.modulePrimary} type="button" onClick={startVoiceDialogue}><Mic size={17} /> {voicePreviewActive ? "正在和星宝对话" : "和星宝开始对话"} <ArrowRight size={15} /></button>
              <button className={styles.moduleSecondary} type="button" onClick={() => scrollToFeature("storybook")}><BookOpen size={17} /> 去听一个故事</button>
            </div>
          </div>
          <div className={`${styles.featureScene} ${styles.voiceScene}`} role="group" aria-label="星宝语音对话预览">
            <div className={styles.sceneTopbar}><span>VOICE STATION</span><strong data-active={voicePreviewActive}>在线</strong></div>
            <div className={styles.voiceTerminal}>
              <div className={styles.voiceLine}><span>星宝</span><p>今天想先从哪一个问题开始？</p></div>
              <div className={`${styles.voiceLine} ${styles.voiceLineUser}`}><span>我</span><p>为什么数字要排队？</p></div>
              <div className={`${styles.voiceWave} ${voicePreviewActive ? styles.voiceWaveActive : ""}`} aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
            </div>
            <span className={`${styles.scenePet} ${styles.petSprite} ${voicePreviewActive ? styles.petSpriteWaving : styles.petSpriteIdle}`} aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className={`${styles.featureModule} ${styles.storyModule}`} id="storybook-reading">
        <div className={`${styles.featureModuleInner} ${styles.featureModuleInnerReverse}`}>
          <div className={styles.moduleCopy}>
            <span className={styles.sectionKicker}>02 · 绘本动画阅读</span>
            <h2>把抽象的知识，<br /><em>读成会动的故事</em></h2>
            <p>一页只讲一个动作：观察、比较、交换。读到关键处，角色会停下来等你说出下一步。</p>
            <div className={styles.moduleTags}><span><BookOpen size={15} /> 分幕阅读</span><span><Sparkles size={15} /> 动作提示</span><span><Headphones size={15} /> 朗读陪伴</span></div>
            <div className={styles.moduleActions}>
              <button className={styles.modulePrimary} type="button" onClick={() => setStoryPreviewPage((page) => (page + 1) % storyPreviewPages.length)}><BookOpen size={17} /> 翻到下一页 <ArrowRight size={15} /></button>
              <button className={styles.moduleSecondary} type="button" onClick={() => scrollToFeature("coding")}><Code2 size={17} /> 把故事变成代码</button>
            </div>
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
            <span className={styles.sectionKicker}>03 · 编程实操训练</span>
            <h2>把刚刚想明白的事，<br /><em>变成能运行的代码</em></h2>
            <p>先选好年级和熟悉程度，学习屋会把同一个问题换成适合现在的提示、任务和挑战。</p>
            <div className={styles.moduleTags}><span><Code2 size={15} /> 分级练习</span><span><FlaskConical size={15} /> 立即运行</span><span><Check size={15} /> 留下作品</span></div>
            <div className={styles.moduleActions}>
              <button className={styles.modulePrimary} type="button" onClick={openProgrammingDialog}><Code2 size={17} /> {codingMatched ? "重新匹配练习" : "选择我的练习"} <ArrowRight size={15} /></button>
              <button className={styles.moduleSecondary} type="button" onClick={() => scrollToFeature("voice")}><MessageCircle size={17} /> 先问问星宝</button>
            </div>
          </div>
          <div className={`${styles.featureScene} ${styles.codingScene}`} role="group" aria-label="编程练习预览">
            <div className={styles.sceneTopbar}><span>PIXEL LAB</span><strong>{codingMatched ? "已匹配" : "待匹配"}</strong></div>
            <div className={styles.codeWorkbench}>
              <div className={styles.codeGutter}>{codingLines.map((_, index) => <span key={index}>{index + 1}</span>)}</div>
              <code>{codingLines.map((line, index) => <span key={index}>{line}</span>)}</code>
            </div>
            <div className={styles.codingMatch} data-ready={codingMatched}><span>{codingMatched ? `${selectedStage.label} · ${codingTemplate}` : "还没有选择学习阶段"}</span><strong>{codingMatched ? "开始今天的小实验" : "先告诉学习屋你现在会什么"}</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.robotSection} id="robot">
        <div className={styles.robotCopy}>
          <span className={styles.sectionKicker}>桌面上的小伙伴</span>
          <h2>星星不只是一个头像，<br /><em>它住在你的学习桌上</em></h2>
          <p>它会留在这张首页里。你可以随时打开对话、查看 OrangePi 的在线状态，或者继续刚才停下来的学习。</p>
          <div className={styles.robotTags}><span><MessageCircle size={15} /> 对话</span><span><MonitorCog size={15} /> 设备状态</span><span><Camera size={15} /> 观察世界</span></div>
          <div className={styles.robotActions}>
            <button className={styles.introPrimary} type="button" onClick={handleReferencePetClick}><MessageCircle size={17} /> 和星宝聊天</button>
            <button className={styles.introSecondary} type="button" onClick={showRobotDeviceStatus}><MonitorCog size={17} /> 查看设备状态</button>
          </div>
        </div>
        <div className={styles.robotStage}>
          <div className={styles.robotHalo}></div>
          <button className={styles.referencePet} type="button" ref={referencePetRef} onClick={handleReferencePetClick} aria-expanded={petOpen} aria-label={petOpen ? "关闭星宝对话" : "打开星宝对话"}>
            <span className={styles.petSprite + " " + styles.petSpriteSparkle} aria-hidden="true" />
          </button>
          <button className={styles.robotBubble} type="button" onClick={handleReferencePetClick} aria-expanded={petOpen}><span>我在这里！</span><small>点击星宝和我聊聊</small></button>
          <div className={styles.robotCloud}><Cloud size={80} fill="currentColor" /></div>
        </div>
      </section>

      <footer className={styles.footer}><span>© Mambo 星云学习屋 · 让好奇心有地方长大</span><span>声音、绘本、实验和机器人都在这一页</span></footer>

      {entryDialog ? (
        <div className={styles.entryBackdrop} role="presentation" onClick={() => setEntryDialog(null)}>
          {entryDialog === "programming" ? (
            <section className={styles.entryDialog} role="dialog" aria-modal="true" aria-labelledby="programming-dialog-title" onClick={(event) => event.stopPropagation()}>
              <div className={styles.entryDialogHeader}>
                <div><span>编程实验室</span><h2 id="programming-dialog-title">先认识你，再匹配练习</h2></div>
                <button className={styles.entryClose} type="button" onClick={() => setEntryDialog(null)} aria-label="关闭"><X size={18} /></button>
              </div>
              <p className={styles.entryDialogLead}>选择学段和目前的熟悉程度，实验室会带你进入对应难度的 Python 练习。</p>
              <fieldset className={styles.choiceGroup}>
                <legend>你现在在哪个学习阶段？</legend>
                <div className={styles.stageChoices}>
                  {labStageOptions.map((option) => (
                    <button className={labStage === option.id ? styles.choiceActive : ""} type="button" key={option.id} aria-pressed={labStage === option.id} onClick={() => setLabStage(option.id)}>
                      <strong>{option.label}</strong><small>{option.detail}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className={styles.choiceGroup}>
                <legend>你对编程的熟悉程度？</legend>
                <div className={styles.familiarityChoices}>
                  {labFamiliarityOptions.map((option) => (
                    <button className={labFamiliarity === option.id ? styles.choiceActive : ""} type="button" key={option.id} aria-pressed={labFamiliarity === option.id} onClick={() => setLabFamiliarity(option.id)}>
                      <strong>{option.label}</strong><small>{option.detail}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className={styles.entryDialogActions}>
                <button className={styles.dialogCancel} type="button" onClick={() => setEntryDialog(null)}>稍后再说</button>
                <button className={styles.dialogConfirm} type="button" onClick={enterProgrammingLab}>开始匹配练习 <ArrowRight size={16} /></button>
              </div>
            </section>
          ) : (
            <section className={styles.entryDialog} role="dialog" aria-modal="true" aria-labelledby="future-dialog-title" onClick={(event) => event.stopPropagation()}>
              <div className={styles.entryDialogHeader}>
                <div><span>未来研究所</span><h2 id="future-dialog-title">选择你的学习阶段</h2></div>
                <button className={styles.entryClose} type="button" onClick={() => setEntryDialog(null)} aria-label="关闭"><X size={18} /></button>
              </div>
              <p className={styles.entryDialogLead}>同一层里准备了不同深度的算法、模型和项目任务。选好后会直接进入你的专属学习页。</p>
              <div className={styles.futureStageChoices}>
                <button type="button" onClick={() => openFutureStage("middle_school")}><span><strong>我是初中生</strong><small>从模型观察和算法实验开始</small></span><ArrowRight size={20} /></button>
                <button type="button" onClick={() => openFutureStage("high_school")}><span><strong>我是高中生</strong><small>进入更完整的分析和项目挑战</small></span><ArrowRight size={20} /></button>
              </div>
            </section>
          )}
        </div>
      ) : null}

      <button
        className={`${styles.petLauncher} ${petOpen ? styles.petLauncherOpen : ""} ${petDragging ? styles.petLauncherDragging : ""}`}
        style={petLauncherStyle}
        ref={petLauncherRef}
        type="button"
        onClick={handlePetClick}
        onPointerDown={handlePetPointerDown}
        onPointerMove={handlePetPointerMove}
        onPointerUp={handlePetPointerUp}
        onPointerCancel={handlePetPointerUp}
        onLostPointerCapture={() => finishPetDrag()}
        onMouseEnter={() => { if (!petDragging) playPetMood("waving", 850); }}
        onMouseLeave={() => { if (!petDragging && !petOpen) playPetMood("idle", 0); }}
        aria-label={petOpen ? "Close star chat" : "Open star chat"}
        aria-grabbed={petDragging}
        title="拖动星星人，点击和它聊天"
      >
        <span className={`${styles.petSprite} ${styles[`petSprite-${petMood}`]}`} aria-hidden="true" />
      </button>

      {petOpen ? (
        <aside className={`${styles.petPanel} ${petPanelPosition ? styles.petPanelAttached : ""} ${petDragging ? styles.petPanelDragging : ""}`} style={petPanelStyle} ref={petPanelRef} aria-label="星星智能体面板">
          <div className={styles.petPanelHeader}>
            <div className={`${styles.petIdentity} ${styles.petIdentityStar}`}><span className={`${styles.petMini} ${styles.petMiniSprite}`}><span className={`${styles.petSprite} ${styles.petSpriteIdle}`} aria-hidden="true" /></span><span><strong>Twinkle Twinkle</strong><small>Star study companion - Online</small></span></div>
            <button className={styles.iconButton} type="button" onClick={() => { setPetOpen(false); setPetPanelPosition(null); }} aria-label="关闭"><X size={18} /></button>
          </div>
          <div className={styles.petTabs} role="tablist">
            <button className={petTab === "chat" ? styles.tabActive : ""} type="button" role="tab" aria-selected={petTab === "chat"} onClick={() => setPetTab("chat")}><MessageCircle size={15} /> 和我聊聊</button>
            <button className={petTab === "device" ? styles.tabActive : ""} type="button" role="tab" aria-selected={petTab === "device"} onClick={() => setPetTab("device")}><Settings2 size={15} /> 设备信息</button>
          </div>
          {petTab === "chat" ? (
            <>
              <div className={styles.messageList}>
                {messages.map((message, index) => <div className={`${styles.message} ${message.from === "user" ? styles.messageUser : ""}`} key={`${message.text}-${index}`}>{message.text}</div>)}
              </div>
              <div className={styles.quickReplies}><button type="button" onClick={() => setDraft("我想学习图像分类")}>图像分类</button><button type="button" onClick={() => setDraft("带我去二楼")}>去二楼</button></div>
              <div className={styles.petComposer}><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="和星星说点什么" aria-label="和星星说点什么" /><button type="button" onClick={sendMessage} aria-label="发送"><Send size={16} /></button></div>
            </>
          ) : (
            <div className={styles.devicePanel}>
              <div className={styles.deviceOnline}><span><span className={styles.liveDot}></span> OrangePi 4 Pro</span><strong>在线</strong></div>
              <div className={styles.deviceMetrics}><div><Cpu size={16} /><span>CPU</span><strong>18%</strong></div><div><Activity size={16} /><span>温度</span><strong>42°</strong></div><div><Headphones size={16} /><span>音频</span><strong>可用</strong></div></div>
              <button className={styles.deviceAction} type="button" onClick={() => router.push("/#workspace")}><MonitorCog size={17} /> 唤醒学习屏幕 <ArrowRight size={15} /></button>
              <button className={styles.deviceAction} type="button" onClick={() => router.push("/robot")}><Camera size={17} /> 拍一张学习快照 <ArrowRight size={15} /></button>
              <p className={styles.deviceHint}>静态预览中的按钮只展示交互状态，后续再接入 Core API。</p>
            </div>
          )}
        </aside>
      ) : null}
    </main>
  );
}
