import { generateText } from "ai";

import { getGoogleModel } from "@/lib/ai/provider";
import { AI_PROVIDER_TIMEOUT_MS, createProviderAbort } from "@/lib/ai/provider-abort";
import { acquireRequestLease, requestGuardRejectionResponse } from "@/lib/ai/request-guard";

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

async function readMultipartForm(request: Request): Promise<FormData> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_MULTIPART_BYTES) {
    await cancelBody(request);
    throw new BodyTooLargeError();
  }
  if (!request.body) throw new Error("Missing multipart body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const contentType = request.headers.get("content-type");
  if (!contentType) throw new Error("Missing multipart content type");
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
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

  try {
    let formData: FormData;
    try {
      formData = await readMultipartForm(request);
    } catch (error) {
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

    const providerAbort = createProviderAbort(request.signal, AI_PROVIDER_TIMEOUT_MS.transcribe);
    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({
        model: getGoogleModel(),
        instructions: TRANSCRIPTION_INSTRUCTIONS,
        messages: [{
          role: "user",
          content: [{ type: "file", mediaType, data: new Uint8Array(await audio.arrayBuffer()) }],
        }],
        abortSignal: providerAbort.signal,
      });
    } finally {
      providerAbort.cleanup();
    }

    const transcript = result.text.trim().slice(0, 4000);
    if (!transcript) throw new Error("Empty transcription");

    return Response.json({ transcript }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "TRANSCRIPTION_FAILED" }, { status: 502, headers: NO_STORE_HEADERS });
  } finally {
    await access.lease.release();
  }
}
