import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import { resolveLearningRoute } from "@/data/learning-route";
import { getStructuredCourse } from "@/data/course-structure";
import { CourseDetail } from "@/features/learning-hub/course-detail";
import { LearningPlatformShell } from "@/features/learning-hub/learning-platform-shell";

interface CourseDetailPageProps {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const [{ courseId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const route = resolveLearningRoute({
    page: "course",
    courseId,
    stage: firstParam(query.stage),
    grade: firstParam(query.grade),
    activityId: firstParam(query.activity),
    templateId: firstParam(query.template),
    mode: firstParam(query.mode),
  });
  if (route.kind === "redirect") redirect(route.canonicalPath);
  const course = getStructuredCourse(route.courseId ?? courseId);
  if (!course) notFound();

  return (
    <LearningPlatformShell initialStage={course.stage} initialGrade={route.grade} initialView="courses" hideContentHeader>
      <CourseDetail course={course} grade={route.grade} embedded />
    </LearningPlatformShell>
  );
}
