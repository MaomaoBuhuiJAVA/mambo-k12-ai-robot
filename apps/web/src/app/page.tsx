import { AppShell } from "@/components/app-shell";
import { LearningWorkspace } from "@/components/learning-workspace";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  return (
    <AppShell>
      <LearningWorkspace
        requestedCourseId={firstParam(query.course)}
        initialCanvasTab={firstParam(query.tab)}
        initialStorybookId={firstParam(query.work)}
      />
    </AppShell>
  );
}
