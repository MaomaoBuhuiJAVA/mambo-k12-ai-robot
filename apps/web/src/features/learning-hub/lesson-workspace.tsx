"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileText,
  Lightbulb,
  LockKeyhole,
  MessageCircleQuestion,
  PlayCircle,
  Save,
  Sparkles,
} from "lucide-react";

import type { CourseLesson, StructuredCourse } from "@/data/course-structure";
import type { LearningGradeId } from "@/data/learning-grades";
import { getActivity, isActivityUnlocked, type LearningActivity } from "@/data/learning-paths";
import type { LearningState } from "@/lib/domain";
import { announceLearningStateChanged, LEARNING_STATE_CHANGED_EVENT } from "@/lib/learning-events";
import { createDefaultLearningState, loadLearningState, saveLearningState } from "@/lib/learning-store";
import {
  checkCompletionPolicy,
  completeCurrentLearningActivity,
  setCurrentLearningActivity,
} from "@/features/learning-sequence/learning-sequence";
import { BubbleSortAnimation } from "@/features/animation/bubble-sort-animation";
import { NeuralNetworkAnimation } from "@/features/animation/neural-network-animation";
import { getLearningActivityKindLabel } from "./learning-hub-data";
import { getPracticeSet, practiceSetIdForCourse } from "./practice-data";
import { PracticeSession } from "./practice-session";
import styles from "./lesson-workspace.module.css";

type ActivityState = "completed" | "available" | "locked";
const MAX_NOTE_LENGTH = 2000;

function getActivities(lesson: CourseLesson): LearningActivity[] {
  return lesson.activityIds.flatMap((activityId) => {
    const activity = getActivity(activityId);
    return activity ? [activity] : [];
  });
}

function getActivityState(state: LearningState, activity: LearningActivity): ActivityState {
  const completed = state.stageProgressByStage[activity.stage].completedActivityIds;
  if (completed.includes(activity.id)) return "completed";
  return isActivityUnlocked(activity.id, completed) ? "available" : "locked";
}

function selectActivity(
  activities: LearningActivity[],
  state: LearningState,
  preferredId: string | undefined,
): LearningActivity | null {
  const preferred = activities.find((activity) => activity.id === preferredId);
  if (preferred && getActivityState(state, preferred) !== "locked") return preferred;
  // Keep a directly requested locked activity visible so a bookmarked legacy
  // URL explains the prerequisite instead of rendering an empty page.
  if (preferred) return preferred;
  return activities.find((activity) => getActivityState(state, activity) === "available")
    ?? activities.find((activity) => getActivityState(state, activity) === "completed")
    ?? null;
}

function noteStorageKey(lessonId: string): string {
  return `mambo-learning-note:${lessonId}`;
}

function courseDetailHref(courseId: string, stage: StructuredCourse["stage"], grade?: LearningGradeId): string {
  if (!grade) return `/learn/course/${encodeURIComponent(courseId)}`;
  return `/learn/course/${encodeURIComponent(courseId)}?stage=${stage}&grade=${grade}`;
}

function tutorHref(lessonId: string, stage: StructuredCourse["stage"], grade?: LearningGradeId): string {
  if (!grade) return `/learn/tutor/${lessonId}`;
  return `/learn/tutor/${encodeURIComponent(lessonId)}?stage=${stage}&grade=${grade}`;
}

function readNote(lessonId: string): string {
  try {
    return window.localStorage.getItem(noteStorageKey(lessonId))?.slice(0, MAX_NOTE_LENGTH) ?? "";
  } catch {
    return "";
  }
}

function activityIcon(kind: LearningActivity["kind"]) {
  if (kind === "assessment") return ClipboardCheck;
  if (kind.includes("lab") || kind === "research_challenge") return PlayCircle;
  if (kind === "lesson") return BookOpenCheck;
  return FileText;
}

