export type GuardRoute = "chat" | "transcribe";

export interface RequestLimits {
  minute: number;
  day: number;
  clientConcurrency: number;
  globalConcurrency: number;
}

export interface RequestLease {
  release: () => void;
}

type RejectionReason = "minute" | "day" | "client_concurrency" | "global_concurrency";
type AcquireResult =
  | { ok: true; lease: RequestLease }
  | { ok: false; reason: RejectionReason; retryAfter: number };

interface ClientState {
  minuteBucket: number;
  minuteCount: number;
  dayBucket: number;
  dayCount: number;
  concurrent: number;
  lastSeen: number;
}

interface RequestGuardOptions<Route extends string> {
  now?: () => number;
  limitsByRoute: Record<Route, RequestLimits>;
}

const DEFAULT_LIMITS: Record<GuardRoute, RequestLimits> = {
  chat: { minute: 12, day: 200, clientConcurrency: 2, globalConcurrency: 24 },
  transcribe: { minute: 4, day: 40, clientConcurrency: 1, globalConcurrency: 8 },
};

function hashClientKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")
    ?? request.headers.get("x-real-ip")
    ?? "local";
  const candidate = forwarded.split(",", 1)[0].trim().toLowerCase();
  const normalized = /^[0-9a-f:.]{1,64}$/.test(candidate) ? candidate : "unknown";
  return hashClientKey(normalized);
}

export function createRequestGuard<Route extends string>({
  now = Date.now,
  limitsByRoute,
}: RequestGuardOptions<Route>) {
  const clients = new Map<string, ClientState>();
  let globalConcurrent = 0;
  let lastCleanupMinute = -1;

  return {
    acquire(request: Request, route: Route): AcquireResult {
      const timestamp = now();
      const minuteBucket = Math.floor(timestamp / 60_000);
      const dayBucket = Math.floor(timestamp / 86_400_000);
      if (minuteBucket !== lastCleanupMinute) {
        for (const [client, clientState] of clients) {
          if (clientState.concurrent === 0 && timestamp - clientState.lastSeen > 86_400_000) {
            clients.delete(client);
          }
        }
        lastCleanupMinute = minuteBucket;
      }
      const key = `${route}:${clientKey(request)}`;
      const limits = limitsByRoute[route];
      const previous = clients.get(key);
      const state: ClientState = previous ?? {
        minuteBucket,
        minuteCount: 0,
        dayBucket,
        dayCount: 0,
        concurrent: 0,
        lastSeen: timestamp,
      };
      state.lastSeen = timestamp;

      if (state.minuteBucket !== minuteBucket) {
        state.minuteBucket = minuteBucket;
        state.minuteCount = 0;
      }
      if (state.dayBucket !== dayBucket) {
        state.dayBucket = dayBucket;
        state.dayCount = 0;
      }

      if (state.concurrent >= limits.clientConcurrency) {
        return { ok: false, reason: "client_concurrency", retryAfter: 1 };
      }
      if (globalConcurrent >= limits.globalConcurrency) {
        return { ok: false, reason: "global_concurrency", retryAfter: 1 };
      }
      if (state.minuteCount >= limits.minute) {
        return {
          ok: false,
          reason: "minute",
          retryAfter: Math.max(1, Math.ceil(((minuteBucket + 1) * 60_000 - timestamp) / 1000)),
        };
      }
      if (state.dayCount >= limits.day) {
        return {
          ok: false,
          reason: "day",
          retryAfter: Math.max(1, Math.ceil(((dayBucket + 1) * 86_400_000 - timestamp) / 1000)),
        };
      }

      state.minuteCount += 1;
      state.dayCount += 1;
      state.concurrent += 1;
      globalConcurrent += 1;
      clients.set(key, state);

      let released = false;
      return {
        ok: true,
        lease: {
          release() {
            if (released) return;
            released = true;
            state.concurrent = Math.max(0, state.concurrent - 1);
            globalConcurrent = Math.max(0, globalConcurrent - 1);
          },
        },
      };
    },
    reset() {
      clients.clear();
      globalConcurrent = 0;
      lastCleanupMinute = -1;
    },
    trackedClientCount() {
      return clients.size;
    },
  };
}

// This in-memory guard protects each function instance without configuration.
// Production-wide enforcement across Vercel instances still needs Firewall or Redis.
const requestGuard = createRequestGuard({ limitsByRoute: DEFAULT_LIMITS });

export function acquireRequestLease(request: Request, route: GuardRoute): AcquireResult {
  return requestGuard.acquire(request, route);
}

export function requestLimitResponse(retryAfter: number): Response {
  return Response.json(
    { error: "RATE_LIMITED" },
    {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) },
    },
  );
}

export function resetRequestGuardForTests(): void {
  requestGuard.reset();
}

export function leaseReadableStream<T>(stream: ReadableStream<T>, lease: RequestLease): ReadableStream<T> {
  const reader = stream.getReader();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    lease.release();
  };

  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          release();
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        release();
      }
    },
  });
}
