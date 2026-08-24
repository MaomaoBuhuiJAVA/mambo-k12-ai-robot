"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheckBig,
  ChevronLeft,
  ChevronRight,
  Map,
  X,
} from "lucide-react";

import type {
  ImportedStorybookManifest,
  StorybookDialogueCue,
} from "@/data/storybooks";

import {
  markImportedStorybookComplete,
  readImportedStorybookProgress,
  saveImportedStorybookPageIndex,
} from "./imported-storybook-progress";
import { resolveDialoguePlacement } from "./storybook-dialogue-anchors";
import styles from "./imported-storybook-player.module.css";

export const DIALOGUE_CHARACTER_INTERVAL_MS = 32;
export const DIALOGUE_CUE_HOLD_MS = 850;

const SPEAKER_LABEL: Record<StorybookDialogueCue["speaker"], string> = {
  narrator: "旁白",
  starbao: "星宝",
  guardian: "守卫",
  teacher: "老师",
  ai_sprite: "AI 小精灵",
  system: "系统",
};

interface ImportedStorybookPlayerProps {
  storybook: ImportedStorybookManifest;
}

export function ImportedStorybookPlayer({ storybook }: ImportedStorybookPlayerProps) {
  return <ImportedStorybookReadingSession key={storybook.id} storybook={storybook} />;
}

