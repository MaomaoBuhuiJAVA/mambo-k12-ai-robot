"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CircleHelp,
  Code2,
  RotateCcw,
  SkipForward,
} from "lucide-react";

import type { CourseExercise } from "@/data/curriculum";
import type { LearningPathStage } from "@/data/learning-paths";
import type { LearningGradeId } from "@/data/learning-grades";
import { announceLearningStateChanged } from "@/lib/learning-events";
import { loadLearningState, saveLearningState } from "@/lib/learning-store";
import { gradeExercise, type GradeResult } from "@/features/quiz/quiz-engine";
import { getMisconceptionForExercise } from "@/features/quiz/middle-chapter-one-remediation";
import { recordQuizAttempt } from "@/features/quiz/quiz-progress";
import { getPracticeSet, type PracticeQuestion, type PracticeSet } from "./practice-data";
import { ClassificationInput } from "@/features/quiz/classification-input";
import { CodeExerciseEditor } from "@/features/quiz/code-exercise-editor";
import {
  clearPracticeSessionProgress,
  loadPracticeSessionProgress,
  savePracticeSessionProgress,
  type PracticeDraftAnswer,
  type PracticeSessionProgress,
  practiceSessionStorageId,
} from "./practice-session-store";
import styles from "./practice-session.module.css";

type DraftAnswer = string | string[];

function initialAnswer(question: PracticeQuestion | null | undefined): DraftAnswer {
  if (!question) return "";
  if (question.exercise.type === "multi_select") return [];
  if (question.exercise.type !== "order") return "";
  const items = question.exercise.items;
  return items.length < 2 ? [...items] : [...items.slice(1), items[0]];
}

function canSubmit(exercise: CourseExercise, answer: DraftAnswer): boolean {
  if (exercise.type === "order") return Array.isArray(answer) && answer.length === exercise.items.length;
  if (exercise.type === "multi_select") return Array.isArray(answer) && answer.length > 0;
  return typeof answer === "string" && answer.trim().length > 0;
}

function nextQuestion(
  questions: PracticeQuestion[],
  progress: PracticeSessionProgress,
): PracticeQuestion | null {
  const handled = new Set(progress.handledQuestionKeys);
  return questions.find((question) => !handled.has(question.key)) ?? null;
}

function emptyProgress(): PracticeSessionProgress {
  return {
    schemaVersion: 1,
    handledQuestionKeys: [],
    correctQuestionKeys: [],
    skippedQuestionKeys: [],
  };
}

function practiceSessionId(practiceSetId: string, questions: PracticeQuestion[]): string {
  return practiceSessionStorageId(practiceSetId, questions.map((question) => question.key));
}

function restoreResult(
  result: NonNullable<PracticeSessionProgress["resultsByQuestionKey"]>[string] | undefined,
): GradeResult | null {
  if (!result) return null;
  return {
    ...result,
    nextAction: result.correct ? "next" : "retry",
  };
}

function formatAnswer(answer: PracticeDraftAnswer): string {
  return Array.isArray(answer) ? answer.join(" -> ") : answer;
}

function questionTypeLabel(exercise: CourseExercise): string {
  if (exercise.type === "single_choice") return "单项选择";
  if (exercise.type === "multi_select") return "多项选择";
  if (exercise.type === "order") return "步骤排序";
  if (exercise.type === "result_interpretation") return "结果解释";
  if (exercise.type === "code_fill") return "代码填空";
  if (exercise.type === "classification") return "样本分类";
  return "代码追踪";
}

function stageLabel(stage: LearningPathStage): string {
  return stage === "middle_school" ? "初中" : "高中";
}

