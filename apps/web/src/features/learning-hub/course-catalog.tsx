"use client";

import Link from "next/link";
import { ArrowRight, Beaker, BookOpen, Brain, CheckCircle2, Clock3, Code2, Database, Gauge, LockKeyhole, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

import { getStructuredCourse } from "@/data/course-structure";
import type { LearningPathStage } from "@/data/learning-paths";
import { gradeIdForProfile, getLearningGrade, type LearningGradeId } from "@/data/learning-grades";
import type { LearningState } from "@/lib/domain";
import {
  getStageActivityStatuses,
} from "@/features/progress/recommendation";
import {
  getCourseProgressSnapshots,
  getLearningActivityKindLabel,
  type CourseLearningAction,
  type CourseLearningStatus,
  type CourseProgressSnapshot,
} from "./learning-hub-data";
import styles from "./learning-platform-shell.module.css";

type CourseFilter = "all" | "available" | "in_progress" | "completed" | "with_lab";
type CourseCategory = "all" | "ai_foundations" | "data_algorithms" | "python" | "model_training" | "generative_ai" | "ai_safety" | "ml" | "neural_networks" | "multimodal" | "audit" | "project";
type CatalogView = "summary" | "detail";

const FILTERS: ReadonlyArray<{ id: CourseFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "available", label: "可开始" },
  { id: "in_progress", label: "进行中" },
  { id: "completed", label: "已完成" },
  { id: "with_lab", label: "含实验" },
];

const MIDDLE_CATEGORIES: ReadonlyArray<{ id: CourseCategory; label: string }> = [
  { id: "all", label: "全部主题" },
  { id: "ai_foundations", label: "AI 基础" },
  { id: "data_algorithms", label: "数据与算法" },
  { id: "python", label: "Python" },
  { id: "model_training", label: "模型训练" },
  { id: "generative_ai", label: "生成式 AI" },
  { id: "ai_safety", label: "AI 安全" },
];

const HIGH_CATEGORIES: ReadonlyArray<{ id: CourseCategory; label: string }> = [
  { id: "all", label: "全部主题" },
  { id: "python", label: "Python 数据" },
  { id: "data_algorithms", label: "算法" },
  { id: "ml", label: "机器学习" },
  { id: "neural_networks", label: "神经网络" },
  { id: "multimodal", label: "多模态与大模型" },
  { id: "audit", label: "模型审计" },
  { id: "project", label: "项目" },
];

const CAPSTONE_PROJECT_ROUTE = "/high/project/capstone";
const CAPSTONE_ACTIVITY_IDS = new Set(["high-capstone-project", "high-capstone-defense"]);

interface CapstoneProjectSnapshot {
  status: CourseLearningStatus;
  completedCount: number;
  activityCount: number;
  action: { href: string; label: string } | null;
  missingPrerequisite: string | null;
}

