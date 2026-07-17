"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { BookMarked, ChevronLeft, ChevronRight, RefreshCw, Save, Volume2 } from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";

import styles from "./storybook-player.module.css";
import { createSeedStorybook, storybookSchema, type Storybook } from "./storybook";

const STORAGE_KEY = "mambo.storybooks.v1";
const MAX_SAVED_VERSIONS = 10;
const MAX_GLOBAL_VERSIONS = 30;
const SCENE_IMAGES = [
  { src: "/storybook/sorting-lab.png", alt: "四个数字泡泡相邻排队并用弧线标出移动方向" },
  { src: "/storybook/feature-studio.png", alt: "输入节点、隐藏节点和输出节点组成的神经网络示意场景" },
  { src: "/storybook/data-journey.png", alt: "四块编号数据沿处理流程依次传递的场景" },
  { src: "/storybook/reflection-board.png", alt: "学习复盘板上列出三项已完成检查的场景" },
] as const;

interface SavedStorybook {
  id: string;
  courseId: string;
  savedAt: string;
  storybook: Storybook;
}

function readAllSaved(): SavedStorybook[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Partial<SavedStorybook>;
      const parsed = storybookSchema.safeParse(record.storybook);
      return typeof record.courseId === "string" && record.courseId.length <= 80 && typeof record.id === "string" && typeof record.savedAt === "string" && parsed.success
        ? [{ id: record.id, courseId: record.courseId, savedAt: record.savedAt, storybook: parsed.data }]
        : [];
    }).slice(0, MAX_GLOBAL_VERSIONS);
  } catch {
    return [];
  }
}

function readSaved(courseId: string): SavedStorybook[] {
  return readAllSaved().filter((item) => item.courseId === courseId).slice(0, MAX_SAVED_VERSIONS);
}

export function StorybookPlayer({ course }: { course: CurriculumCourse }) {
  const seed = useMemo(() => createSeedStorybook(course), [course]);
  const [storybook, setStorybook] = useState(seed);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedStorybook[]>(() =>
    typeof window === "undefined" ? [] : readSaved(course.id),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const page = storybook.pages[pageIndex];
  const sceneImage = SCENE_IMAGES[pageIndex % SCENE_IMAGES.length];

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  function goToPage(nextIndex: number) {
    setPageIndex(Math.max(0, Math.min(storybook.pages.length - 1, nextIndex)));
    setSelectedAnswer(null);
    setNotice(null);
    window.speechSynthesis?.cancel();
  }

  function readAloud() {
    if (!page || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = typeof SpeechSynthesisUtterance === "undefined"
      ? ({ text: `${page.title}。${page.narration}`, lang: "zh-CN", rate: 0.9 } as SpeechSynthesisUtterance)
      : new SpeechSynthesisUtterance(`${page.title}。${page.narration}`);
    utterance.lang = "zh-CN";
    utterance.rate = course.stage === "lower_primary" ? 0.82 : 0.92;
    window.speechSynthesis.speak(utterance);
  }

  function saveStorybook() {
    const entry: SavedStorybook = {
      id: `${course.id}-${Date.now()}`,
      courseId: course.id,
      savedAt: new Date().toISOString(),
      storybook,
    };
    const allSaved = readAllSaved();
    const currentCourse = [entry, ...allSaved.filter((item) => item.courseId === course.id)].slice(0, MAX_SAVED_VERSIONS);
    const otherCourses = allSaved.filter((item) => item.courseId !== course.id);
    const nextAll = [...currentCourse, ...otherCourses]
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .slice(0, MAX_GLOBAL_VERSIONS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAll));
      setSaved(nextAll.filter((item) => item.courseId === course.id));
      setNotice("绘本已保存在这台设备上，可以稍后回看。 ");
    } catch {
      setNotice("本地存储空间不足，本次绘本尚未保存。 ");
    }
  }

  async function regenerate() {
    setIsGenerating(true);
    setNotice(null);
    try {
      const response = await fetch("/api/storybook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, stage: course.stage }),
      });
      if (!response.ok) throw new Error("generation failed");
      const body: unknown = await response.json();
      const candidate = body && typeof body === "object" ? (body as { storybook?: unknown }).storybook : undefined;
      const parsed = storybookSchema.safeParse(candidate);
      if (!parsed.success) throw new Error("invalid storybook");
      setStorybook(parsed.data);
      setPageIndex(0);
      setSelectedAnswer(null);
      setNotice("新版本已生成，保存后可在本机回看。 ");
    } catch {
      setNotice("暂时无法生成新版本，当前绘本仍可继续阅读。 ");
    } finally {
      setIsGenerating(false);
    }
  }

  function restoreLatest() {
    const latest = saved[0];
    if (!latest) return;
    setStorybook(latest.storybook);
    setPageIndex(0);
    setSelectedAnswer(null);
    setNotice(`正在回看 ${new Date(latest.savedAt).toLocaleDateString("zh-CN")} 保存的版本。`);
  }

  if (!page) return null;
  const question = page.interactiveQuestion;
  const feedback = selectedAnswer === null
    ? null
    : selectedAnswer === question.answer
      ? question.correctFeedback
      : question.incorrectFeedback;

  return (
    <section className={styles.player} aria-label={`${storybook.title}绘本阅读器`}>
      <header className={styles.header}>
        <div>
          <span>互动绘本</span>
          <h3>{storybook.title}</h3>
          <p>{storybook.summary}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={readAloud} aria-label="朗读本页" title="朗读本页"><Volume2 size={17} /></button>
          <button type="button" onClick={saveStorybook} aria-label="保存绘本" title="保存绘本"><Save size={17} /></button>
          <button type="button" onClick={regenerate} disabled={isGenerating} aria-label="重新生成" title="重新生成"><RefreshCw size={17} /></button>
        </div>
      </header>

      <div className={styles.savedBar}>
        <span>已保存 {saved.length} 个版本</span>
        {saved.length > 0 ? <button type="button" onClick={restoreLatest}><BookMarked size={15} />查看最近保存</button> : null}
      </div>

      <div className={styles.scene}>
        <div className={styles.illustration} aria-label={page.scene}>
          <Image
            src={sceneImage.src}
            width={640}
            height={420}
            sizes="(max-width: 520px) 100vw, 36vw"
            alt={sceneImage.alt}
          />
          <span>{course.knowledgePointTags[pageIndex % course.knowledgePointTags.length]}</span>
        </div>
        <div className={styles.pageText}>
          <span>第 {pageIndex + 1} / {storybook.pages.length} 页</span>
          <h4>{page.title}</h4>
          <p>{page.narration}</p>
          <small>{page.scene}</small>
        </div>
      </div>

      <div className={styles.question}>
        <strong>{question.prompt}</strong>
        <div className={styles.options}>
          {question.options.map((option) => (
            <button
              type="button"
              aria-label={`答案：${option}`}
              aria-pressed={selectedAnswer === option}
              key={option}
              onClick={() => setSelectedAnswer(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {feedback ? <p role="status" data-correct={selectedAnswer === question.answer}>{feedback}</p> : null}
      </div>

      <footer className={styles.footer}>
        <button type="button" onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0} aria-label="上一页"><ChevronLeft size={18} />上一页</button>
        <span aria-live="polite">{notice ?? (isGenerating ? "正在生成新绘本..." : "读完本页再继续")}</span>
        <button type="button" onClick={() => goToPage(pageIndex + 1)} disabled={pageIndex === storybook.pages.length - 1} aria-label="下一页">下一页<ChevronRight size={18} /></button>
      </footer>
    </section>
  );
}