export function PracticeSession({
  initialPracticeSet,
  practiceSetId,
  stage,
  remediationActivityId,
  grade,
  embedded = false,
}: {
  initialPracticeSet: PracticeSet;
  practiceSetId: string;
  stage: LearningPathStage;
  remediationActivityId?: string;
  grade?: LearningGradeId;
  embedded?: boolean;
}) {
  const [practiceSet, setPracticeSet] = useState<PracticeSet>(initialPracticeSet);
  const questions = useMemo(() => practiceSet.questions, [practiceSet]);
  const questionKeys = useMemo(() => new Set(questions.map((question) => question.key)), [questions]);
  const sessionId = useMemo(() => practiceSessionId(practiceSetId, questions), [practiceSetId, questions]);
  const [progress, setProgress] = useState<PracticeSessionProgress>(emptyProgress);
  const [activeQuestionKey, setActiveQuestionKey] = useState<string | null>(() =>
    nextQuestion(questions, emptyProgress())?.key ?? null,
  );
  const activeQuestion = questions.find((question) => question.key === activeQuestionKey);
  const [answer, setAnswer] = useState<DraftAnswer>(() => initialAnswer(activeQuestion));
  const [result, setResult] = useState<GradeResult | null>(null);
  const [hints, setHints] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const submissionLocked = useRef(false);

  const saveProgress = useCallback((next: PracticeSessionProgress): boolean => {
    const saved = savePracticeSessionProgress(sessionId, next, questionKeys);
    if (!saved) setNotice("本次练习的恢复进度未能保存；已记录的答题证据不受影响。");
    return saved;
  }, [questionKeys, sessionId]);

  const updateAnswer = useCallback((nextAnswer: DraftAnswer) => {
    setAnswer(nextAnswer);
    if (!activeQuestion) return;
    const nextProgress: PracticeSessionProgress = {
      ...progress,
      answersByQuestionKey: {
        ...(progress.answersByQuestionKey ?? {}),
        [activeQuestion.key]: nextAnswer,
      },
    };
    setProgress(nextProgress);
    saveProgress(nextProgress);
  }, [activeQuestion, progress, saveProgress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restoredSet = getPracticeSet(stage, practiceSetId, loadLearningState(), new Date(), remediationActivityId, grade);
      if (!restoredSet) return;
      const restoredKeys = new Set(restoredSet.questions.map((question) => question.key));
      const restoredProgress = loadPracticeSessionProgress(sessionId, restoredKeys);
      const restoredQuestion = nextQuestion(restoredSet.questions, restoredProgress);
      setPracticeSet(restoredSet);
      setProgress(restoredProgress);
      setActiveQuestionKey(restoredQuestion?.key ?? null);
      const restoredKey = restoredQuestion?.key;
      setAnswer(restoredKey ? restoredProgress.answersByQuestionKey?.[restoredKey] ?? initialAnswer(restoredQuestion) : "");
      setResult(restoredKey ? restoreResult(restoredProgress.resultsByQuestionKey?.[restoredKey]) : null);
      const restoredHints = restoredKey ? restoredProgress.hintsByQuestionKey?.[restoredKey] ?? 0 : 0;
      setHints(restoredHints);
      setShowHint(restoredHints > 0);
      setNotice(null);
      submissionLocked.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [grade, practiceSetId, remediationActivityId, sessionId, stage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeQuestion || result !== null || event.defaultPrevented) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (activeQuestion.exercise.type !== "single_choice" && activeQuestion.exercise.type !== "result_interpretation") return;
      const optionIndex = Number(event.key) - 1;
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= activeQuestion.exercise.options.length) return;
      event.preventDefault();
      updateAnswer(activeQuestion.exercise.options[optionIndex]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeQuestion, result, updateAnswer]);

  function moveToNext(kind: "answered" | "skipped") {
    if (!activeQuestion) return;
    const correct = kind === "answered" && result?.correct === true;
    const nextProgress: PracticeSessionProgress = {
      ...progress,
      schemaVersion: 1,
      handledQuestionKeys: [...progress.handledQuestionKeys, activeQuestion.key],
      correctQuestionKeys: correct
        ? [...progress.correctQuestionKeys, activeQuestion.key]
        : progress.correctQuestionKeys,
      skippedQuestionKeys: kind === "skipped"
        ? [...progress.skippedQuestionKeys, activeQuestion.key]
        : progress.skippedQuestionKeys,
    };
    saveProgress(nextProgress);
    const next = nextQuestion(questions, nextProgress);
    setProgress(nextProgress);
    setActiveQuestionKey(next?.key ?? null);
    setAnswer(initialAnswer(next));
    setResult(null);
    setHints(0);
    setShowHint(false);
    setNotice(null);
    submissionLocked.current = false;
  }

  function submit() {
    if (!activeQuestion || submissionLocked.current || result !== null) return;
    submissionLocked.current = true;
    const graded = gradeExercise(activeQuestion.exercise, answer, activeQuestion.course.stage);
    setResult(graded);
    const submittedAnswerHistory = progress.submittedAnswerHistoryByQuestionKey ?? {};
    const priorAnswers = submittedAnswerHistory[activeQuestion.key] ?? [];
    const nextProgress: PracticeSessionProgress = {
      ...progress,
      answersByQuestionKey: {
        ...(progress.answersByQuestionKey ?? {}),
        [activeQuestion.key]: answer,
      },
      submittedAnswerHistoryByQuestionKey: {
        ...submittedAnswerHistory,
        [activeQuestion.key]: [...priorAnswers, answer].slice(-8),
      },
      resultsByQuestionKey: {
        ...(progress.resultsByQuestionKey ?? {}),
        [activeQuestion.key]: {
          correct: graded.correct,
          score: graded.score,
          feedback: graded.feedback,
          knowledgePointIds: graded.knowledgePointIds,
        },
      },
      hintsByQuestionKey: {
        ...(progress.hintsByQuestionKey ?? {}),
        [activeQuestion.key]: hints,
      },
    };
    setProgress(nextProgress);
    saveProgress(nextProgress);
    const nextState = recordQuizAttempt(loadLearningState(), {
      course: activeQuestion.course,
      exercise: activeQuestion.exercise,
      score: graded.score,
      hints,
      completedAt: new Date().toISOString(),
      attemptId: globalThis.crypto?.randomUUID?.() ?? `practice-${activeQuestion.key}-${Date.now()}`,
    });
    if (saveLearningState(nextState)) {
      announceLearningStateChanged();
    } else {
      setNotice("本题已经判分，但学习证据未能保存。请检查浏览器存储权限后重试。");
    }
  }

  function retry() {
    if (!activeQuestion) return;
    setAnswer(initialAnswer(activeQuestion));
    setResult(null);
    setShowHint(false);
    submissionLocked.current = false;
    if (activeQuestion) {
      const nextProgress: PracticeSessionProgress = {
        ...progress,
        answersByQuestionKey: {
          ...(progress.answersByQuestionKey ?? {}),
          [activeQuestion.key]: initialAnswer(activeQuestion),
        },
        resultsByQuestionKey: Object.fromEntries(
          Object.entries(progress.resultsByQuestionKey ?? {}).filter(([key]) => key !== activeQuestion.key),
        ),
      };
      setProgress(nextProgress);
      saveProgress(nextProgress);
    }
  }

  function moveOrderItem(from: number, direction: -1 | 1) {
    if (!activeQuestion || !Array.isArray(answer) || result !== null) return;
    const to = from + direction;
    if (to < 0 || to >= answer.length) return;
    const next = [...answer];
    [next[from], next[to]] = [next[to], next[from]];
    updateAnswer(next);
  }

  function reorderOrderItem(from: number, to: number) {
    if (!activeQuestion || !Array.isArray(answer) || result !== null || from === to) return;
    if (from < 0 || to < 0 || from >= answer.length || to >= answer.length) return;
    const next = [...answer];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    updateAnswer(next);
  }

  function restart() {
    if (!clearPracticeSessionProgress(sessionId)) {
      setNotice("无法清除本次练习进度，请检查浏览器存储权限。");
      return;
    }
    const nextProgress: PracticeSessionProgress = {
      schemaVersion: 1,
      handledQuestionKeys: [],
      correctQuestionKeys: [],
      skippedQuestionKeys: [],
    };
    const first = nextQuestion(questions, nextProgress);
    setProgress(nextProgress);
    setActiveQuestionKey(first?.key ?? null);
    setAnswer(initialAnswer(first));
    setResult(null);
    setHints(0);
    setShowHint(false);
    setNotice(null);
    submissionLocked.current = false;
  }

  if (!activeQuestion) {
    return (
      <main className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
        {!embedded ? (
          <header className={styles.topBar}>
            <Link href={`/learn?stage=${stage}${grade ? `&grade=${grade}` : ""}&view=practice`}><ArrowLeft aria-hidden="true" size={16} />返回练习</Link>
            <span>{stageLabel(stage)} / {practiceSet.title}</span>
          </header>
        ) : null}
        <section className={styles.summary} aria-labelledby="practice-summary-title">
          {questions.length > 0 ? <CheckCircle2 aria-hidden="true" size={30} /> : <CircleHelp aria-hidden="true" size={30} />}
          <p>{questions.length > 0 ? "练习完成" : "暂无可用题目"}</p>
          <h1 id="practice-summary-title">{practiceSet.title}</h1>
          {questions.length > 0 ? (
            <>
              <dl>
                <div><dt>已作答</dt><dd>{progress.handledQuestionKeys.length - progress.skippedQuestionKeys.length}</dd></div>
                <div><dt>答对</dt><dd>{progress.correctQuestionKeys.length}</dd></div>
                <div><dt>跳过</dt><dd>{progress.skippedQuestionKeys.length}</dd></div>
              </dl>
              <p>作答结果已由程序写入本机学习档案；错题和到期复习会影响后续推荐。</p>
              <div><button onClick={restart} type="button"><RotateCcw aria-hidden="true" size={16} />重新练习</button><Link href={`/learn?stage=${stage}${grade ? `&grade=${grade}` : ""}&view=practice`}>返回练习列表</Link></div>
            </>
          ) : (
            <p>当前没有符合条件的题目。完成一次练习后，错题补救会在这里出现。</p>
          )}
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </section>
      </main>
    );
  }

  const questionNumber = progress.handledQuestionKeys.length + 1;
  const progressPercent = Math.round((progress.handledQuestionKeys.length / questions.length) * 100);
  const remediation = result?.correct === false
    ? getMisconceptionForExercise(activeQuestion.exercise.id)
    : undefined;
  const remediationHref = remediation?.route ?? `/learn/practice/remediation-${stage}?stage=${stage}`;
  const isIncorrect = result?.correct === false;
  const answerHistory = progress.submittedAnswerHistoryByQuestionKey?.[activeQuestion.key] ?? [];
  const hint = activeQuestion.course.explanation.keyIdeas.find((idea) =>
    activeQuestion.exercise.knowledgePointTags.some((tag) => idea.includes(tag)),
  ) ?? activeQuestion.course.explanation.workedExample;

  return (
    <main className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
      {!embedded ? (
        <header className={styles.topBar}>
          <Link href={`/learn?stage=${stage}${grade ? `&grade=${grade}` : ""}&view=practice`}><ArrowLeft aria-hidden="true" size={16} />退出练习</Link>
          <div><span>{stageLabel(stage)}</span><strong>{practiceSet.title}</strong></div>
          <span>{questionNumber} / {questions.length}</span>
        </header>
      ) : null}
      <section className={styles.session} aria-labelledby="practice-question-title">
        <header className={styles.sessionHeader}>
          <div><span>{questionTypeLabel(activeQuestion.exercise)}</span><p>{activeQuestion.course.title}</p></div>
          <div aria-label={`练习进度 ${progressPercent}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progressPercent} className={styles.progressTrack} role="progressbar"><i style={{ width: `${progressPercent}%` }} /></div>
        </header>
      <div className={styles.questionBody}>
        <h1 id="practice-question-title">{activeQuestion.exercise.prompt}</h1>
          <QuestionInput answer={answer} exercise={activeQuestion.exercise} result={result} setAnswer={updateAnswer} moveOrderItem={moveOrderItem} reorderOrderItem={reorderOrderItem} />
        </div>
        <footer className={styles.actions}>
          {result === null ? (
            <>
              <div className={styles.secondaryActions}>
                <button
                  disabled={showHint}
                  onClick={() => {
                    setShowHint(true);
                    const nextHints = Math.min(20, hints + 1);
                    setHints(nextHints);
                    if (activeQuestion) {
                      const nextProgress: PracticeSessionProgress = {
                        ...progress,
                        hintsByQuestionKey: {
                          ...(progress.hintsByQuestionKey ?? {}),
                          [activeQuestion.key]: nextHints,
                        },
                      };
                      setProgress(nextProgress);
                      saveProgress(nextProgress);
                    }
                  }}
                  type="button"
                ><CircleHelp aria-hidden="true" size={16} />提示</button>
                <button onClick={() => moveToNext("skipped")} type="button"><SkipForward aria-hidden="true" size={16} />跳过</button>
              </div>
              <button className={styles.submit} disabled={!canSubmit(activeQuestion.exercise, answer)} onClick={submit} type="button">提交答案<ArrowRight aria-hidden="true" size={16} /></button>
            </>
          ) : (
            <>
              <div className={styles.feedback} data-correct={result.correct || undefined} role="status" aria-live="polite">
                <strong>{result.correct ? "回答正确" : "还需要再想一步"}</strong>
                <p>{result.feedback}</p>
                <span>关联知识点：{result.knowledgePointIds.join("、")}</span>
              </div>
              <div className={styles.feedbackActions}>
                {!result.correct ? <button onClick={retry} type="button"><RotateCcw aria-hidden="true" size={16} />再试一次</button> : null}
                {!result.correct ? <Link className={styles.remediationAction} href={remediationHref}><RotateCcw aria-hidden="true" size={16} />进入错题补救</Link> : null}
                <button className={styles.submit} onClick={() => moveToNext("answered")} type="button">{questionNumber === questions.length ? "查看结果" : "下一题"}<ArrowRight aria-hidden="true" size={16} /></button>
              </div>
            </>
          )}
        </footer>
        {showHint ? <aside className={styles.hint} aria-live="polite"><Code2 aria-hidden="true" size={16} /><p>{hint}</p></aside> : null}
        {isIncorrect ? (
          <aside className={styles.remediation} aria-labelledby="practice-remediation-title">
            {remediation ? <><span>错题补救：{remediation.tag}</span><h2 id="practice-remediation-title">{remediation.title}</h2><p>{remediation.explanation}</p><p><strong>示例：</strong>{remediation.example}</p></> : <><span>错题补救</span><h2 id="practice-remediation-title">回到题目依据重新核对</h2><p>先说明你选择的依据，再比较输入、规则和结果；完成补救后可回到本题复测。</p></>}
          </aside>
        ) : null}
        {answerHistory.length > 0 ? (
          <details className={styles.answerEvidence}>
            <summary>查看本题作答证据（{answerHistory.length} 次）</summary>
            <ol>
              {answerHistory.map((submittedAnswer, index) => <li key={`${index}-${formatAnswer(submittedAnswer)}`}><span>第 {index + 1} 次</span><code>{formatAnswer(submittedAnswer) || "（空答案）"}</code></li>)}
            </ol>
          </details>
        ) : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </section>
    </main>
  );
}

function QuestionInput({
  answer,
  exercise,
  result,
  setAnswer,
  moveOrderItem,
  reorderOrderItem,
}: {
  answer: DraftAnswer;
  exercise: CourseExercise;
  result: GradeResult | null;
  setAnswer: (answer: DraftAnswer) => void;
  moveOrderItem: (from: number, direction: -1 | 1) => void;
  reorderOrderItem: (from: number, to: number) => void;
}) {
  if (exercise.type === "multi_select") {
    const selected = Array.isArray(answer) ? answer : [];
    return (
      <fieldset className={styles.choiceList} disabled={result !== null}>
        <legend>选择所有符合条件的答案</legend>
        {exercise.options.map((option, index) => {
          const checked = selected.includes(option);
          return (
            <label data-selected={checked || undefined} key={option}>
              <input
                checked={checked}
                name={exercise.id}
                onChange={() => setAnswer(checked ? selected.filter((item) => item !== option) : [...selected, option])}
                type="checkbox"
                value={option}
              />
              <span className={styles.optionNumber} aria-hidden="true">{index + 1}</span>
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
        disabled={result !== null}
        exercise={exercise}
        result={result}
        setAnswer={setAnswer}
      />
    );
  }
  if (exercise.type === "single_choice" || exercise.type === "result_interpretation") {
    return (
      <fieldset className={styles.choiceList} disabled={result !== null}>
        <legend>选择一个答案</legend>
        {exercise.type === "result_interpretation" ? <pre className={styles.resultEvidence}>{exercise.result}</pre> : null}
        {exercise.options.map((option, index) => (
          <label data-selected={answer === option || undefined} key={option}>
            <input checked={answer === option} name={exercise.id} onChange={() => setAnswer(option)} type="radio" value={option} />
            <span className={styles.optionNumber} aria-hidden="true">{index + 1}</span>
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (exercise.type === "order") {
    const ordered = Array.isArray(answer) ? answer : [];
    return (
      <>
        <p className={styles.orderHint}>拖动项目调整顺序，也可以使用每项右侧的上下按钮。</p>
        <ol className={styles.orderList} aria-label="当前步骤顺序">
        {ordered.map((item, index) => (
          <li
            draggable={result === null}
            key={item}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const from = Number(event.dataTransfer.getData("text/plain"));
              if (Number.isInteger(from)) reorderOrderItem(from, index);
            }}
          >
            <span>{index + 1}</span><p>{item}</p>
            <div><button aria-label={`将${item}上移`} disabled={result !== null || index === 0} onClick={() => moveOrderItem(index, -1)} title="上移" type="button"><ArrowUp aria-hidden="true" size={16} /></button><button aria-label={`将${item}下移`} disabled={result !== null || index === ordered.length - 1} onClick={() => moveOrderItem(index, 1)} title="下移" type="button"><ArrowDown aria-hidden="true" size={16} /></button></div>
          </li>
        ))}
        </ol>
      </>
    );
  }
  return (
    <CodeExerciseEditor
      answer={typeof answer === "string" ? answer : ""}
      disabled={result !== null}
      exercise={exercise}
      key={exercise.id}
      onAnswerChange={setAnswer}
    />
  );
}
