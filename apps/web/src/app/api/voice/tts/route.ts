import { z } from "zod";

import { proxyCore } from "@/lib/core-proxy";

const requestSchema = z.object({ text: z.string().trim().min(1).max(1024) }).strict();

export async function POST(request: Request): Promise<Response> {
  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "INVALID_TTS_REQUEST" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const upstream = await proxyCore(
      "/api/v1/voice/tts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      },
      { maxResponseBytes: 4 * 1024 * 1024 },
    );
    if (!upstream) return Response.json({ error: "VOICE_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const body = await upstream.arrayBuffer();
    if (!upstream.ok) {
      return new Response(body, { status: upstream.status, headers: { "Cache-Control": "no-store", "Content-Type": "application/json" } });
    }
    return new Response(body, { status: 200, headers: { "Cache-Control": "no-store", "Content-Type": "audio/mpeg" } });
  } catch {
    return Response.json({ error: "VOICE_UPSTREAM_FAILED" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