export function LessonWorkspace({
  course,
  lesson,
  initialActivityId,
  grade,
  embedded = false,
}: {
  course: StructuredCourse;
  lesson: CourseLesson;
  initialActivityId?: string;
  grade?: LearningGradeId;
  embedded?: boolean;
}) {
  const activities = useMemo(() => getActivities(lesson), [lesson]);
  const [state, setState] = useState<LearningState>(() => createDefaultLearningState());
  const [selectedActivityId, setSelectedActivityId] = useState<string | undefined>(initialActivityId);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteStatus, setNoteStatus] = useState<string | null>(null);
  const selectedActivity = selectActivity(activities, state, selectedActivityId);
  const completion = selectedActivity
    ? checkCompletionPolicy(state, selectedActivity, reviewConfirmed)
    : null;
  const completedActivities = activities.filter((activity) => getActivityState(state, activity) === "completed").length;
  const progress = activities.length === 0 ? 0 : Math.round((completedActivities / activities.length) * 100);

  useEffect(() => {
    const refresh = () => setState(loadLearningState());
    const timer = window.setTimeout(() => {
      refresh();
      setNote(readNote(lesson.id));
    }, 0);
    window.addEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [lesson.id]);

  function chooseActivity(activity: LearningActivity) {
    if (getActivityState(state, activity) === "locked") return;
    setSelectedActivityId(activity.id);
    setReviewConfirmed(false);
    setNotice(null);
  }

  function completeSelectedActivity() {
    if (!selectedActivity || !completion) return;
    const now = new Date().toISOString();
    const active = setCurrentLearningActivity(state, selectedActivity.stage, selectedActivity.id, now);
    const next = completeCurrentLearningActivity(active, selectedActivity.id, reviewConfirmed, now);
    if (next === active) {
      setNotice(completion.met ? "当前活动尚未满足解锁条件。" : completion.requirement);
      return;
    }
    if (!saveLearningState(next)) {
      setNotice("当前活动已在页面内完成，但本机学习记录未能保存。请检查浏览器存储权限后重试。");
      return;
    }
    setState(next);
    setReviewConfirmed(false);
    setNotice("当前活动已记录。下一项可在左侧步骤中继续。");
    announceLearningStateChanged();
  }

  function saveNote() {
    try {
      window.localStorage.setItem(noteStorageKey(lesson.id), note.slice(0, MAX_NOTE_LENGTH));
      setNoteStatus("笔记已保存到本机。");
    } catch {
      setNoteStatus("笔记未能保存，请检查浏览器存储权限。");
    }
  }

  if (!selectedActivity || !completion) return null;

  const selectedState = getActivityState(state, selectedActivity);
  if (selectedState === "locked") {
    return (
      <main className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
        {!embedded ? (
          <header className={styles.topBar}>
            <Link href={courseDetailHref(course.course.id, course.stage, grade)}><ArrowLeft aria-hidden="true" size={16} />返回课程详情</Link>
            <span>{course.stage === "middle_school" ? "初中" : "高中"} / {course.course.title}</span>
          </header>
        ) : null}
        <section className={styles.lockedActivity} aria-labelledby="locked-activity-title">
          <LockKeyhole aria-hidden="true" size={28} />
          <p>活动已锁定</p>
          <h1 id="locked-activity-title">{selectedActivity.title}</h1>
          <span>完成前置活动后，这里会开放讲解、练习或实验。</span>
          {selectedActivity.prerequisites.length > 0 ? (
            <ul aria-label="需要先完成的活动">
              {selectedActivity.prerequisites.map((prerequisiteId) => {
                const prerequisite = getActivity(prerequisiteId);
                return <li key={prerequisiteId}>{prerequisite?.title ?? prerequisiteId}</li>;
              })}
            </ul>
          ) : null}
          <Link href={courseDetailHref(course.course.id, course.stage, grade)}>返回课程详情<ArrowRight aria-hidden="true" size={16} /></Link>
        </section>
      </main>
    );
  }
  const supportsConfirmation = completion.requiresReviewConfirmation;
  const isLab = selectedActivity.kind.includes("lab") || selectedActivity.kind === "research_challenge";

  return (
    <main className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
      {!embedded ? (
        <header className={styles.topBar}>
          <Link href={courseDetailHref(course.course.id, course.stage, grade)}><ArrowLeft aria-hidden="true" size={16} />返回课程详情</Link>
          <span>{course.stage === "middle_school" ? "初中" : "高中"} / {course.course.title}</span>
        </header>
      ) : null}

      <header className={styles.lessonHeader}>
        <div>
          <p>自主学习工作台</p>
          <h1>{lesson.title}</h1>
          <span>{lesson.summary}</span>
        </div>
        <div
          aria-label={`本节完成度 ${progress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className={styles.lessonProgress}
          role="progressbar"
        >
          <strong>{completedActivities} / {activities.length}</strong>
          <span><i style={{ width: `${progress}%` }} /></span>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.stepRail} aria-label="本节步骤">
          <header>
            <p>本节步骤</p>
            <span>{lesson.estimatedMinutes} 分钟</span>
          </header>
          <ol>
            {activities.map((activity, index) => {
              const status = getActivityState(state, activity);
              const Icon = activityIcon(activity.kind);
              return (
                <li data-active={selectedActivity.id === activity.id || undefined} data-status={status} key={activity.id}>
                  <button
                    aria-current={selectedActivity.id === activity.id ? "step" : undefined}
                    disabled={status === "locked"}
                    onClick={() => chooseActivity(activity)}
                    type="button"
                  >
                    <span className={styles.stepNumber} aria-hidden="true">
                      {status === "completed" ? <CheckCircle2 size={16} />
                        : status === "locked" ? <LockKeyhole size={15} />
                          : index + 1}
                    </span>
                    <span>
                      <strong>{activity.title}</strong>
                      <small><Icon aria-hidden="true" size={13} />{getLearningActivityKindLabel(activity.kind)}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={styles.completionRule}>
            <CircleDot aria-hidden="true" size={16} />
            <p>{completion.requirement}</p>
          </div>
        </aside>

        <section className={styles.canvas} aria-labelledby="activity-title">
          <header className={styles.activityHeader}>
            <span>{getLearningActivityKindLabel(selectedActivity.kind)}</span>
            <h2 id="activity-title">{selectedActivity.title}</h2>
            <p>{activityInstruction(selectedActivity, course.course.title)}</p>
          </header>

          <ActivityCanvas activity={selectedActivity} course={course} state={state} />

          <footer className={styles.activityFooter}>
            {supportsConfirmation ? (
              <label className={styles.confirmation}>
                <input
                  checked={reviewConfirmed}
                  onChange={(event) => setReviewConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>我已阅读本节讲解或完成演示观察，并能说明本节目标。</span>
              </label>
            ) : null}
            {isLab ? (
              <Link className={styles.labAction} href={selectedActivity.route}>
                前往实验室形成证据<ArrowRight aria-hidden="true" size={16} />
              </Link>
            ) : null}
            <button
              className={styles.completeAction}
              disabled={selectedState === "completed" || !completion.met}
              onClick={completeSelectedActivity}
              type="button"
            >
              <CheckCircle2 aria-hidden="true" size={16} />
              {selectedState === "completed" ? "本活动已完成" : "记录本活动完成"}
            </button>
          </footer>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </section>

        <aside className={styles.supportRail} aria-label="学习提示与笔记">
          <section>
            <header><Lightbulb aria-hidden="true" size={17} /><h2>关键知识点</h2></header>
            <ul>{lesson.knowledgePointTags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
          </section>
          <section>
            <header><MessageCircleQuestion aria-hidden="true" size={17} /><h2>星宝提示</h2></header>
            <p>{hintFor(selectedActivity)}</p>
          </section>
          <section className={styles.tutorPlaceholder}>
            <header><Sparkles aria-hidden="true" size={17} /><h2>AI 导师</h2></header>
            <p>可先使用离线种子课程完成讲解、字幕、预测和笔记；云端课程协议接入后会沿用同一受控界面。</p>
            <Link href={tutorHref(lesson.id, course.stage, grade)}>开启 AI 导师</Link>
          </section>
          <section className={styles.notes}>
            <header><FileText aria-hidden="true" size={17} /><h2>我的笔记</h2></header>
            <textarea
              aria-label="本节笔记"
              maxLength={MAX_NOTE_LENGTH}
              onChange={(event) => { setNote(event.target.value); setNoteStatus(null); }}
              placeholder="记录你的预测、证据或下一步问题"
              value={note}
            />
            <div><span>{note.length} / {MAX_NOTE_LENGTH}</span><button onClick={saveNote} type="button"><Save aria-hidden="true" size={14} />保存</button></div>
            {noteStatus ? <p role="status">{noteStatus}</p> : null}
          </section>
        </aside>
      </div>
    </main>
  );
}

function ActivityCanvas({
  activity,
  course,
  state,
}: {
  activity: LearningActivity;
  course: StructuredCourse;
  state: LearningState;
}) {
  if (activity.kind === "assessment") {
    const practiceSetId = practiceSetIdForCourse(course.course.id);
    const practiceSet = getPracticeSet(course.stage, practiceSetId, state);
    return practiceSet ? (
      <PracticeSession
        embedded
        initialPracticeSet={practiceSet}
        practiceSetId={practiceSetId}
        stage={course.stage}
      />
    ) : <p className={styles.labPreview}>当前课程暂未配置练习题。</p>;
  }
  if (activity.kind.includes("lab") || activity.kind === "research_challenge") {
    return (
      <div className={styles.labPreview}>
        <p>实验准备</p>
        <h3>{activity.title}</h3>
        <pre><code>{course.course.starterCode}</code></pre>
        <p>实验页会保存固定模板、测试结果和结论证据；完成后回到本节继续解锁。</p>
      </div>
    );
  }
  if (activity.kind === "demonstration") return <Demonstration course={course} />;
  return <LessonContent course={course} />;
}

function LessonContent({ course }: { course: StructuredCourse }) {
  const content = course.course;
  return (
    <div className={styles.lessonContent}>
      <section>
        <p className={styles.sectionLabel}>核心讲解</p>
        <h3>从事实和步骤建立理解</h3>
        <p>{content.explanation.overview}</p>
      </section>
      <section>
        <p className={styles.sectionLabel}>关键概念</p>
        <ul>{content.explanation.keyIdeas.map((idea) => <li key={idea}>{idea}</li>)}</ul>
      </section>
      <section className={styles.example}>
        <p className={styles.sectionLabel}>带着证据看示例</p>
        <p>{content.explanation.workedExample}</p>
      </section>
      <section>
        <p className={styles.sectionLabel}>课堂材料</p>
        <ul className={styles.materials}>
          {content.materials.map((material) => <li key={material.name}><strong>{material.name}</strong><span>{material.purpose}</span></li>)}
        </ul>
      </section>
    </div>
  );
}

function Demonstration({ course }: { course: StructuredCourse }) {
  if (/bubble|sort/i.test(`${course.course.id} ${course.course.animation.template}`)) {
    return <BubbleSortAnimation stage={course.course.stage} />;
  }
  if (/neural|classif|feature|picture-label/i.test(`${course.course.id} ${course.course.animation.template}`)) {
    return <NeuralNetworkAnimation stage={course.course.stage} />;
  }
  return (
    <section className={styles.demoTimeline} aria-label="演示步骤">
      <header><PlayCircle aria-hidden="true" size={19} /><div><p>演示轨迹</p><h3>{course.course.animation.template}</h3></div></header>
      <ol>{course.course.animation.steps.map((step, index) => <li key={step.id}><span>{index + 1}</span><p>{step.narration}</p></li>)}</ol>
    </section>
  );
}

function activityInstruction(activity: LearningActivity, courseTitle: string): string {
  if (activity.kind === "assessment") return `用确定性练习核对《${courseTitle}》的知识点理解。`;
  if (activity.kind.includes("lab") || activity.kind === "research_challenge") return "先预测变量变化，再在固定实验模板中运行并保存可核对结果。";
  if (activity.kind === "demonstration") return "按步骤观察数据、变量或模型输出如何变化，再用自己的话说明原因。";
  return "先理解核心概念和示例，再把每个结论对应到可观察的证据。";
}

function hintFor(activity: LearningActivity): string {
  if (activity.kind === "assessment") return "先回到题干中的数据、代码或结果，不要只凭印象选择答案。";
  if (activity.kind.includes("lab") || activity.kind === "research_challenge") return "一次只调整一个变量，并记录调整前后的输入、输出和解释。";
  if (activity.kind === "demonstration") return "暂停在每一步，先预测下一步会发生什么，再继续观察。";
  return "把新概念同本节的示例对应起来：输入是什么，规则或模型做了什么，输出又是什么。";
}
