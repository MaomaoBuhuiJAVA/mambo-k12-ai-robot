import { generateText } from "ai";

import { getGoogleModel } from "@/lib/ai/provider";
import { acquireRequestLease, requestGuardRejectionResponse } from "@/lib/ai/request-guard";
import { AI_ROUTE_DEADLINE_MS, createRouteDeadline } from "@/lib/ai/route-deadline";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_MULTIPART_BYTES = 9 * 1024 * 1024;
const AUDIO_MIME_TYPES = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4"]);
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const TRANSCRIPTION_INSTRUCTIONS = "请转写音频中的中文或原始语言内容。只返回转写文本，不要添加说明、翻译或格式。";

function invalidFileResponse(): Response {
  return Response.json({ error: "TRANSCRIPTION_FILE_INVALID" }, { status: 400, headers: NO_STORE_HEADERS });
}

class BodyTooLargeError extends Error {}

async function cancelBody(request: Request): Promise<void> {
  try {
    await request.body?.cancel();
  } catch {
    // The stream may already be locked or closed.
  }
}

async function readMultipartForm(request: Request, signal: AbortSignal): Promise<FormData> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_MULTIPART_BYTES) {
    await cancelBody(request);
    throw new BodyTooLargeError();
  }
  if (!request.body) throw new Error("Missing multipart body");
  if (signal.aborted) {
    await request.body.cancel(signal.reason).catch(() => undefined);
    throw signal.reason;
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
      if (totalBytes > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancelOnAbort);
    reader.releaseLock();
  }

  if (signal.aborted) throw signal.reason;

  const contentType = request.headers.get("content-type");
  if (!contentType) throw new Error("Missing multipart content type");
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const formData = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
  if (signal.aborted) throw signal.reason;
  return formData;
}

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value !== null
    && typeof value !== "string"
    && typeof value.arrayBuffer === "function"
    && typeof value.size === "number"
    && typeof value.type === "string";
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const access = await acquireRequestLease(request, "transcribe");
  if (!access.ok) return requestGuardRejectionResponse(access);
  const deadline = createRouteDeadline(request.signal, AI_ROUTE_DEADLINE_MS.transcribe);

  try {
    let formData: FormData;
    try {
      formData = await readMultipartForm(request, deadline.signal);
    } catch (error) {
      if (deadline.signal.aborted) {
        return Response.json({ error: "AI_REQUEST_TIMEOUT" }, { status: 408, headers: NO_STORE_HEADERS });
      }
      if (error instanceof BodyTooLargeError) {
        return Response.json(
          { error: "TRANSCRIPTION_BODY_TOO_LARGE" },
          { status: 413, headers: NO_STORE_HEADERS },
        );
      }
      return invalidFileResponse();
    }

    const audio = formData.get("audio");
    const mediaType = isAudioFile(audio) ? audio.type.split(";", 1)[0].trim().toLowerCase() : "";
    if (!isAudioFile(audio) || !AUDIO_MIME_TYPES.has(mediaType) || audio.size < 1 || audio.size > MAX_AUDIO_BYTES) {
      return invalidFileResponse();
    }

    const result = await generateText({
      model: getGoogleModel(),
      instructions: TRANSCRIPTION_INSTRUCTIONS,
      messages: [{
        role: "user",
        content: [{ type: "file", mediaType, data: new Uint8Array(await audio.arrayBuffer()) }],
      }],
      abortSignal: deadline.signal,
    });

    const transcript = result.text.trim().slice(0, 4000);
    if (!transcript) throw new Error("Empty transcription");

    return Response.json({ transcript }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "TRANSCRIPTION_FAILED" }, { status: 502, headers: NO_STORE_HEADERS });
  } finally {
    deadline.cleanup();
    await access.lease.release();
  }
}
