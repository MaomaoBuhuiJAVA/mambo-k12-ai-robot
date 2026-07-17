import { generateText } from "ai";

import { getGoogleModel } from "@/lib/ai/provider";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const AUDIO_MIME_TYPES = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4"]);
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const TRANSCRIPTION_INSTRUCTIONS = "请转写音频中的中文或原始语言内容。只返回转写文本，不要添加说明、翻译或格式。";

function invalidFileResponse(): Response {
  return Response.json({ error: "TRANSCRIPTION_FILE_INVALID" }, { status: 400, headers: NO_STORE_HEADERS });
}

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value !== null
    && typeof value !== "string"
    && typeof value.arrayBuffer === "function"
    && typeof value.size === "number"
    && typeof value.type === "string";
}

export async function POST(request: Request): Promise<Response> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return invalidFileResponse();
  }

  const audio = formData.get("audio");
  const mediaType = isAudioFile(audio) ? audio.type.split(";", 1)[0].trim().toLowerCase() : "";
  if (!isAudioFile(audio) || !AUDIO_MIME_TYPES.has(mediaType) || audio.size < 1 || audio.size > MAX_AUDIO_BYTES) {
    return invalidFileResponse();
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  try {
    const result = await generateText({
      model: getGoogleModel(),
      instructions: TRANSCRIPTION_INSTRUCTIONS,
      messages: [{
        role: "user",
        content: [{ type: "file", mediaType, data: new Uint8Array(await audio.arrayBuffer()) }],
      }],
    });

    const transcript = result.text.trim().slice(0, 4000);
    if (!transcript) throw new Error("Empty transcription");

    return Response.json({ transcript }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "TRANSCRIPTION_FAILED" }, { status: 502, headers: NO_STORE_HEADERS });
  }
}
