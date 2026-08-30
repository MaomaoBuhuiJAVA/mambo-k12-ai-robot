import { redirect } from "next/navigation";

import { resolveLearningRoute } from "@/data/learning-route";
import { LearningPlatformShell, type LearningHubStage, type LearningHubView } from "@/features/learning-hub/learning-platform-shell";
import type { LearningGradeId } from "@/data/learning-grades";

interface LearnPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LearnPage({ searchParams }: LearnPageProps) {
  const query = await searchParams;
  const route = resolveLearningRoute({
    page: "hub",
    stage: firstParam(query.stage),
    grade: firstParam(query.grade),
    view: firstParam(query.view),
    courseId: firstParam(query.courseId ?? query.course),
    lessonId: firstParam(query.lessonId ?? query.lesson),
    activityId: firstParam(query.activityId ?? query.activity),
    practiceSetId: firstParam(query.practiceSetId ?? query.practice),
    projectId: firstParam(query.projectId ?? query.project),
    templateId: firstParam(query.templateId ?? query.template),
    mode: firstParam(query.mode),
  });

  if (route.kind === "redirect") redirect(route.canonicalPath);

  return (
    <LearningPlatformShell
      initialStage={route.stage as LearningHubStage | undefined}
      initialGrade={route.grade as LearningGradeId | undefined}
      initialView={route.view as LearningHubView}
    />
  );
}
