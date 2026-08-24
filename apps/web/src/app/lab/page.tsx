import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PythonLab } from "@/features/lab/python-lab";
import { LearningPlatformShell } from "@/features/learning-hub/learning-platform-shell";
import { resolveLabRoute } from "@/features/lab/lab-route";
import styles from "./page.module.css";

interface LabPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LabPage({ searchParams }: LabPageProps) {
  const query = await searchParams;
  const route = resolveLabRoute({
    stage: firstParam(query.stage),
    templateId: firstParam(query.template),
    mode: firstParam(query.mode),
    familiarity: firstParam(query.familiarity),
    activityId: firstParam(query.activityId),
    projectId: firstParam(query.projectId),
  });

  if (route.kind === "redirect") redirect(route.canonicalPath);

  const { stage, mode, templateId } = route;

  if (stage === "middle_school" || stage === "high_school") {
    return (
      <LearningPlatformShell
        contentEyebrow={`${stage === "middle_school" ? "初中" : "高中"} / 课程实验`}
        contentTitle="Python 编程实验室"
        hideContentHeader
        initialStage={stage}
        initialView="courses"
      >
        <PythonLab embedded initialMode={mode} initialStage={stage} initialTemplateId={templateId} />
      </LearningPlatformShell>
    );
  }

  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="实验室导航">
        <Link href="/preview">
          <ArrowLeft size={18} aria-hidden="true" />
          返回首页
        </Link>
        <span>Mambo AI 教室</span>
      </nav>
      <PythonLab initialMode={mode} initialStage={stage} initialTemplateId={templateId} />
    </main>
  );
}
