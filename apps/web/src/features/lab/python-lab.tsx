"use client";

import { useEffect, useRef, useState } from "react";
import { CircleStop, Lightbulb, Play, RefreshCw, RotateCcw, Terminal } from "lucide-react";

import type { Stage } from "@/lib/domain";
import { announceLearningStateChanged } from "@/lib/learning-events";
import { loadLearningState, saveLearningState } from "@/lib/learning-store";
import { recordLabCompletion } from "./lab-progress";
import {
  DEFAULT_LAB_TEMPLATE_ID,
  LAB_TEMPLATES,
  getLabGuidance,
  getLabTemplate,
} from "./lab-templates";
import type { LabOutputEntry, LabTemplateId, LabTerminalResponse } from "./lab-protocol";
import { MonacoPythonEditor } from "./monaco-python-editor";
import {
  createPyodideWorkerController,
  type LabRunner,
  type LabRunnerStatus,
} from "./worker-controller";
import styles from "./python-lab.module.css";

interface PythonLabProps {
  createRunner?: () => LabRunner;
}

function outputFrom(response: LabTerminalResponse): LabOutputEntry[] {
  if (response.type === "result") return response.output;
  const linePrefix = response.line ? `第 ${response.line} 行：` : "";
  return [...response.output, { stream: "stderr", text: `${linePrefix}${response.message}` }];
}

