"use client";

import { useEffect, useRef, useState } from "react";
import { CircleStop, Lightbulb, MessageCircle, Play, RefreshCw, RotateCcw, Save, Terminal } from "lucide-react";

import type { ExperimentMode, Stage } from "@/lib/domain";
import { isActivityUnlocked } from "@/data/learning-paths";
import { announceLearningStateChanged } from "@/lib/learning-events";
import { loadLearningState, saveLearningState } from "@/lib/learning-store";
import {
  getIndependentImageClassificationRuns,
  getGuidedImageClassificationEvidence,
  hasCompletedResearchImageClassificationChallenge,
  GUIDED_IMAGE_CLASSIFICATION_TEST_COUNT,
  recordGuidedImageClassificationEvidence,
  recordIndependentImageClassificationConclusion,
  recordIndependentImageClassificationRun,
  getResearchImageClassificationAttempts,
  recordResearchImageClassificationAttempt,
  recordResearchImageClassificationConclusion,
  recordLabCompletion,
  getLabEvidenceMetrics,
} from "./lab-progress";
import {
  canRunGuidedImageClassification,
  GuidedImageClassificationFlow,
  type GuidedImageClassificationPrediction,
} from "./guided-image-classification-flow";
import {
  calculateIndependentImageClassificationRun,
  getIndependentVariable,
  type IndependentImageClassificationRun,
  type IndependentVariableId,
} from "./independent-image-classification";
import {
  calculateResearchImageClassificationAttempt,
  type ResearchImageClassificationAttempt,
  type ResearchSampleId,
} from "./research-image-classification";
import { ResearchImageClassificationFlow } from "./research-image-classification-flow";
import {
  IndependentImageClassificationFlow,
  type IndependentExperimentConclusion,
} from "./independent-image-classification-flow";
import {
  DEFAULT_LAB_TEMPLATE_ID,
  LAB_TEMPLATES,
  getLabGuidance,
  getLabTemplate,
} from "./lab-templates";
import type { LabOutputEntry, LabTemplateId, LabTerminalResponse } from "./lab-protocol";
import { loadLatestLabCodeVersion, saveLabCodeVersion } from "./lab-version-store";
import { MonacoPythonEditor } from "./monaco-python-editor";
import {
  createPyodideWorkerController,
  type LabRunner,
  type LabRunnerStatus,
} from "./worker-controller";
import styles from "./python-lab.module.css";

interface PythonLabProps {
  createRunner?: () => LabRunner;
  embedded?: boolean;
  /**
   * A lab entry flow can choose a stage without overwriting the learner's
   * saved profile. The value is intentionally used only for this session.
   */
  initialStage?: Stage;
  initialTemplateId?: LabTemplateId;
  initialMode?: ExperimentMode;
}

interface GuidedImageClassificationRunMetadata {
  runId: string;
  challengeVersion: number;
  runDurationMs: number;
  passedTests: number;
  totalTests: number;
  hintsUsed: number;
  resultCode: string;
}

function outputFrom(response: LabTerminalResponse): LabOutputEntry[] {
  if (response.type === "result") return response.output;
  const linePrefix = response.line ? `第 ${response.line} 行：` : "";
  return [...response.output, { stream: "stderr", text: `${linePrefix}${response.message}` }];
}

