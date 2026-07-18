"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, CalendarClock, ClipboardList } from "lucide-react";

import type { Attempt, LearningState, MasteryRecord } from "@/lib/domain";
import { createDefaultLearningState, loadLearningState, saveLearningState } from "@/lib/learning-store";
import { announceLearningStateChanged, LEARNING_STATE_CHANGED_EVENT } from "@/lib/learning-events";
import { readSavedStorybooks, type SavedStorybook } from "@/features/storybook/storybook-storage";
import { recommendNextCourse } from "./recommendation";
import { INTEREST_OPTIONS } from "./interest-options";
import styles from "./progress-dashboard.module.css";

const STAGE_LABELS = {
  lower_primary: "小学低年级",
  upper_primary: "小学高年级",
  middle_school: "初中",
  high_school: "高中",
} as const;

export function ProgressDashboard({ now }: { now?: Date }) {
  const [state, setState] = useState<LearningState>(() => createDefaultLearningState());
  const [savedWorks, setSavedWorks] = useState<SavedStorybook[]>([]);
  const [interestNotice, setInterestNotice] = useState<string | null>(null);
  const [nowMs] = useState(() => now?.getTime() ?? Date.now());

  useEffect(() => {
    const refresh = () => {
      setState(loadLearningState());
      setSavedWorks(readSavedStorybooks(window.localStorage));
    };
    refresh();
    window.addEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const masteryRecords = Object.values(state.masteryByKnowledgePoint)
    .sort((left, right) => (right.lastPracticedAt ?? "").localeCompare(left.lastPracticedAt ?? ""));
  const dueRecords = masteryRecords.filter((record) =>
    record.nextReviewAt !== null && Date.parse(record.nextReviewAt) <= nowMs,
  );
  const recommendation = recommendNextCourse(state, new Date(nowMs));
  const recentAttempts = [...state.attempts]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((attempt, index, attempts) =>
      attempts.findIndex((candidate) => submissionAttemptId(candidate) === submissionAttemptId(attempt)) === index,
    )
    .slice(0, 8);
  const submissionCount = new Set(state.attempts.map(submissionAttemptId)).size;

  function toggleInterest(interestId: string, selected: boolean) {
    const current = loadLearningState();
    const interests = selected
      ? [...new Set([...current.interests, interestId])]
      : current.interests.filter((interest) => interest !== interestId);
    const next = { ...current, interests, updatedAt: new Date().toISOString() };
    if (!saveLearningState(next)) {
      setInterestNotice("兴趣偏好未能保存，请检查浏览器存储权限后重试。");
      return;
    }
    setState(loadLearningState());
    setInterestNotice("兴趣偏好已保存。");
    announceLearningStateChanged();
  }

  return (
    <section className={styles.dashboard} aria-labelledby="progress-title">
      <header className={styles.header}>
        <div>
          <span>{STAGE_LABELS[state.profile.stage]}</span>
          <h1 id="progress-title">学习进度</h1>
          <p>这里只展示本机实际保存的练习证据，不根据使用时长推测能力。</p>
        </div>
        <Link href="/" className={styles.backLink}>返回学习工作台</Link>
      </header>

      <div className={styles.summaryBand}>
        <SummaryItem icon={BookOpenCheck} value={`${masteryRecords.length}`} label="已练知识点" />
        <SummaryItem icon={CalendarClock} value={`${dueRecords.length}`} label="到期复习" />
        <SummaryItem icon={ClipboardList} value={`${submissionCount}`} label="已记录作答" />
      </div>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.section} aria-labelledby="mastery-title">
            <div className={styles.sectionHeading}>
              <div><span>掌握情况</span><h2 id="mastery-title">知识点证据</h2></div>
              <p>{dueRecords.length} 个知识点待复习</p>
            </div>
            {masteryRecords.length === 0 ? (
              <EmptyState title="还没有练习记录" detail="完成课程练习后，这里会显示对应知识点的当前掌握值。" />
            ) : (
              <ul className={styles.masteryList}>
                {masteryRecords.map((record) => <MasteryRow key={record.knowledgePointId} record={record} nowMs={nowMs} />)}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="attempts-title">
            <div className={styles.sectionHeading}><div><span>最近学习</span><h2 id="attempts-title">练习记录</h2></div></div>
            {recentAttempts.length === 0 ? (
              <EmptyState title="暂无最近作答" detail="提交练习或完成编程实验后会在这里形成记录。" />
            ) : (
              <ul className={styles.attemptList}>
                {recentAttempts.map((attempt) => (
                  <li key={attempt.attemptId}>
                    <div><strong>{knowledgeLabel(attempt.knowledgePointId)}</strong><span>{attempt.mode === "code" ? "编程实验" : "课程练习"}</span></div>
                    <span data-passed={attemptPassed(attempt) || undefined}>{attemptStatus(attempt)} · {formatDate(attempt.completedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className={styles.sideColumn} id="works" aria-label="下一步学习">
          <fieldset className={styles.interests}>
            <legend>兴趣偏好</legend>
            <p>只在课程学习优先级相同时用于排序。</p>
            <div>
              {INTEREST_OPTIONS.map((interest) => (
                <label key={interest.id}>
                  <input
                    type="checkbox"
                    checked={state.interests.includes(interest.id)}
                    onChange={(event) => toggleInterest(interest.id, event.target.checked)}
                  />
                  <span>{interest.label}</span>
                </label>
              ))}
            </div>
            {interestNotice ? <p role="status">{interestNotice}</p> : null}
          </fieldset>
          <section className={styles.recommendation}>
            <span>推荐下一课</span>
            <h2>{recommendation.course.title}</h2>
            <p>{recommendation.reason}</p>
            <Link href={`/?course=${encodeURIComponent(recommendation.course.id)}#workspace`}>
              去学习推荐课程 <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
          <section className={styles.works}>
            <span>最近作品</span>
            <h2>作品记录</h2>
            {savedWorks.length === 0 ? <p className={styles.emptyWork}>还没有保存的作品</p> : (
              <ul className={styles.workList}>
                {savedWorks.slice(0, 5).map((work) => (
                  <li key={work.id}>
                    <Link href={`/?course=${encodeURIComponent(work.courseId)}&tab=storybook&work=${encodeURIComponent(work.id)}#teaching-canvas`}>
                      <strong>{work.storybook.title}</strong>
                      <span>保存于 {formatDate(work.savedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function SummaryItem({ icon: Icon, value, label }: { icon: typeof BookOpenCheck; value: string; label: string }) {
  return <div className={styles.summaryItem}><Icon size={20} aria-hidden="true" /><div><strong>{value}</strong><span>{label}</span></div></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className={styles.emptyState}><strong>{title}</strong><p>{detail}</p></div>;
}

function MasteryRow({ record, nowMs }: { record: MasteryRecord; nowMs: number }) {
  const percent = Math.round(record.mastery * 100);
  const due = record.nextReviewAt !== null && Date.parse(record.nextReviewAt) <= nowMs;
  return (
    <li>
      <div className={styles.masteryTitle}><strong>{knowledgeLabel(record.knowledgePointId)}</strong><span>{percent}%</span></div>
      <div className={styles.masteryBar} role="progressbar" aria-label={`${knowledgeLabel(record.knowledgePointId)}掌握度 ${percent}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
      <p>{record.evidenceCount} 条证据 · 置信度 {Math.round(record.confidence * 100)}% · {due ? "已到复习时间" : record.nextReviewAt ? `${formatDate(record.nextReviewAt)}复习` : "等待更多证据"}</p>
    </li>
  );
}

function knowledgeLabel(id: string): string {
  const separator = id.indexOf(":");
  return separator >= 0 ? id.slice(separator + 1) : id;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value));
}

function attemptPassed(attempt: Attempt): boolean {
  return attempt.mode === "code" ? attempt.score >= 0.6 : attempt.score === 1;
}

function attemptStatus(attempt: Attempt): string {
  if (attempt.mode === "code") return attemptPassed(attempt) ? "形成性完成" : "继续改进";
  return attempt.score === 1 ? "通过" : "未通过";
}

function submissionAttemptId(attempt: Attempt): string {
  return attempt.mode === "quiz" ? attempt.attemptId.replace(/~e\d+$/, "") : attempt.attemptId;
}
