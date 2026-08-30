"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BarChart3,
  Compass,
  GraduationCap,
  House,
  LibraryBig,
  Search,
  UserRound,
} from "lucide-react";

import { type LearningPathStage } from "@/data/learning-paths";
import type { LearningState, Stage } from "@/lib/domain";
import { announceLearningStateChanged, LEARNING_STATE_CHANGED_EVENT } from "@/lib/learning-events";
import {
  createDefaultLearningState,
  loadLearningState,
  saveLearningState,
} from "@/lib/learning-store";
import {
  gradeIdForProfile,
  gradeNumberForId,
  getLearningGrade,
  getLearningGrades,
  type LearningGradeId,
} from "@/data/learning-grades";
import { getStructuredCourse } from "@/data/course-structure";
import {
  getStageActivityStatuses,
  recommendNextActivity,
} from "@/features/progress/recommendation";
import { getMiddleSchoolCompletionRequirements, hasCompletedMiddleSchool } from "@/features/progress/middle-school-completion";
import { CourseCatalog } from "./course-catalog";
import { LearningPathTimeline } from "./learning-path-timeline";
import { LearnerProfile } from "./learner-profile";
import { getLearningActivityKindLabel, learningActivityHref } from "./learning-hub-data";
import { PracticeOverview } from "./practice-overview";
import styles from "./learning-platform-shell.module.css";

export type LearningHubStage = LearningPathStage;
export type LearningHubView = "path" | "courses" | "practice" | "profile";

interface LearningPlatformShellProps {
  children?: ReactNode;
  contentEyebrow?: string;
  contentTitle?: string;
  hideContentHeader?: boolean;
  initialStage?: LearningHubStage;
  initialGrade?: LearningGradeId;
  initialView: LearningHubView;
}

const LEARNING_HUB_OWNER = Symbol("learning-hub-owner");

type LearningHubBody = HTMLBodyElement & {
  [LEARNING_HUB_OWNER]?: object;
};

const STAGE_LABELS: Record<LearningHubStage, string> = {
  middle_school: "初中",
  high_school: "高中",
};

const VIEW_ITEMS: ReadonlyArray<{
  id: LearningHubView;
  label: string;
  icon: typeof Compass;
}> = [
  { id: "path", label: "学习路径", icon: Compass },
  { id: "courses", label: "课程", icon: LibraryBig },
  { id: "practice", label: "练习", icon: BookOpen },
  { id: "profile", label: "个人画像", icon: UserRound },
];

function tutorHref(
  stage: LearningHubStage,
  grade: LearningGradeId,
  nextActivity: ReturnType<typeof recommendNextActivity>,
): string {
  const course = nextActivity ? getStructuredCourse(nextActivity.activity.courseId) : undefined;
  const lesson = course?.units.flatMap((unit) => unit.lessons).at(0);
  if (!lesson) {
    return stage === "middle_school"
      ? "/learn?stage=middle_school&grade=middle_1&view=courses"
      : `/learn?stage=${stage}&grade=${grade}&view=path`;
  }
  return `/learn/tutor/${encodeURIComponent(lesson.id)}?stage=${stage}&grade=${grade}`;
}

function stageFromProfile(stage: Stage): LearningHubStage | null {
  return stage === "middle_school" || stage === "high_school" ? stage : null;
}

function updateProfileStage(state: LearningState, stage: Stage): LearningState {
  if (state.profile.stage === stage) return state;
  return {
    ...state,
    profile: { ...state.profile, stage },
    updatedAt: new Date().toISOString(),
  };
}

export function LearningPlatformShell({
  children,
  contentEyebrow,
  contentTitle,
  hideContentHeader,
  initialStage,
  initialGrade,
  initialView,
}: LearningPlatformShellProps) {
  return (
    <LearningPlatformShellContent
      contentEyebrow={contentEyebrow}
      contentTitle={contentTitle}
      hideContentHeader={hideContentHeader}
      initialStage={initialStage}
      initialGrade={initialGrade}
      initialView={initialView}
      key={`${initialStage ?? "saved"}:${initialGrade ?? "saved"}:${initialView}:${hideContentHeader ? "embedded" : "header"}`}
    >
      {children}
    </LearningPlatformShellContent>
  );
}

