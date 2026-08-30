"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileText, Presentation, Video } from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";
import { StarbaoSprite } from "@/components/starbao/starbao-sprite";
import { practiceSetIdForCourse } from "@/features/learning-hub/practice-data";
import { getHighSchoolRemediationForCourse } from "@/features/quiz/high-school-remediation";

import { KnowledgeEvidence } from "./knowledge-evidence";
import { getCourseLibraryContent } from "@/data/course-library-content";
import styles from "./resource-library.module.css";

type Format = "docx" | "pptx";

function fallbackName(course: CurriculumCourse, format: Format) {
  return `${course.title}-学习材料.${format}`;
}

async function downloadMaterial(course: CurriculumCourse, format: Format) {
  const response = await fetch(`/api/materials/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId: course.id, stage: course.stage }),
  });
  if (!response.ok) throw new Error("Material generation failed");
  const blob = await response.blob();
  const encodedName = response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const name = encodedName ? decodeURIComponent(encodedName) : fallbackName(course, format);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function ResourceLibrary({ course }: { course: CurriculumCourse }) {
  const [activeDownload, setActiveDownload] = useState<Format | null>(null);
  const [status, setStatus] = useState("可生成适配当前学段的讲义与课件");
  const libraryContent = getCourseLibraryContent(course.id);
  const remediation = course.stage === "high_school" ? getHighSchoolRemediationForCourse(course.id) : undefined;

  async function startDownload(format: Format) {
    setActiveDownload(format);
    setStatus(format === "docx" ? "正在生成 Word 讲义..." : "正在生成 PowerPoint 课件...");
    try {
      await downloadMaterial(course, format);
      setStatus("材料已生成并开始下载");
    } catch {
      setStatus("材料暂时无法生成，请稍后重试");
    } finally {
      setActiveDownload(null);
    }
  }

  return (
    <section className={styles.library} aria-label="课程资源库">
      <header>
        <div><span>学习资源</span><h3>{course.title}材料库</h3></div>
        <div className={styles.headerStatus}>
          {activeDownload === "pptx" ? <StarbaoSprite mood="drawing" className={styles.generationMascot} /> : null}
          <p role="status">{status}</p>
        </div>
      </header>
      <div className={styles.downloads}>
        <button type="button" aria-label="下载 Word 讲义" onClick={() => startDownload("docx")} disabled={activeDownload !== null}>
          <FileText size={18} /><span><strong>下载 Word 讲义</strong><small>目标、讲解、活动与测验</small></span><Download size={16} />
        </button>
        <button type="button" aria-label="下载 PowerPoint 课件" onClick={() => startDownload("pptx")} disabled={activeDownload !== null}>
          <Presentation size={18} /><span><strong>下载 PowerPoint 课件</strong><small>概念、动画步骤、练习与总结</small></span><Download size={16} />
        </button>
      </div>
      <div className={styles.recommendations}>
        <h4><Video size={16} />课堂演示建议</h4>
        <p>把本课动画步骤录成 3–5 分钟短讲解，暂停在每个检查点让学生先预测再验证。</p>
        <ul>{course.materials.map((material) => <li key={material.name}><strong>{material.name}</strong><span>{material.purpose}</span></li>)}</ul>
      </div>
      {libraryContent ? <>
        <section className={styles.glossary} aria-labelledby="library-terms-title">
          <h4 id="library-terms-title">本课术语 <small>资料版本 {libraryContent.version}</small></h4>
          <dl>{libraryContent.terms.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>)}</dl>
        </section>
        <section className={styles.failureCases} aria-labelledby="library-failure-title">
          <h4 id="library-failure-title">失败案例与补救</h4>
          {libraryContent.failureCases.map((item) => <article key={item.title}><strong>{item.title}</strong><p><b>观察：</b>{item.observation}</p><p><b>下一步：</b>{item.nextStep}</p></article>)}
        </section>
      </> : null}
      {course.stage === "middle_school" || course.stage === "high_school" ? (
        <div className={styles.remediationAction}>
          <div>
            <strong>需要再练一次？</strong>
            <span>从本课题目开始补救，错误记录会保留并形成新的证据。</span>
          </div>
          <Link href={remediation?.route ?? `/learn/practice/${practiceSetIdForCourse(course.id)}?stage=${course.stage}`}>
            进入本课补救练习
          </Link>
        </div>
      ) : null}
      <KnowledgeEvidence courseId={course.id} variant="sources" />
    </section>
  );
}
