import { z } from "zod";

import { getCourseById, type CurriculumCourse, type ReadonlyCurriculumCourse } from "@/data/curriculum";
import { getKnowledgeContextForCourse } from "@/data/knowledge-sources";
import { readBoundedJson } from "@/lib/bounded-json";
import type { LearningMode } from "@/lib/domain";
import { getStagePolicy } from "@/lib/stage-policy";

const MAX_REQUEST_BYTES = 8 * 1024;

const materialRequestSchema = z.object({
  courseId: z.string().min(1).max(80),
  stage: z.enum(["lower_primary", "upper_primary", "middle_school", "high_school"]),
}).strict();

export interface LessonDocumentSpec {
  title: string;
  stageLabel: string;
  learningObjectives: string[];
  explanation: string[];
  activity: string;
  animationSteps: string[];
  quiz: Array<{ prompt: string }>;
  summary: string;
  sources: Array<{ label: string; url: string }>;
}

const STAGE_LABELS = {
  lower_primary: "小学低年级",
  upper_primary: "小学高年级",
  middle_school: "初中",
  high_school: "高中",
} as const;

const MODE_LABELS: Record<LearningMode, string> = {
  voice: "语音复述",
  storybook: "互动绘本",
  game: "游戏练习",
  diagram: "图示观察",
  quiz: "随堂测验",
  code: "代码实践",
  project: "项目探究",
};

export async function parseMaterialRequest(request: Request): Promise<CurriculumCourse | null> {
  try {
    const parsed = materialRequestSchema.safeParse(await readBoundedJson(request, MAX_REQUEST_BYTES));
    if (!parsed.success) return null;
    const course = getCourseById(parsed.data.courseId);
    return course?.stage === parsed.data.stage ? course : null;
  } catch {
    return null;
  }
}

export function buildLessonDocument(course: ReadonlyCurriculumCourse): LessonDocumentSpec {
  const policy = getStagePolicy(course.stage);
  const knowledge = getKnowledgeContextForCourse(course.id);
  return {
    title: `${course.title}学习讲义`,
    stageLabel: STAGE_LABELS[course.stage],
    learningObjectives: [...course.objectives],
    explanation: [course.explanation.overview, ...course.explanation.keyIdeas, course.explanation.workedExample],
    activity: course.ageAdaptation.activity,
    animationSteps: course.animation.steps.map((step) => step.narration),
    quiz: course.exercises.map((exercise) => ({ prompt: exercise.prompt })),
    summary: `本课围绕${course.knowledgePointTags.join("、")}展开。建议用“${MODE_LABELS[policy.preferredModes[0]]}”方式复习，并能用自己的话说明每一步的依据。`,
    sources: knowledge?.sources.map((source, index) => ({
      label: `[${index + 1}] ${source.publisher}《${source.title}》`,
      url: source.url,
    })) ?? [],
  };
}

export function downloadHeaders(course: ReadonlyCurriculumCourse, extension: "docx" | "pptx", mime: string) {
  const chineseName = `${course.title}-${STAGE_LABELS[course.stage]}学习材料.${extension}`;
  return {
    "Cache-Control": "no-store",
    "Content-Type": mime,
    "Content-Disposition": `attachment; filename="mambo-learning-material.${extension}"; filename*=UTF-8''${encodeURIComponent(chineseName)}`,
    "X-Content-Type-Options": "nosniff",
  };
}

export const invalidMaterialResponse = () => Response.json(
  { error: "INVALID_MATERIAL_REQUEST" },
  { status: 400, headers: { "Cache-Control": "no-store" } },
);
