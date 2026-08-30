"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ListChecks,
  Share2,
  Sparkles,
} from "lucide-react";

import type { StructuredCourse } from "@/data/course-structure";
import type { LearningGradeId } from "@/data/learning-grades";
import { getActivity, isActivityUnlocked, type LearningActivity } from "@/data/learning-paths";
import type { LearningState } from "@/lib/domain";
import { LEARNING_STATE_CHANGED_EVENT } from "@/lib/learning-events";
import { createDefaultLearningState, loadLearningState } from "@/lib/learning-store";
import { ResourceLibrary } from "@/features/courses/resource-library";
import { getLearningActivityKindLabel } from "./learning-hub-data";
import styles from "./course-detail.module.css";

type ActivityStatus = "completed" | "available" | "locked";

function activityStatus(state: LearningState, activity: LearningActivity): ActivityStatus {
  const completed = state.stageProgressByStage[activity.stage].completedActivityIds;
  if (completed.includes(activity.id)) return "completed";
  return isActivityUnlocked(activity.id, completed) ? "available" : "locked";
}

function getFirstOpenActivity(course: StructuredCourse, state: LearningState): {
  activity: LearningActivity;
  lessonId: string;
} | null {
  for (const unit of course.units) {
    for (const lesson of unit.lessons) {
      for (const activityId of lesson.activityIds) {
        const activity = getActivity(activityId);
        if (activity && activityStatus(state, activity) === "available") {
          return { activity, lessonId: lesson.id };
        }
      }
    }
  }
  return null;
}

type CourseUnit = StructuredCourse["units"][number];

type UnitSnapshot = {
  activityCount: number;
  completedCount: number;
  percent: number;
  status: "completed" | "in_progress" | "available" | "locked";
};

function getFirstActivityInUnit(unit: CourseUnit): {
  activity: LearningActivity;
  lessonId: string;
} | null {
  for (const lesson of unit.lessons) {
    const activity = lesson.activityIds.map((activityId) => getActivity(activityId)).find(
      (candidate): candidate is LearningActivity => candidate !== undefined,
    );
    if (activity) return { activity, lessonId: lesson.id };
  }
  return null;
}

function getFirstOpenActivityInUnit(unit: CourseUnit, state: LearningState): {
  activity: LearningActivity;
  lessonId: string;
} | null {
  for (const lesson of unit.lessons) {
    for (const activityId of lesson.activityIds) {
      const activity = getActivity(activityId);
      if (activity && activityStatus(state, activity) === "available") {
        return { activity, lessonId: lesson.id };
      }
    }
  }
  return null;
}

function getUnitSnapshot(unit: CourseUnit, state: LearningState): UnitSnapshot {
  const activities = unit.lessons
    .flatMap((lesson) => lesson.activityIds)
    .map((activityId) => getActivity(activityId))
    .filter((activity): activity is LearningActivity => activity !== undefined);
  const completedCount = activities.filter((activity) => activityStatus(state, activity) === "completed").length;
  const activityCount = activities.length;
  const hasAvailable = activities.some((activity) => activityStatus(state, activity) === "available");
  const status = completedCount === activityCount && activityCount > 0
    ? "completed"
    : completedCount > 0
      ? "in_progress"
      : hasAvailable
        ? "available"
        : "locked";

  return {
    activityCount,
    completedCount,
    percent: activityCount === 0 ? 0 : Math.round((completedCount / activityCount) * 100),
    status,
  };
}

function getUnitStatusLabel(status: UnitSnapshot["status"]): string {
  return status === "completed"
    ? "已完成"
    : status === "in_progress"
      ? "进行中"
      : status === "available"
        ? "可开始"
        : "已锁定";
}

function lessonHref(lessonId: string, activityId: string, stage?: StructuredCourse["stage"], grade?: LearningGradeId): string {
  const query = new URLSearchParams();
  if (grade) {
    if (stage) query.set("stage", stage);
    query.set("grade", grade);
  }
  query.set("activity", activityId);
  return `/learn/lesson/${lessonId}?${query.toString()}`;
}

