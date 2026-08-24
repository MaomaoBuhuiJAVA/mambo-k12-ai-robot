"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, LockKeyhole } from "lucide-react";

import {
  getActivity,
  getLearningPath,
  isActivityUnlocked,
  type LearningActivity,
  type LearningPathStage,
} from "@/data/learning-paths";
import { getCourseById } from "@/data/curriculum";
import type { LearningState } from "@/lib/domain";
import { announceLearningStateChanged, LEARNING_STATE_CHANGED_EVENT } from "@/lib/learning-events";
import { createDefaultLearningState, loadLearningState, saveLearningState } from "@/lib/learning-store";
import { ImageClassificationDemo } from "@/features/image-classification/image-classification-demo";
import { DataBiasMetricsComparison } from "@/features/image-classification/data-bias-metrics-view";
import { ModelEvaluationExperiment } from "@/features/image-classification/model-evaluation-experiment-view";
import { NeuralSignalExperiment } from "@/features/image-classification/neural-signal-experiment-view";
import { AiSafetyScenarioView } from "@/features/ai-safety/ai-safety-scenario-view";
import { createProject } from "@/features/projects/project-schema";
import { loadProject } from "@/features/projects/project-store";
import { evaluateProject } from "@/features/projects/project-evaluator";
import {
  hasCompletedIndependentImageClassification,
  hasCompletedResearchImageClassificationChallenge,
  hasPassedLabAttempt,
} from "@/features/lab/lab-progress";
import styles from "./learning-sequence.module.css";

export interface CompletionCheck {
  met: boolean;
  requirement: string;
  requiresReviewConfirmation: boolean;
}

export function getNextIncompleteActivity(
  state: LearningState,
  stage: LearningPathStage,
): LearningActivity | null {
  const completed = state.stageProgressByStage[stage].completedActivityIds;
  return getLearningPath(stage).find((activity) =>
    !completed.includes(activity.id) && isActivityUnlocked(activity.id, completed),
  ) ?? null;
}

export function getCurrentLearningActivity(
  state: LearningState,
  stage: LearningPathStage,
): LearningActivity | null {
  const progress = state.stageProgressByStage[stage];
  const active = progress.activeActivityId
    ? getActivity(progress.activeActivityId)
    : undefined;
  if (
    active?.stage === stage &&
    !progress.completedActivityIds.includes(active.id) &&
    isActivityUnlocked(active.id, progress.completedActivityIds)
  ) return active;

  return getNextIncompleteActivity(state, stage);
}

function hasPassedCourseAssessment(
  state: LearningState,
  activity: LearningActivity,
): boolean {
  const course = getCourseById(activity.courseId);
  if (!course) return false;
  return course.knowledgePointTags.every((tag) =>
    state.attempts.some((attempt) =>
      attempt.knowledgePointId === `${course.id}:${tag}` && attempt.score === 1,
    ),
  );
}

function hasExperimentEvidence(
  state: LearningState,
  activity: LearningActivity,
): boolean {
  const projectFor = (id: "model-audit" | "capstone") => loadProject(id) ?? createProject(id);
  const availableEvidenceIds = new Set(
    state.stageProgressByStage.high_school.experimentEvidence.map((evidence) => evidence.runId),
  );
  if (activity.id === "high-image-model-audit-project") {
    return evaluateProject(projectFor("model-audit"), availableEvidenceIds).passed;
  }
  if (activity.id === "high-image-model-audit-defense") {
    const project = projectFor("model-audit");
    return evaluateProject(project, availableEvidenceIds).passed
      && project.defenseAnswers.filter((answer) => answer.trim().length >= 8).length >= 3;
  }
  if (activity.id === "high-capstone-project") return evaluateProject(projectFor("capstone"), availableEvidenceIds).passed;
  if (activity.id === "high-capstone-defense") {
    const project = projectFor("capstone");
    return evaluateProject(project, availableEvidenceIds).passed && project.defenseAnswers.filter((answer) => answer.trim().length >= 8).length >= 3;
  }
  if (activity.id === "middle-neural-signals-independent-lab") {
    return hasCompletedIndependentImageClassification(state);
  }
  if (activity.id === "middle-data-bias-research") {
    return hasCompletedResearchImageClassificationChallenge(state);
  }
  if (activity.labTemplateId) {
    return hasPassedLabAttempt(state, activity.labTemplateId);
  }
  return state.stageProgressByStage[activity.stage].experimentEvidence.some(
    (evidence) => evidence.activityId === activity.id,
  );
}

