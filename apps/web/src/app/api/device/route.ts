import { getDeviceStatus, type PublicDeviceStatus } from "@/lib/core-api";

export const dynamic = "force-dynamic";

const UNAVAILABLE: PublicDeviceStatus = {
  status: "unavailable",
  name: null,
  online: false,
  lastSeenAt: null,
  capabilities: [],
};

export async function GET() {
  let result = UNAVAILABLE;
  try {
    result = await getDeviceStatus();
  } catch {
    // Keep the teaching interface available when the optional device adapter fails.
  }

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
