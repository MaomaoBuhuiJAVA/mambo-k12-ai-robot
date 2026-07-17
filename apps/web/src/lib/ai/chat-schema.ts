import type { ModelMessage } from "ai";
import { z } from "zod";

import { getCourseById } from "@/data/curriculum";
import { type Stage } from "@/lib/domain";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const stageSchema = z.enum([
  "lower_primary",
  "upper_primary",
  "middle_school",
  "high_school",
]);

function imageDataUrlIsValid(value: string): boolean {
  const match = IMAGE_DATA_URL.exec(value);
  if (!match) return false;

  const base64 = match[2];
  if (base64.length % 4 !== 0) return false;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding <= MAX_IMAGE_BYTES;
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
  image: z.string().refine(imageDataUrlIsValid, "Image must be a JPEG, PNG, or WebP data URL up to 4 MiB").optional(),
});

export const chatRequestSchema = z.object({
  stage: stageSchema,
  courseId: z.string().min(1),
  messages: z.array(messageSchema).min(1).max(20),
}).superRefine((request, context) => {
  if (request.messages.reduce((total, message) => total + message.content.length, 0) > 20000) {
    context.addIssue({ code: "custom", path: ["messages"], message: "Total message content exceeds 20000 characters" });
  }

  const course = getCourseById(request.courseId);
  if (!course) {
    context.addIssue({ code: "custom", path: ["courseId"], message: "Course does not exist" });
  } else if (course.stage !== request.stage) {
    context.addIssue({ code: "custom", path: ["courseId"], message: "Course does not belong to this stage" });
  }
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export function toModelMessages(request: Pick<ChatRequest, "messages">): ModelMessage[] {
  return request.messages.map((message) => {
    if (!message.image) return { role: message.role, content: message.content };

    const match = IMAGE_DATA_URL.exec(message.image);
    if (!match) throw new Error("Validated image data URL did not match expected format");

    return {
      role: message.role,
      content: [
        { type: "text" as const, text: message.content },
        { type: "file" as const, mediaType: match[1], data: message.image },
      ],
    };
  });
}

export type ChatStage = Stage;
