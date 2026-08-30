"use client";

import Link from "next/link";
import { BarChart3, Code2, FileText, LockKeyhole, Microscope } from "lucide-react";
import { useEffect, useState } from "react";

import { getStageActivityStatuses, recommendNextActivity } from "@/features/progress/recommendation";
import { getMiddleSchoolCompletionRequirements, hasCompletedMiddleSchool } from "@/features/progress/middle-school-completion";
import { createDefaultLearningState, loadLearningState } from "@/lib/learning-store";
import type { LearningState } from "@/lib/domain";
import styles from "./high-research-station.module.css";

export function HighResearchStation() {
  const [state, setState] = useState<LearningState>(() => createDefaultLearningState());
  useEffect(() => { queueMicrotask(() => setState(loadLearningState())); }, []);
  const unlocked = hasCompletedMiddleSchool(state);
  const missing = getMiddleSchoolCompletionRequirements(state).filter((item) => !item.met);
  const next = unlocked ? recommendNextActivity(state, "high_school") : null;
  const activities = unlocked ? getStageActivityStatuses(state, "high_school") : [];

  if (!unlocked) return <section className={styles.locked} aria-labelledby="high-station-title">
    <header><LockKeyhole aria-hidden="true" /><div><p>高中 AI 研究站</p><h1 id="high-station-title">研究站尚未解锁</h1></div></header>
    <p>先完成初中阶段的可核对学习证据，高中项目才会开放。</p>
    <ul>{missing.map((item) => <li key={item.id}><span>{item.label}</span><Link href={item.remediationHref}>前往补救</Link></li>)}</ul>
  </section>;

  return <section className={styles.station} aria-labelledby="high-station-title">
    <header className={styles.header}><div><p>高中 AI 研究站</p><h1 id="high-station-title">研究路径与实验工作台</h1><span>所有指标、测试和进度均来自本机保存的确定性学习证据。</span></div><Link href="/progress?stage=high_school">查看阶段进度</Link></header>
    <div className={styles.workspace}>
      <nav aria-label="高中研究路径" className={styles.path}><h2>研究路径</h2><ol>{activities.map((item, index) => <li key={item.activity.id} data-status={item.status}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.activity.title}</strong><small>{item.status === "completed" ? "已完成" : item.status === "locked" ? "等待前置证据" : "可继续"}</small></div></li>)}</ol></nav>
      <main className={styles.focus}><p>当前任务</p><h2>{next?.activity.title ?? "研究路径已完成"}</h2><span>{next?.reason ?? "可开始整理项目证据与报告。"}</span>{next ? <Link href={next.activity.route}><Code2 size={16} aria-hidden="true" />进入代码或课程</Link> : null}<div className={styles.terminal}><span>实验记录</span><code>{state.stageProgressByStage.high_school.experimentEvidence.length} 条结构化运行证据已保存</code></div></main>
      <aside className={styles.metrics} aria-label="研究指标与项目入口"><h2><BarChart3 size={17} />指标与项目</h2><dl><div><dt>完成任务</dt><dd>{activities.filter((item) => item.status === "completed").length}/{activities.length}</dd></div><div><dt>实验记录</dt><dd>{state.stageProgressByStage.high_school.experimentEvidence.length}</dd></div></dl><Link href="/high/project/capstone"><FileText size={16} aria-hidden="true" />项目工作区</Link><p><Microscope size={15} aria-hidden="true" />先用实验数据和测试结果形成报告，再进入答辩。</p></aside>
    </div>
  </section>;
}
