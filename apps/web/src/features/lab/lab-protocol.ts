import { z } from "zod";

export const MAX_CODE_LENGTH = 20_000;
export const MAX_OUTPUT_TEXT_LENGTH = 4_000;
export const MAX_ERROR_MESSAGE_LENGTH = 1_000;
export const LAB_TEMPLATE_IDS = ["bubble-sort", "image-classifier"] as const;

export type LabTemplateId = (typeof LAB_TEMPLATE_IDS)[number];

const runRequestSchema = z.object({
  type: z.literal("run"),
  id: z.uuid(),
  templateId: z.enum(LAB_TEMPLATE_IDS),
  code: z.string().min(1).max(MAX_CODE_LENGTH),
  timeoutMs: z.number().int().min(500).max(10_000),
}).strict();

const outputEntrySchema = z.object({
  stream: z.enum(["stdout", "stderr"]),
  text: z.string().max(MAX_OUTPUT_TEXT_LENGTH),
}).strict();

const readyResponseSchema = z.object({ type: z.literal("ready") }).strict();
const runningResponseSchema = z.object({
  type: z.literal("running"),
  id: z.uuid(),
}).strict();
const resultResponseSchema = z.object({
  type: z.literal("result"),
  id: z.uuid(),
  durationMs: z.number().finite().nonnegative(),
  passed: z.boolean(),
  output: z.array(outputEntrySchema).max(200),
}).strict();
const errorResponseSchema = z.object({
  type: z.literal("error"),
  id: z.uuid().nullable(),
  category: z.enum(["validation", "python", "runtime", "timeout", "cancelled"]),
  message: z.string().min(1).max(MAX_ERROR_MESSAGE_LENGTH),
  line: z.number().int().positive().optional(),
  output: z.array(outputEntrySchema).max(200),
}).strict();

const workerResponseSchema = z.discriminatedUnion("type", [
  readyResponseSchema,
  runningResponseSchema,
  resultResponseSchema,
  errorResponseSchema,
]);

export type LabRunRequest = z.infer<typeof runRequestSchema>;
export type LabOutputEntry = z.infer<typeof outputEntrySchema>;
export type LabWorkerResponse = z.infer<typeof workerResponseSchema>;
export type LabTerminalResponse =
  | z.infer<typeof resultResponseSchema>
  | z.infer<typeof errorResponseSchema>;
export type LabErrorCategory = z.infer<typeof errorResponseSchema>["category"];

export function parseRunRequest(value: unknown): LabRunRequest {
  return runRequestSchema.parse(value);
}

export function parseWorkerResponse(value: unknown): LabWorkerResponse {
  return workerResponseSchema.parse(value);
}

export function toSafeLabError(error: unknown): { message: string; line?: number } {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  const message = (normalized || "Python 运行失败").slice(0, MAX_ERROR_MESSAGE_LENGTH);
  const lineMatch = /(?:File\s+[^\n]*,\s*line|line)\s+(\d+)/i.exec(normalized);
  const line = lineMatch ? Number(lineMatch[1]) : undefined;

  return line && Number.isInteger(line) && line > 0 ? { message, line } : { message };
}
