import { z } from "zod";

import { proxyCore } from "@/lib/core-proxy";

const managedSource = z.string().regex(
  /^\/home\/orangepi\/\.local\/share\/mambo\/media\/[A-Za-z0-9._/-]+$/,
  "source must be inside the managed media directory",
);
const commandSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("ping"), arguments: z.object({}).strict() }),
  z.object({ name: z.literal("get_status"), arguments: z.object({}).strict() }),
  z.object({ name: z.literal("capture_snapshot"), arguments: z.object({}).strict() }),
  z.object({ name: z.literal("stop_artifact"), arguments: z.object({}).strict() }),
  z.object({ name: z.literal("stop_audio"), arguments: z.object({}).strict() }),
  z.object({ name: z.literal("set_display_mode"), arguments: z.object({ mode: z.enum(["on", "presentation", "off"]) }).strict() }),
  z.object({ name: z.literal("show_artifact"), arguments: z.object({ source: managedSource, media_type: z.enum(["image", "video"]) }).strict() }),
  z.object({ name: z.literal("play_audio"), arguments: z.object({ source: managedSource, volume: z.number().int().min(0).max(100) }).strict() }),
]);

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_DEVICE_COMMAND" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_DEVICE_COMMAND" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const deviceId = process.env.CORE_DEVICE_ID?.trim();
  if (!deviceId) return Response.json({ error: "DEVICE_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const upstream = await proxyCore(
      `/api/v1/devices/${encodeURIComponent(deviceId)}/commands`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) },
      { maxResponseBytes: 128 * 1024 },
    );
    if (!upstream) return Response.json({ error: "DEVICE_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: { "Cache-Control": "no-store", "Content-Type": "application/json" } });
  } catch {
    return Response.json({ error: "DEVICE_UPSTREAM_FAILED" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
