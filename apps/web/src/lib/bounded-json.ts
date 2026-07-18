export async function readBoundedJson(
  request: Request,
  maximumBytes: number,
  signal?: AbortSignal,
): Promise<unknown | undefined> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength > maximumBytes || !request.body) return undefined;
  if (signal?.aborted) {
    await request.body.cancel(signal.reason).catch(() => undefined);
    return undefined;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const cancelOnAbort = () => {
    try {
      void reader.cancel(signal?.reason).catch(() => undefined);
    } catch {
      // The reader may already be closed.
    }
  };
  signal?.addEventListener("abort", cancelOnAbort, { once: true });
  if (signal?.aborted) cancelOnAbort();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal?.aborted) return undefined;
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("Request body is too large");
        return undefined;
      }
      chunks.push(value);
    }
  } catch {
    return undefined;
  } finally {
    signal?.removeEventListener("abort", cancelOnAbort);
    reader.releaseLock();
  }

  if (signal?.aborted) return undefined;

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
}
