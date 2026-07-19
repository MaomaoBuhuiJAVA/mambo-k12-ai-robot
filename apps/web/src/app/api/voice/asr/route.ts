import { proxyCore } from "@/lib/core-proxy";

const MAX_AUDIO_BYTES = 1_920_000;
const JSON_HEADERS = { "Cache-Control": "no-store", "Content-Type": "application/json" };

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (!contentType || !["audio/wav", "audio/x-wav", "audio/pcm"].includes(contentType)) {
    return Response.json({ error: "UNSUPPORTED_AUDIO_TYPE" }, { status: 415, headers: JSON_HEADERS });
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES) {
    await request.body?.cancel();
    return Response.json({ error: "AUDIO_TOO_LARGE" }, { status: 413, headers: JSON_HEADERS });
  }
  const audio = new Uint8Array(await request.arrayBuffer());
  if (audio.byteLength < 1 || audio.byteLength > MAX_AUDIO_BYTES) {
    return Response.json({ error: "AUDIO_TOO_LARGE" }, { status: 413, headers: JSON_HEADERS });
  }
  try {
    const upstream = await proxyCore(
      "/api/v1/voice/asr",
      { method: "POST", headers: { "Content-Type": contentType }, body: audio },
      { maxResponseBytes: 128 * 1024 },
    );
    if (!upstream) return Response.json({ error: "VOICE_NOT_CONFIGURED" }, { status: 503, headers: JSON_HEADERS });
    const body = await upstream.arrayBuffer();
    return new Response(body, { status: upstream.status, headers: JSON_HEADERS });
  } catch {
    return Response.json({ error: "VOICE_UPSTREAM_FAILED" }, { status: 502, headers: JSON_HEADERS });
  }
}
