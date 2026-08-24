import { notFound, redirect } from "next/navigation";

import { resolveLearningRoute } from "@/data/learning-route";
import { createDefaultLearningState } from "@/lib/learning-store";
import { getPracticeSet, isKnownPracticeSetId } from "@/features/learning-hub/practice-data";
import { PracticeSession } from "@/features/learning-hub/practice-session";
import { LearningPlatformShell } from "@/features/learning-hub/learning-platform-shell";

interface PracticePageProps {
  params: Promise<{ practiceSetId: string }>;
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

export default async function PracticePage({ params, searchParams }: PracticePageProps) {
  const [{ practiceSetId }, query] = await Promise.all([params, searchParams]);
  const decodedPracticeSetId = decodeRouteSegment(practiceSetId);
  const route = resolveLearningRoute({
    page: "practice",
    stage: firstParam(query.stage),
    grade: firstParam(query.grade),
    practiceSetId: decodedPracticeSetId,
    remediationActivityId: firstParam(query.remediation),
    templateId: firstParam(query.template),
    mode: firstParam(query.mode),
  });
  if (route.kind === "redirect") redirect(route.canonicalPath);
  const stage = route.stage;
  const remediationActivityId = route.activityId;
  if (!stage || !route.practiceSetId || !isKnownPracticeSetId(stage, route.practiceSetId)) notFound();
  const initialPracticeSet = getPracticeSet(
    stage,
    route.practiceSetId,
    createDefaultLearningState(),
    new Date(),
    remediationActivityId,
    route.grade,
  );
  if (!initialPracticeSet) notFound();

  return (
    <LearningPlatformShell initialGrade={route.grade} initialStage={stage} initialView="practice" hideContentHeader>
      <PracticeSession
        embedded
        initialPracticeSet={initialPracticeSet}
    key={`${stage}:${route.practiceSetId}`}
    practiceSetId={route.practiceSetId}
        stage={stage}
        remediationActivityId={remediationActivityId}
        grade={route.grade}
      />
    </LearningPlatformShell>
  );
}
