"use client";

import { useState } from "react";
import { Download, FileText, Presentation, Video } from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";

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
        <p role="status">{status}</p>
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
    </section>
  );
}
