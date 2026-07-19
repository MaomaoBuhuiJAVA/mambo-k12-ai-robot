import "server-only";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function coreUrl(path: string): string | null {
  const raw = process.env.CORE_API_URL?.trim();
  const token = process.env.CORE_API_ADMIN_TOKEN?.trim();
  if (!raw || !token) return null;
  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return null;
  if (process.env.VERCEL === "1" && base.protocol !== "https:") return null;
  base.hash = "";
  base.search = "";
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;
  return new URL(path.replace(/^\/+/, ""), base).toString();
}

async function readLimited(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new Error("Core response too large");
  }
  if (!response.body) return new ArrayBuffer(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Core response too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer;
}

export async function proxyCore(
  path: string,
  init: RequestInit,
  options: { timeoutMs?: number; maxResponseBytes?: number } = {},
): Promise<Response | null> {
  const url = coreUrl(path);
  const token = process.env.CORE_API_ADMIN_TOKEN?.trim();
  if (!url || !token) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", headers.get("Accept") ?? "application/json");
    const upstream = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    const body = await readLimited(upstream, options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES);
    const outputHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) outputHeaders.set("Content-Type", contentType);
    return new Response(body, { status: upstream.status, headers: outputHeaders });
  } finally {
    clearTimeout(timeout);
  }
}