function ImportedStorybookReadingSession({ storybook }: ImportedStorybookPlayerProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [activeDialogueIndex, setActiveDialogueIndex] = useState(0);
  const [typedCharacterCount, setTypedCharacterCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const didNavigateBeforeRestore = useRef(false);

  const page = storybook.pages[pageIndex] ?? storybook.pages[0]!;
  const dialogue = useMemo(
    () => [...page.dialogue].sort((left, right) => left.order - right.order),
    [page.dialogue],
  );
  const activeDialogue = dialogue[activeDialogueIndex];
  const dialoguePlacement = activeDialogue
    ? resolveDialoguePlacement(storybook.id, activeDialogue)
    : null;
  const typedDialogueText = activeDialogue?.text.slice(0, typedCharacterCount) ?? "";
  const isNarrationCue = activeDialogue?.speaker === "narrator"
    || activeDialogue?.displayMode === "caption";
  const visibleBubble = isNarrationCue ? undefined : activeDialogue;
  const narrationText = isNarrationCue ? typedDialogueText : page.narration;
  const question = page.question;
  const isLastPage = pageIndex === storybook.pages.length - 1;
  const feedback = selectedAnswer === null || !question
    ? null
    : selectedAnswer === question.answer
      ? question.correctFeedback
      : question.incorrectFeedback;

  useEffect(() => {
    const restore = window.setTimeout(() => {
      if (didNavigateBeforeRestore.current) return;
      const restoredProgress = readImportedStorybookProgress(storybook.id, storybook.pages.length, window.localStorage);
      setSelectedAnswer(null);
      setActiveDialogueIndex(0);
      setTypedCharacterCount(0);
      setIsCompleted(restoredProgress.completed);
      setPageIndex(restoredProgress.pageIndex);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [storybook.id, storybook.pages, storybook.pages.length]);

  useEffect(() => {
    if (!activeDialogue) return undefined;
    const timeout = window.setTimeout(() => {
      if (typedCharacterCount < activeDialogue.text.length) {
        setTypedCharacterCount((current) => current + 1);
        return;
      }
      if (activeDialogueIndex < dialogue.length - 1) {
        setActiveDialogueIndex((current) => current + 1);
        setTypedCharacterCount(0);
      }
    }, typedCharacterCount < activeDialogue.text.length ? DIALOGUE_CHARACTER_INTERVAL_MS : DIALOGUE_CUE_HOLD_MS);
    return () => window.clearTimeout(timeout);
  }, [activeDialogue, activeDialogueIndex, dialogue.length, typedCharacterCount]);

  function goToPage(nextIndex: number) {
    const normalized = Math.max(0, Math.min(storybook.pages.length - 1, nextIndex));
    didNavigateBeforeRestore.current = true;
    setSelectedAnswer(null);
    setActiveDialogueIndex(0);
    setTypedCharacterCount(0);
    setPageIndex(normalized);
    saveImportedStorybookPageIndex(storybook.id, normalized, window.localStorage);
  }

  function completeStorybook() {
    const saved = markImportedStorybookComplete(storybook.id, pageIndex, window.localStorage);
    setCompletionError(!saved);
    if (saved) setIsCompleted(true);
  }

  return (
    <section className={styles.player} aria-label={`${storybook.title}绘本阅读器`}>
      <article
        className={styles.page}
        style={{ "--page-aspect-ratio": String(page.image.width / page.image.height) } as React.CSSProperties}
      >
        <div
          className={styles.illustration}
        >
          <Image
            src={page.image.src}
            alt={page.image.alt}
            fill
            priority={pageIndex === 0}
            sizes="(max-width: 720px) calc(100vw - 32px), min(920px, 92vw)"
          />
          {visibleBubble ? (
            <article
              aria-live="polite"
              className={styles.dialogueBubble}
              data-speaker={visibleBubble.speaker}
              data-tail={dialoguePlacement?.tailSide}
              style={{
                "--bubble-left": `${dialoguePlacement?.left ?? 6}%`,
                "--bubble-top": `${dialoguePlacement?.top ?? 8}%`,
                "--bubble-width": `${dialoguePlacement?.width ?? 32}%`,
                "--tail-offset": `${dialoguePlacement?.tailOffset ?? 50}%`,
              } as React.CSSProperties}
            >
              <div>
                <strong>{SPEAKER_LABEL[visibleBubble.speaker]}</strong>
                {visibleBubble.stageDirection ? <span>{visibleBubble.stageDirection}</span> : null}
              </div>
              <p>{typedDialogueText}</p>
            </article>
          ) : null}
          <div className={styles.narrationPanel} aria-label="本页旁白" aria-live="polite">
            <span>{isNarrationCue ? "旁白" : `第 ${page.pageNumber} 页 · ${page.title}`}</span>
            <p>{narrationText}</p>
          </div>
          <Link className={styles.exitButton} href="/map" aria-label="退出绘本" title="退出绘本">
            <X aria-hidden="true" size={20} />
          </Link>
          <nav className={styles.pictureNavigation} aria-label="绘本翻页">
            <button
              type="button"
              aria-label="上一页"
              title="上一页"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              <ChevronLeft aria-hidden="true" size={22} />
            </button>
            <button
              type="button"
              aria-label="下一页"
              title="下一页"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={pageIndex === storybook.pages.length - 1}
            >
              <ChevronRight aria-hidden="true" size={22} />
            </button>
          </nav>
        </div>
      </article>

      {question ? (
        <section className={styles.question} aria-label="互动小问答">
          <strong>互动小问答：{question.prompt}</strong>
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
        </section>
      ) : null}

      {isLastPage ? (
        <section className={styles.completion} aria-label="绘本完成">
          {isCompleted ? (
            <>
              <CircleCheckBig aria-hidden="true" size={22} />
              <div>
                <strong>这本绘本已完成</strong>
                <p>完成另外两本绘本后，就能在地图上挑战本区域怪兽。</p>
              </div>
              <a href="/map"><Map aria-hidden="true" size={17} />返回学习地图</a>
            </>
          ) : (
            <>
              <div>
                <strong>已经读到最后一页</strong>
                <p>确认完成后，本书会计入地图区域的学习进度。</p>
              </div>
              <button type="button" onClick={completeStorybook}>完成本绘本</button>
            </>
          )}
          {completionError ? <p className={styles.completionError} role="alert">进度暂时无法保存，请稍后重试。</p> : null}
        </section>
      ) : null}

    </section>
  );
}
