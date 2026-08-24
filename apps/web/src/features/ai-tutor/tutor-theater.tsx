"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Captions,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";
import type { CourseLesson } from "@/data/course-structure";
import { createDefaultLearningState, loadLearningState } from "@/lib/learning-store";
import {
  createMockTutorEvents,
  createTutorLearningContext,
  createTutorProtocolWhitelist,
  createTutorSeedLesson,
  applyTutorLessonPlan,
  EMPTY_TUTOR_MOCK_SESSION,
  getMockEventsForSlide,
  reduceTutorMockEvent,
  type TutorMockSessionState,
  type TutorSessionStatus,
  type TutorStreamEvent,
} from "./tutor-data";
import { TutorLessonPlanSchema } from "@/lib/dify/tutor-lesson-plan";
import { createTutorProtocolStreamValidator, validateLearningContextV2 } from "./tutor-protocol";
import styles from "./tutor-theater.module.css";

const START_DELAY_MS = 120;
const PRESENT_DELAY_MS = 260;
const MOCK_STREAM_TIMEOUT_MS = 4000;
const MAX_NOTE_LENGTH = 600;

interface PersistedTutorSession {
  schemaVersion: 1;
  slideIndex: number;
  answer: number | null;
  note: string;
}

type TutorSessionAction =
  | { type: "reset" }
  | { type: "receive"; event: TutorStreamEvent };

function tutorSessionReducer(
  state: TutorMockSessionState,
  action: TutorSessionAction,
): TutorMockSessionState {
  return action.type === "reset"
    ? EMPTY_TUTOR_MOCK_SESSION
    : reduceTutorMockEvent(state, action.event);
}

function storageKey(lessonId: string): string {
  return `mambo-tutor-session:v1:${lessonId}`;
}

function getPresentationStatus(slideIndex: number, lastSlideIndex: number): TutorSessionStatus {
  return slideIndex === lastSlideIndex ? "summarizing" : "presenting";
}

function shouldPlaySpeech(status: TutorSessionStatus): boolean {
  return status === "presenting" || status === "summarizing" || status === "degraded_static_lesson";
}

function speechApiAvailable(): boolean {
  return typeof window !== "undefined"
    && Boolean(window.speechSynthesis)
    && typeof SpeechSynthesisUtterance !== "undefined";
}

function tutorStatusLabel(status: TutorSessionStatus): string {
  switch (status) {
    case "idle":
      return "准备开始课程";
    case "planning":
      return "正在组织本节内容";
    case "prebuffering":
      return "正在准备本页讲解";
    case "presenting":
      return "正在讲解";
    case "awaiting_interaction":
      return "等待你的预测";
    case "summarizing":
      return "正在总结本节内容";
    case "completed":
      return "本节讲解完成";
    case "text_only":
      return "语音不可用，已切换为仅字幕";
    case "paused_session":
      return "课程已暂停";
    case "degraded_static_lesson":
      return "已切换到离线种子课程";
    default:
      return "离线种子课程";
  }
}

function readPersistedSession(lessonId: string, slideCount: number): PersistedTutorSession | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(lessonId));
    const value = raw ? JSON.parse(raw) : null;
    if (
      value?.schemaVersion !== 1
      || !Number.isInteger(value.slideIndex)
      || value.slideIndex < 0
      || value.slideIndex >= slideCount
    ) {
      return null;
    }
    return {
      schemaVersion: 1,
      slideIndex: value.slideIndex,
      answer: Number.isInteger(value.answer) ? value.answer : null,
      note: typeof value.note === "string" ? value.note.slice(0, MAX_NOTE_LENGTH) : "",
    };
  } catch {
    return null;
  }
}

