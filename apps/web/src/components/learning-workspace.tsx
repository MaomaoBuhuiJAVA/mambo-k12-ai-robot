"use client";

import { useMemo, useState } from "react";

import {
  getCoursesForStage,
  getFeaturedCourses,
} from "@/data/curriculum";
import type { Stage } from "@/lib/domain";

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

export function LearningWorkspace() {
  const [stage, setStage] = useState<Stage>(DEFAULT_STAGE);
  const [selectedCourseId, setSelectedCourseId] = useState(() =>
    getDefaultCourseId(DEFAULT_STAGE),
  );
  const [mobileView, setMobileView] =
    useState<MobileView>("conversation");
  const courses = useMemo(() => getCoursesForStage(stage), [stage]);
  const course =
    courses.find((candidate) => candidate.id === selectedCourseId) ?? courses[0];

  function handleStageChange(nextStage: Stage) {
    setStage(nextStage);
    setSelectedCourseId(getDefaultCourseId(nextStage));
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
            onCourseSelect={setSelectedCourseId}
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
          <TeachingCanvas course={course} key={course.id} />
        </div>
      </div>

      <MobileViewSwitcher
        activeView={mobileView}
        onViewChange={setMobileView}
      />
    </main>
  );
}
