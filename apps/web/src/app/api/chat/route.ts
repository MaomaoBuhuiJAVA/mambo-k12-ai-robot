import { createTextStreamResponse, streamText, toTextStream } from "ai";

import { getCourseById } from "@/data/curriculum";
import { chatRequestSchema, toModelMessages } from "@/lib/ai/chat-schema";
import { getGoogleModel } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import {
  acquireRequestLease,
  leaseReadableStream,
  requestGuardRejectionResponse,
} from "@/lib/ai/request-guard";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_CHAT_BODY_BYTES = 6 * 1024 * 1024;

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("Missing request body");

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_CHAT_BODY_BYTES) {
    await request.body.cancel();
    throw new Error("Request body is too large");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_CHAT_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Request body is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const access = await acquireRequestLease(request, "chat");
  if (!access.ok) return requestGuardRejectionResponse(access);
  let streamOwnsLease = false;
  let body: unknown;

  try {
    try {
      body = await readJsonBody(request);
    } catch {
      return Response.json({ error: "INVALID_CHAT_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "INVALID_CHAT_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const course = getCourseById(parsed.data.courseId);
    if (!course) {
      return Response.json({ error: "INVALID_CHAT_REQUEST" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    try {
      const result = streamText({
        model: getGoogleModel(),
        instructions: buildSystemPrompt({ stage: parsed.data.stage, course }),
        messages: toModelMessages(parsed.data),
      });
      const textStream = toTextStream({ stream: result.stream });

      const response = createTextStreamResponse({
        stream: leaseReadableStream(textStream, access.lease),
        headers: NO_STORE_HEADERS,
      });
      streamOwnsLease = true;
      return response;
    } catch {
      return Response.json({ error: "CHAT_FAILED" }, { status: 502, headers: NO_STORE_HEADERS });
    }
  } finally {
    if (!streamOwnsLease) await access.lease.release();
  }
}