export function TutorTheater({
  course,
  lesson,
  embedded = false,
  mockEvents,
  enableDify = false,
}: {
  course: CurriculumCourse;
  lesson: CourseLesson;
  embedded?: boolean;
  /** Enables the server-validated Dify lesson-plan workflow in production. */
  enableDify?: boolean;
  /** Test-only seam for exercising the offline seed fallback. */
  mockEvents?: TutorStreamEvent[];
}) {
  const seedBase = useMemo(() => createTutorSeedLesson(course, lesson), [course, lesson]);
  const [remoteSeed, setRemoteSeed] = useState<typeof seedBase | null>(null);
  const seed = remoteSeed ?? seedBase;
  const [status, setStatus] = useState<TutorSessionStatus>("idle");
  const [slideIndex, setSlideIndex] = useState(0);
  const [captions, setCaptions] = useState(true);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const [speed, setSpeed] = useState(course.stage === "middle_school" ? 0.95 : 1.05);
  const [answer, setAnswer] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [question, setQuestion] = useState("");
  const [guideText, setGuideText] = useState("");
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideHistory, setGuideHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [sessionStorageReady, setSessionStorageReady] = useState(false);
  const [learningState, setLearningState] = useState(() => createDefaultLearningState());
  const [lessonPlanStatus, setLessonPlanStatus] = useState<"idle" | "loading" | "ready" | "degraded">(enableDify ? "loading" : "ready");
  const [session, dispatchSession] = useReducer(tutorSessionReducer, EMPTY_TUTOR_MOCK_SESSION);
  const startTimers = useRef<number[]>([]);
  const streamDeliveredRef = useRef(false);
  const protocolValidatorRef = useRef<ReturnType<typeof createTutorProtocolStreamValidator> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const pausedSpeechRef = useRef(false);
  const resumeStatusRef = useRef<TutorSessionStatus>("presenting");
  const streamEvents = useMemo(() => mockEvents ?? createMockTutorEvents(seed, learningState), [learningState, mockEvents, seed]);

  const slide = seed.slides[slideIndex]!;
  const lastSlideIndex = seed.slides.length - 1;
  const narration = session.narrationBySlideId[slide.id] ?? "";
  const currentSlideReady = session.readySlideIds.includes(slide.id);
  const interactionReady = !slide.interaction || answer !== null;
  const tutorContext = useMemo(
    () => createTutorLearningContext(course, lesson, learningState),
    [course, learningState, lesson],
  );
  const protocolWhitelist = useMemo(
    () => createTutorProtocolWhitelist(course, lesson, seed, tutorContext),
    [course, lesson, seed, tutorContext],
  );

  useEffect(() => {
    if (!enableDify || mockEvents) return;
    let cancelled = false;
    const loadPlan = async () => {
      try {
        const response = await fetch("/api/ai/tutor/lesson-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schemaVersion: 1,
            traceId: tutorContext.traceId,
            courseId: course.id,
            lessonId: lesson.id,
            context: { stage: tutorContext.stage, learnerSummary: tutorContext.misconceptionTags.join(", ") },
          }),
        });
        const body = await response.json() as { data?: unknown; degraded?: boolean };
        const parsed = TutorLessonPlanSchema.safeParse(body.data);
        if (!parsed.success) throw new Error("invalid tutor lesson plan");
        if (!cancelled) {
          setRemoteSeed(applyTutorLessonPlan(seedBase, parsed.data));
          setLessonPlanStatus(body.degraded ? "degraded" : "ready");
        }
      } catch {
        if (!cancelled) setLessonPlanStatus("degraded");
      }
    };
    void loadPlan();
    return () => { cancelled = true; };
  }, [course.id, enableDify, lesson.id, mockEvents, seedBase, tutorContext]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const persisted = readPersistedSession(lesson.id, seed.slides.length);
      if (persisted) {
        setSlideIndex(persisted.slideIndex);
        setAnswer(persisted.answer);
        setNote(persisted.note);
      }
      setLearningState(loadLearningState());
      setSessionStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [lesson.id, seed.slides.length]);

  useEffect(() => {
    if (!sessionStorageReady) return;
    const next: PersistedTutorSession = {
      schemaVersion: 1,
      slideIndex,
      answer,
      note: note.slice(0, MAX_NOTE_LENGTH),
    };
    try {
      window.sessionStorage.setItem(storageKey(lesson.id), JSON.stringify(next));
    } catch {
      // The lesson remains usable if the browser blocks session storage.
    }
  }, [answer, lesson.id, note, sessionStorageReady, slideIndex]);

  useEffect(() => {
    if (!captions || !narration) return;

    let revealed = 0;
    const reveal = () => {
      revealed = Math.min(narration.length, revealed + 8);
      setCaptionText(narration.slice(0, revealed));
    };
    const timer = window.setInterval(() => {
      reveal();
      if (revealed === narration.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [captions, narration, slide.id]);

  useEffect(() => {
    if (!enableDify
      || !currentSlideReady
      || !shouldPlaySpeech(status)
      || !speechEnabled
      || speechUnavailable
    ) return;
    let cancelled = false;
    const controller = new AbortController();
    const playServerSpeech = async () => {
      try {
        const response = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: narration }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("tts request failed");
        const blob = await response.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audio.playbackRate = speed;
        audioRef.current = audio;
        audio.onended = () => {
          if (cancelled) return;
          audioRef.current = null;
          if (slide.interaction) setStatus("awaiting_interaction");
          else if (slideIndex === lastSlideIndex) setStatus("completed");
        };
        await audio.play();
      } catch {
        if (!cancelled) {
          setSpeechUnavailable(true);
          setStatus("text_only");
        }
      }
    };
    void playServerSpeech();
    return () => {
      cancelled = true;
      controller.abort();
      audioRef.current?.pause();
      audioRef.current = null;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    };
  }, [currentSlideReady, enableDify, lastSlideIndex, narration, playbackRevision, slide.id, slide.interaction, slideIndex, speechEnabled, speechUnavailable, speed, status]);

  useEffect(() => {
    if (
      enableDify
      ||
      !currentSlideReady
      || !shouldPlaySpeech(status)
      || !speechEnabled
      || speechUnavailable
      || typeof window === "undefined"
      || !window.speechSynthesis
      || typeof SpeechSynthesisUtterance === "undefined"
    ) {
      return;
    }

    const synthesis = window.speechSynthesis;
    if (pausedSpeechRef.current && utteranceRef.current) {
      pausedSpeechRef.current = false;
      synthesis.resume();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(narration);
    utterance.lang = "zh-CN";
    utterance.rate = speed;
    utteranceRef.current = utterance;
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      pausedSpeechRef.current = false;
      setSpeechUnavailable(true);
      setStatus("text_only");
    };
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      if (slide.interaction) {
        setStatus("awaiting_interaction");
        return;
      }
      if (slideIndex === lastSlideIndex) {
        setStatus("completed");
      }
    };
    synthesis.cancel();
    synthesis.speak(utterance);

    return () => {
      if (!pausedSpeechRef.current && utteranceRef.current === utterance) {
        synthesis.cancel();
        utteranceRef.current = null;
      }
    };
  }, [
      currentSlideReady,
    enableDify,
    lastSlideIndex,
    narration,
    playbackRevision,
    slide.id,
    slide.interaction,
    slideIndex,
    speechEnabled,
    speechUnavailable,
    speed,
    status,
  ]);

  useEffect(() => {
    return () => {
      startTimers.current.forEach((timer) => window.clearTimeout(timer));
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  function receiveEvents(events: TutorStreamEvent[]): number {
    const validator = protocolValidatorRef.current;
    if (!validator) return 0;
    let accepted = 0;
    events.forEach((event) => {
      const parsed = validator.accept(event);
      if (!parsed.ok) return;
      dispatchSession({ type: "receive", event: parsed.value });
      accepted += 1;
    });
    return accepted;
  }

  function cancelSpeech() {
    pausedSpeechRef.current = false;
    utteranceRef.current = null;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
  }

  function start() {
    startTimers.current.forEach((timer) => window.clearTimeout(timer));
    startTimers.current = [];
    cancelSpeech();
    dispatchSession({ type: "reset" });
    setSpeechUnavailable(false);
    setStatus("planning");
    const contextResult = validateLearningContextV2(tutorContext, protocolWhitelist);
    if (!contextResult.ok) {
      setStatus("degraded_static_lesson");
      return;
    }
    protocolValidatorRef.current = createTutorProtocolStreamValidator({
      expected: {
        traceId: tutorContext.traceId,
        stage: tutorContext.stage,
        courseId: tutorContext.courseId,
        lessonId: tutorContext.lessonId,
      },
      whitelist: protocolWhitelist,
    });
    receiveEvents(streamEvents.filter((event) => event.type === "session.started" || event.type === "plan.ready"));
    startTimers.current.push(window.setTimeout(() => {
      setStatus("prebuffering");
      let delivered = 0;
      for (let index = 0; index <= slideIndex; index += 1) {
        const previousSlide = seed.slides[index];
        if (previousSlide) delivered += receiveEvents(getMockEventsForSlide(streamEvents, previousSlide.id));
      }
      if (slideIndex === lastSlideIndex) {
        delivered += receiveEvents(streamEvents.filter((event) => event.type === "session.completed"));
      }
      streamDeliveredRef.current = delivered > 0;
    }, START_DELAY_MS));
    startTimers.current.push(window.setTimeout(() => {
      setStatus(enableDify || speechApiAvailable() ? getPresentationStatus(slideIndex, lastSlideIndex) : "text_only");
    }, PRESENT_DELAY_MS));
    startTimers.current.push(window.setTimeout(() => {
      if (streamDeliveredRef.current) return;
      const seedEvents = createMockTutorEvents(seed, learningState);
      protocolValidatorRef.current = createTutorProtocolStreamValidator({
        expected: {
          traceId: tutorContext.traceId,
          stage: tutorContext.stage,
          courseId: tutorContext.courseId,
          lessonId: tutorContext.lessonId,
        },
        whitelist: protocolWhitelist,
      });
      dispatchSession({ type: "reset" });
      receiveEvents(seedEvents.filter((event) => event.type === "session.started" || event.type === "plan.ready"));
      for (let index = 0; index <= slideIndex; index += 1) {
        const fallbackSlide = seed.slides[index];
        if (fallbackSlide) receiveEvents(getMockEventsForSlide(seedEvents, fallbackSlide.id));
      }
      setStatus("degraded_static_lesson");
    }, MOCK_STREAM_TIMEOUT_MS));
  }

  function move(delta: number) {
    const nextSlideIndex = Math.min(lastSlideIndex, Math.max(0, slideIndex + delta));
    if (nextSlideIndex === slideIndex) return;
    cancelSpeech();
    const nextSlide = seed.slides[nextSlideIndex]!;
    receiveEvents(getMockEventsForSlide(streamEvents, nextSlide.id));
    if (nextSlideIndex === lastSlideIndex) {
      receiveEvents(streamEvents.filter((event) => event.type === "session.completed"));
    }
    setSlideIndex(nextSlideIndex);
    setAnswer(null);
    setStatus(speechUnavailable ? "text_only" : getPresentationStatus(nextSlideIndex, lastSlideIndex));
  }

  function togglePause() {
    if (status === "paused_session") {
      setStatus(resumeStatusRef.current);
      audioRef.current?.play().catch(() => undefined);
      return;
    }
    resumeStatusRef.current = status;
    pausedSpeechRef.current = true;
    window.speechSynthesis?.pause();
    audioRef.current?.pause();
    setStatus("paused_session");
  }

  function repeat() {
    cancelSpeech();
    setSpeechUnavailable(false);
    setStatus(getPresentationStatus(slideIndex, lastSlideIndex));
    setPlaybackRevision((current) => current + 1);
  }

  function toggleSpeech() {
    if (speechEnabled) {
      cancelSpeech();
      setSpeechEnabled(false);
      return;
    }
    setSpeechEnabled(true);
    setSpeechUnavailable(false);
    if (status === "text_only") setStatus(getPresentationStatus(slideIndex, lastSlideIndex));
  }

  function toggleCaptions() {
    setCaptionText("");
    setCaptions((value) => !value);
  }

  async function askTutor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || guideBusy) return;
    const messages = [...guideHistory, { role: "user" as const, content: text }].slice(-8);
    setQuestion("");
    setGuideText("");
    setGuideBusy(true);
    try {
      const response = await fetch("/api/ai/tutor/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          context: {
            schemaVersion: 1,
            traceId: tutorContext.traceId,
            anonymousLearnerId: tutorContext.anonymousLearnerId,
            stage: tutorContext.stage,
            grade: tutorContext.grade,
            teachingMode: "dialogue",
            activityId: tutorContext.activityId,
            courseId: tutorContext.courseId,
            moduleId: null,
            storybookId: null,
            pageNumber: null,
            knowledgePointIds: tutorContext.knowledgePointIds,
            completedActivityIds: [],
            masterySummary: tutorContext.masterySummary,
            misconceptionTags: tutorContext.misconceptionTags,
            recentEvidenceSummary: tutorContext.recentEvidenceSummary.map((item) => ({
              evidenceId: item.evidenceId,
              kind: item.kind,
              resultCode: item.resultCode,
              metrics: item.metricSummary,
            })),
            allowedActionIds: tutorContext.allowedActionIds.slice(0, 8),
          },
          messages,
          question: text,
        }),
      });
      if (!response.body) throw new Error("empty guide stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim()) as { text?: unknown };
            if (typeof payload.text === "string") {
              answer += payload.text;
              setGuideText(answer);
            }
          } catch { /* Ignore incomplete SSE records. */ }
        }
      }
      const finalAnswer = answer || "请先回到本页要点，再试着用自己的话描述问题。";
      setGuideText(finalAnswer);
      setGuideHistory([...messages, { role: "assistant" as const, content: finalAnswer }].slice(-8));
    } catch {
      setGuideText("暂时无法连接导师服务。请先根据本页讲解完成学习，稍后再试。 ");
    } finally {
      setGuideBusy(false);
    }
  }

  if (status === "idle") {
    return (
      <main className={`${styles.start} ${embedded ? styles.embedded : ""}`} aria-labelledby="tutor-start-title">
        <Link href={`/learn/lesson/${lesson.id}`}>
          <ArrowLeft aria-hidden="true" size={16} />返回课程
        </Link>
        <p>AI 导师学习</p>
        <h1 id="tutor-start-title">{lesson.title}</h1>
        <span>{lesson.summary}</span>
        <dl>
          <div><dt>预计时间</dt><dd>{lesson.estimatedMinutes} 分钟</dd></div>
          <div><dt>教学模式</dt><dd>{lessonPlanStatus === "ready" ? "Dify AI 导师" : lessonPlanStatus === "loading" ? "正在准备 AI 课件" : "本地降级课件"}</dd></div>
        </dl>
        <button disabled={!sessionStorageReady || lessonPlanStatus === "loading"} onClick={start} type="button">
          <Play aria-hidden="true" size={17} />开始学习
        </button>
        {lessonPlanStatus === "degraded" ? <small className={styles.degradedNotice}>Dify 暂不可用，已准备本地课件，仍可继续学习。</small> : null}
      </main>
    );
  }

  return (
    <main
      className={`${styles.theater} ${embedded ? styles.embedded : ""}`}
      aria-labelledby="tutor-title"
      data-learning-context-version={tutorContext.schemaVersion}
      data-tutor-status={status}
    >
      <header className={styles.topbar}>
        <Link href={`/learn/lesson/${lesson.id}`} onClick={cancelSpeech}>
          <ArrowLeft aria-hidden="true" size={16} />返回课程
        </Link>
        <strong>{course.title} / {lesson.title}</strong>
        <div>
          <button
            aria-label={captions ? "关闭字幕" : "开启字幕"}
            aria-pressed={captions}
            onClick={toggleCaptions}
            title="字幕"
            type="button"
          >
            <Captions aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={speechEnabled ? "关闭语音" : "开启语音"}
            aria-pressed={speechEnabled}
            onClick={toggleSpeech}
            title="语音"
            type="button"
          >
            {speechEnabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />}
          </button>
          <label>
            速度
            <select aria-label="语音速度" onChange={(event) => setSpeed(Number(event.target.value))} value={speed}>
              <option value={0.85}>0.85</option>
              <option value={0.95}>0.95</option>
              <option value={1.05}>1.05</option>
              <option value={1.15}>1.15</option>
            </select>
          </label>
        </div>
      </header>

      <p className={styles.sessionStatus} role="status">{tutorStatusLabel(status)}</p>

      <div className={styles.grid}>
        <section className={styles.dialogue} aria-label="导师讲解与互动">
          <p>星宝导师</p>
          <h1 id="tutor-title">{slide.title}</h1>
          {captions ? (
            <div aria-live="polite" className={styles.caption}>
              {captionText || "正在准备讲解内容..."}
            </div>
          ) : <p className={styles.captionOff}>字幕已关闭</p>}

          {slide.interaction && currentSlideReady ? (
            <fieldset>
              <legend>{slide.interaction.prompt}</legend>
              {slide.interaction.options.map((option, index) => (
                <label data-selected={answer === index || undefined} key={option}>
                  <input
                    checked={answer === index}
                    name="tutor-answer"
                    onChange={() => setAnswer(index)}
                    type="radio"
                  />
                  {option}
                </label>
              ))}
              {answer !== null ? (
                <p role="status">
                  {answer === slide.interaction.correctIndex
                    ? "回答已记录。现在把理由带到下一步。"
                    : "先保留这个预测，下一页会用证据核对。"}
                </p>
              ) : null}
            </fieldset>
          ) : null}
          <form className={styles.askForm} onSubmit={askTutor}>
            <label htmlFor="tutor-question">向导师提问</label>
            <div>
              <input
                disabled={guideBusy}
                id="tutor-question"
                maxLength={400}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="说说你哪里没理解"
                value={question}
              />
              <button disabled={guideBusy || !question.trim()} type="submit">{guideBusy ? "回答中" : "发送"}</button>
            </div>
            {guideText ? <p aria-live="polite" className={styles.guideReply}>{guideText}</p> : null}
          </form>
        </section>

        <section className={styles.slide} aria-label="当前幻灯片">
          <span>{slide.type}</span>
          <h2>{slide.title}</h2>
          <ul>{slide.blocks.map((block) => <li key={block}>{block}</li>)}</ul>
        </section>

        <aside className={styles.rail} aria-label="课程进度与笔记">
          <span>{slideIndex + 1} / {seed.slides.length}</span>
          <ol>
            {seed.slides.map((item, index) => (
              <li aria-current={index === slideIndex ? "step" : undefined} key={item.id}>{item.title}</li>
            ))}
          </ol>
          <label>
            笔记
            <textarea
              aria-label="导师笔记"
              maxLength={MAX_NOTE_LENGTH}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
        </aside>
      </div>

      <footer className={styles.controls}>
        <button disabled={!currentSlideReady || slideIndex === 0} onClick={() => move(-1)} type="button">上一页</button>
        <button disabled={status === "completed" || !currentSlideReady} onClick={togglePause} type="button">
          {status === "paused_session" ? <Play aria-hidden="true" size={16} /> : <Pause aria-hidden="true" size={16} />}
          {status === "paused_session" ? "继续" : "暂停"}
        </button>
        <button disabled={!currentSlideReady} onClick={repeat} type="button">
          <RotateCcw aria-hidden="true" size={16} />重复当前段落
        </button>
        <button
          disabled={!currentSlideReady || !interactionReady || slideIndex === lastSlideIndex}
          onClick={() => move(1)}
          type="button"
        >
          下一页<ArrowRight aria-hidden="true" size={16} />
        </button>
        {slideIndex === lastSlideIndex ? (
          <span>课程小结已就绪，可返回工作台完成练习或实验。</span>
        ) : null}
      </footer>
    </main>
  );
}
