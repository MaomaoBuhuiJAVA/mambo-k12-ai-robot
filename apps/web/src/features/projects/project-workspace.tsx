"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  FlaskConical,
  LockKeyhole,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { LearningState } from "@/lib/domain";
import { LEARNING_STATE_CHANGED_EVENT } from "@/lib/learning-events";
import { createDefaultLearningState, loadLearningState } from "@/lib/learning-store";
import {
  PROJECT_STEPS,
  createProject,
  getProjectStep,
  getProjectDefinition,
  type ProjectId,
  type ProjectField,
  type ProjectRecord,
  type ProjectStepId,
} from "./project-schema";
import { loadProject, saveProject } from "./project-store";
import { defenseQuestions, evaluateProject, evaluateProjectStep } from "./project-evaluator";
import { collectProjectEvidence, importAllProjectEvidence, syncProjectEvidence, type ProjectEvidenceView } from "./project-evidence";
import { formatProjectReport } from "./project-report";
import styles from "./project-workspace.module.css";

const labels: Record<ProjectField, string> = {
  researchQuestion: "研究问题",
  dataSource: "数据来源",
  authorization: "授权说明",
  processingSteps: "数据处理步骤",
  modelVersion: "模型或算法版本",
  metrics: "实验运行与指标",
  failureCases: "失败案例",
  conclusion: "结论",
  limitations: "限制与下一步",
};

const hints: Record<ProjectField, string> = {
  researchQuestion: "例：固定样本中，哪种输入条件会让分类器更容易出错？",
  dataSource: "写明使用的固定数据集、实验模板或样本编号。",
  authorization: "说明数据是否为课程固定样本，以及允许的使用范围。",
  processingSteps: "按顺序记录清洗、切分、特征处理或分组方式。",
  modelVersion: "写出算法名称、模板版本或本次实验使用的规则。",
  metrics: "引用程序产生的数值，不要只写“效果很好”。",
  failureCases: "保留错误分组、失败样本、未知引用或无法核对的输出。",
  conclusion: "只根据已经保存的指标和失败案例回答研究问题。",
  limitations: "说明样本范围、不能推出的结论和下一步要补的证据。",
};

function nextStepId(stepId: ProjectStepId): ProjectStepId | null {
  const index = PROJECT_STEPS.findIndex((step) => step.id === stepId);
  return PROJECT_STEPS[index + 1]?.id ?? null;
}

function previousStepId(stepId: ProjectStepId): ProjectStepId | null {
  const index = PROJECT_STEPS.findIndex((step) => step.id === stepId);
  return PROJECT_STEPS[index - 1]?.id ?? null;
}

function stepStatus(
  project: ProjectRecord,
  stepId: ProjectStepId,
  availableEvidenceIds: ReadonlySet<string>,
): "completed" | "current" | "available" | "locked" {
  if (evaluateProjectStep(project, stepId, availableEvidenceIds).passed) return "completed";
  if (project.currentStep === stepId) return "current";
  const index = PROJECT_STEPS.findIndex((step) => step.id === stepId);
  const currentIndex = PROJECT_STEPS.findIndex((step) => step.id === project.currentStep);
  return index <= currentIndex + 1 ? "available" : "locked";
}

function formatEvidenceCount(project: ProjectRecord, evidence: readonly ProjectEvidenceView[]): string {
  const attached = evidence.filter((item) => project.evidenceRefs.includes(item.evidence.runId)).length;
  return `${attached} / ${evidence.length} 条实验记录已引用`;
}

