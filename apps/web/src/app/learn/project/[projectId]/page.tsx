import { notFound, redirect } from "next/navigation";

import { resolveLearningRoute } from "@/data/learning-route";
import { ProjectWorkspace } from "@/features/projects/project-workspace";
import { getProjectDefinition } from "@/features/projects/project-schema";
import { LearningPlatformShell } from "@/features/learning-hub/learning-platform-shell";

interface LearnProjectPageProps {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LearnProjectPage({ params, searchParams }: LearnProjectPageProps) {
  const [{ projectId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const route = resolveLearningRoute({
    page: "project",
    projectId,
    stage: firstParam(query.stage),
    activityId: firstParam(query.activity),
    templateId: firstParam(query.template),
    mode: firstParam(query.mode),
  });
  if (route.kind === "redirect") redirect(route.canonicalPath);
  const definition = getProjectDefinition(route.projectId ?? projectId);
  if (!definition) notFound();
  return (
    <LearningPlatformShell initialStage="high_school" initialView="path" contentEyebrow={definition.eyebrow} contentTitle={definition.title}>
      <ProjectWorkspace projectId={definition.id} />
    </LearningPlatformShell>
  );
}
