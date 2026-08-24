import Link from "next/link";
import { CheckCircle2, CircleDot, LockKeyhole } from "lucide-react";
import { useState } from "react";

import type { LearningPathStage } from "@/data/learning-paths";
import type { LearningGradeId } from "@/data/learning-grades";
import type { LearningState } from "@/lib/domain";
import { getStageActivityStatuses } from "@/features/progress/recommendation";
import {
  getCourseProgressSnapshots,
  getLearningActivityKindLabel,
  getLearningActivityStatusLabel,
  learningActivityHref,
} from "./learning-hub-data";
import styles from "./learning-platform-shell.module.css";

export function LearningPathTimeline({
  grade,
  stage,
  state,
}: {
  grade?: LearningGradeId;
  stage: LearningPathStage;
  state: LearningState;
}) {
  const activities = getStageActivityStatuses(state, stage, grade);
  const courses = getCourseProgressSnapshots(state, stage, grade);
  const statusByActivityId = new Map(
    activities.map((item) => [item.activity.id, item]),
  );
  const initiallyExpanded = courses.filter(
    (course) => course.status === "in_progress" || course.status === "available",
  );
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(
    () => new Set((initiallyExpanded.length > 0 ? initiallyExpanded : courses.slice(0, 1))
      .map((course) => course.course.id)),
  );

  function toggleCourse(courseId: string) {
    setExpandedCourseIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  return (
    <section className={styles.pathSection} aria-labelledby="path-timeline-title">
      <header className={styles.sectionHeading}>
        <div>
          <p>课程路线</p>
          <h2 id="path-timeline-title">按顺序完成学习任务</h2>
        </div>
        <span>{activities.length} 个任务</span>
      </header>

      <div className={styles.courseTimelineList}>
        {courses.map((course) => (
          <section className={styles.courseTimelineGroup} key={course.course.id}>
            <header className={styles.courseTimelineHeader}>
              <button
                aria-controls={`path-course-${course.course.id}`}
                aria-expanded={expandedCourseIds.has(course.course.id)}
                className={styles.courseTimelineToggle}
                onClick={() => toggleCourse(course.course.id)}
                type="button"
              >
                <div>
                <p>{course.completedCount} / {course.activities.length} 已完成</p>
                <h3>{course.course.title}</h3>
                </div>
                <span aria-hidden="true" className={styles.courseTimelineChevron}>⌄</span>
              </button>
              <span data-status={course.status}>{course.status === "in_progress" ? "进行中" : getCourseStatusLabel(course.status)}</span>
            </header>
            {expandedCourseIds.has(course.course.id) ? <ol className={styles.pathTimeline} id={`path-course-${course.course.id}`}>
              {course.activities.map((item) => {
                const activityStatus = statusByActivityId.get(item.activity.id) ?? item;
                const actionLabel = activityStatus.status === "completed"
                  ? "复习"
                  : activityStatus.status === "active"
                    ? "继续"
                    : "开始";
                const isActionable = activityStatus.status !== "locked";

                return (
                  <li data-status={activityStatus.status} key={activityStatus.activity.id}>
                    <span className={styles.pathNodeIcon} aria-hidden="true">
                      {activityStatus.status === "completed" ? <CheckCircle2 size={17} />
                        : activityStatus.status === "locked" ? <LockKeyhole size={16} />
                          : <CircleDot size={17} />}
                    </span>
                    <div className={styles.pathNodeBody}>
                      <div className={styles.pathNodeTitle}>
                        <strong>{activityStatus.activity.title}</strong>
                        <span>{getLearningActivityStatusLabel(activityStatus.status)}</span>
                      </div>
                      <p>{getLearningActivityKindLabel(activityStatus.activity.kind)}</p>
                      {activityStatus.status === "locked" ? (
                        <small>
                          需要先完成：{activityStatus.missingPrerequisites
                            .map((prerequisite) => prerequisite.title)
                            .join("、")}
                        </small>
                      ) : null}
                    </div>
                    {isActionable ? (
                      <Link href={learningActivityHref(activityStatus.activity, stage, grade)}>{actionLabel}</Link>
                    ) : null}
                  </li>
                );
              })}
            </ol> : null}
          </section>
        ))}
      </div>
    </section>
  );
}

function getCourseStatusLabel(status: "locked" | "available" | "completed"): string {
  const labels = {
    locked: "已锁定",
    available: "可开始",
    completed: "已完成",
  };
  return labels[status];
}
