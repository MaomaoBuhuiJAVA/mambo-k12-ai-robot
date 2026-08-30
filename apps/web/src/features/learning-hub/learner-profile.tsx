"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Beaker,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  FileText,
  Lightbulb,
  Target,
} from "lucide-react";

import { getCourseById } from "@/data/curriculum";
import { getActivity, getLearningPath, type LearningActivity, type LearningPathStage } from "@/data/learning-paths";
import type { Attempt, LearningState, MasteryRecord } from "@/lib/domain";
import { INTEREST_OPTIONS } from "@/features/progress/interest-options";
import { getStageActivityStatuses, recommendNextActivity } from "@/features/progress/recommendation";
import { loadProject } from "@/features/projects/project-store";
import { getProjectDefinition, PROJECT_IDS, type ProjectId, type ProjectRecord } from "@/features/projects/project-schema";
import { evaluateProject } from "@/features/projects/project-evaluator";
import { getLabTemplate } from "@/features/lab/lab-templates";
import styles from "./learner-profile.module.css";

function belongsToStage(knowledgePointId: string, stage: LearningPathStage): boolean {
  const separator = knowledgePointId.indexOf(":");
  if (separator > 0) return getCourseById(knowledgePointId.slice(0, separator))?.stage === stage;
  return getLearningPath(stage).some((activity) =>
    activity.labTemplateId !== undefined
    && getLabTemplate(activity.labTemplateId).knowledgePointId === knowledgePointId,
  );
}

function knowledgeLabel(knowledgePointId: string): string {
  const separator = knowledgePointId.indexOf(":");
  return separator > 0 ? knowledgePointId.slice(separator + 1) : knowledgePointId;
}

function submissionId(attempt: Attempt): string {
  return attempt.mode === "quiz" ? attempt.attemptId.replace(/~e\d+$/, "") : attempt.attemptId;
}

function isPassed(attempt: Attempt): boolean {
  return attempt.mode === "code" ? attempt.score >= 0.6 : attempt.score === 1;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value));
}

