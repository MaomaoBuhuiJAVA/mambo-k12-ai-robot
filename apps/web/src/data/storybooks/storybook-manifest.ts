import { z } from "zod";

const safeText = (minimum: number, maximum: number) => z.string()
  .trim()
  .min(minimum)
  .max(maximum)
  .refine((value) => !/<\/?[a-z][^>]*>|javascript:|data:text\/html/i.test(value), "Markup and executable URLs are not allowed")
  .refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value), "Control characters are not allowed");

export const storybookSpeakerSchema = z.enum([
  "narrator",
  "starbao",
  "guardian",
  "teacher",
  "ai_sprite",
  "system",
]);

export const storybookDialogueAnchorSchema = z.enum([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "top-center",
  "near-top-left",
  "near-top-right",
  "upper-right",
  "middle-left",
  "middle-right",
]);

export const storybookQuestionSchema = z.object({
  prompt: safeText(2, 180),
  options: z.array(safeText(1, 100)).min(2).max(4),
  answer: safeText(1, 100),
  correctFeedback: safeText(2, 220),
  incorrectFeedback: safeText(2, 220),
}).strict().superRefine((question, context) => {
  if (!question.options.includes(question.answer)) {
    context.addIssue({ code: "custom", path: ["answer"], message: "Answer must match an option" });
  }
  if (new Set(question.options).size !== question.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Options must be unique" });
  }
});

export const storybookDialogueCueSchema = z.object({
  id: safeText(1, 80),
  speaker: storybookSpeakerSchema,
  text: safeText(1, 360),
  stageDirection: safeText(1, 180).optional(),
  order: z.number().int().min(1).max(12),
  displayMode: z.enum(["caption", "bubble"]),
  anchor: storybookDialogueAnchorSchema.optional(),
}).strict();

export const storybookPageManifestSchema = z.object({
  pageNumber: z.number().int().min(1).max(40),
  title: safeText(1, 100),
  image: z.object({
    src: z.string().regex(/^\/assets\/storybooks\/[a-z0-9-]+\/page-\d{2}\.(?:png|jpeg)$/),
    alt: safeText(8, 260),
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
  }).strict(),
  narration: safeText(2, 900),
  dialogue: z.array(storybookDialogueCueSchema).max(8),
  question: storybookQuestionSchema.optional(),
}).strict().superRefine((page, context) => {
  const dialogueIds = new Set<string>();
  const dialogueOrders = new Set<number>();
  for (const cue of page.dialogue) {
    if (dialogueIds.has(cue.id)) {
      context.addIssue({ code: "custom", path: ["dialogue"], message: "Dialogue IDs must be unique per page" });
    }
    if (dialogueOrders.has(cue.order)) {
      context.addIssue({ code: "custom", path: ["dialogue"], message: "Dialogue orders must be unique per page" });
    }
    dialogueIds.add(cue.id);
    dialogueOrders.add(cue.order);
  }
});

export const importedStorybookManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: safeText(3, 100),
  moduleId: safeText(3, 100),
  lessonNumber: z.number().int().min(1).max(99),
  stage: z.enum(["lower_primary", "upper_primary"]),
  title: safeText(2, 120),
  summary: safeText(2, 360),
  source: z.object({
    originalFileName: safeText(5, 160),
    documentSha256: z.string().regex(/^[A-F0-9]{64}$/),
    contentVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict(),
  knowledgePointIds: z.array(safeText(2, 100)).min(1).max(12),
  pages: z.array(storybookPageManifestSchema).min(1).max(40),
}).strict().superRefine((storybook, context) => {
  const pageNumbers = new Set<number>();
  const imageSources = new Set<string>();
  for (const [index, page] of storybook.pages.entries()) {
    if (pageNumbers.has(page.pageNumber)) {
      context.addIssue({ code: "custom", path: ["pages", index, "pageNumber"], message: "Page numbers must be unique" });
    }
    if (page.pageNumber !== index + 1) {
      context.addIssue({ code: "custom", path: ["pages", index, "pageNumber"], message: "Pages must be contiguous and ordered" });
    }
    if (imageSources.has(page.image.src)) {
      context.addIssue({ code: "custom", path: ["pages", index, "image", "src"], message: "Image sources must be unique" });
    }
    const imagePageNumber = Number(page.image.src.match(/\/page-(\d{2})\.(?:png|jpeg)$/)?.[1]);
    if (imagePageNumber !== page.pageNumber) {
      context.addIssue({ code: "custom", path: ["pages", index, "image", "src"], message: "Image source must match its page number" });
    }
    pageNumbers.add(page.pageNumber);
    imageSources.add(page.image.src);
  }
});

export type ImportedStorybookManifest = z.infer<typeof importedStorybookManifestSchema>;
export type StorybookPageManifest = z.infer<typeof storybookPageManifestSchema>;
export type StorybookDialogueCue = z.infer<typeof storybookDialogueCueSchema>;
export type StorybookQuestion = z.infer<typeof storybookQuestionSchema>;