function requiredActivityId(stage: Stage | undefined, mode: ExperimentMode | undefined, templateId: LabTemplateId): string | null {
  if (stage === "middle_school" && mode === "guided" && templateId === "image-classifier") return "middle-neural-signals-guided-lab";
  if (stage === "middle_school" && mode === "independent" && templateId === "bubble-sort") return "middle-data-and-algorithms-lab";
  if (stage === "middle_school" && mode === "independent" && templateId === "middle-python-basics") return "middle-python-basics-lab";
  if (stage === "middle_school" && mode === "independent" && templateId === "image-classifier") return "middle-neural-signals-independent-lab";
  if (stage === "middle_school" && mode === "research" && templateId === "image-classifier") return "middle-data-bias-research";
  if (stage === "high_school" && mode === "independent" && templateId === "python-data-basics") return "high-python-data-lab-code";
  if (stage === "high_school" && mode === "independent" && templateId === "bubble-sort-analysis") return "high-bubble-analysis-code";
  if (stage === "high_school" && mode === "independent" && templateId === "dataset-split") return "high-ml-pipeline-code";
  if (stage === "high_school" && mode === "independent" && templateId === "classification-metrics") return "high-classification-regression-code";
  if (stage === "high_school" && mode === "independent" && templateId === "gradient-descent-demo") return "high-neural-network-training-code";
  if (stage === "high_school" && mode === "independent" && templateId === "multimodal-input-audit") return "high-multimodal-ai-code";
  if (stage === "high_school" && mode === "independent" && templateId === "rag-citation-check") return "high-generative-ai-rag-code";
  if (stage === "high_school" && mode === "project" && templateId === "model-audit") return "high-image-model-audit-project";
  return null;
}

