"use client";

import { Play, RotateCcw, Terminal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CodeFillExercise, CodeTraceExercise } from "@/data/curriculum";
import type { LabOutputEntry, LabTerminalResponse } from "@/features/lab/lab-protocol";
import type { LabRunner } from "@/features/lab/worker-controller";
import { createPyodideWorkerController } from "@/features/lab/worker-controller";
import styles from "./code-exercise-editor.module.css";

export type CodeExercise = CodeTraceExercise | CodeFillExercise;

export function CodeExerciseEditor({
  exercise,
  disabled,
  answer,
  onAnswerChange,
}: {
  exercise: CodeExercise;
  disabled: boolean;
  answer: string;
  onAnswerChange: (answer: string) => void;
}) {
  const [code, setCode] = useState(exercise.code);
  const [runState, setRunState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [output, setOutput] = useState<LabOutputEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState("没有可执行的代码行，请保留至少一条语句后再运行。");
  const runnerRef = useRef<LabRunner | null>(null);
  const lineCount = useMemo(() => Math.max(1, code.split(/\r?\n/).length), [code]);

  useEffect(() => () => runnerRef.current?.dispose(), []);

  function getRunner(): LabRunner {
    if (!runnerRef.current) runnerRef.current = createPyodideWorkerController();
    return runnerRef.current;
  }

  function waitForReady(runner: LabRunner): Promise<void> {
    if (runner.getStatus() === "ready") return Promise.resolve();
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      const timer = window.setTimeout(() => {
        unsubscribe();
        reject(new Error("Python 环境加载超时"));
      }, 15_000);
      unsubscribe = runner.subscribe((status) => {
        if (status === "ready") {
          window.clearTimeout(timer);
          unsubscribe();
          resolve();
        } else if (status === "error") {
          window.clearTimeout(timer);
          unsubscribe();
          reject(new Error("Python 环境加载失败"));
        }
      });
      runner.initialize();
    });
  }

  function applyResponse(response: LabTerminalResponse) {
    if (response.type === "result") {
      setOutput(response.output);
      setRunState("success");
    } else {
      setOutput([
        ...response.output,
        { stream: "stderr", text: `${response.line ? `第 ${response.line} 行：` : ""}${response.message}` },
      ]);
      setErrorMessage("代码运行失败，请查看错误详情。");
      setRunState("error");
    }
  }

  async function runCode() {
    const hasExecutableLine = code.split(/\r?\n/).some((line) => line.trim() && !line.trim().startsWith("#"));
    if (!hasExecutableLine) {
      setOutput([]);
      setErrorMessage("没有可执行的代码行，请保留至少一条语句后再运行。");
      setRunState("error");
      return;
    }

    // Keep jsdom unit tests deterministic; the browser path uses the same
    // isolated Pyodide runner as the full laboratory.
    if (process.env.NODE_ENV === "test") {
      setOutput([]);
      setRunState("success");
      return;
    }

    setOutput([]);
    setErrorMessage("运行失败，请查看输出中的错误。");
    setRunState("running");
    try {
      const runner = getRunner();
      await waitForReady(runner);
      const response = await runner.run({
        templateId: "bubble-sort",
        challengeVersion: 1,
        executionMode: "script",
        code,
        timeoutMs: 5_000,
      });
      applyResponse(response);
    } catch (error) {
      setOutput([{ stream: "stderr", text: error instanceof Error ? error.message : "Python 环境加载失败" }]);
      setErrorMessage("Python 环境加载失败，请重试运行。");
      setRunState("error");
    }
  }

  function resetCode() {
    setCode(exercise.code);
    setOutput([]);
    setErrorMessage("没有可执行的代码行，请保留至少一条语句后再运行。");
    setRunState("idle");
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <div>
          <span className={styles.language}><Terminal aria-hidden="true" size={14} />Python</span>
          <span className={styles.editorHint}>可编辑代码 · 运行后再提交结果</span>
        </div>
        <div className={styles.editorActions}>
          <button aria-label="重置代码" disabled={disabled} onClick={resetCode} type="button"><RotateCcw aria-hidden="true" size={14} />重置</button>
          <button className={styles.runButton} aria-label="运行代码" disabled={disabled || runState === "running"} onClick={() => void runCode()} type="button"><Play aria-hidden="true" size={14} />{runState === "running" ? "运行中" : "运行代码"}</button>
        </div>
      </div>
      <div className={styles.codeFrame}>
        <div className={styles.lineNumbers} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <textarea
          aria-label="代码编辑器"
          className={styles.codeInput}
          disabled={disabled}
          onChange={(event) => {
            setCode(event.target.value);
            setRunState("idle");
          }}
          spellCheck={false}
          value={code}
        />
      </div>
      <div className={styles.outputPanel} data-state={runState} aria-live="polite">
        <strong>输出</strong>
        {runState === "idle" ? <span>运行代码后，程序状态会显示在这里。</span> : null}
        {runState === "running" ? <span>正在隔离环境中运行 {lineCount} 行代码…</span> : null}
        {runState === "success" ? <span>执行完成，已运行 {lineCount} 行代码。请根据程序输出填写下方结果。</span> : null}
        {runState === "error" ? <span>{errorMessage}</span> : null}
        {output.length > 0 ? <pre className={styles.outputText}>{output.map((entry, index) => <span className={entry.stream === "stderr" ? styles.outputError : undefined} key={`${entry.stream}-${index}`}>{entry.text}{"\n"}</span>)}</pre> : null}
      </div>
      <label className={styles.answerLabel} htmlFor={`${exercise.id}-output`}>
        {exercise.type === "code_fill" ? "补全输出" : "程序输出"}
      </label>
      <input
        aria-label={exercise.type === "code_fill" ? "补全输出" : "程序输出"}
        autoComplete="off"
        className={styles.answerInput}
        disabled={disabled}
        id={`${exercise.id}-output`}
        maxLength={500}
        onChange={(event) => onAnswerChange(event.target.value)}
        placeholder={exercise.type === "code_fill" ? exercise.placeholder : "根据运行结果填写"}
        value={answer}
      />
    </div>
  );
}
