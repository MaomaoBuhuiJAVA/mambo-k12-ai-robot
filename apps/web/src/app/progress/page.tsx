import { redirect } from "next/navigation";
import { LearningPlatformShell } from "@/features/learning-hub/learning-platform-shell";
import type { LearningPathStage } from "@/data/learning-paths";

interface ProgressPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStage(value: string | undefined): LearningPathStage | undefined {
  return value === "middle_school" || value === "high_school"
    ? value
    : undefined;
}

export default async function ProgressPage({ searchParams }: ProgressPageProps) {
  const query = await searchParams;
  const stage = parseStage(firstParam(query.stage));
  if (stage) {
    return <LearningPlatformShell initialStage={stage} initialView="profile" />;
  }
  redirect("/learn?view=profile");
}
