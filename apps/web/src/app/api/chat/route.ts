import { createTextStreamResponse, streamText, toTextStream } from "ai";

import { getCourseById } from "@/data/curriculum";
import { chatRequestSchema, toModelMessages } from "@/lib/ai/chat-schema";
import { buildCourseFallback } from "@/lib/ai/course-fallback";
import { getGoogleModel } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import {
  acquireRequestLease,
  leaseReadableStream,
  requestGuardRejectionResponse,
} from "@/lib/ai/request-guard";
import { AI_ROUTE_DEADLINE_MS, createRouteDeadline } from "@/lib/ai/route-deadline";
import { withTextStreamFallback } from "@/lib/ai/text-stream-fallback";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_CHAT_BODY_BYTES = 6 * 1024 * 1024;

async function readJsonBody(request: Request, signal: AbortSignal): Promise<unknown> {
  if (!request.body) throw new Error("Missing request body");
  if (signal.aborted) {
    await request.body.cancel(signal.reason).catch(() => undefined);
    throw signal.reason;
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_CHAT_BODY_BYTES) {
    await request.body.cancel();
    throw new Error("Request body is too large");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const cancelOnAbort = () => {
    try {
      void reader.cancel(signal.reason).catch(() => undefined);
    } catch {
      // The reader may already be closed.
    }
  };
  signal.addEventListener("abort", cancelOnAbort, { once: true });
  if (signal.aborted) cancelOnAbort();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw signal.reason;
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_CHAT_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Request body is too large");
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancelOnAbort);
    reader.releaseLock();
  }

  if (signal.aborted) throw signal.reason;

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
  const deadline = createRouteDeadline(request.signal, AI_ROUTE_DEADLINE_MS.chat);
  let streamOwnsLease = false;
  let body: unknown;

  try {
    try {
      body = await readJsonBody(request, deadline.signal);
    } catch {
      if (deadline.signal.aborted) {
        return Response.json({ error: "AI_REQUEST_TIMEOUT" }, { status: 408, headers: NO_STORE_HEADERS });
      }
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
        abortSignal: deadline.signal,
        maxRetries: 0,
      });
      const textStream = toTextStream({ stream: result.stream });
      const resilientStream = withTextStreamFallback(textStream, buildCourseFallback(course));

      const response = createTextStreamResponse({
        stream: leaseReadableStream(resilientStream, access.lease, deadline.cleanup),
        headers: NO_STORE_HEADERS,
      });
      streamOwnsLease = true;
      return response;
    } catch {
      return Response.json({ error: "CHAT_FAILED" }, { status: 502, headers: NO_STORE_HEADERS });
    }
  } finally {
    if (!streamOwnsLease) {
      deadline.cleanup();
      await access.lease.release();
    }
  }
}