function LearningPlatformShellContent({
  children,
  contentEyebrow,
  contentTitle,
  hideContentHeader,
  initialStage,
  initialGrade,
  initialView,
}: LearningPlatformShellProps) {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<LearningHubStage>(
    initialStage ?? "middle_school",
  );
  const [selectedGrade, setSelectedGrade] = useState<LearningGradeId>(
    initialGrade ?? gradeIdForProfile(initialStage ?? "middle_school", null),
  );
  const [selectedView, setSelectedView] = useState<LearningHubView>(initialView);
  const [gradeMenuOpen, setGradeMenuOpen] = useState(false);
  const [learningState, setLearningState] = useState<LearningState>(() =>
    createDefaultLearningState(),
  );
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  // The rest of the application uses a fixed viewport, so its global body
  // scroll lock must be relaxed only while the learning shell is mounted.
  useEffect(() => {
    const body = document.body as LearningHubBody;
    const owner = {};
    body[LEARNING_HUB_OWNER] = owner;
    body.dataset.learningHub = "true";
    return () => {
      // A Next soft navigation can mount the next shell before the previous
      // shell cleanup runs. Only the current owner may release document scroll.
      if (body[LEARNING_HUB_OWNER] === owner) {
        delete body[LEARNING_HUB_OWNER];
        delete body.dataset.learningHub;
      }
    };
  }, []);

  useEffect(() => {
    const syncState = () => {
      const loaded = loadLearningState();
      setLearningState(loaded);
      if (initialStage === undefined) {
        const savedStage = stageFromProfile(loaded.profile.stage) ?? "middle_school";
        setSelectedStage(savedStage);
        setSelectedGrade(gradeIdForProfile(savedStage, loaded.profile.grade));
      } else if (initialGrade === undefined) {
        setSelectedGrade(gradeIdForProfile(initialStage, loaded.profile.grade));
      }
    };

    const timer = window.setTimeout(syncState, 0);
    window.addEventListener(LEARNING_STATE_CHANGED_EVENT, syncState);
    window.addEventListener("storage", syncState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(LEARNING_STATE_CHANGED_EVENT, syncState);
      window.removeEventListener("storage", syncState);
    };
  }, [initialGrade, initialStage]);

  function persistStage(stage: Stage): LearningState | null {
    const current = loadLearningState();
    const next = updateProfileStage(current, stage);
    if (!saveLearningState(next)) {
      setStorageNotice("当前学段未能保存到本机档案，请检查浏览器存储权限。");
      return null;
    }
    setLearningState(next);
    setStorageNotice(null);
    announceLearningStateChanged();
    return next;
  }

  function switchLearningStage(stage: LearningHubStage, requestedGrade?: LearningGradeId) {
    const availableGrades = getLearningGrades(stage);
    const nextGrade = availableGrades.some((item) => item.id === requestedGrade)
      ? requestedGrade!
      : availableGrades[0].id;
    const nextState = persistStage(stage);
    if (nextState) {
      const withGrade = {
        ...nextState,
        profile: { ...nextState.profile, grade: gradeNumberForId(nextGrade) },
        updatedAt: new Date().toISOString(),
      };
      if (saveLearningState(withGrade)) {
        setLearningState(withGrade);
        announceLearningStateChanged();
      }
    }
    setSelectedStage(stage);
    setSelectedGrade(nextGrade);
    const nextView = stage === "middle_school" ? "courses" : "path";
    setSelectedView(nextView);
    router.push(`/learn?stage=${stage}&grade=${nextGrade}&view=${nextView}`);
  }

  function switchLearningGrade(grade: LearningGradeId) {
    const definition = getLearningGrade(grade);
    if (definition.stage !== selectedStage) return;
    const current = loadLearningState();
    const next = {
      ...current,
      profile: { ...current.profile, stage: selectedStage, grade: definition.number },
      updatedAt: new Date().toISOString(),
    };
    if (!saveLearningState(next)) {
      setStorageNotice("当前年级未能保存到本机档案，请检查浏览器存储权限。");
      return;
    }
    setLearningState(next);
    setSelectedGrade(grade);
    setStorageNotice(null);
    announceLearningStateChanged();
    router.push(`/learn?stage=${selectedStage}&grade=${grade}&view=${selectedView}`);
  }

  function switchToPrimary() {
    const currentPrimaryStage = initialStage === undefined && ["lower_primary", "upper_primary"].includes(learningState.profile.stage)
      ? learningState.profile.stage
      : "upper_primary";
    persistStage(currentPrimaryStage);
    router.push("/map");
  }

  function switchView(view: LearningHubView) {
    setSelectedView(view);
    router.push(`/learn?stage=${selectedStage}&grade=${selectedGrade}&view=${view}`);
  }

  const nextActivity = recommendNextActivity(learningState, selectedStage, selectedGrade);
  const stageStatuses = getStageActivityStatuses(learningState, selectedStage, selectedGrade);
  const blockedActivity = nextActivity === null
    ? stageStatuses.find((item) => item.status === "locked")
    : undefined;
  const completedStageActivityCount = stageStatuses.filter((item) => item.status === "completed").length;
  const stageActivityCount = stageStatuses.length;
  const stagePercent = stageActivityCount === 0
    ? 0
    : Math.round((completedStageActivityCount / stageActivityCount) * 100);
  const stageLabel = STAGE_LABELS[selectedStage];
  const grade = getLearningGrade(selectedGrade);
  const hasEmbeddedContent = children !== undefined;
  const showContentHeader = !hideContentHeader && (hasEmbeddedContent || (selectedView !== "courses" && selectedView !== "practice"));
  const highSchoolLocked = selectedStage === "high_school" && !hasCompletedMiddleSchool(learningState);

  return (
    <main
      className={styles.platform}
      data-lab={hasEmbeddedContent && contentTitle === "Python 编程实验室" ? "true" : undefined}
      data-stage={selectedStage}
    >
      <header className={styles.topBar}>
        <div className={styles.topBarLead}>
          <Link className={styles.homeLink} href="/preview">
            <img alt="" className={styles.brandMark} src="/assets/starbao-nav-peek.png" />
            <span>星宝课堂</span>
          </Link>
          <nav className={styles.globalNavigation} aria-label="全局导航">
            <Link href="/preview">主页</Link>
            <Link aria-current="page" className={styles.globalNavigationActive} href={`/learn?stage=${selectedStage}&grade=${selectedGrade}&view=path`}>学习</Link>
            <Link href={tutorHref(selectedStage, selectedGrade, nextActivity)}>AI 导师</Link>
            <div className={styles.gradeMenu}>
              <button
                aria-expanded={gradeMenuOpen}
                aria-haspopup="menu"
                className={styles.gradeMenuTrigger}
                onClick={() => setGradeMenuOpen((open) => !open)}
                type="button"
              >
                年级 · {grade.label}
              </button>
              {gradeMenuOpen ? (
                <div className={styles.gradeMenuPanel} role="menu" aria-label="选择年级">
                  <button
                    onClick={() => {
                      setGradeMenuOpen(false);
                      switchToPrimary();
                    }}
                    role="menuitem"
                    type="button"
                  >小学</button>
                  {(["middle_school", "high_school"] as const).map((stage) => (
                    <div className={styles.gradeMenuGroup} key={stage}>
                      <strong>{STAGE_LABELS[stage]}</strong>
                      {getLearningGrades(stage).map((item) => (
                        <button
                          aria-current={item.id === selectedGrade ? "page" : undefined}
                          key={item.id}
                          onClick={() => {
                            setGradeMenuOpen(false);
                            if (stage !== selectedStage) switchLearningStage(stage, item.id);
                            else switchLearningGrade(item.id);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <Link href={selectedStage === "high_school" ? "/high/project/capstone" : `/learn?stage=${selectedStage}&grade=${selectedGrade}&view=profile`}>项目</Link>
          </nav>
        </div>
        <div className={styles.profileStatus}>
          <Link
            aria-label="搜索课程"
            className={styles.topSearch}
            href={`/learn?stage=${selectedStage}&grade=${selectedGrade}&view=courses`}
          >
            <Search aria-hidden="true" size={15} />
            <span>搜索课程...</span>
          </Link>
          <Link
            aria-label="查看学习进度"
            className={styles.quickAction}
            href={`/learn?stage=${selectedStage}&grade=${selectedGrade}&view=profile`}
          >
            <BarChart3 aria-hidden="true" size={15} />
            <span>进度</span>
          </Link>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="学习中心导航">
          <nav className={styles.navigation} aria-label="学习模块">
            {VIEW_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                aria-current={selectedView === id ? "page" : undefined}
                className={styles.navigationItem}
                key={id}
                onClick={() => switchView(id)}
                type="button"
              >
                <Icon aria-hidden="true" size={19} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.sidebarSection}>
            <p>实践</p>
            <Link className={styles.sidebarLink} href={`/lab?stage=${selectedStage}&mode=guided`}>
              <House aria-hidden="true" size={17} />
              <span>实验室</span>
            </Link>
            <Link className={styles.sidebarLink} href={selectedStage === "high_school" ? "/high/project/capstone" : `/learn?stage=${selectedStage}&grade=${selectedGrade}&view=profile`}>
              <ArrowRight aria-hidden="true" size={17} />
              <span>{selectedStage === "high_school" ? "项目工作台" : "进度与档案"}</span>
            </Link>
          </div>
        </aside>

        <section className={styles.content} aria-labelledby="learning-hub-title">
          {showContentHeader ? (
            <header className={styles.contentHeader}>
              <div>
                <p>{contentEyebrow ?? `${stageLabel}阶段 · ${grade.label}重点`}</p>
                <h1 id="learning-hub-title">{contentTitle ?? viewTitle(selectedView)}</h1>
              </div>
              {!hasEmbeddedContent && selectedView === "path" ? (
                <div
                  aria-label={`${stageLabel}学习路径完成度 ${stagePercent}%`}
                  className={styles.stageProgressLabel}
                >
                  <strong>{stagePercent}%</strong>
                  <span>{completedStageActivityCount} / {stageActivityCount} 项已完成</span>
                  <i aria-hidden="true"><b style={{ width: `${stagePercent}%` }} /></i>
                </div>
              ) : null}
            </header>
          ) : null}

          {highSchoolLocked ? (
            <StageUnlockGate state={learningState} />
          ) : hasEmbeddedContent ? children : selectedView === "path" ? (
            <section className={styles.currentTask} aria-labelledby="current-task-title">
              <div className={styles.currentTaskMarker} aria-hidden="true">
                <Compass size={22} />
              </div>
              <div className={styles.currentTaskBody}>
                <p>当前任务</p>
                <h2 id="current-task-title">
                  {nextActivity?.activity.title
                    ?? (blockedActivity ? "等待前置课程" : "本年级任务已完成")}
                </h2>
                <span className={styles.activityType}>
                  {nextActivity
                    ? getLearningActivityKindLabel(nextActivity.activity.kind)
                    : blockedActivity ? "尚未解锁" : "阶段完成"}
                </span>
                <p className={styles.taskReason}>
                  {nextActivity?.reason
                    ?? (blockedActivity
                      ? `先完成：${blockedActivity.missingPrerequisites.map((item) => item.title).join("、")}`
                      : "当前已配置的学习步骤均已形成完成记录。")}
                </p>
              </div>
              {nextActivity ? (
                <Link className={styles.primaryAction} href={learningActivityHref(nextActivity.activity, selectedStage, selectedGrade)}>
                  {nextActivity.kind === "resume" ? "继续学习" : "开始学习"}
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
              ) : blockedActivity?.missingPrerequisites[0] ? (
                <Link
                  className={styles.primaryAction}
                  href={learningActivityHref(blockedActivity.missingPrerequisites[0], selectedStage, selectedGrade)}
                >
                  查看前置课程
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
              ) : null}
            </section>
          ) : selectedView === "courses" ? (
            <CourseCatalog grade={selectedGrade} stage={selectedStage} state={learningState} />
          ) : selectedView === "practice" ? (
            <PracticeOverview grade={selectedGrade} stage={selectedStage} state={learningState} />
          ) : (
            <LearnerProfile stage={selectedStage} state={learningState} />
          )}

          {!highSchoolLocked && !hasEmbeddedContent && selectedView === "path" ? (
            <LearningPathTimeline
              grade={selectedGrade}
              key={`${selectedStage}:${selectedGrade}`}
              stage={selectedStage}
              state={learningState}
            />
          ) : null}

          {storageNotice ? <p className={styles.storageNotice} role="status">{storageNotice}</p> : null}
        </section>
      </div>
    </main>
  );
}

function StageUnlockGate({ state }: { state: LearningState }) {
  const requirements = getMiddleSchoolCompletionRequirements(state);

  return (
    <section className={styles.unlockGate} aria-labelledby="high-school-lock-title">
      <div className={styles.unlockGateIcon} aria-hidden="true"><GraduationCap size={24} /></div>
      <p>高中研究站</p>
      <h2 id="high-school-lock-title">先完成初中阶段，再进入高中项目</h2>
      <span>高中课程、实验和项目会在初中结业条件全部满足后解锁。已有的高中入口不会丢失，解锁后会继续使用同一份学习档案。</span>
      <ul>
        {requirements.map((requirement) => (
          <li data-met={requirement.met ? "true" : "false"} key={requirement.id}>
            <span aria-hidden="true">{requirement.met ? "✓" : "·"}</span>
            <div><strong>{requirement.label}</strong>{!requirement.met ? <Link href={requirement.remediationHref}>去完成</Link> : <small>已满足</small>}</div>
          </li>
        ))}
      </ul>
      <Link className={styles.unlockGateAction} href="/learn?stage=middle_school&grade=middle_1&view=courses">返回初中学习路径<ArrowRight aria-hidden="true" size={16} /></Link>
    </section>
  );
}

function viewTitle(view: LearningHubView): string {
  const titles: Record<LearningHubView, string> = {
    path: "学习路径",
    courses: "课程",
    practice: "练习",
    profile: "个人画像",
  };
  return titles[view];
}
