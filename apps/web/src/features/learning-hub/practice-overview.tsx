"use client";

import Link from "next/link";
import { Braces, ClipboardCheck, Flame, RotateCcw, Search, Target } from "lucide-react";
import { useMemo, useState } from "react";

import type { LearningPathStage } from "@/data/learning-paths";
import { gradeIdForProfile, type LearningGradeId } from "@/data/learning-grades";
import type { LearningState } from "@/lib/domain";
import { getPracticeSet, getPracticeSetSummaries, type PracticeSetKind } from "./practice-data";
import { loadPracticeSessionProgress, practiceSessionStorageId, type PracticeSessionProgress } from "./practice-session-store";
import styles from "./practice-overview.module.css";

const ICONS: Record<PracticeSetKind, typeof Target> = {
  daily: Flame,
  course: Target,
  code: Braces,
  remediation: RotateCcw,
  assessment: ClipboardCheck,
};

type PracticeFilter = "all" | PracticeSetKind;

const FILTERS: ReadonlyArray<{ id: PracticeFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "daily", label: "每日练习" },
  { id: "course", label: "课程练习" },
  { id: "code", label: "代码挑战" },
  { id: "remediation", label: "错题补救" },
  { id: "assessment", label: "阶段评价" },
];

export function PracticeOverview({
  grade,
  stage,
  state,
}: {
  grade?: LearningGradeId;
  stage: LearningPathStage;
  state: LearningState;
}) {
  const selectedGrade = grade ?? gradeIdForProfile(stage, state.profile.grade);
  const summaries = useMemo(
    () => getPracticeSetSummaries(stage, state, new Date(), selectedGrade),
    [selectedGrade, stage, state],
  );
  const sessionProgress = useMemo(() => {
    const next: Record<string, PracticeSessionProgress> = {};
    for (const summary of summaries) {
      const set = getPracticeSet(stage, summary.id, state, new Date(), undefined, selectedGrade);
      if (!set) continue;
      const sessionId = practiceSessionStorageId(summary.id, set.questions.map((question) => question.key));
      next[summary.id] = loadPracticeSessionProgress(sessionId, new Set(set.questions.map((question) => question.key)));
    }
    return next;
  }, [selectedGrade, stage, state, summaries]);
  const [filter, setFilter] = useState<PracticeFilter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const visibleSummaries = summaries.filter((summary) => {
    if (filter !== "all" && summary.kind !== filter) return false;
    if (!normalizedQuery) return true;
    return `${summary.title} ${summary.description}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery);
  });
  return (
    <section className={styles.overview} aria-labelledby="practice-overview-title">
      <header className={styles.heading}>
        <div>
          <p>确定性练习</p>
          <h2 id="practice-overview-title">选择一组练习开始</h2>
        </div>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="练习类型筛选" role="group">
          {FILTERS.map((item) => (
            <button aria-pressed={filter === item.id} key={item.id} onClick={() => setFilter(item.id)} type="button">
              {item.label}
            </button>
          ))}
        </div>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>搜索练习</span>
          <Search aria-hidden="true" size={15} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="搜索练习" type="search" value={query} />
        </label>
      </div>
      <p className={styles.resultCount} aria-live="polite">{visibleSummaries.length} 组练习</p>
      <div className={styles.cardGrid}>
        {visibleSummaries.map((summary) => {
          const Icon = ICONS[summary.kind];
          const progress = sessionProgress[summary.id];
          const handledCount = progress?.handledQuestionKeys.length ?? 0;
          const answeredCount = Math.max(0, handledCount - (progress?.skippedQuestionKeys.length ?? 0));
          const correctCount = progress?.correctQuestionKeys.length ?? 0;
          const completed = summary.questionCount > 0 && handledCount >= summary.questionCount;
          const active = handledCount > 0 && !completed;
          const score = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null;
          const actionLabel = completed ? "复习练习" : active ? "继续练习" : "开始练习";
          return (
            <article className={styles.card} data-kind={summary.kind} data-status={completed ? "completed" : active ? "active" : "available"} key={summary.id}>
              <header className={styles.cardHeader}>
                <span className={styles.iconTile}><Icon aria-hidden="true" size={19} /></span>
                <span className={styles.cardStatus}>{completed ? "已完成" : active ? "进行中" : "未开始"}</span>
              </header>
              <h3>{summary.title}</h3>
              <p>{summary.description}</p>
              <ul aria-label={`${summary.title}题型`} className={styles.formats}>
                {summary.formats.map((format) => <li key={format}>{format}</li>)}
              </ul>
              <div className={styles.cardProgress} aria-label={`${summary.title}答题进度`}>
                <span><strong>{handledCount}</strong>/{summary.questionCount} 题</span>
                <span>{score === null ? "尚无得分" : `最近得分 ${score}%`}</span>
                <i aria-hidden="true"><b style={{ width: `${summary.questionCount === 0 ? 0 : Math.min(100, (handledCount / summary.questionCount) * 100)}%` }} /></i>
              </div>
              <div className={styles.cardFooter}>
                <span>{summary.questionCount} 题 · 约 {summary.estimatedMinutes} 分钟</span>
                {summary.disabled ? (
                  <span className={styles.unavailable}>暂不可用</span>
                ) : (
                  <Link
                    aria-label={`${summary.title}：${actionLabel}`}
                    href={`/learn/practice/${summary.id}?stage=${stage}&grade=${selectedGrade}`}
                  >
                    {actionLabel}
                  </Link>
                )}
              </div>
              {summary.kind === "remediation" && !summary.disabled ? (
                <Link className={styles.reviewLink} href={`/learn/practice/${summary.id}?stage=${stage}&grade=${selectedGrade}`}>查看错题复习</Link>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
