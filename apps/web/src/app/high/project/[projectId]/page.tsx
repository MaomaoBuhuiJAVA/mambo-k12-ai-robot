import { notFound, redirect } from "next/navigation";

import { resolveLegacyHighProject } from "@/data/learning-route";
import { ProjectWorkspace } from "@/features/projects/project-workspace";
import { getProjectDefinition } from "@/features/projects/project-schema";
import { LearningPlatformShell } from "@/features/learning-hub/learning-platform-shell";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const [{ projectId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const route = resolveLegacyHighProject(
    projectId,
    firstParam(query.stage),
    firstParam(query.activity),
    firstParam(query.template),
    firstParam(query.mode),
  );
  if (route.kind === "redirect") {
    if (route.reason === "invalid") notFound();
    redirect(route.canonicalPath);
  }
  // A legacy route is always redirected above. Keep this guard for the type
  // contract if Next's redirect implementation changes its return type.
  const definition = getProjectDefinition(route.projectId ?? projectId);
  if (!definition) notFound();
  return (
    <LearningPlatformShell initialStage="high_school" initialView="path" contentEyebrow={definition.eyebrow} contentTitle={definition.title}>
      <ProjectWorkspace projectId={definition.id} />
    </LearningPlatformShell>
  );
}