export function checkCompletionPolicy(
  state: LearningState,
  activity: LearningActivity,
  reviewConfirmed: boolean,
): CompletionCheck {
  switch (activity.completionPolicyId) {
    case "lesson-reviewed":
      return {
        met: reviewConfirmed,
        requirement: "阅读课程讲解、核心概念和材料后，确认自己能够说明本节目标。",
        requiresReviewConfirmation: true,
      };
    case "demonstration-reviewed":
      return {
        met: reviewConfirmed,
        requirement: "查看演示步骤后，确认自己能够说明数据如何在本节活动中变化。",
        requiresReviewConfirmation: true,
      };
    case "assessment-passed": {
      const met = hasPassedCourseAssessment(state, activity);
      return {
        met,
        requirement: met
          ? "课程全部知识点评价已有正确作答记录。"
          : "完成本课程练习，并让每个知识点至少形成一条正确作答记录。",
        requiresReviewConfirmation: false,
      };
    }
    case "lab-evidence":
    case "research-evidence":
    case "project-evidence":
    case "defense-evidence": {
      const met = hasExperimentEvidence(state, activity);
      return {
        met,
        requirement: met
          ? "本活动已有结构化实验或项目证据。"
          : "完成实验并保存结构化变量、指标和结论证据后才能继续。",
        requiresReviewConfirmation: false,
      };
    }
  }
}

export function setCurrentLearningActivity(
  state: LearningState,
  stage: LearningPathStage,
  activityId: string | null,
  updatedAt: string,
): LearningState {
  const activity = activityId ? getActivity(activityId) : undefined;
  const completed = state.stageProgressByStage[stage].completedActivityIds;
  if (
    activityId !== null &&
    (!activity || activity.stage !== stage || completed.includes(activityId) || !isActivityUnlocked(activityId, completed))
  ) return state;

  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      [stage]: {
        ...state.stageProgressByStage[stage],
        activeActivityId: activityId,
      },
    },
    updatedAt,
  };
}

export function completeCurrentLearningActivity(
  state: LearningState,
  activityId: string,
  reviewConfirmed: boolean,
  updatedAt: string,
): LearningState {
  const activity = getActivity(activityId);
  if (!activity) return state;

  const progress = state.stageProgressByStage[activity.stage];
  if (
    progress.completedActivityIds.includes(activity.id) ||
    !isActivityUnlocked(activity.id, progress.completedActivityIds) ||
    !checkCompletionPolicy(state, activity, reviewConfirmed).met
  ) return state;

  const completedActivityIds = [...progress.completedActivityIds, activity.id];
  const next = getLearningPath(activity.stage).find((candidate) =>
    !completedActivityIds.includes(candidate.id) &&
    isActivityUnlocked(candidate.id, completedActivityIds),
  );
  return {
    ...state,
    stageProgressByStage: {
      ...state.stageProgressByStage,
      [activity.stage]: {
        ...progress,
        completedActivityIds,
        activeActivityId: next?.id ?? null,
      },
    },
    updatedAt,
  };
}

