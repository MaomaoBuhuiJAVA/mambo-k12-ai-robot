"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, RotateCcw } from "lucide-react";

import type { CurriculumCourse, CourseExercise } from "@/data/curriculum";
import { loadLearningState, saveLearningState } from "@/lib/learning-store";
import { announceLearningStateChanged } from "@/lib/learning-events";
import { gradeExercise, type GradeResult } from "./quiz-engine";
import { recordQuizAttempt } from "./quiz-progress";
import styles from "./quiz-player.module.css";

type DraftAnswer = string | string[];

function initialAnswer(exercise: CourseExercise): DraftAnswer {
  if (exercise.type !== "order") return "";
  if (exercise.items.length < 2) return [...exercise.items];
  return [...exercise.items.slice(1), exercise.items[0]];
}

function canSubmit(exercise: CourseExercise, answer: DraftAnswer): boolean {
  return exercise.type === "order"
    ? Array.isArray(answer) && answer.length === exercise.items.length
    : typeof answer === "string" && answer.trim().length > 0;
}

export function QuizPlayer({ course }: { course: CurriculumCourse }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState<DraftAnswer>(() => initialAnswer(course.exercises[0]));
  const [result, setResult] = useState<GradeResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [retries, setRetries] = useState(0);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
  const submissionLocked = useRef(false);
  const exercise = course.exercises[questionIndex];
  const progress = ((questionIndex + 1) / course.exercises.length) * 100;

  const sessionSummary = useMemo(
    () => `答对 ${correctCount} / ${course.exercises.length} 题`,
    [correctCount, course.exercises.length],
  );

  if (finished) {
    return (
      <section className={styles.player} aria-labelledby="quiz-summary-title">
        <div className={styles.summary}>
          <CheckCircle2 size={28} aria-hidden="true" />
          <h3 id="quiz-summary-title">本次练习完成</h3>
          <p>{sessionSummary}</p>
          <p>{persistenceFailed
            ? "本次结果未能保存，仅在当前会话中可见。"
            : "结果已经写入本机学习记录，可在学习进度页查看知识点掌握情况。"}</p>
          <button type="button" onClick={() => {
            restart(setQuestionIndex, setAnswer, setResult, setFinished, setCorrectCount, course.exercises[0]);
            setRetries(0);
            setPersistenceFailed(false);
            submissionLocked.current = false;
          }}>
            <RotateCcw size={16} aria-hidden="true" />
            重新练习
          </button>
        </div>
      </section>
    );
  }

  function submit() {
    if (submissionLocked.current || result !== null) return;
    submissionLocked.current = true;
    const graded = gradeExercise(exercise, answer, course.stage);
    setResult(graded);
    if (graded.correct) setCorrectCount((count) => count + 1);

    const nextState = recordQuizAttempt(loadLearningState(), {
      course,
      exercise,
      score: graded.score,
      hints: retries,
      completedAt: new Date().toISOString(),
      attemptId: globalThis.crypto?.randomUUID?.() ?? `${exercise.id}-${Date.now()}`,
    });
    if (saveLearningState(nextState)) {
      announceLearningStateChanged();
    } else {
      setPersistenceFailed(true);
    }
  }

  function moveOrderItem(from: number, direction: -1 | 1) {
    if (!Array.isArray(answer) || result !== null) return;
    const to = from + direction;
    if (to < 0 || to >= answer.length) return;
    const next = [...answer];
    [next[from], next[to]] = [next[to], next[from]];
    setAnswer(next);
  }

  function nextQuestion() {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= course.exercises.length) {
      setFinished(true);
      return;
    }
    setQuestionIndex(nextIndex);
    setAnswer(initialAnswer(course.exercises[nextIndex]));
    setResult(null);
    setRetries(0);
    submissionLocked.current = false;
  }

  function retry() {
    setAnswer(initialAnswer(exercise));
    setResult(null);
    setRetries((count) => Math.min(20, count + 1));
    submissionLocked.current = false;
  }

  return (
    <section className={styles.player} aria-labelledby="quiz-question-title">
      <div className={styles.progressRow}>
        <span>第 {questionIndex + 1} / {course.exercises.length} 题</span>
        <span>{exerciseTypeLabel(exercise)}</span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="练习进度"
        aria-valuemin={1}
        aria-valuemax={course.exercises.length}
        aria-valuenow={questionIndex + 1}
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.questionArea}>
        <h3 id="quiz-question-title">{exercise.prompt}</h3>
        <QuestionInput exercise={exercise} answer={answer} disabled={result !== null} setAnswer={setAnswer} moveOrderItem={moveOrderItem} />
      </div>

      <div className={styles.actionArea}>
        {result === null ? (
          <button className={styles.primaryButton} type="button" disabled={!canSubmit(exercise, answer)} onClick={submit}>
            提交答案
          </button>
        ) : (
          <>
            <div className={styles.feedback} data-correct={result.correct || undefined} role="status" aria-live="polite">
              <strong>{result.correct ? "回答正确" : "还需要再想一步"}</strong>
              <p>{result.feedback}</p>
            </div>
            {result.correct ? (
              <button className={styles.primaryButton} type="button" onClick={nextQuestion}>
                {questionIndex === course.exercises.length - 1 ? "查看总结" : "下一题"}
              </button>
            ) : (
              <button className={styles.secondaryButton} type="button" onClick={retry}>
                <RotateCcw size={16} aria-hidden="true" />
                再试一次
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function QuestionInput({
  exercise,
  answer,
  disabled,
  setAnswer,
  moveOrderItem,
}: {
  exercise: CourseExercise;
  answer: DraftAnswer;
  disabled: boolean;
  setAnswer: (answer: DraftAnswer) => void;
  moveOrderItem: (from: number, direction: -1 | 1) => void;
}) {
  if (exercise.type === "single_choice") {
    return (
      <fieldset className={styles.choiceList} disabled={disabled}>
        <legend className={styles.srOnly}>选择一个答案</legend>
        {exercise.options.map((option) => (
          <label key={option}>
            <input type="radio" name={exercise.id} value={option} checked={answer === option} onChange={() => setAnswer(option)} />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (exercise.type === "order") {
    return <OrderInput answer={Array.isArray(answer) ? answer : []} disabled={disabled} moveOrderItem={moveOrderItem} />;
  }

  return (
    <div className={styles.traceInput}>
      <pre><code>{exercise.code}</code></pre>
      <label htmlFor={`${exercise.id}-output`}>程序输出</label>
      <input
        id={`${exercise.id}-output`}
        value={typeof answer === "string" ? answer : ""}
        disabled={disabled}
        maxLength={500}
        autoComplete="off"
        onChange={(event) => setAnswer(event.target.value)}
      />
    </div>
  );
}

function OrderInput({ answer, disabled, moveOrderItem }: {
  answer: string[];
  disabled: boolean;
  moveOrderItem: (from: number, direction: -1 | 1) => void;
}) {
  return (
    <ol className={styles.orderList} aria-label="当前步骤顺序">
      {answer.map((item, index) => (
        <li key={item}>
          <span className={styles.orderNumber}>{index + 1}</span>
          <span>{item}</span>
          <span className={styles.orderButtons}>
            <button type="button" title="上移" aria-label={`将${item}上移`} disabled={disabled || index === 0} onClick={() => moveOrderItem(index, -1)}>
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button type="button" title="下移" aria-label={`将${item}下移`} disabled={disabled || index === answer.length - 1} onClick={() => moveOrderItem(index, 1)}>
              <ArrowDown size={16} aria-hidden="true" />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

function exerciseTypeLabel(exercise: CourseExercise): string {
  if (exercise.type === "single_choice") return "单项选择";
  if (exercise.type === "order") return "步骤排序";
  return "代码轨迹";
}

function restart(
  setQuestionIndex: (value: number) => void,
  setAnswer: (value: DraftAnswer) => void,
  setResult: (value: GradeResult | null) => void,
  setFinished: (value: boolean) => void,
  setCorrectCount: (value: number) => void,
  firstExercise: CourseExercise,
) {
  setQuestionIndex(0);
  setAnswer(initialAnswer(firstExercise));
  setResult(null);
  setFinished(false);
  setCorrectCount(0);
}
