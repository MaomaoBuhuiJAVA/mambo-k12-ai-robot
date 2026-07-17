"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getCoursesForStage,
  getCourseById,
  getFeaturedCourses,
} from "@/data/curriculum";
import type { Stage } from "@/lib/domain";
import { announceLearningStateChanged } from "@/lib/learning-events";
import { loadLearningState, saveLearningState } from "@/lib/learning-store";

import { ConversationClassroom } from "./conversation-classroom";
import { CourseRail } from "./course-rail";
import {
  MobileViewSwitcher,
  type MobileView,
} from "./mobile-view-switcher";
import { StageSwitcher } from "./stage-switcher";
import { TeachingCanvas } from "./teaching-canvas";

const DEFAULT_STAGE: Stage = "lower_primary";

function getDefaultCourseId(stage: Stage) {
  const defaultCourse =
    getFeaturedCourses(stage)[0] ?? getCoursesForStage(stage)[0];

  if (defaultCourse === undefined) {
    throw new Error(`No curriculum course found for stage: ${stage}`);
  }

  return defaultCourse.id;
}

function persistLearningSelection(nextStage: Stage, courseId: string) {
  const current = loadLearningState();
  const updatedAt = new Date().toISOString();
  if (saveLearningState({
    ...current,
    profile: { ...current.profile, stage: nextStage },
    lastCourseId: courseId,
    updatedAt,
  })) announceLearningStateChanged();
}

interface LearningWorkspaceProps {
  requestedCourseId?: string;
  initialCanvasTab?: string;
  initialStorybookId?: string;
}

export function LearningWorkspace({
  requestedCourseId,
  initialCanvasTab,
  initialStorybookId,
}: LearningWorkspaceProps = {}) {
  const requestedCourse = requestedCourseId ? getCourseById(requestedCourseId) : undefined;
  const initialStage = requestedCourse?.stage ?? DEFAULT_STAGE;
  const [stage, setStage] = useState<Stage>(initialStage);
  const [selectedCourseId, setSelectedCourseId] = useState(() =>
    requestedCourse?.id ?? getDefaultCourseId(initialStage),
  );
  const [mobileView, setMobileView] =
    useState<MobileView>("conversation");
  const courses = useMemo(() => getCoursesForStage(stage), [stage]);
  const course =
    courses.find((candidate) => candidate.id === selectedCourseId) ?? courses[0];

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const saved = loadLearningState();
      const requested = requestedCourseId ? getCourseById(requestedCourseId) : undefined;
      const savedCourse = saved.lastCourseId ? getCourseById(saved.lastCourseId) : undefined;
      const initialCourse = requested ?? (savedCourse?.stage === saved.profile.stage ? savedCourse : undefined);
      const initialStage = initialCourse?.stage ?? saved.profile.stage;
      setStage(initialStage);
      setSelectedCourseId(initialCourse?.id ?? getDefaultCourseId(initialStage));
      if (requested) persistLearningSelection(requested.stage, requested.id);
    });
    return () => { active = false; };
  }, [requestedCourseId]);

  function handleStageChange(nextStage: Stage) {
    const nextCourseId = getDefaultCourseId(nextStage);
    setStage(nextStage);
    setSelectedCourseId(nextCourseId);
    persistLearningSelection(nextStage, nextCourseId);
  }

  function handleCourseSelect(courseId: string) {
    const selected = courses.find((candidate) => candidate.id === courseId);
    if (!selected) return;
    setSelectedCourseId(courseId);
    persistLearningSelection(stage, courseId);
  }

  if (course === undefined) {
    return null;
  }

  return (
    <main className="learning-workspace" id="workspace">
      <div className="workspace-toolbar">
        <StageSwitcher
          selectedStage={stage}
          onStageChange={handleStageChange}
        />
      </div>

      <div className="workspace-grid">
        <div
          className="workspace-panel workspace-panel--path"
          data-mobile-active={mobileView === "path"}
        >
          <CourseRail
            stage={stage}
            courses={courses}
            selectedCourseId={course.id}
            onCourseSelect={handleCourseSelect}
          />
        </div>

        <div
          className="workspace-panel workspace-panel--conversation"
          data-mobile-active={mobileView === "conversation"}
        >
          <ConversationClassroom course={course} stage={stage} key={course.id} />
        </div>

        <div
          className="workspace-panel workspace-panel--content"
          data-mobile-active={mobileView === "content"}
        >
          <TeachingCanvas
            course={course}
            initialTab={initialCanvasTab}
            initialStorybookId={initialStorybookId}
            key={course.id}
          />
        </div>
      </div>

      <MobileViewSwitcher
        activeView={mobileView}
        onViewChange={setMobileView}
      />
    </main>
  );
}
