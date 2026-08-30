"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, RotateCcw } from "lucide-react";

import type { CurriculumCourse, CourseExercise } from "@/data/curriculum";
import { loadLearningState, saveLearningState } from "@/lib/learning-store";
import { announceLearningStateChanged } from "@/lib/learning-events";
import { gradeExercise, type GradeResult } from "./quiz-engine";
import { recordQuizAttempt } from "./quiz-progress";
import { getMisconceptionForExercise } from "./middle-chapter-one-remediation";
import { ClassificationInput } from "./classification-input";
import { CodeExerciseEditor } from "./code-exercise-editor";
import styles from "./quiz-player.module.css";

type DraftAnswer = string | string[];

function initialAnswer(exercise: CourseExercise): DraftAnswer {
  if (exercise.type === "multi_select") return [];
  if (exercise.type !== "order") return "";
  if (exercise.items.length < 2) return [...exercise.items];
  return [...exercise.items.slice(1), exercise.items[0]];
}

function canSubmit(exercise: CourseExercise, answer: DraftAnswer): boolean {
  if (exercise.type === "order") return Array.isArray(answer) && answer.length === exercise.items.length;
  if (exercise.type === "multi_select") return Array.isArray(answer) && answer.length > 0;
  return typeof answer === "string" && answer.trim().length > 0;
}

export function QuizPlayer({ course }: { course: CurriculumCourse }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState<DraftAnswer>(() => initialAnswer(course.exercises[0]));
  const [result, setResult] = useState<GradeResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [retries, setRetries] = useState(0);
  const [remediationRetestUsed, setRemediationRetestUsed] = useState(false);
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
            setRemediationRetestUsed(false);
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

  function reorderOrderItem(from: number, to: number) {
    if (!Array.isArray(answer) || result !== null || from === to) return;
    if (from < 0 || to < 0 || from >= answer.length || to >= answer.length) return;
    const next = [...answer];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
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
    setRemediationRetestUsed(false);
    submissionLocked.current = false;
  }

  function retry(isRemediationRetest = false) {
    setAnswer(initialAnswer(exercise));
    setResult(null);
    setRetries((count) => Math.min(20, count + 1));
    if (isRemediationRetest) setRemediationRetestUsed(true);
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
        <QuestionInput exercise={exercise} answer={answer} disabled={result !== null} result={result} setAnswer={setAnswer} moveOrderItem={moveOrderItem} reorderOrderItem={reorderOrderItem} />
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
            ) : <RemediationAction
              exerciseId={exercise.id}
              retestUsed={remediationRetestUsed}
              onRetry={retry}
            />}
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
  result,
  setAnswer,
  moveOrderItem,
  reorderOrderItem,
}: {
  exercise: CourseExercise;
  answer: DraftAnswer;
  disabled: boolean;
  result: GradeResult | null;
  setAnswer: (answer: DraftAnswer) => void;
  moveOrderItem: (from: number, direction: -1 | 1) => void;
  reorderOrderItem: (from: number, to: number) => void;
}) {
  if (exercise.type === "multi_select") {
    const selected = Array.isArray(answer) ? answer : [];
    return (
      <fieldset className={styles.choiceList} disabled={disabled}>
        <legend className={styles.srOnly}>选择所有符合条件的答案</legend>
        {exercise.options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label key={option}>
              <input
                type="checkbox"
                name={exercise.id}
                value={option}
                checked={checked}
                onChange={() => setAnswer(checked ? selected.filter((item) => item !== option) : [...selected, option])}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (exercise.type === "classification") {
    return (
      <ClassificationInput
        answer={typeof answer === "string" ? answer : ""}
        disabled={disabled}
        exercise={exercise}
        result={result}
        setAnswer={setAnswer}
      />
    );
  }

  if (exercise.type === "single_choice" || exercise.type === "result_interpretation") {
    return (
      <fieldset className={styles.choiceList} disabled={disabled}>
        <legend className={styles.srOnly}>选择一个答案</legend>
        {exercise.type === "result_interpretation" ? <pre className={styles.resultEvidence}>{exercise.result}</pre> : null}
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
    return <OrderInput answer={Array.isArray(answer) ? answer : []} disabled={disabled} moveOrderItem={moveOrderItem} reorderOrderItem={reorderOrderItem} />;
  }

  return (
    <CodeExerciseEditor
      answer={typeof answer === "string" ? answer : ""}
      disabled={disabled}
      exercise={exercise}
      key={exercise.id}
      onAnswerChange={setAnswer}
    />
  );
}

function OrderInput({ answer, disabled, moveOrderItem, reorderOrderItem }: {
  answer: string[];
  disabled: boolean;
  moveOrderItem: (from: number, direction: -1 | 1) => void;
  reorderOrderItem: (from: number, to: number) => void;
}) {
  return (
    <>
      <p className={styles.orderHint}>拖动项目调整顺序，也可以使用每项右侧的上下按钮。</p>
      <ol className={styles.orderList} aria-label="当前步骤顺序">
        {answer.map((item, index) => (
        <li
          draggable={!disabled}
          key={item}
          onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const from = Number(event.dataTransfer.getData("text/plain"));
            if (Number.isInteger(from)) reorderOrderItem(from, index);
          }}
        >
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
    </>
  );
}

function exerciseTypeLabel(exercise: CourseExercise): string {
  if (exercise.type === "single_choice") return "单项选择";
  if (exercise.type === "multi_select") return "多项选择";
  if (exercise.type === "order") return "步骤排序";
  if (exercise.type === "result_interpretation") return "结果解释";
  if (exercise.type === "code_fill") return "代码填空";
  if (exercise.type === "classification") return "样本分类";
  return "代码轨迹";
}

function RemediationAction({
  exerciseId,
  retestUsed,
  onRetry,
}: {
  exerciseId: string;
  retestUsed: boolean;
  onRetry: (isRemediationRetest?: boolean) => void;
}) {
  const remediation = getMisconceptionForExercise(exerciseId);
  if (!remediation || retestUsed) {
    return (
      <button className={styles.secondaryButton} type="button" onClick={() => onRetry()}>
        <RotateCcw size={16} aria-hidden="true" />
        再试一次
      </button>
    );
  }
  return (
    <section className={styles.remediation} aria-labelledby="remediation-title">
      <span>误区补救：{remediation.tag}</span>
      <h4 id="remediation-title">{remediation.title}</h4>
      <p>{remediation.explanation}</p>
      <p><strong>示例：</strong>{remediation.example}</p>
      <button className={styles.secondaryButton} type="button" onClick={() => onRetry(true)}>
        <RotateCcw size={16} aria-hidden="true" />
        开始一次复测
      </button>
    </section>
  );
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