export function PythonLab({
  createRunner = createPyodideWorkerController,
  embedded = false,
  initialStage,
  initialTemplateId = DEFAULT_LAB_TEMPLATE_ID,
  initialMode,
}: PythonLabProps) {
  const [templateId, setTemplateId] = useState<LabTemplateId>(initialTemplateId);
  const [code, setCode] = useState(() => {
    const template = getLabTemplate(initialTemplateId);
    return loadLatestLabCodeVersion({
      stage: initialStage ?? null,
      mode: initialMode ?? "standard",
      templateId: initialTemplateId,
      challengeVersion: template.challengeVersion,
    })?.code ?? template.starterCode;
  });
  const [status, setStatus] = useState<LabRunnerStatus>("loading");
  const [output, setOutput] = useState<LabOutputEntry[]>([]);
  const [resultMessage, setResultMessage] = useState("等待运行");
  const [hintIndex, setHintIndex] = useState(-1);
  const [stage, setStage] = useState<Stage>(initialStage ?? "lower_primary");
  const [guidedPrediction, setGuidedPrediction] = useState<GuidedImageClassificationPrediction | null>(null);
  const [guidedRunPassed, setGuidedRunPassed] = useState(false);
  const [guidedRunMetadata, setGuidedRunMetadata] = useState<GuidedImageClassificationRunMetadata | null>(null);
  const [guidedEvidenceSaved, setGuidedEvidenceSaved] = useState(false);
  const [guidedSaveNotice, setGuidedSaveNotice] = useState<string | null>(null);
  const [guidedObservation, setGuidedObservation] = useState("");
  const [guidedConclusion, setGuidedConclusion] = useState("");
  const [independentVariableId, setIndependentVariableId] = useState<IndependentVariableId>("texture");
  const [independentValue, setIndependentValue] = useState("striped");
  const [independentRuns, setIndependentRuns] = useState<IndependentImageClassificationRun[]>([]);
  const [independentEvidenceSaved, setIndependentEvidenceSaved] = useState(false);
  const [independentSaveNotice, setIndependentSaveNotice] = useState<string | null>(null);
  const [researchAttempts, setResearchAttempts] = useState<ResearchImageClassificationAttempt[]>([]);
  const [researchEvidenceSaved, setResearchEvidenceSaved] = useState(false);
  const [researchSaveNotice, setResearchSaveNotice] = useState<string | null>(null);
  const [versionNotice, setVersionNotice] = useState<string | null>(null);
  const [mentorNotice, setMentorNotice] = useState<string | null>(null);
  const [researchResetKey, setResearchResetKey] = useState(0);
  const [lastRun, setLastRun] = useState<{ passed: boolean; durationMs: number } | null>(null);
  const runnerRef = useRef<LabRunner | null>(null);

  const template = getLabTemplate(templateId);
  const guidance = getLabGuidance(templateId, stage);
  const evidenceMetrics = getLabEvidenceMetrics(templateId);
  const isRunning = status === "running";
  const isGuidedImageClassification = initialMode === "guided" && templateId === "image-classifier";
  const isIndependentImageClassification = initialMode === "independent"
    && initialStage === "middle_school"
    && templateId === "image-classifier";
  const isResearchImageClassification = initialMode === "research"
    && initialStage === "middle_school"
    && templateId === "image-classifier";
  const isProjectMode = initialMode === "project";
  const requiredActivity = requiredActivityId(initialStage, initialMode, templateId);
  const requiresLearningPathEntry = initialMode !== undefined;
  const entryState = requiredActivity ? loadLearningState() : null;
  const entryProgress = requiredActivity
    && (initialStage === "middle_school" || initialStage === "high_school")
    ? entryState?.stageProgressByStage[initialStage]
    : null;
  const entryUnlocked = requiredActivity
    ? Boolean(
      entryProgress
      && entryProgress.activeActivityId === requiredActivity
      && isActivityUnlocked(requiredActivity, entryProgress.completedActivityIds),
    )
    : !requiresLearningPathEntry;

  useEffect(() => {
    const runner = createRunner();
    let active = true;
    queueMicrotask(() => {
      if (active && !initialStage) setStage(loadLearningState().profile.stage);
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
  }, [createRunner, initialStage]);

  useEffect(() => {
    if (!isGuidedImageClassification) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const evidence = getGuidedImageClassificationEvidence(loadLearningState());
      if (!evidence) return;
      const prediction = evidence.variables.predictionBeforeRun ?? evidence.variables.learnerPrediction;
      if (prediction === "leaf" || prediction === "ball" || prediction === "cup") setGuidedPrediction(prediction);
      setGuidedRunPassed(true);
      setGuidedEvidenceSaved(true);
      setGuidedObservation(String(evidence.variables.observation ?? ""));
      setGuidedConclusion(String(evidence.variables.learnerConclusion ?? ""));
      const runDurationMs = Number(evidence.variables.runDurationMs);
      const hintsUsed = Number(evidence.variables.hintsUsed);
      const challengeVersion = Number(evidence.variables.challengeVersion);
      const passedTests = Number(evidence.metrics.passedTests);
      const totalTests = Number(evidence.metrics.totalTests);
      if (
        Number.isFinite(runDurationMs)
        && Number.isFinite(hintsUsed)
        && Number.isFinite(challengeVersion)
        && Number.isFinite(passedTests)
        && Number.isFinite(totalTests)
      ) {
        setGuidedRunMetadata({
          runId: evidence.runId,
          challengeVersion,
          runDurationMs,
          passedTests,
          totalTests,
          hintsUsed,
          resultCode: String(evidence.variables.resultCode ?? "passed"),
        });
      }
    });
    return () => { active = false; };
  }, [isGuidedImageClassification]);

  useEffect(() => {
    if (!isIndependentImageClassification) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setIndependentRuns(getIndependentImageClassificationRuns(loadLearningState()));
    });
    return () => { active = false; };
  }, [isIndependentImageClassification]);

  useEffect(() => {
    if (!isResearchImageClassification) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const state = loadLearningState();
      setResearchAttempts(getResearchImageClassificationAttempts(state));
      setResearchEvidenceSaved(hasCompletedResearchImageClassificationChallenge(state));
    });
    return () => { active = false; };
  }, [isResearchImageClassification]);

  const selectTemplate = (nextId: LabTemplateId) => {
    if (isRunning || initialMode === "guided" || initialMode === "independent" || initialMode === "research" || initialMode === "project" || nextId === templateId) return;
    setTemplateId(nextId);
    setCode(getLabTemplate(nextId).starterCode);
    setOutput([]);
    setResultMessage("等待运行");
    setHintIndex(-1);
    setGuidedPrediction(null);
    setGuidedRunPassed(false);
    setGuidedRunMetadata(null);
    setGuidedEvidenceSaved(false);
    setGuidedSaveNotice(null);
    setGuidedObservation("");
    setGuidedConclusion("");
    setIndependentRuns([]);
    setIndependentEvidenceSaved(false);
    setIndependentSaveNotice(null);
    setResearchAttempts([]);
    setResearchEvidenceSaved(false);
    setResearchSaveNotice(null);
    setVersionNotice(null);
    setMentorNotice(null);
    setLastRun(null);
  };

  const runCode = async () => {
    const runner = runnerRef.current;
    if (
      !runner
      || isRunning
      || !code.trim()
      || !entryUnlocked
      || (isGuidedImageClassification && (!canRunGuidedImageClassification(guidedPrediction) || guidedRunPassed))
    ) return;
    setMentorNotice(null);
    setOutput([]);
    setResultMessage("正在运行确定性检查…");

    const hintsUsed = Math.max(0, hintIndex + 1);
    let response: LabTerminalResponse;
    try {
      response = await runner.run({
        templateId,
        challengeVersion: template.challengeVersion,
        code,
        timeoutMs: 5_000,
      });
    } catch {
      setResultMessage("运行请求失败，实验环境已重置；请点击重试加载后再次运行");
      setOutput([{ stream: "stderr", text: "实验运行请求未完成，请重试。" }]);
      return;
    }
    setOutput(outputFrom(response));
    setLastRun(response.type === "result" ? { passed: response.passed, durationMs: response.durationMs } : null);

    if (isGuidedImageClassification) {
      const passed = response.type === "result" && response.passed;
      setGuidedRunPassed(passed);
      setGuidedRunMetadata(passed && response.type === "result" ? {
        runId: response.id,
        challengeVersion: template.challengeVersion,
        runDurationMs: response.durationMs,
        passedTests: GUIDED_IMAGE_CLASSIFICATION_TEST_COUNT,
        totalTests: GUIDED_IMAGE_CLASSIFICATION_TEST_COUNT,
        hintsUsed,
        resultCode: "passed",
      } : null);
      setGuidedEvidenceSaved(false);
      setGuidedSaveNotice(null);
    }

    if (response.type === "result" && response.passed) {
      const now = new Date().toISOString();
      const currentState = loadLearningState();
      let nextState = currentState;
      if (!isGuidedImageClassification) {
        nextState = recordLabCompletion(currentState, {
          templateId,
          challengeVersion: template.challengeVersion,
          passed: true,
          completedAt: now,
          hintsUsed,
          durationMs: response.durationMs,
          resultCode: "passed",
        });
      }
      if (isIndependentImageClassification) {
        const run = calculateIndependentImageClassificationRun({
          runId: `independent-image-classifier:${now}:${independentVariableId}:${independentValue}`,
          variableId: independentVariableId,
          value: independentValue,
          hintsUsed,
          completedAt: now,
        });
        if (run) nextState = recordIndependentImageClassificationRun(nextState, run);
      }
      if (isGuidedImageClassification) {
        setResultMessage("运行通过，请完成观察和结论后保存实验证据");
      } else if (nextState === currentState) {
        setResultMessage("本挑战版本已经记录，本次运行不重复增加掌握证据");
      } else if (saveLearningState(nextState)) {
        if (isIndependentImageClassification) {
          setIndependentRuns(getIndependentImageClassificationRuns(nextState));
          setIndependentEvidenceSaved(false);
          setIndependentSaveNotice("本次运行已保存到对比表。请用同一变量的另一个取值再运行一次。");
          setResultMessage("本次独立运行已保存；请继续形成可比较的第二次运行。");
        } else {
          setResultMessage("形成性练习已保存到本机学习记录");
        }
        announceLearningStateChanged();
      } else {
        setResultMessage("挑战已通过，但本机学习记录保存失败");
      }
    } else if (response.type === "result") {
      setResultMessage("代码已运行，但挑战检查尚未全部通过");
    } else if (response.category === "cancelled") {
      setResultMessage("本次运行已停止");
    } else if (response.category === "timeout") {
      setResultMessage("运行超时，隔离环境已重启；环境恢复后可以再次运行");
    } else if (response.category === "runtime") {
      setResultMessage("运行环境发生错误，隔离环境已关闭；请点击重试加载");
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
    setGuidedRunPassed(false);
    setGuidedRunMetadata(null);
    setGuidedEvidenceSaved(false);
    setGuidedSaveNotice(null);
    setGuidedObservation("");
    setGuidedConclusion("");
    setVersionNotice(null);
    setMentorNotice(null);
    if (isResearchImageClassification) setResearchResetKey((key) => key + 1);
    setLastRun(null);
  };

  const saveVersion = () => {
    const savedAt = new Date().toISOString();
    const saved = saveLabCodeVersion({
      stage: initialStage ?? null,
      mode: initialMode ?? "standard",
      templateId,
      challengeVersion: template.challengeVersion,
      code,
      savedAt,
    });
    setVersionNotice(saved ? "当前代码版本已保存到本机，可在本次实验中恢复。" : "版本保存失败，请检查浏览器存储权限后重试。");
  };

  const askStarBao = () => {
    setMentorNotice(isProjectMode
      ? "星宝提示（本地实验教练）：先运行固定测试，再用一个具体指标说明模型在哪个分组失败；不要只写总体准确率。"
      : "星宝提示（本地实验教练）：先预测运行结果，再查看固定测试和输出，最后说明变量或代码改变带来的影响。"
    );
  };

  const saveGuidedObservation = ({ observation, conclusion }: { observation: string; conclusion: string }) => {
    if (!guidedPrediction || !guidedRunPassed || guidedEvidenceSaved || !guidedRunMetadata) return;
    const now = new Date().toISOString();
    const currentState = loadLearningState();
    const evidenceState = recordGuidedImageClassificationEvidence(currentState, {
      prediction: guidedPrediction,
      observation,
      conclusion,
      predictionBeforeRun: guidedPrediction,
      runId: guidedRunMetadata.runId,
      challengeVersion: guidedRunMetadata.challengeVersion,
      runDurationMs: guidedRunMetadata.runDurationMs,
      hintsUsed: guidedRunMetadata.hintsUsed,
      passedTests: guidedRunMetadata.passedTests,
      totalTests: guidedRunMetadata.totalTests,
      resultCode: guidedRunMetadata.resultCode,
      completedAt: now,
    });
    if (evidenceState === currentState) {
      setGuidedSaveNotice("观察或结论不完整，且结论必须引用本次固定检查指标（例如 3/3）。");
      return;
    }
    const nextState = recordLabCompletion(evidenceState, {
      templateId: "image-classifier",
      challengeVersion: guidedRunMetadata.challengeVersion,
      passed: true,
      completedAt: now,
      hintsUsed: guidedRunMetadata.hintsUsed,
      durationMs: guidedRunMetadata.runDurationMs,
      resultCode: guidedRunMetadata.resultCode,
    });
    if (saveLearningState(nextState)) {
      setGuidedEvidenceSaved(true);
      setGuidedObservation(observation);
      setGuidedConclusion(conclusion);
      setGuidedSaveNotice("已保存预测、变量、测试指标、提示次数、观察和结论；可回到阶段任务继续学习。");
      announceLearningStateChanged();
      return;
    }
    setGuidedSaveNotice("实验已完成，但本机学习记录未能保存。请检查浏览器存储权限后重试。");
  };

  const changeIndependentVariable = (variableId: IndependentVariableId) => {
    if (independentRuns.length > 0) return;
    setIndependentVariableId(variableId);
    setIndependentValue(getIndependentVariable(variableId).options[0]!.value);
  };

  const saveIndependentConclusion = (conclusion: IndependentExperimentConclusion) => {
    if (independentEvidenceSaved) return;
    const now = new Date().toISOString();
    const currentState = loadLearningState();
    const nextState = recordIndependentImageClassificationConclusion(currentState, {
      ...conclusion,
      completedAt: now,
    });
    if (nextState === currentState) {
      setIndependentSaveNotice("结论还缺少两次可比较运行，或没有引用表中的实际分数与 3/3 检查指标。");
      return;
    }
    if (saveLearningState(nextState)) {
      setIndependentEvidenceSaved(true);
      setIndependentSaveNotice("两次可比较运行和实验结论已保存；可回到阶段任务继续学习。");
      announceLearningStateChanged();
      return;
    }
    setIndependentSaveNotice("实验结论已完成，但本机学习记录未能保存。请检查浏览器存储权限后重试。");
  };

  const evaluateResearchPlan = (selectedSampleIds: readonly ResearchSampleId[]) => {
    if (researchEvidenceSaved) return;
    const now = new Date().toISOString();
    const attempt = calculateResearchImageClassificationAttempt({
      runId: `research-image-classifier:attempt:${now}`,
      selectedSampleIds,
      completedAt: now,
    });
    if (!attempt) {
      setResearchSaveNotice("本次补样本方案无效，暂时不能评估。");
      return;
    }
    const currentState = loadLearningState();
    const nextState = recordResearchImageClassificationAttempt(currentState, attempt);
    if (nextState === currentState) {
      setResearchSaveNotice("当前研究挑战尚未解锁，或本次方案已经保存。");
      return;
    }
    if (saveLearningState(nextState)) {
      setResearchAttempts(getResearchImageClassificationAttempts(nextState));
      setResearchSaveNotice("方案和分组指标已保存。请继续保留对照并比较下一次尝试。");
      announceLearningStateChanged();
      return;
    }
    setResearchSaveNotice("方案已评估，但本机学习记录未能保存。请检查浏览器存储权限后重试。");
  };

  const saveResearchConclusion = (conclusion: string) => {
    if (researchEvidenceSaved) return;
    const now = new Date().toISOString();
    const currentState = loadLearningState();
    const nextState = recordResearchImageClassificationConclusion(currentState, conclusion, now);
    if (nextState === currentState) {
      setResearchSaveNotice("研究证据尚未满足：请完成两次可比较评估、达到逆光目标，并引用实际指标。");
      return;
    }
    if (saveLearningState(nextState)) {
      setResearchEvidenceSaved(true);
      setResearchSaveNotice("研究挑战证据已保存；可回到阶段任务继续学习。");
      announceLearningStateChanged();
      return;
    }
    setResearchSaveNotice("研究结论已完成，但本机学习记录未能保存。请检查浏览器存储权限后重试。");
  };

  const revealHint = () => {
    setHintIndex((current) => Math.min(current + 1, guidance.hints.length - 1));
  };

  return (
    <section className={`${styles.lab} ${embedded ? styles.embedded : ""} ${isResearchImageClassification ? styles.researchLab : ""}`} aria-labelledby="lab-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Python 编程实验室</p>
          <h1 id="lab-title">边改边运行，亲手验证算法</h1>
          <p>代码在无主站同源权限的隔离页面中执行，不会发送到服务端。</p>
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

      {!isGuidedImageClassification && !isIndependentImageClassification && !isResearchImageClassification && !isProjectMode ? <div className={styles.templatePicker} role="group" aria-label="实验模板">
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
      </div> : null}

      <div className={`${styles.workspace} ${isResearchImageClassification ? styles.researchWorkspace : ""}`}>
        {isResearchImageClassification ? (
          <>
          <aside className={`${styles.guide} ${styles.researchGuide}`} aria-label="研究挑战">
            <ResearchImageClassificationFlow
              key={researchResetKey}
              attempts={researchAttempts}
              saved={researchEvidenceSaved}
              notice={researchSaveNotice}
              onEvaluate={evaluateResearchPlan}
              onSaveConclusion={saveResearchConclusion}
            />
          </aside>
          <div className={styles.researchWorkbench} aria-label="研究数据工作台">
            <div className={styles.toolbar}>
              <button type="button" className={styles.primaryButton} disabled title="研究挑战通过左侧固定数据表单评估">
                <Play size={17} aria-hidden="true" />
                运行代码
              </button>
              <button type="button" className={styles.stopButton} disabled>
                <CircleStop size={17} aria-hidden="true" />
                停止运行
              </button>
              <button type="button" className={styles.toolbarButton} onClick={resetCode} title="重置本次研究方案">
                <RotateCcw size={17} aria-hidden="true" />
                重置方案
              </button>
              <button type="button" className={styles.toolbarButton} onClick={saveVersion}>
                <Save size={17} aria-hidden="true" />
                保存版本
              </button>
              <button type="button" className={styles.toolbarButton} onClick={askStarBao}>
                <MessageCircle size={17} aria-hidden="true" />
                询问星宝
              </button>
            </div>
            <div className={styles.researchCanvas}>
              <p className={styles.panelLabel}>固定研究工作台</p>
              <h2>按分组比较模型表现</h2>
              <p>本挑战使用版本化样本和确定性评分。你在左侧选择补样本方案，程序会在右侧保留室内组、逆光组和总体指标。</p>
              <dl className={styles.researchMetrics}>
                <div><dt>数据版本</dt><dd>image-classifier-research-v1</dd></div>
                <div><dt>基线</dt><dd>逆光组 4/10</dd></div>
                <div><dt>目标</dt><dd>逆光组至少 7/10</dd></div>
              </dl>
              {versionNotice ? <p className={styles.toolbarNotice} role="status">{versionNotice}</p> : null}
              {mentorNotice ? <p className={styles.mentorNotice} role="status">{mentorNotice}</p> : null}
            </div>
          </div>
          <aside className={styles.outputPanel} aria-label="研究指标与运行记录">
            <div className={styles.outputHeading}>
              <Terminal size={18} aria-hidden="true" />
              <h2>指标与运行记录</h2>
            </div>
            <p className={styles.resultMessage} aria-live="polite">{researchEvidenceSaved ? "研究挑战状态：已保存" : "等待左侧方案评估"}</p>
            <dl className={styles.runMeta}>
              <div><dt>挑战版本</dt><dd>{template.challengeVersion}</dd></div>
              <div><dt>固定指标</dt><dd>逆光组 4/10 → 7/10</dd></div>
            </dl>
            <pre aria-label="研究运行记录" aria-live="polite"><span className={styles.placeholder}>评估结果会显示在左侧记录表；完成后这里保留固定挑战版本和指标摘要。</span></pre>
          </aside>
          </>
        ) : <>
        <aside className={styles.guide} aria-label="实验任务">
          {isGuidedImageClassification ? (
            <GuidedImageClassificationFlow
              key={guidedEvidenceSaved ? guidedRunMetadata?.runId ?? "saved-guided-evidence" : "guided-draft"}
              prediction={guidedPrediction}
              hasPassedRun={guidedRunPassed}
              isRunning={isRunning}
              saved={guidedEvidenceSaved}
              saveNotice={guidedSaveNotice}
              initialObservation={guidedObservation}
              initialConclusion={guidedConclusion}
              predictionLocked={guidedRunPassed || guidedEvidenceSaved}
              onPredictionChange={setGuidedPrediction}
              onSaveObservation={saveGuidedObservation}
            />
          ) : null}
          {isIndependentImageClassification ? (
            <IndependentImageClassificationFlow
              variableId={independentVariableId}
              value={independentValue}
              runs={independentRuns}
              isRunning={isRunning}
              saved={independentEvidenceSaved}
              notice={independentSaveNotice}
              onVariableChange={changeIndependentVariable}
              onValueChange={setIndependentValue}
              onSaveConclusion={saveIndependentConclusion}
            />
          ) : null}
          {isProjectMode ? (
            <section className={styles.projectContext} aria-label="高中项目实验上下文">
              <p className={styles.panelLabel}>高中项目实验</p>
              <h2>图像模型审计</h2>
              <p>完成固定分组测试后，结果会作为项目工作台可引用的确定性证据。项目状态和报告仍由项目页面保存。</p>
              <span>挑战版本：{template.challengeVersion}</span>
            </section>
          ) : null}
          {!entryUnlocked ? (
            <p className={styles.lockedNotice} role="status">
              请先从学习路径完成前置活动，再运行本实验；直接打开链接不会写入学习证据。
            </p>
          ) : null}
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
        </aside>

        <div className={styles.codeArea}>
          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryButton} onClick={() => void runCode()} disabled={isRunning || status !== "ready" || !entryUnlocked || !code.trim() || (isGuidedImageClassification && (guidedRunPassed || guidedEvidenceSaved || !canRunGuidedImageClassification(guidedPrediction)))}>
              <Play size={17} aria-hidden="true" />
              运行代码
            </button>
            <button type="button" className={styles.stopButton} onClick={stopCode} disabled={!isRunning}>
              <CircleStop size={17} aria-hidden="true" />
              停止运行
            </button>
            <button type="button" className={styles.toolbarButton} onClick={saveVersion} disabled={isRunning}>
              <Save size={17} aria-hidden="true" />
              保存版本
            </button>
            <button type="button" className={styles.toolbarButton} onClick={askStarBao} disabled={isRunning}>
              <MessageCircle size={17} aria-hidden="true" />
              询问星宝
            </button>
            <button type="button" className={styles.iconButton} onClick={resetCode} disabled={isRunning} title="重置代码">
              <RotateCcw size={17} aria-hidden="true" />
              重置代码
            </button>
          </div>
          <MonacoPythonEditor value={code} onChange={setCode} />
          {versionNotice ? <p className={styles.toolbarNotice} role="status">{versionNotice}</p> : null}
          {mentorNotice ? <p className={styles.mentorNotice} role="status">{mentorNotice}</p> : null}
        </div>

        <aside className={styles.outputPanel} aria-label="运行输出">
          <div className={styles.outputHeading}>
            <Terminal size={18} aria-hidden="true" />
            <h2>运行输出</h2>
          </div>
          <p className={styles.resultMessage} aria-live="polite">{resultMessage}</p>
          {lastRun ? (
            <dl className={styles.runMeta} aria-label="本次运行元数据">
              <div><dt>检查结果</dt><dd>{lastRun.passed ? "通过" : "未通过"}</dd></div>
              <div><dt>运行耗时</dt><dd>{lastRun.durationMs} ms</dd></div>
              <div><dt>挑战版本</dt><dd>v{template.challengeVersion}</dd></div>
            </dl>
          ) : null}
          {evidenceMetrics ? (
            <dl className={styles.runMeta} aria-label="固定实验指标">
              {Object.entries(evidenceMetrics).slice(0, 5).map(([key, value]) => (
                <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          ) : null}
          <pre aria-label="Python 运行输出" aria-live="polite">
            {output.length === 0 ? <span className={styles.placeholder}>运行后将在这里显示 stdout 和错误。</span> : output.map((entry, index) => (
              <span key={`${entry.stream}-${index}`} className={entry.stream === "stderr" ? styles.stderr : styles.stdout}>
                {entry.text}{"\n"}
              </span>
            ))}
          </pre>
        </aside>
        </>}
      </div>

      <p className={styles.safetyNote}>
        浏览器内课程练习不是服务端正式判题沙箱；导入提示也不是安全边界。隔离页面、CSP 和运行后禁网共同保护主站数据，结果仅作低权重形成性学习证据。
      </p>
    </section>
  );
}