export function LearningSequence({ stage }: { stage: LearningPathStage }) {
  const [state, setState] = useState<LearningState>(() => createDefaultLearningState());
  const [reviewedActivityId, setReviewedActivityId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const currentActivity = getCurrentLearningActivity(state, stage);
  const reviewConfirmed = reviewedActivityId === currentActivity?.id;
  const completion = useMemo(
    () => currentActivity
      ? checkCompletionPolicy(state, currentActivity, reviewConfirmed)
      : null,
    [currentActivity, reviewConfirmed, state],
  );
  const completedCount = state.stageProgressByStage[stage].completedActivityIds.length;
  const activityCount = getLearningPath(stage).length;

  useEffect(() => {
    const refresh = () => {
      const loaded = loadLearningState();
      const current = getCurrentLearningActivity(loaded, stage);
      if (loaded.stageProgressByStage[stage].activeActivityId || !current) {
        setState(loaded);
        return;
      }
      const next = setCurrentLearningActivity(
        loaded,
        stage,
        current.id,
        new Date().toISOString(),
      );
      if (next !== loaded && saveLearningState(next)) {
        setState(next);
        announceLearningStateChanged();
        return;
      }
      setState(loaded);
    };
    refresh();
    window.addEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LEARNING_STATE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [stage]);

  function continueToNextActivity() {
    if (!currentActivity) return;
    const next = completeCurrentLearningActivity(
      state,
      currentActivity.id,
      reviewConfirmed,
      new Date().toISOString(),
    );
    if (next === state) {
      setNotice("当前完成要求尚未满足，暂时不能继续。");
      return;
    }
    if (!saveLearningState(next)) {
      setNotice("步骤已在当前页面完成，但本机学习记录未能保存。请检查浏览器存储权限后重试。");
      return;
    }
    setState(next);
    setNotice("当前步骤已完成，已切换到下一步。");
    announceLearningStateChanged();
  }

  if (!currentActivity || !completion) {
    return (
      <section className={styles.sequence} aria-labelledby="learning-sequence-title">
        <header className={styles.header}>
          <div><span>阶段学习序列</span><h2 id="learning-sequence-title">本学段任务已完成</h2></div>
          <strong>{completedCount} / {activityCount}</strong>
        </header>
        <p className={styles.completedMessage}>当前已配置的学习步骤均已形成完成记录。</p>
      </section>
    );
  }

  const course = getCourseById(currentActivity.courseId);
  const nextActivity = getLearningPath(stage).find((activity) =>
    activity.prerequisites.includes(currentActivity.id),
  );

  return (
    <section className={styles.sequence} aria-labelledby="learning-sequence-title">
      <header className={styles.header}>
        <div><span>阶段学习序列</span><h2 id="learning-sequence-title">当前步骤</h2></div>
        <strong>{completedCount} / {activityCount}</strong>
      </header>
      <div className={styles.currentStep}>
        <span className={styles.stepMarker} aria-hidden="true"><CircleDot size={18} /></span>
        <div>
          <p className={styles.stepLabel}>{currentActivity.kind.replaceAll("_", " ")}</p>
          <h3>{currentActivity.title}</h3>
          <p>{course?.objectives[0] ?? "完成当前活动并形成可核对的学习证据。"}</p>
        </div>
      </div>
      <dl className={styles.details}>
        <div><dt>完成要求</dt><dd>{completion.requirement}</dd></div>
        <div><dt>下一步</dt><dd>{nextActivity ? nextActivity.title : "完成后将结束当前学段已配置路径。"}</dd></div>
      </dl>
      {currentActivity.id === "middle-ai-foundations-demonstration" ? <ImageClassificationDemo /> : null}
      {currentActivity.id === "middle-neural-signals-demonstration" ? <NeuralSignalExperiment /> : null}
      {currentActivity.id === "middle-model-evaluation-demonstration" ? <ModelEvaluationExperiment /> : null}
      {currentActivity.id === "middle-data-bias-demonstration" ? <DataBiasMetricsComparison /> : null}
      {currentActivity.id === "middle-ai-safety-demonstration" ? <AiSafetyScenarioView /> : null}
      {completion.requiresReviewConfirmation ? (
        <label className={styles.confirmation}>
          <input
            type="checkbox"
            checked={reviewConfirmed}
            onChange={(event) => setReviewedActivityId(
              event.target.checked ? currentActivity.id : null,
            )}
          />
          <span>我已完成本步骤的阅读或演示观察，并能说明本节目标。</span>
        </label>
      ) : null}
      <div className={styles.actions}>
        <Link href={currentActivity.route}>前往完成当前步骤 <ArrowRight size={16} aria-hidden="true" /></Link>
        <button type="button" disabled={!completion.met} onClick={continueToNextActivity}>
          <CheckCircle2 size={16} aria-hidden="true" />
          继续到下一步
        </button>
      </div>
      {!completion.met && !completion.requiresReviewConfirmation ? (
        <p className={styles.locked}><LockKeyhole size={15} aria-hidden="true" /> 完成要求未满足，后续活动保持锁定。</p>
      ) : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    </section>
  );
}
