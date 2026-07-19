import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PythonLab } from "@/features/lab/python-lab";
import type { LabTemplateId } from "@/features/lab/lab-protocol";
import type { Stage } from "@/lib/domain";
import styles from "./page.module.css";

interface LabPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const stages: readonly Stage[] = [
  "lower_primary",
  "upper_primary",
  "middle_school",
  "high_school",
];

const templates: readonly LabTemplateId[] = ["bubble-sort", "image-classifier"];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStage(value: string | undefined): Stage | undefined {
  return stages.find((stage) => stage === value);
}

function parseTemplate(value: string | undefined): LabTemplateId | undefined {
  return templates.find((template) => template === value);
}

function chooseMatchedTemplate(stage: Stage | undefined, familiarity: string | undefined): LabTemplateId {
  const normalizedFamiliarity = familiarity?.trim().toLowerCase();
  const isBeginner = ["beginner", "new", "starter", "zero", "none", "first_steps"].includes(normalizedFamiliarity ?? "");
  const isConfident = ["confident", "advanced", "independent", "experienced", "ready"].includes(normalizedFamiliarity ?? "");

  if (isBeginner) return "image-classifier";
  if (isConfident) return "bubble-sort";
  return stage === "middle_school" || stage === "high_school" ? "bubble-sort" : "image-classifier";
}

export default async function LabPage({ searchParams }: LabPageProps) {
  const query = await searchParams;
  const stage = parseStage(firstParam(query.stage));
  const templateId = parseTemplate(firstParam(query.template))
    ?? chooseMatchedTemplate(stage, firstParam(query.familiarity));

  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="实验室导航">
        <Link href="/preview">
          <ArrowLeft size={18} aria-hidden="true" />
          返回首页
        </Link>
        <span>Mambo AI 教室</span>
      </nav>
      <PythonLab initialStage={stage} initialTemplateId={templateId} />
    </main>
  );
}
