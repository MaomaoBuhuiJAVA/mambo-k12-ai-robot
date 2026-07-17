import { z } from "zod";

import type { CurriculumCourse } from "@/data/curriculum";

const safeText = (minimum: number, maximum: number) => z.string()
  .trim()
  .min(minimum)
  .max(maximum)
  .refine((value) => !/<\/?[a-z][^>]*>|javascript:|data:text\/html/i.test(value), "Markup and executable URLs are not allowed")
  .refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value), "Control characters are not allowed");

export const interactiveQuestionSchema = z.object({
  prompt: safeText(2, 120),
  options: z.array(safeText(1, 80)).min(2).max(4),
  answer: safeText(1, 80),
  correctFeedback: safeText(2, 140),
  incorrectFeedback: safeText(2, 140),
}).strict().superRefine((question, context) => {
  if (!question.options.includes(question.answer)) {
    context.addIssue({ code: "custom", path: ["answer"], message: "Answer must match an option" });
  }
  if (new Set(question.options).size !== question.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Options must be unique" });
  }
});

export const storybookPageSchema = z.object({
  title: safeText(1, 80),
  narration: safeText(2, 320),
  scene: safeText(2, 400),
  interactiveQuestion: interactiveQuestionSchema,
}).strict();

export const storybookSchema = z.object({
  title: safeText(1, 100),
  summary: safeText(2, 240),
  pages: z.array(storybookPageSchema).min(4).max(8),
}).strict();

export type Storybook = z.infer<typeof storybookSchema>;

const OBSERVE_OPTIONS = ["先观察当前状态", "跳过观察直接猜"];

export function createSeedStorybook(course: CurriculumCourse): Storybook {
  return storybookSchema.parse({
    title: `${course.title}探险记`,
    summary: `跟随故事角色，用${course.ageAdaptation.language}认识${course.knowledgePointTags.join("、")}。`,
    pages: course.storybook.map((page, index) => ({
      title: page.title,
      narration: `${page.narration} ${index === course.storybook.length - 1 ? course.explanation.workedExample : ""}`.trim(),
      scene: page.scene,
      interactiveQuestion: {
        prompt: page.interaction,
        options: OBSERVE_OPTIONS,
        answer: OBSERVE_OPTIONS[0],
        correctFeedback: "正确，先找证据再回答，才能说明这一步为什么发生。",
        incorrectFeedback: `再想一想：先观察“${course.knowledgePointTags[index % course.knowledgePointTags.length]}”发生了什么。`,
      },
    })),
  });
}

export function buildStorybookPrompt(course: CurriculumCourse): string {
  return [
    `课程：${course.title}`,
    `学段表达要求：${course.ageAdaptation.language}`,
    `学习目标：${course.objectives.join("；")}`,
    `核心概念：${course.explanation.keyIdeas.join("；")}`,
    `事实讲解：${course.explanation.overview}`,
    `参考情节（仅作课程事实与顺序依据）：${course.storybook.map((page) => page.narration).join("；")}`,
    "生成 4 至 8 页完整绘本。每页只讲一个可观察动作，并用一个 2 至 4 选项的问题检查理解。",
  ].join("\n");
}
