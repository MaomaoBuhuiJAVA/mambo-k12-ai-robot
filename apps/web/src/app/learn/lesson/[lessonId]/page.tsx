import { notFound, redirect } from "next/navigation";

import { resolveLearningRoute } from "@/data/learning-route";
import { getCourseLesson, getStructuredCourse } from "@/data/course-structure";
import { LessonWorkspace } from "@/features/learning-hub/lesson-workspace";
import { LearningPlatformShell } from "@/features/learning-hub/learning-platform-shell";

interface LessonWorkspacePageProps {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function LessonWorkspacePage({
  params,
  searchParams,
}: LessonWorkspacePageProps) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  // Turbopack forwards encoded path separators in this dynamic segment.
  const decodedLessonId = decodeRouteSegment(lessonId);
  const route = resolveLearningRoute({
    page: "lesson",
    stage: firstParam(query.stage),
    grade: firstParam(query.grade),
    lessonId: decodedLessonId,
    activityId: firstParam(query.activity),
    templateId: firstParam(query.template),
    mode: firstParam(query.mode),
  });
  if (route.kind === "redirect") redirect(route.canonicalPath);
  const lesson = getCourseLesson(route.lessonId ?? decodedLessonId);
  const course = lesson ? getStructuredCourse(lesson.courseId) : undefined;
  if (!lesson || !course) notFound();

  return (
    <LearningPlatformShell initialStage={course.stage} initialGrade={route.grade} initialView="path" hideContentHeader>
      <LessonWorkspace
        course={course}
        grade={route.grade}
        initialActivityId={route.activityId}
        lesson={lesson}
        embedded
      />
    </LearningPlatformShell>
  );
}
