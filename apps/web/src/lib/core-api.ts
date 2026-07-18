import "server-only";

import { z } from "zod";

const CORE_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_DEVICES = 32;
const ALLOWED_CAPABILITIES = new Set([
  "audio",
  "camera",
  "display",
  "microphone",
  "npu",
  "ping",
  "speaker",
  "get_status",
]);

const timestampSchema = z.string().datetime({ offset: true });
const deviceSchema = z.object({
  device_id: z.string().min(3).max(64),
  online: z.boolean(),
  first_seen_at: timestampSchema,
  last_seen_at: timestampSchema,
  connected_at: timestampSchema.nullable(),
  disconnected_at: timestampSchema.nullable(),
  agent_version: z.string().max(64).nullable(),
  platform: z.string().max(128).nullable(),
  capabilities: z.array(z.string().min(1).max(64)).max(32),
  latest_status: z.record(z.string().max(64), z.unknown()),
  hardware: z.record(z.string().max(64), z.unknown()).optional(),
}).strict();

const deviceListSchema = z.object({
  items: z.array(deviceSchema).max(MAX_DEVICES),
  count: z.number().int().min(0).max(MAX_DEVICES),
}).strict().refine(({ count, items }) => count === items.length);

export type PublicDeviceStatus = {
  status: "configured" | "online" | "offline" | "unavailable" | "unconfigured";
  name: string | null;
  online: boolean;
  lastSeenAt: string | null;
  capabilities: string[];
};

const EMPTY_STATUS: Omit<PublicDeviceStatus, "status"> = {
  name: null,
  online: false,
  lastSeenAt: null,
  capabilities: [],
};

function emptyStatus(status: PublicDeviceStatus["status"]): PublicDeviceStatus {
  return { status, ...EMPTY_STATUS };
}

function normalizeCoreUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid Core API URL");
  }
  if (process.env.VERCEL === "1" && url.protocol !== "https:") {
    throw new Error("Core API must use HTTPS on Vercel");
  }
  url.hash = "";
  url.search = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url.toString();
}

function createRequestSignal(callerSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("Core API timed out", "TimeoutError"));
  }, CORE_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

async function readLimitedJson(response: Response): Promise<unknown> {
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    await response.body?.cancel();
    throw new Error("Core API response is not JSON");
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("Core API response too large");
  }
  if (!response.body) {
    throw new Error("Core API response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Core API response too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}

function normalizeDevice(device: z.infer<typeof deviceSchema>): PublicDeviceStatus {
  const rawHostname = device.latest_status.hostname;
  const hostname = typeof rawHostname === "string"
    ? rawHostname
      .replace(/[^\p{L}\p{N} ._-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 128)
    : "";
  const capabilities = [...new Set(device.capabilities)]
    .filter((capability) => ALLOWED_CAPABILITIES.has(capability))
    .slice(0, 8);

  return {
    status: device.online ? "online" : "offline",
    name: hostname || device.device_id,
    online: device.online,
    lastSeenAt: device.last_seen_at,
    capabilities,
  };
}

export async function getDeviceStatus(
  options: { signal?: AbortSignal } = {},
): Promise<PublicDeviceStatus> {
  const rawUrl = process.env.CORE_API_URL?.trim();
  const adminToken = process.env.CORE_API_ADMIN_TOKEN?.trim();
  if (!rawUrl || !adminToken) {
    return emptyStatus("unconfigured");
  }

  const requestSignal = createRequestSignal(options.signal);
  try {
    const baseUrl = normalizeCoreUrl(rawUrl);
    const response = await fetch(new URL("api/v1/devices", baseUrl).toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      cache: "no-store",
      signal: requestSignal.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return emptyStatus("unavailable");
    }

    const parsed = deviceListSchema.safeParse(await readLimitedJson(response));
    if (!parsed.success) {
      return emptyStatus("unavailable");
    }
    const targetId = process.env.CORE_DEVICE_ID?.trim();
    const device = targetId
      ? parsed.data.items.find((item) => item.device_id === targetId)
      : parsed.data.items[0];
    return device ? normalizeDevice(device) : emptyStatus("configured");
  } catch {
    return emptyStatus("unavailable");
  } finally {
    requestSignal.cleanup();
  }
}