export function activityHref(
  lessonId: string,
  activity: LearningActivity,
  stage?: StructuredCourse["stage"],
  grade?: LearningGradeId,
): string {
  return activity.kind === "project" || activity.kind === "defense"
    ? activity.route
    : lessonHref(lessonId, activity.id, stage, grade);
}

export function CourseDetail({ course, grade, embedded = false }: { course: StructuredCourse; grade?: LearningGradeId; embedded?: boolean }) {
  const [state, setState] = useState<LearningState>(() => createDefaultLearningState());
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const refresh = () => setState(loadLearningState());
    refresh();
    window.addEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const activityCount = useMemo(
    () => course.units.flatMap((unit) => unit.lessons).reduce(
      (count, lesson) => count + lesson.activityIds.length,
      0,
    ),
    [course.units],
  );
  const completedIds = state.stageProgressByStage[course.stage].completedActivityIds;
  const completedCount = course.units
    .flatMap((unit) => unit.lessons)
    .flatMap((lesson) => lesson.activityIds)
    .filter((id) => completedIds.includes(id)).length;
  const lessons = course.units.flatMap((unit) => unit.lessons);
  const lessonCount = lessons.length;
  const totalMinutes = lessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0);
  const labCount = lessons
    .flatMap((lesson) => lesson.activityIds)
    .map((activityId) => getActivity(activityId))
    .filter((activity) => activity?.labTemplateId !== undefined).length;
  const assessmentCount = lessons
    .flatMap((lesson) => lesson.activityIds)
    .map((activityId) => getActivity(activityId))
    .filter((activity) => activity?.kind === "assessment").length;
  const checkpoint = lessons
    .flatMap((lesson) => lesson.activityIds.map((activityId) => ({
      lesson,
      activity: getActivity(activityId),
    })))
    .find((item): item is { lesson: (typeof lessons)[number]; activity: LearningActivity } =>
      item.activity?.kind === "assessment");
  const checkpointStatus = checkpoint ? activityStatus(state, checkpoint.activity) : null;
  const percent = activityCount === 0 ? 0 : Math.round((completedCount / activityCount) * 100);
  const next = getFirstOpenActivity(course, state);
  const expandedUnitIndex = course.units.findIndex((unit) => {
    const status = getUnitSnapshot(unit, state).status;
    return status === "in_progress" || status === "available";
  });
  const defaultExpandedUnitIndex = expandedUnitIndex >= 0 ? expandedUnitIndex : 0;
  const nextHref = next ? activityHref(next.lessonId, next.activity, course.stage, grade) : null;

  return (
    <main className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
      {!embedded ? (
        <header className={styles.topBar}>
          <Link href={`/learn?stage=${course.stage}${grade ? `&grade=${grade}` : ""}&view=courses`}>返回课程目录</Link>
          <span>{course.stage === "middle_school" ? "初中" : "高中"} AI 学习中心</span>
        </header>
      ) : null}

      <section className={styles.hero} aria-labelledby="course-detail-title">
        <div>
          <p>课程详情</p>
          <h1 id="course-detail-title">{course.course.title}</h1>
          <p className={styles.summary}>{course.course.summary}</p>
          <ul className={styles.tags} aria-label="课程知识点">
            {course.course.knowledgePointTags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
          <dl className={styles.heroMetrics} aria-label="课程指标">
            <div><dt>课节</dt><dd>{lessonCount}</dd></div>
            <div><dt>任务</dt><dd>{activityCount}</dd></div>
            <div><dt>实验</dt><dd>{labCount}</dd></div>
            <div><dt>评价</dt><dd>{assessmentCount}</dd></div>
            <div><dt>预计时长</dt><dd>{totalMinutes} 分钟</dd></div>
          </dl>
        </div>
        <div className={styles.progressCard}>
          <span>课程进度</span>
          <strong>{completedCount} / {activityCount}</strong>
          <div
            aria-label={`课程完成度 ${percent}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className={styles.progressTrack}
            role="progressbar"
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          {next ? (
            <div className={styles.progressActions}>
              <Link className={styles.primaryAction} href={activityHref(next.lessonId, next.activity, course.stage, grade)}>
                {completedCount === 0 ? "开始课程" : "继续课程"}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              {next.activity.kind !== "project" && next.activity.kind !== "defense" ? (
                <Link
                  aria-label="开启 AI 导师学习"
                  className={styles.tutorAction}
                  href={`/learn/tutor/${encodeURIComponent(next.lessonId)}${grade ? `?stage=${course.stage}&grade=${grade}` : ""}`}
                >
                  开启 AI 导师
                </Link>
              ) : null}
            </div>
          ) : completedCount === activityCount ? (
            <span className={styles.completedCourse}><CheckCircle2 aria-hidden="true" size={16} />课程已完成</span>
          ) : <span className={styles.lockedCourse}><LockKeyhole aria-hidden="true" size={16} />完成前置课程后解锁</span>}
        </div>
      </section>

      {next && nextHref ? (
        <div className={styles.stickyContinue} aria-label="课程固定操作">
          <div>
            <span>下一步</span>
            <strong>{next.activity.title}</strong>
          </div>
          <span className={styles.stickyProgress}>{completedCount} / {activityCount} 项活动</span>
          <Link
            aria-label={`固定操作：${completedCount === 0 ? "开始课程" : "继续课程"}`}
            className={styles.stickyContinueAction}
            href={nextHref}
          >
            {completedCount === 0 ? "开始课程" : "继续课程"}
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
      ) : null}

      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <section className={styles.courseFacts} aria-label="课程目标与学习证据">
            <div>
              <BookOpenCheck aria-hidden="true" size={18} />
              <span>课程目标</span>
              <p>{course.course.objectives[0]}</p>
            </div>
            <div>
              <Clock3 aria-hidden="true" size={18} />
              <span>学习安排</span>
              <p>{course.units.flatMap((unit) => unit.lessons).length} 节课，按完成条件依次解锁</p>
            </div>
            <div>
              <Sparkles aria-hidden="true" size={18} />
              <span>学习证据</span>
              <p>讲解确认、确定性练习或实验记录</p>
            </div>
          </section>

          {checkpoint ? (
            <section className={styles.knowledgeCheck} aria-labelledby="knowledge-check-title">
              <div>
                <p>能力自测</p>
                <h2 id="knowledge-check-title">已经了解了吗？</h2>
                <span>用一组短题检查自己是否掌握了本课核心概念，再决定继续练习还是回看讲解。</span>
              </div>
              {checkpointStatus === "locked" ? (
                <span className={styles.knowledgeCheckLocked}><LockKeyhole aria-hidden="true" size={15} />完成前置活动后可测试</span>
              ) : (
                <Link className={styles.knowledgeCheckAction} href={activityHref(checkpoint.lesson.id, checkpoint.activity, course.stage, grade)}>
                  {checkpointStatus === "completed" ? "复习自测" : "参加自测"}
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              )}
            </section>
          ) : null}

          <section className={styles.outline} aria-labelledby="course-outline-title">
        <header>
          <div>
            <p>课程目录</p>
            <h2 id="course-outline-title">按单元完成学习活动</h2>
          </div>
          <span>不可跳过必要的实验和评价</span>
        </header>
        <div className={styles.unitList}>
          {course.units.map((unit, unitIndex) => {
            const snapshot = getUnitSnapshot(unit, state);
            const nextInUnit = getFirstOpenActivityInUnit(unit, state)
              ?? (snapshot.status === "completed" ? getFirstActivityInUnit(unit) : null);
            return (
            <details className={styles.unit} key={unit.id} open={unitIndex === defaultExpandedUnitIndex}>
              <summary className={styles.unitSummary}>
                <div>
                  <p>{unit.summary}</p>
                  <h3>{unit.title}</h3>
                </div>
                <div className={styles.unitSummaryMeta}>
                  <div className={styles.unitStatusRow}>
                    <span className={styles.unitStatus} data-status={snapshot.status}>{getUnitStatusLabel(snapshot.status)}</span>
                    <span>{snapshot.completedCount} / {snapshot.activityCount} 项活动</span>
                  </div>
                  <div
                    aria-label={`${unit.title} 完成度 ${snapshot.percent}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={snapshot.percent}
                    className={styles.unitProgress}
                    role="progressbar"
                  >
                    <span style={{ width: `${snapshot.percent}%` }} />
                  </div>
                </div>
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className={styles.unitContentHeader}>
                <span>{snapshot.percent}% 完成 · {snapshot.activityCount} 项活动</span>
                {nextInUnit ? (
                  <Link href={activityHref(nextInUnit.lessonId, nextInUnit.activity, course.stage, grade)}>
                    {snapshot.status === "completed" ? "复习本单元" : "继续本单元"}
                    <ArrowRight aria-hidden="true" size={14} />
                  </Link>
                ) : null}
              </div>
              <div className={styles.lessonList}>
                {unit.lessons.map((lesson) => (
                  <article className={styles.lesson} key={lesson.id}>
                    <div className={styles.lessonHeading}>
                      <div>
                        <p>{lesson.estimatedMinutes} 分钟</p>
                        <h4>{lesson.title}</h4>
                        <span>{lesson.summary}</span>
                      </div>
                      <ul aria-label={`${lesson.title} 知识点`}>
                        {lesson.knowledgePointTags.map((tag) => <li key={tag}>{tag}</li>)}
                      </ul>
                    </div>
                    <ol className={styles.activityList}>
                      {lesson.activityIds.map((activityId) => {
                        const activity = getActivity(activityId);
                        if (!activity) return null;
                        const status = activityStatus(state, activity);
                        return (
                          <li data-status={status} key={activity.id}>
                            <span className={styles.activityStatus} aria-hidden="true">
                              {status === "completed" ? <CheckCircle2 size={16} />
                                : status === "locked" ? <LockKeyhole size={15} />
                                  : <span />}
                            </span>
                            <div>
                              <strong>{activity.title}</strong>
                              <small>{getLearningActivityKindLabel(activity.kind)}</small>
                            </div>
                            {status !== "locked" ? (
                              <Link href={activityHref(lesson.id, activity, course.stage, grade)}>
                                {status === "completed" ? "复习" : status === "available" ? "开始" : "继续"}
                              </Link>
                            ) : <span className={styles.lockedText}>完成前置活动后解锁</span>}
                          </li>
                        );
                      })}
                    </ol>
                  </article>
                ))}
              </div>
            </details>
            );
          })}
        </div>
          </section>
        </div>

        <aside className={styles.detailAside} aria-label="课程信息">
          <section className={styles.asideCard}>
            <Share2 aria-hidden="true" size={18} />
            <h2>分享课程</h2>
            <p>把课程链接分享给同学，一起完成练习和实验。</p>
            <button type="button" onClick={() => {
              const clipboard = navigator.clipboard;
              if (!clipboard) return;
              void clipboard.writeText(window.location.href).then(() => setLinkCopied(true));
            }}>
              {linkCopied ? "已复制课程链接" : "复制课程链接"}
            </button>
          </section>
          <section className={styles.asideCard}>
            <ListChecks aria-hidden="true" size={18} />
            <h2>前置课程</h2>
            <p className={styles.asideSuccess}>✓ 无前置课程要求</p>
          </section>
          <section className={styles.asideCard}>
            <BookOpenCheck aria-hidden="true" size={18} />
            <h2>课程证据</h2>
            <p>{activityCount} 项确定性活动，包含讲解、练习和进度记录。</p>
            <a href="#course-resources">查看学习资源 <ArrowRight aria-hidden="true" size={14} /></a>
          </section>
        </aside>
      </div>

      <section className={styles.resources} id="course-resources" aria-labelledby="course-resources-title">
        <header>
          <div>
            <p>知识资料室</p>
            <h2 id="course-resources-title">本课资料与证据</h2>
          </div>
          <span>术语、失败案例、材料与权威来源</span>
        </header>
        <ResourceLibrary course={course.course} />
      </section>
    </main>
  );
}