function studyStreak(dates: string[]): { days: number; latest: string | null } {
  const tokens = [...new Set(dates.map((date) => date.slice(0, 10)).filter(Boolean))].sort().reverse();
  const latest = tokens[0] ?? null;
  if (!latest) return { days: 0, latest: null };
  const available = new Set(tokens);
  let cursor = new Date(`${latest}T00:00:00.000Z`);
  let days = 0;
  while (available.has(cursor.toISOString().slice(0, 10))) {
    days += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return { days, latest };
}

function hasProjectEvidence(project: ProjectRecord | null): boolean {
  if (!project) return false;
  return [
    project.researchQuestion,
    project.dataSource,
    project.metrics,
    project.conclusion,
    project.evidenceRefs.join(" "),
    ...project.defenseAnswers,
  ].some((value) => value.trim().length > 0) || project.currentStep !== "question";
}

interface TrendPoint {
  day: string;
  passed: number;
  total: number;
}

function makeTrend(attempts: Attempt[]): TrendPoint[] {
  const byDay = new Map<string, TrendPoint>();
  for (const attempt of attempts) {
    const day = attempt.completedAt.slice(0, 10);
    const item = byDay.get(day) ?? { day, passed: 0, total: 0 };
    item.total += 1;
    if (isPassed(attempt)) item.passed += 1;
    byDay.set(day, item);
  }
  return [...byDay.values()].sort((left, right) => right.day.localeCompare(left.day)).slice(0, 5);
}

function activityRouteForEvidence(
  evidence: LearningState["stageProgressByStage"][LearningPathStage]["experimentEvidence"][number],
  stage: LearningPathStage,
): string {
  const activity = getActivity(evidence.activityId);
  if (activity) return activity.route;
  return `/lab?stage=${stage}&template=${encodeURIComponent(evidence.templateId)}&mode=${evidence.mode}`;
}

function activityRouteForAttempt(attempt: Attempt, stage: LearningPathStage): string | null {
  const activity = getLearningPath(stage).find(
    (candidate) => candidate.labTemplateId !== undefined
      && getLabTemplate(candidate.labTemplateId).knowledgePointId === attempt.knowledgePointId,
  );
  return activity?.route ?? null;
}

function activityKindLabel(activity: LearningActivity): string {
  const labels: Record<LearningActivity["kind"], string> = {
    lesson: "课程",
    demonstration: "演示",
    guided_lab: "引导实验",
    independent_lab: "独立实验",
    research_challenge: "研究挑战",
    assessment: "评价",
    remediation: "补救练习",
    project: "项目",
    defense: "答辩",
  };
  return labels[activity.kind];
}

export function LearnerProfile({
  now = new Date(),
  stage,
  state,
}: {
  now?: Date;
  stage: LearningPathStage;
  state: LearningState;
}) {
  const [projects, setProjects] = useState<Partial<Record<ProjectId, ProjectRecord | null>>>({});
  const stageActivities = state.stageProgressByStage[stage];
  const availableEvidenceIds = useMemo(
    () => new Set(stageActivities.experimentEvidence.map((evidence) => evidence.runId)),
    [stageActivities.experimentEvidence],
  );
  const masteries = useMemo(() => Object.values(state.masteryByKnowledgePoint)
    .filter((record) => belongsToStage(record.knowledgePointId, stage))
    .sort((left, right) => right.mastery - left.mastery || right.evidenceCount - left.evidenceCount), [stage, state.masteryByKnowledgePoint]);
  const dueReviews = masteries.filter((record) => record.nextReviewAt !== null && Date.parse(record.nextReviewAt) <= now.getTime());
  const misconceptionTags = [...new Set(masteries.flatMap((record) => record.misconceptionTags))];
  const attempts = useMemo(() => {
    const seen = new Set<string>();
    return [...state.attempts]
      .filter((attempt) => belongsToStage(attempt.knowledgePointId, stage))
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .filter((attempt) => {
        const id = submissionId(attempt);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }, [stage, state.attempts]);
  const trend = makeTrend(attempts);
  const passedAttempts = attempts.filter(isPassed).length;
  const recommendation = recommendNextActivity(state, stage);
  const stageStatuses = useMemo(() => getStageActivityStatuses(state, stage), [stage, state]);
  const activeActivity = stageStatuses.find((item) => item.status === "active")?.activity;
  const latestEvidence = [...stageActivities.experimentEvidence]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  const evidenceCourse = latestEvidence ? getCourseById(latestEvidence.courseId) : undefined;
  const currentCourse = getCourseById(state.lastCourseId ?? "")?.stage === stage
    ? getCourseById(state.lastCourseId ?? "")
    : activeActivity?.courseId
      ? getCourseById(activeActivity.courseId)
      : evidenceCourse?.stage === stage ? evidenceCourse : null;
  const nextLab = stageStatuses.find((item) =>
    item.activity.labTemplateId !== undefined && (item.status === "active" || item.status === "available"),
  );
  const codeAttempts = attempts.filter((attempt) => attempt.mode === "code").slice(0, 5);
  const streak = studyStreak([
    ...attempts.map((attempt) => attempt.completedAt),
    ...stageActivities.experimentEvidence.map((evidence) => evidence.completedAt),
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (stage !== "high_school") {
        setProjects({});
        return;
      }
      setProjects(Object.fromEntries(PROJECT_IDS.map((id) => [id, loadProject(id)])));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const projectItems = stage === "high_school"
    ? PROJECT_IDS.map((id) => {
      const project = projects[id] ?? null;
      const definition = getProjectDefinition(id)!;
      return {
        id,
        project,
        definition,
        hasEvidence: hasProjectEvidence(project),
        passed: project ? evaluateProject(project, availableEvidenceIds).passed : false,
      };
    })
    : [];

  return (
    <section className={styles.profile} aria-labelledby="learner-profile-title">
      <header className={styles.overview}>
        <div>
          <p>{stage === "middle_school" ? "初中学习档案" : "高中学习档案"}</p>
          <h2 id="learner-profile-title">用学习证据查看自己的进展</h2>
          <span>档案只记录课程、练习、实验和项目证据，不对能力或性格作推断。</span>
        </div>
        <dl>
          <div><dt>在学课程</dt><dd>{currentCourse?.title ?? "尚未开始"}</dd></div>
          <div><dt>连续学习</dt><dd>{streak.days > 0 ? `${streak.days} 天` : "暂无记录"}</dd><small>{streak.latest ? `最近学习 ${formatDate(streak.latest)}` : "完成一次练习或实验后开始记录"}</small></div>
        </dl>
      </header>

      <div className={styles.summaryGrid}>
        <EvidenceSummary icon={BookOpenCheck} label="已完成任务" value={`${stageActivities.completedActivityIds.length}`} detail="来自已保存的活动完成记录" />
        <EvidenceSummary icon={BrainCircuit} label="知识点证据" value={`${masteries.length}`} detail={`${masteries.reduce((total, item) => total + item.evidenceCount, 0)} 条掌握证据`} />
        <EvidenceSummary icon={Beaker} label="实验记录" value={`${stageActivities.experimentEvidence.length}`} detail="来自结构化实验运行和结论" />
        <EvidenceSummary icon={ClipboardCheck} label="已提交练习" value={`${attempts.length}`} detail={attempts.length > 0 ? `达标 ${passedAttempts} / ${attempts.length}` : "尚无作答样本"} />
      </div>

      <div className={styles.columns}>
        <div className={styles.primaryColumn}>
          <section className={styles.section} aria-labelledby="mastery-title">
            <header><div><p>知识点</p><h3 id="mastery-title">掌握度与证据</h3></div><span>{masteries.length} 个已练知识点</span></header>
            {masteries.length === 0 ? <EmptyState detail="完成练习或实验后，这里会显示对应知识点和证据次数。" title="尚无知识点证据" /> : (
              <ul className={styles.masteryList}>
                {masteries.map((record) => <MasteryRow key={record.knowledgePointId} now={now} record={record} />)}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="trend-title">
            <header><div><p>练习趋势</p><h3 id="trend-title">最近作答</h3></div><span>{attempts.length > 0 ? `样本 ${attempts.length}` : "暂无样本"}</span></header>
            {trend.length === 0 ? <EmptyState detail="提交客观练习后，趋势会按实际作答日期汇总。" title="暂无可计算趋势" /> : (
              <ol className={styles.trendList}>
                {trend.map((item) => <li key={item.day}><time>{formatDate(`${item.day}T00:00:00.000Z`)}</time><span>{item.passed} / {item.total} 达标</span><i aria-hidden="true"><b style={{ width: `${Math.round((item.passed / item.total) * 100)}%` }} /></i><small>样本 {item.total}</small></li>)}
              </ol>
            )}
          </section>

          <section className={styles.section} aria-labelledby="evidence-title">
            <header>
              <div><p>编程与实验</p><h3 id="evidence-title">Python 挑战与实验记录</h3></div>
              <div className={styles.sectionHeaderActions}>
                <span>{stageActivities.experimentEvidence.length} 条结构化实验</span>
                {nextLab ? <Link href={nextLab.activity.route}>{nextLab.status === "active" ? "继续挑战" : "开始挑战"}</Link> : null}
              </div>
            </header>
            {codeAttempts.length > 0 ? <div className={styles.challengeSummary}><strong>{codeAttempts.length} 次 Python 挑战记录</strong><span>每次运行结果均来自确定性测试，未用模型估算。</span></div> : null}
            {stageActivities.experimentEvidence.length === 0 ? <EmptyState detail="完成 Python 挑战并保存观察或结论后，会在这里出现可核对记录。" title="尚无实验记录" /> : (
              <ul className={styles.evidenceList}>
                {stageActivities.experimentEvidence.slice(-5).reverse().map((evidence) => {
                  const activity = getActivity(evidence.activityId);
                  return <li key={evidence.runId}>
                    <div><strong>{getCourseById(evidence.courseId)?.title ?? evidence.courseId}</strong><span>{activity ? activityKindLabel(activity) : evidence.mode} · {evidence.templateId}</span></div>
                    <p>{Object.entries(evidence.metrics).slice(0, 3).map(([key, value]) => `${key} ${value}`).join(" · ") || "已保存运行证据"}</p>
                    <small>{formatDate(evidence.completedAt)}{evidence.conclusion ? " · 已有结论" : " · 等待结论"}</small>
                    <Link href={activityRouteForEvidence(evidence, stage)}>打开实验记录</Link>
                  </li>;
                })}
              </ul>
            )}
            {codeAttempts.length > 0 ? <ul className={styles.challengeList} aria-label="Python 挑战记录">
              {codeAttempts.map((attempt) => {
                const route = activityRouteForAttempt(attempt, stage);
                const result = isPassed(attempt) ? "通过" : "继续改进";
                return <li key={attempt.attemptId}><span>{knowledgeLabel(attempt.knowledgePointId)}</span><small>{result} · {formatDate(attempt.completedAt)}</small>{route ? <Link href={route}>打开挑战</Link> : null}</li>;
              })}
            </ul> : null}
          </section>
        </div>

        <aside className={styles.sideColumn} aria-label="复习与下一步">
          <section className={styles.section} aria-labelledby="review-title">
            <header><div><p>到期复习</p><h3 id="review-title">需要回看的知识点</h3></div><CalendarClock aria-hidden="true" size={19} /></header>
            {dueReviews.length === 0 ? <p className={styles.quiet}>当前没有到期复习；后续会根据真实练习日期安排。</p> : <ul className={styles.simpleList}>{dueReviews.map((record) => <li key={record.knowledgePointId}><strong>{knowledgeLabel(record.knowledgePointId)}</strong><span>{record.nextReviewAt ? `${formatDate(record.nextReviewAt)} 到期` : "已到期"}</span></li>)}</ul>}
          </section>

          <section className={styles.section} aria-labelledby="misconception-title">
            <header><div><p>常见误区</p><h3 id="misconception-title">由错误证据形成</h3></div><Target aria-hidden="true" size={19} /></header>
            {misconceptionTags.length === 0 ? <p className={styles.quiet}>尚未形成需要补救的误区标签。</p> : <ul className={styles.tagList}>{misconceptionTags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
          </section>

          <section className={styles.section} aria-labelledby="interest-title">
            <header><div><p>主动选择</p><h3 id="interest-title">学习兴趣</h3></div><Lightbulb aria-hidden="true" size={19} /></header>
            {state.interests.length === 0 ? <p className={styles.quiet}>暂未选择兴趣偏好，课程推荐只依据学习路径和证据。</p> : <ul className={styles.tagList}>{state.interests.map((interest) => <li key={interest}>{INTEREST_OPTIONS.find((option) => option.id === interest)?.label ?? interest}</li>)}</ul>}
          </section>

          {stage === "high_school" ? <section className={styles.section} aria-labelledby="project-title">
            <header><div><p>项目作品</p><h3 id="project-title">研究项目入口</h3></div><FileText aria-hidden="true" size={19} /></header>
            <ul className={styles.projectList}>
              {projectItems.map(({ id, definition, hasEvidence, passed }) => <li key={id}>
                <div><strong>{definition.title}</strong><span>{hasEvidence ? (passed ? "证据完整" : "草稿已保存") : "未开始"}</span></div>
                <p>{hasEvidence ? "已记录项目内容，可继续补充证据。" : definition.summary}</p>
                <Link href={`/learn/project/${id}`}>{hasEvidence ? "打开项目工作台" : "开始项目"}</Link>
              </li>)}
            </ul>
            {projectItems.every((item) => !item.hasEvidence) ? <p className={styles.quiet}>尚未保存高中综合项目内容。</p> : null}
          </section> : null}

          <section className={styles.recommendation} aria-labelledby="next-title">
            <p>确定性推荐</p><h3 id="next-title">{recommendation?.activity.title ?? "本学段路径已完成"}</h3><span>{recommendation?.reason ?? "当前配置的任务均已形成完成记录。"}</span>
            {recommendation ? <Link href={recommendation.activity.route}>继续下一步 <ChartNoAxesColumnIncreasing aria-hidden="true" size={15} /></Link> : null}
          </section>
        </aside>
      </div>
    </section>
  );
}

function EvidenceSummary({ icon: Icon, label, value, detail }: { icon: typeof BookOpenCheck; label: string; value: string; detail: string }) {
  return <div className={styles.summaryItem}><Icon aria-hidden="true" size={20} /><div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></div>;
}

function EmptyState({ detail, title }: { detail: string; title: string }) {
  return <div className={styles.emptyState}><strong>{title}</strong><p>{detail}</p></div>;
}

function MasteryRow({ now, record }: { now: Date; record: MasteryRecord }) {
  const percent = Math.round(record.mastery * 100);
  const due = record.nextReviewAt !== null && Date.parse(record.nextReviewAt) <= now.getTime();
  return <li><div><strong>{knowledgeLabel(record.knowledgePointId)}</strong><span>{percent}%</span></div><div aria-label={`${knowledgeLabel(record.knowledgePointId)}掌握度 ${percent}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className={styles.masteryBar} role="progressbar"><i style={{ width: `${percent}%` }} /></div><p>{record.evidenceCount} 条证据 · {due ? "已到复习时间" : record.nextReviewAt ? `${formatDate(record.nextReviewAt)}复习` : "等待下一次证据"}</p></li>;
}
