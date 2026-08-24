import { AppShell } from "@/components/app-shell";
import { LearningWorkspace } from "@/components/learning-workspace";
import { getCourseLessonForActivity, getStructuredCourse } from "@/data/course-structure";
import { getActivity, type LearningActivityKind } from "@/data/learning-paths";
import { LessonWorkspace } from "@/features/learning-hub/lesson-workspace";
import { LearningPlatformShell } from "@/features/learning-hub/learning-platform-shell";

interface WorkspacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getFirstCourseActivity(course: NonNullable<ReturnType<typeof getStructuredCourse>>) {
  for (const unit of course.units) {
    for (const lesson of unit.lessons) {
      const activityId = lesson.activityIds[0];
      const activity = activityId ? getActivity(activityId) : undefined;
      if (activity) return { activityId, activity, lesson };
    }
  }
  return undefined;
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const query = await searchParams;
  const requestedCourseId = firstParam(query.course);
  const structuredCourse = requestedCourseId
    ? getStructuredCourse(requestedCourseId)
    : undefined;
  const requestedTab = firstParam(query.tab);
  const activityKind: LearningActivityKind | undefined = requestedTab === "animation"
    ? "demonstration"
    : requestedTab === "exercise"
      ? "assessment"
      : undefined;
  const structuredActivity = activityKind
    ? structuredCourse?.units
      .flatMap((unit) => unit.lessons)
      .flatMap((lesson) => lesson.activityIds)
      .map((activityId) => ({
        activityId,
        activity: getActivity(activityId),
        lesson: getCourseLessonForActivity(activityId),
      }))
      .find(({ activity }) => activity?.kind === activityKind)
    : undefined;
  const legacyCourseEntry = structuredCourse ? getFirstCourseActivity(structuredCourse) : undefined;
  const selectedActivity = structuredActivity ?? legacyCourseEntry;

  // Keep old primary-school workspace links intact while moving middle/high
  // course bookmarks onto the structured learning platform.
  if (selectedActivity?.lesson) {
    return (
      <LearningPlatformShell initialStage={structuredCourse!.stage} initialView="path" hideContentHeader>
        <LessonWorkspace
          course={structuredCourse!}
          embedded
          initialActivityId={selectedActivity.activityId}
          lesson={selectedActivity.lesson}
        />
      </LearningPlatformShell>
    );
  }

  return (
    <AppShell>
      <LearningWorkspace
        requestedCourseId={requestedCourseId}
        initialCanvasTab={firstParam(query.tab)}
        initialStorybookId={firstParam(query.work)}
        initialMobileView={firstParam(query.view)}
      />
    </AppShell>
  );
}