export function PythonLab({
  createRunner = createPyodideWorkerController,
}: PythonLabProps) {
  const [templateId, setTemplateId] = useState<LabTemplateId>(DEFAULT_LAB_TEMPLATE_ID);
  const [code, setCode] = useState(() => getLabTemplate(DEFAULT_LAB_TEMPLATE_ID).starterCode);
  const [status, setStatus] = useState<LabRunnerStatus>("loading");
  const [output, setOutput] = useState<LabOutputEntry[]>([]);
  const [resultMessage, setResultMessage] = useState("等待运行");
  const [hintIndex, setHintIndex] = useState(-1);
  const [stage, setStage] = useState<Stage>("lower_primary");
  const runnerRef = useRef<LabRunner | null>(null);

  const template = getLabTemplate(templateId);
  const guidance = getLabGuidance(templateId, stage);
  const isRunning = status === "running";

  useEffect(() => {
    const runner = createRunner();
    let active = true;
    queueMicrotask(() => {
      if (active) setStage(loadLearningState().profile.stage);
    });
    runnerRef.current = runner;
    const unsubscribe = runner.subscribe(setStatus);
    runner.initialize();

    return () => {
      active = false;
      unsubscribe();
      runner.dispose();
      runnerRef.current = null;
    };
  }, [createRunner]);

  const selectTemplate = (nextId: LabTemplateId) => {
    if (isRunning || nextId === templateId) return;
    setTemplateId(nextId);
    setCode(getLabTemplate(nextId).starterCode);
    setOutput([]);
    setResultMessage("等待运行");
    setHintIndex(-1);
  };

  const runCode = async () => {
    const runner = runnerRef.current;
    if (!runner || isRunning || !code.trim()) return;
    setOutput([]);
    setResultMessage("正在运行确定性检查…");

    const hintsUsed = Math.max(0, hintIndex + 1);
    const response = await runner.run({
      templateId,
      challengeVersion: template.challengeVersion,
      code,
      timeoutMs: 5_000,
    });
    setOutput(outputFrom(response));

    if (response.type === "result" && response.passed) {
      const now = new Date().toISOString();
      const currentState = loadLearningState();
      const nextState = recordLabCompletion(currentState, {
        templateId,
        challengeVersion: template.challengeVersion,
        passed: true,
        completedAt: now,
        hintsUsed,
      });
      if (nextState === currentState) {
        setResultMessage("本挑战版本已经记录，本次运行不重复增加掌握证据");
      } else if (saveLearningState(nextState)) {
        announceLearningStateChanged();
        setResultMessage("形成性练习已保存到本机学习记录");
      } else {
        setResultMessage("挑战已通过，但本机学习记录保存失败");
      }
    } else if (response.type === "result") {
      setResultMessage("代码已运行，但挑战检查尚未全部通过");
    } else if (response.category === "cancelled") {
      setResultMessage("本次运行已停止");
    } else {
      setResultMessage("运行未完成，请查看输出中的提示");
    }
  };

  const stopCode = () => {
    runnerRef.current?.stop();
  };

  const resetCode = () => {
    if (isRunning) return;
    setCode(template.starterCode);
    setOutput([]);
    setResultMessage("代码已恢复为课程模板");
    setHintIndex(-1);
  };

  const revealHint = () => {
    setHintIndex((current) => Math.min(current + 1, guidance.hints.length - 1));
  };

  return (
    <section className={styles.lab} aria-labelledby="lab-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Python 编程实验室</p>
          <h1 id="lab-title">边改边运行，亲手验证算法</h1>
          <p>代码在无主站同源权限的隔离页面 Worker 中执行，不会发送到服务端。</p>
        </div>
        <div className={styles.runtimeStatus} data-status={status} aria-live="polite">
          <span aria-hidden="true" />
          {status === "loading" ? "正在加载 Python" : status === "running" ? "正在运行" : status === "error" ? "环境需重试" : "Python 已就绪"}
          {status === "error" ? (
            <button type="button" onClick={() => runnerRef.current?.initialize()}>
              <RefreshCw size={14} aria-hidden="true" />
              重试加载
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.templatePicker} role="group" aria-label="实验模板">
        {(Object.values(LAB_TEMPLATES) as typeof LAB_TEMPLATES[LabTemplateId][]).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === templateId}
            disabled={isRunning}
            onClick={() => selectTemplate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <div className={styles.codeArea}>
          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryButton} onClick={() => void runCode()} disabled={isRunning || status === "loading" || !code.trim()}>
              <Play size={17} aria-hidden="true" />
              运行代码
            </button>
            <button type="button" className={styles.stopButton} onClick={stopCode} disabled={!isRunning}>
              <CircleStop size={17} aria-hidden="true" />
              停止运行
            </button>
            <button type="button" className={styles.iconButton} onClick={resetCode} disabled={isRunning} title="重置代码">
              <RotateCcw size={17} aria-hidden="true" />
              重置代码
            </button>
          </div>
          <MonacoPythonEditor value={code} onChange={setCode} />
        </div>

        <aside className={styles.guide} aria-label="实验任务">
          <div className={styles.task}>
            <p className={styles.panelLabel}>本次任务</p>
            <h2>{template.title}</h2>
            <p>{guidance.task}</p>
          </div>

          <div className={styles.hints}>
            <div className={styles.hintHeading}>
              <Lightbulb size={18} aria-hidden="true" />
              <h2>分级提示</h2>
            </div>
            {hintIndex < 0 ? <p>遇到困难时逐条查看，不会直接替你写完整代码。</p> : (
              <ol>
                {guidance.hints.slice(0, hintIndex + 1).map((hint) => <li key={hint}>{hint}</li>)}
              </ol>
            )}
            <button type="button" onClick={revealHint} disabled={hintIndex >= guidance.hints.length - 1}>
              {hintIndex < 0 ? "查看第一条提示" : "再看一条提示"}
            </button>
          </div>

          <div className={styles.outputPanel}>
            <div className={styles.outputHeading}>
              <Terminal size={18} aria-hidden="true" />
              <h2>运行输出</h2>
            </div>
            <p className={styles.resultMessage} aria-live="polite">{resultMessage}</p>
            <pre aria-label="Python 运行输出" aria-live="polite">
              {output.length === 0 ? <span className={styles.placeholder}>运行后将在这里显示 stdout 和错误。</span> : output.map((entry, index) => (
                <span key={`${entry.stream}-${index}`} className={entry.stream === "stderr" ? styles.stderr : styles.stdout}>
                  {entry.text}{"\n"}
                </span>
              ))}
            </pre>
          </div>
        </aside>
      </div>

      <p className={styles.safetyNote}>
        浏览器内课程练习不是服务端正式判题沙箱；导入提示也不是安全边界。隔离页面、CSP 和运行后禁网共同保护主站数据，结果仅作低权重形成性学习证据。
      </p>
    </section>
  );
}
