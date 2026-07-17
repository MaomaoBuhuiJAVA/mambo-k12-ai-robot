import { createTextStreamResponse, streamText, toTextStream } from "ai";

import { getCourseById } from "@/data/curriculum";
import { chatRequestSchema, toModelMessages } from "@/lib/ai/chat-schema";
import { getGoogleModel } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/prompt";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_CHAT_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_CHAT_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  try {
    const course = getCourseById(parsed.data.courseId);
    if (!course) {
      return Response.json({ error: "INVALID_CHAT_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const result = streamText({
      model: getGoogleModel(),
      instructions: buildSystemPrompt({ stage: parsed.data.stage, course }),
      messages: toModelMessages(parsed.data),
    });

    return createTextStreamResponse({
      stream: toTextStream({ stream: result.stream }),
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return Response.json({ error: "CHAT_FAILED" }, { status: 502, headers: NO_STORE_HEADERS });
  }
}