export function ProjectWorkspace({ projectId }: { projectId: ProjectId }) {
  // Start from the deterministic server-safe draft, then restore local storage
  // after mount so saved progress cannot cause an SSR hydration mismatch.
  const [project, setProject] = useState<ProjectRecord>(() => createProject(projectId));
  const [learningState, setLearningState] = useState<LearningState>(() => createDefaultLearningState());
  const [notice, setNotice] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const projectRef = useRef(project);
  const hydratedRef = useRef(false);
  const definition = getProjectDefinition(projectId)!;

  const evidence = useMemo(() => collectProjectEvidence(learningState), [learningState]);
  const availableEvidenceIds = useMemo(
    () => new Set(evidence.map((item) => item.evidence.runId)),
    [evidence],
  );
  const currentStep = getProjectStep(project.currentStep);
  const evaluation = evaluateProject(project, availableEvidenceIds);
  const currentEvaluation = evaluateProjectStep(project, project.currentStep, availableEvidenceIds);
  const currentIndex = PROJECT_STEPS.findIndex((step) => step.id === project.currentStep);
  const selectedEvidence = useMemo(
    () => evidence
      .filter((item) => project.evidenceRefs.includes(item.evidence.runId))
      .map((item) => item.evidence),
    [evidence, project.evidenceRefs],
  );
  const report = useMemo(
    () => formatProjectReport(project, evaluation, selectedEvidence),
    [evaluation, project, selectedEvidence],
  );

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      const next = projectRef.current;
      if (!saveProject(next)) {
        setNotice("自动保存失败，请检查浏览器存储权限后重试。");
        return;
      }
      setSavedAt(new Date().toISOString());
    }, 600);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    const refresh = () => {
      const state = loadLearningState();
      const stored = loadProject(projectId) ?? createProject(projectId);
      setLearningState(state);
      const synced = syncProjectEvidence(stored, collectProjectEvidence(state));
      projectRef.current = synced;
      setProject(synced);
      if (stored.evidenceRefs.join("\u0000") !== synced.evidenceRefs.join("\u0000")) saveProject(synced);
      hydratedRef.current = true;
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [projectId]);

  useEffect(() => {
    const flush = () => {
      if (hydratedRef.current) saveProject(projectRef.current);
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [projectId]);

  function updateProject(patch: Partial<ProjectRecord>) {
    setProject((current) => {
      const next = { ...current, ...patch };
      projectRef.current = next;
      return next;
    });
    setNotice(null);
  }

  function persist(next: ProjectRecord = project, message = "项目草稿已保存到本机。") {
    if (!saveProject(next)) {
      setNotice("项目未能保存，请检查浏览器存储权限后重试。");
      return false;
    }
    projectRef.current = next;
    setProject(next);
    setSavedAt(new Date().toISOString());
    setNotice(message);
    return true;
  }

  function selectStep(stepId: ProjectStepId) {
    if (stepStatus(project, stepId, availableEvidenceIds) === "locked") {
      setNotice("请先完成前面的项目步骤。");
      return;
    }
    updateProject({ currentStep: stepId });
  }

  function continueStep() {
    if (!currentEvaluation.passed) {
      setNotice(`当前步骤还缺少：${currentEvaluation.missing.join("；")}`);
      return;
    }
    const next = nextStepId(project.currentStep);
    if (!next) {
      persist(project, "项目已完成确定性检查，可以导出报告或开始答辩。");
      return;
    }
    const nextProject = { ...project, currentStep: next };
    persist(nextProject, `已完成“${currentStep.title}”，进入下一步。`);
  }

  function attachEvidence(runId: string) {
    const refs = project.evidenceRefs.includes(runId)
      ? project.evidenceRefs.filter((ref) => ref !== runId)
      : [...project.evidenceRefs, runId].slice(-60);
    updateProject({ evidenceRefs: refs });
  }

  function importAllEvidence() {
    const synced = importAllProjectEvidence(project, evidence);
    updateProject(synced);
    setNotice(evidence.length > 0 ? "已引用全部高中实验记录，并填入可复核指标。" : "当前还没有可引用的高中实验记录。");
  }

  function downloadReport() {
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.id}-report.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("项目报告已生成下载。");
  }

  return (
    <section className={styles.workspace} aria-labelledby="project-workspace-title">
      <header className={styles.intro}>
        <div>
          <p>{definition.eyebrow} · {project.id}</p>
          <h2 id="project-workspace-title">{definition.title}</h2>
          <span>{definition.summary} 一次完成一个步骤，项目会自动恢复上次位置和已引用的实验记录。</span>
        </div>
        <div className={styles.introActions}>
          <Link href="/learn?stage=high_school&view=path"><ArrowLeft aria-hidden="true" size={15} />返回学习路径</Link>
          <span>{savedAt ? `最近保存 ${new Date(savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "本机草稿"}</span>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.stepRail} aria-label="项目步骤">
          <div className={styles.railHeading}><FileText aria-hidden="true" size={18} /><div><strong>项目步骤</strong><span>{currentIndex + 1} / {PROJECT_STEPS.length}</span></div></div>
          <ol>
            {PROJECT_STEPS.map((step, index) => {
              const status = stepStatus(project, step.id, availableEvidenceIds);
              return <li data-status={status} key={step.id}><button aria-current={status === "current" ? "step" : undefined} disabled={status === "locked"} onClick={() => selectStep(step.id)} type="button"><span className={styles.stepNumber}>{status === "completed" ? <Check aria-hidden="true" size={14} /> : String(index + 1).padStart(2, "0")}</span><span><strong>{step.title}</strong><small>{status === "completed" ? "已完成" : status === "locked" ? "等待前置步骤" : step.summary}</small></span></button></li>;
            })}
          </ol>
          <div className={styles.railFooter}><ShieldCheck aria-hidden="true" size={16} /><span>评价、解锁和指标由程序确定</span></div>
        </aside>

        <main className={styles.main}>
          <header className={styles.stepHeader}>
            <div><p>步骤 {String(currentIndex + 1).padStart(2, "0")}</p><h3>{currentStep.title}</h3><span>{currentStep.summary}</span></div>
            <div className={currentEvaluation.passed ? styles.stepPassed : styles.stepPending} role="status">{currentEvaluation.passed ? <CheckCircle2 aria-hidden="true" size={16} /> : <LockKeyhole aria-hidden="true" size={15} />}{currentEvaluation.passed ? "本步骤已满足要求" : `${currentEvaluation.missing.length} 项待补充`}</div>
          </header>

          {currentStep.fields.map((field) => <FieldEditor field={field} key={field} project={project} updateProject={updateProject} />)}
          {project.currentStep === "experiment" ? <EvidencePanel evidence={evidence} project={project} attachEvidence={attachEvidence} importAllEvidence={importAllEvidence} /> : null}
          {project.currentStep === "audit" ? <ModelCardPreview project={project} evidence={evidence} /> : null}
          {project.currentStep === "report" ? <ReportPreview report={report} /> : null}
          {project.currentStep === "defense" ? <DefensePanel project={project} updateProject={updateProject} /> : null}

          <footer className={styles.actions}>
            <button className={styles.secondaryButton} disabled={!previousStepId(project.currentStep)} onClick={() => updateProject({ currentStep: previousStepId(project.currentStep) ?? project.currentStep })} type="button"><ArrowLeft aria-hidden="true" size={15} />上一步</button>
            <span>{formatEvidenceCount(project, evidence)}</span>
            <button className={styles.secondaryButton} onClick={() => persist()} type="button"><Save aria-hidden="true" size={15} />保存草稿</button>
            {project.currentStep === "report" ? <button className={styles.secondaryButton} onClick={downloadReport} type="button"><Download aria-hidden="true" size={15} />导出报告</button> : null}
            <button className={styles.primaryButton} onClick={continueStep} type="button">{project.currentStep === "defense" ? "完成项目检查" : "保存并继续"}<ArrowRight aria-hidden="true" size={15} /></button>
          </footer>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </main>

        <aside className={styles.evidenceRail} aria-label="项目确定性检查">
          <section><header><FlaskConical aria-hidden="true" size={17} /><div><p>实验证据</p><h4>{evidence.length} 条可用记录</h4></div></header><span>进入实验并通过固定测试后，记录会自动出现在这里。</span>{evidence.length > 0 ? <ul>{evidence.slice(-4).reverse().map((item) => <li key={item.evidence.runId}><strong>{item.evidence.templateId}</strong><small>{item.metricText}</small></li>)}</ul> : null}</section>
          <section><header><FileCheck2 aria-hidden="true" size={17} /><div><p>确定性评价</p><h4>{evaluation.passed ? "材料完整" : "仍需补充"}</h4></div></header>{evaluation.passed ? <span>指标、失败案例、限制和实验引用都已满足。</span> : <ul className={styles.missingList}>{evaluation.missing.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>}</section>
          <section className={styles.quickLinks}><header><FileText aria-hidden="true" size={17} /><div><p>相关入口</p><h4>继续学习</h4></div></header><Link href="/lab?stage=high_school&template=model-audit&mode=project">打开模型审计实验</Link><Link href="/learn?stage=high_school&view=profile">查看个人画像</Link></section>
        </aside>
      </div>
    </section>
  );
}

function FieldEditor({ field, project, updateProject }: { field: ProjectField; project: ProjectRecord; updateProject: (patch: Partial<ProjectRecord>) => void }) {
  return <label className={styles.field}><span>{labels[field]}</span><small>{hints[field]}</small><textarea aria-label={labels[field]} maxLength={1600} onChange={(event) => updateProject({ [field]: event.target.value })} placeholder={hints[field]} value={project[field]} /></label>;
}

function EvidencePanel({ evidence, project, attachEvidence, importAllEvidence }: { evidence: readonly ProjectEvidenceView[]; project: ProjectRecord; attachEvidence: (runId: string) => void; importAllEvidence: () => void }) {
  return <section className={styles.evidencePanel} aria-labelledby="evidence-panel-title"><header><div><p>可引用证据</p><h4 id="evidence-panel-title">选择已经完成的实验</h4></div><button className={styles.inlineButton} onClick={importAllEvidence} type="button"><FlaskConical aria-hidden="true" size={14} />自动引用全部</button></header>{evidence.length === 0 ? <p className={styles.empty}>还没有高中实验记录。先完成一个 Python 实验并通过固定测试。</p> : <ul>{evidence.map((item) => { const attached = project.evidenceRefs.includes(item.evidence.runId); return <li data-attached={attached} key={item.evidence.runId}><button aria-pressed={attached} className={styles.evidenceToggle} onClick={() => attachEvidence(item.evidence.runId)} type="button"><span>{attached ? <Check aria-hidden="true" size={14} /> : ""}</span><strong>{item.evidence.templateId}</strong><small>{item.metricText}</small></button><p>{item.failureText}</p></li>; })}</ul>}</section>;
}

function ModelCardPreview({ project, evidence }: { project: ProjectRecord; evidence: readonly ProjectEvidenceView[] }) {
  return <section className={styles.preview} aria-labelledby="model-card-title"><header><div><p>模型卡草稿</p><h4 id="model-card-title">部署前先说明边界</h4></div><span>{evidence.length} 条实验引用</span></header><dl><div><dt>预期用途</dt><dd>{project.researchQuestion || "尚未填写研究问题"}</dd></div><div><dt>数据与授权</dt><dd>{project.dataSource || "尚未填写数据来源"}<br />{project.authorization || "尚未填写授权说明"}</dd></div><div><dt>处理与模型</dt><dd>{project.processingSteps || "尚未填写处理步骤"}<br />{project.modelVersion || "尚未填写模型版本"}</dd></div><div><dt>指标</dt><dd>{project.metrics || "尚未引用实验指标"}</dd></div><div><dt>失败与限制</dt><dd>{project.failureCases || "尚未记录失败案例"}<br />{project.limitations || "尚未填写限制"}</dd></div></dl></section>;
}

function ReportPreview({ report }: { report: string }) {
  return <section className={styles.preview} aria-labelledby="report-preview-title"><header><div><p>导出前预览</p><h4 id="report-preview-title">项目报告</h4></div><span>Markdown</span></header><pre className={styles.report}><code>{report}</code></pre></section>;
}

function DefensePanel({ project, updateProject }: { project: ProjectRecord; updateProject: (patch: Partial<ProjectRecord>) => void }) {
  const questions = defenseQuestions(project);
  return <section className={styles.defense} aria-labelledby="defense-title"><header><div><p>星宝答辩</p><h4 id="defense-title">用证据回答四个问题</h4></div><span>至少完成 3 题</span></header><ol>{questions.map((question, index) => <li key={question}><strong>{question}</strong><textarea aria-label={`答辩回答 ${index + 1}`} maxLength={1600} onChange={(event) => { const answers = [...project.defenseAnswers]; answers[index] = event.target.value; updateProject({ defenseAnswers: answers }); }} placeholder="引用一个实验指标、失败案例或限制来回答" value={project.defenseAnswers[index] ?? ""} /></li>)}</ol></section>;
}