export function CourseCatalog({
  grade,
  stage,
  state,
}: {
  grade?: LearningGradeId;
  stage: LearningPathStage;
  state: LearningState;
}) {
  const [filter, setFilter] = useState<CourseFilter>("all");
  const [category, setCategory] = useState<CourseCategory>("all");
  const [catalogView, setCatalogView] = useState<CatalogView>("summary");
  const [aiTutorOnly, setAiTutorOnly] = useState(false);
  const [query, setQuery] = useState("");
  const gradeDefinition = getLearningGrade(grade ?? gradeIdForProfile(stage, null));
  const gradeRank = new Map(gradeDefinition.courseIds.map((courseId, index) => [courseId, index]));
  const courses = getCourseProgressSnapshots(state, stage, grade)
    .sort((left, right) => {
    const leftRank = gradeRank.get(left.course.id);
    const rightRank = gradeRank.get(right.course.id);
    return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER);
  });
  const categories = stage === "middle_school" ? MIDDLE_CATEGORIES : HIGH_CATEGORIES;
  const capstone = stage === "high_school" && gradeDefinition.id === "high_3"
    ? getCapstoneProjectSnapshot(state)
    : null;
  const catalogMetrics = getCatalogMetrics(courses, capstone);
  const visibleCourses = courses.filter((item) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    const matchesFilter = filter === "all"
      || filter === "with_lab"
        ? filter !== "with_lab" || item.hasLab
        : item.status === filter;
    if (!matchesFilter) return false;
    if (category !== "all" && !matchesCategory(item.course.id, category)) return false;
    if (aiTutorOnly && !getTutorHref(item.course.id, stage, grade)) return false;
    if (normalizedQuery.length === 0) return true;
    return [item.course.title, item.course.summary, ...item.course.knowledgePointTags]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedQuery);
  });
  const showCapstone = capstone !== null
    && !aiTutorOnly
    && (category === "all" || category === "project")
    && matchesCapstoneFilter(capstone, filter, query);
  const resultCount = visibleCourses.length + Number(showCapstone);

  return (
    <section className={styles.catalog} aria-labelledby="course-catalog-title">
      <section className={styles.catalogIntro} aria-label={`${stage === "middle_school" ? "初中" : "高中"}技能学习路径`}>
        <div className={styles.catalogIntroIcon} aria-hidden="true">
          {stage === "middle_school" ? <BookOpen size={26} /> : <Code2 size={26} />}
        </div>
        <div className={styles.catalogIntroCopy}>
          <p>{stage === "middle_school" ? "技能深度学习" : "研究技能路径"}</p>
          <h2 id="course-catalog-title">{gradeDefinition.label} · {stage === "middle_school" ? "AI 技能学习路径" : "AI 研究学习路径"}</h2>
          <span>
            {stage === "middle_school"
              ? "从概念、练习到实验，逐步理解数据、算法和模型。"
              : "从可运行代码到项目证据，完成数据、模型和指标实践。"}
          </span>
          <div className={styles.catalogGradeFocus} aria-label={`${gradeDefinition.label}学习重点`}>
            <strong>{gradeDefinition.description}</strong>
            {gradeDefinition.focus.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className={styles.catalogIntroFacts} aria-label="学习路径指标">
          <div>
            <strong>{catalogMetrics.courseCount}</strong>
            <span>门课程</span>
          </div>
          <div>
            <strong>{catalogMetrics.lessonCount}</strong>
            <span>个课节</span>
          </div>
          <div>
            <strong>{catalogMetrics.activityCount}</strong>
            <span>个任务</span>
          </div>
          <div>
            <strong>{catalogMetrics.duration}</strong>
            <span>预计学习</span>
          </div>
        </div>
      </section>
      <header className={styles.catalogToolbar}>
          <div className={styles.filterGroups}>
          <div className={styles.courseFilters} aria-label="课程主题筛选" role="group">
            {categories.map((item) => (
              <button
                aria-pressed={category === item.id}
                key={item.id}
                onClick={() => setCategory(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.courseFilters} aria-label="课程状态筛选" role="group">
            {FILTERS.map((item) => (
              <button
                aria-pressed={filter === item.id}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.catalogViewToggle} aria-label="课程目录视图" role="group">
            <span>显示</span>
            {([ ["summary", "概览"], ["detail", "详细"] ] as const).map(([id, label]) => (
              <button
                aria-pressed={catalogView === id}
                key={id}
                onClick={() => setCatalogView(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.catalogControls}>
          <button
            aria-checked={aiTutorOnly}
            className={styles.tutorFilter}
            onClick={() => setAiTutorOnly((current) => !current)}
            role="switch"
            type="button"
          >
            <span aria-hidden="true" className={styles.tutorSwitch}><i /></span>
            <Sparkles aria-hidden="true" size={14} />
            AI 导师
          </button>
          <label className={styles.searchField}>
          <span className={styles.screenReaderOnly}>搜索课程或知识点</span>
          <Search aria-hidden="true" size={16} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索课程或知识点"
            type="search"
            value={query}
          />
          </label>
        </div>
      </header>
      <p className={styles.resultCount} aria-live="polite">{resultCount} 门课程</p>

      <div className={styles.courseCardGrid}>
        {visibleCourses.map((item) => {
          const detailHref = courseHref(item.course.id, stage, grade);
          const percent = item.activities.length === 0
            ? 0
            : Math.round((item.completedCount / item.activities.length) * 100);
          const presentation = getCoursePresentation(item.course.id);
          return (
            <article className={styles.courseCard} data-course-theme={presentation.theme} data-grade-focus data-stage={stage} data-status={item.status} data-view={catalogView} key={item.course.id}>
              <header className={styles.courseCardHeader}>
                <span className={styles.courseSubjectIcon} aria-hidden="true"><CourseSubjectIcon courseId={item.course.id} /></span>
                <span className={styles.courseStatusGroup}>
                  <CourseStatusIcon status={item.status} />
                  <span className={styles.courseStatus}>{courseStatusLabel(item.status)}</span>
                </span>
              </header>
              <p className={styles.courseEyebrow}>{gradeDefinition.label}重点 · {stage === "middle_school" ? "技能学习路径" : "研究技能路径"}</p>
              <h2 id={`course-${item.course.id}`}>
                <Link
                  className={styles.courseTitleLink}
                  href={detailHref}
                >
                  {item.course.title}
                </Link>
              </h2>
              <p className={styles.courseSummary}>{item.course.summary}</p>
              <div className={styles.courseLearningMeta} aria-label="课程难度与预计时长">
                <span><Gauge aria-hidden="true" size={13} />{presentation.difficulty}</span>
                <span><Clock3 aria-hidden="true" size={13} />{presentation.durationLabel}</span>
              </div>
              <ul className={styles.courseTags} aria-label="课程知识点">
                {item.course.knowledgePointTags.slice(0, 2).map((tag) => <li key={tag}>{tag}</li>)}
                {item.course.knowledgePointTags.length > 2 ? (
                  <li aria-label={`还有 ${item.course.knowledgePointTags.length - 2} 个知识点`}>
                    +{item.course.knowledgePointTags.length - 2}
                  </li>
                ) : null}
              </ul>
              {catalogView === "detail" ? (
                <ol className={styles.courseActivityFlow} aria-label={`${item.course.title}学习活动流程`}>
                  {item.activities.map((activityStatus) => (
                    <li data-status={activityStatus.status} key={activityStatus.activity.id}>
                      <span aria-hidden="true" className={styles.courseActivityMarker} />
                      <span>{getLearningActivityKindLabel(activityStatus.activity.kind)}</span>
                      <strong>{activityStatus.activity.title}</strong>
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className={styles.courseEvidence}>
                <div className={styles.courseMeta}>
                  <span>{getCourseLessonCount(item.course.id)} 节课</span>
                  <span>{item.activities.length} 个任务</span>
                  {item.hasLab ? <span className={styles.labBadge}><Beaker aria-hidden="true" size={14} />含实验</span> : null}
                </div>
                <div className={styles.courseProgressRow}>
                  <div
                    aria-label={`${item.course.title} 完成度 ${percent}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={percent}
                    className={styles.courseProgress}
                    role="progressbar"
                  >
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <strong>{percent}%</strong>
                </div>
              </div>
              {item.action ? (
                <div className={styles.courseActions}>
                  <Link
                    aria-label={`${item.course.title}：${courseActionLabel(item.action.label)}`}
                    className={styles.courseAction}
                    href={learningActionHref(item.action.href, stage, grade)}
                  >
                    <span>{courseActionLabel(item.action.label)}</span>
                    <ArrowRight aria-hidden="true" size={14} />
                  </Link>
                  {getTutorHref(item.course.id, stage, grade) ? (
                    <Link
                      aria-label={`${item.course.title}：AI 导师学习`}
                      className={styles.tutorAction}
                      href={getTutorHref(item.course.id, stage, grade)!}
                    >
                      <Sparkles aria-hidden="true" size={14} />
                      AI 导师学习
                    </Link>
                  ) : (
                    <Link
                      aria-label={`${item.course.title}：查看课程详情`}
                      className={styles.tutorAction}
                      href={detailHref}
                    >
                      查看详情 <ArrowRight aria-hidden="true" size={14} />
                    </Link>
                  )}
                </div>
              ) : (
                <div className={styles.courseLocked}>
                  <span>
                    {(() => {
                      const prerequisite = item.activities
                        .flatMap((activity) => activity.missingPrerequisites)
                        .at(0);
                      return prerequisite
                        ? `需要先完成：${prerequisite.title}`
                        : "完成前置任务后解锁";
                    })()}
                  </span>
                  <Link
                    aria-label={`${item.course.title}：查看课程详情`}
                    className={styles.lockedCourseAction}
                    href={detailHref}
                  >
                    查看课程
                  </Link>
                </div>
              )}
            </article>
          );
        })}
        {showCapstone && capstone ? <CapstoneProjectCard snapshot={capstone} /> : null}
      </div>
      {resultCount === 0 ? (
        <div className={styles.catalogEmpty} role="status">没有符合当前筛选条件的课程。</div>
      ) : null}
    </section>
  );
}

function courseActionLabel(label: CourseLearningAction["label"]): string {
  const labels = {
    "开始学习": "开始",
    "继续学习": "继续学习",
    "复习课程": "复习",
  } as const;
  return labels[label];
}

function matchesCategory(courseId: string, category: CourseCategory): boolean {
  const groups: Record<Exclude<CourseCategory, "all">, readonly string[]> = {
    ai_foundations: ["middle-ai-foundations"],
    data_algorithms: ["middle-data-and-algorithms", "high-bubble-analysis"],
    python: ["middle-python-basics", "high-python-data-lab"],
    model_training: ["middle-neural-signals", "middle-model-evaluation", "middle-data-bias"],
    generative_ai: ["middle-generative-ai"],
    ai_safety: ["middle-ai-safety"],
    ml: ["high-ml-pipeline", "high-classification-regression"],
    neural_networks: ["high-neural-network-training"],
    multimodal: ["high-multimodal-ai", "high-generative-ai-rag"],
    audit: ["high-image-model-audit"],
    project: [],
  };
  return groups[category as Exclude<CourseCategory, "all">]?.includes(courseId) ?? false;
}

function getCapstoneProjectSnapshot(state: LearningState): CapstoneProjectSnapshot {
  const statuses = getStageActivityStatuses(state, "high_school")
    .filter((item) => CAPSTONE_ACTIVITY_IDS.has(item.activity.id));
  const completedCount = statuses.filter((item) => item.status === "completed").length;
  const active = statuses.find((item) => item.status === "active");
  const available = statuses.find((item) => item.status === "available");
  const primary = active ?? available;
  const status: CourseLearningStatus = completedCount === statuses.length && statuses.length > 0
    ? "completed"
    : active
      ? "in_progress"
      : available
        ? "available"
        : "locked";
  const locked = statuses.find((item) => item.status === "locked");

  return {
    status,
    completedCount,
    activityCount: statuses.length,
    action: primary
      ? { href: primary.activity.route, label: primary.status === "active" ? "继续项目" : "开始项目" }
      : null,
    missingPrerequisite: locked?.missingPrerequisites[0]?.title ?? null,
  };
}

function matchesCapstoneFilter(
  snapshot: CapstoneProjectSnapshot,
  filter: CourseFilter,
  query: string,
): boolean {
  if (filter === "with_lab") return false;
  if (filter !== "all" && filter !== snapshot.status) return false;
  if (query.trim().length === 0) return true;
  return ["AI 综合项目与答辩", "把实验、模型卡、报告和答辩整理成可复核成果", "项目证据", "模型卡", "答辩"]
    .join(" ")
    .toLocaleLowerCase("zh-CN")
    .includes(query.trim().toLocaleLowerCase("zh-CN"));
}

function CapstoneProjectCard({ snapshot }: { snapshot: CapstoneProjectSnapshot }) {
  const percent = snapshot.activityCount === 0
    ? 0
    : Math.round((snapshot.completedCount / snapshot.activityCount) * 100);
  const href = snapshot.action?.href ?? CAPSTONE_PROJECT_ROUTE;
  return (
    <article className={styles.courseCard} data-course-theme="gold" data-status={snapshot.status} data-view="summary">
      <header className={styles.courseCardHeader}>
        <span className={styles.courseSubjectIcon} aria-hidden="true"><Sparkles size={20} /></span>
        <span className={styles.courseStatusGroup}>
          <CourseStatusIcon status={snapshot.status} />
          <span className={styles.courseStatus}>{courseStatusLabel(snapshot.status)}</span>
        </span>
      </header>
      <h2>AI 综合项目与答辩</h2>
      <p className={styles.courseSummary}>把实验、模型卡、报告和答辩整理成可复核成果。</p>
      <div className={styles.courseLearningMeta} aria-label="项目难度与预计时长">
        <span><Gauge aria-hidden="true" size={13} />挑战</span>
        <span><Clock3 aria-hidden="true" size={13} />约 45 分钟</span>
      </div>
      <ul aria-label="项目知识点" className={styles.courseTags}>
        <li>项目证据</li>
        <li>模型卡</li>
        <li>答辩表达</li>
      </ul>
      <div className={styles.courseEvidence}>
        <div className={styles.courseMeta}>
          <span>{snapshot.activityCount} 个项目阶段</span>
          <span>{snapshot.completedCount} 个已完成</span>
        </div>
        <div className={styles.courseProgressRow}>
          <div
            aria-label={`AI 综合项目与答辩完成度 ${percent}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className={styles.courseProgress}
            role="progressbar"
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <strong>{percent}%</strong>
        </div>
      </div>
      <div className={styles.courseActions}>
        <Link
          aria-label="AI 综合项目与答辩：打开项目工作台"
          className={styles.courseAction}
          href={href}
        >
          打开项目工作台
        </Link>
      </div>
      {snapshot.status === "locked" && snapshot.missingPrerequisite ? (
        <p className={styles.courseLocked}>需要先完成：{snapshot.missingPrerequisite}</p>
      ) : null}
    </article>
  );
}

function courseHref(courseId: string, stage?: LearningPathStage, grade?: LearningGradeId): string {
  const query = new URLSearchParams();
  if (grade) {
    if (stage) query.set("stage", stage);
    query.set("grade", grade);
  }
  const suffix = query.toString();
  return `/learn/course/${encodeURIComponent(courseId)}${suffix ? `?${suffix}` : ""}`;
}

function learningActionHref(
  href: string,
  stage?: LearningPathStage,
  grade?: LearningGradeId,
): string {
  if (!stage || !grade || !href.startsWith("/")) return href;
  const [pathname, rawQuery = ""] = href.split("?", 2);
  const query = new URLSearchParams(rawQuery);
  query.set("stage", stage);
  query.set("grade", grade);
  return `${pathname}?${query.toString()}`;
}

function getTutorHref(courseId: string, stage?: LearningPathStage, grade?: LearningGradeId): string | null {
  const course = getStructuredCourse(courseId);
  const lessonId = course?.units[0]?.lessons[0]?.id;
  if (!lessonId) return null;
  const query = new URLSearchParams();
  if (grade) {
    if (stage) query.set("stage", stage);
    query.set("grade", grade);
  }
  const suffix = query.toString();
  return `/learn/tutor/${encodeURIComponent(lessonId)}${suffix ? `?${suffix}` : ""}`;
}

function getCourseLessonCount(courseId: string): number {
  const course = getStructuredCourse(courseId);
  return course?.units.flatMap((unit) => unit.lessons).length ?? 0;
}

function CourseStatusIcon({ status }: { status: CourseLearningStatus }) {
  if (status === "locked") return <LockKeyhole aria-hidden="true" size={18} />;
  if (status === "completed") return <CheckCircle2 aria-hidden="true" size={18} />;
  return <span aria-hidden="true" className={styles.courseStatusDot} />;
}

function CourseSubjectIcon({ courseId }: { courseId: string }) {
  const Icon = courseId.includes("python") || courseId.includes("bubble")
    ? Code2
    : courseId.includes("data") || courseId.includes("pipeline")
      ? Database
      : courseId.includes("neural") || courseId.includes("image")
        ? Brain
        : courseId.includes("safety")
          ? ShieldCheck
          : BookOpen;
  return <Icon size={20} />;
}

type CourseTheme = "teal" | "blue" | "violet" | "gold" | "coral";
type CourseDifficulty = "基础" | "进阶" | "挑战";

interface CoursePresentation {
  theme: CourseTheme;
  difficulty: CourseDifficulty;
  durationLabel: string;
}

/** Keep visual identity deterministic while deriving time from the structured lessons. */
function getCoursePresentation(courseId: string): CoursePresentation {
  const theme: CourseTheme = courseId.includes("safety")
    ? "coral"
    : courseId.includes("neural") || courseId.includes("image")
      ? "violet"
      : courseId.includes("python") || courseId.includes("bubble")
        ? "blue"
        : courseId.includes("generative") || courseId.includes("multimodal")
          ? "gold"
          : courseId.includes("ml") || courseId.includes("classification") || courseId.includes("pipeline")
            ? "violet"
            : "teal";
  const difficulty: CourseDifficulty = courseId.startsWith("high-")
    ? courseId.includes("audit") || courseId.includes("capstone")
      ? "挑战"
      : "进阶"
    : courseId.includes("safety") || courseId.includes("generative")
      ? "进阶"
      : "基础";
  const course = getStructuredCourse(courseId);
  const minutes = course?.units
    .flatMap((unit) => unit.lessons)
    .reduce((total, lesson) => total + lesson.estimatedMinutes, 0) ?? 0;
  return {
    theme,
    difficulty,
    durationLabel: formatCourseDuration(minutes),
  };
}

function formatCourseDuration(minutes: number): string {
  if (minutes <= 0) return "时长待定";
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `约 ${hours} 小时` : `约 ${hours} 小时 ${remainder} 分钟`;
}

function getCatalogMetrics(
  courses: readonly CourseProgressSnapshot[],
  capstone: CapstoneProjectSnapshot | null,
): { courseCount: number; lessonCount: number; activityCount: number; duration: string } {
  const structured = courses
    .map((item) => getStructuredCourse(item.course.id))
    .filter((course): course is NonNullable<typeof course> => course !== undefined);
  const lessonCount = structured.reduce(
    (total, course) => total + course.units.flatMap((unit) => unit.lessons).length,
    0,
  );
  const activityCount = courses.reduce((total, item) => total + item.activities.length, 0)
    + (capstone?.activityCount ?? 0);
  const minutes = structured.reduce(
    (total, course) => total + course.units
      .flatMap((unit) => unit.lessons)
      .reduce((lessonTotal, lesson) => lessonTotal + lesson.estimatedMinutes, 0),
    0,
  );
  const duration = minutes >= 60
    ? `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分` : ""}`
    : `${minutes} 分钟`;
  return {
    courseCount: courses.length + Number(capstone !== null),
    lessonCount,
    activityCount,
    duration,
  };
}

function courseStatusLabel(status: CourseLearningStatus): string {
  const labels: Record<CourseLearningStatus, string> = {
    locked: "已锁定",
    available: "可开始",
    in_progress: "进行中",
    completed: "已完成",
  };
  return labels[status];
}
