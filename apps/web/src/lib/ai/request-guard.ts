export type GuardRoute = "chat" | "transcribe" | "storybook";

export interface RequestLimits {
  minute: number;
  day: number;
  clientConcurrency: number;
  routeConcurrency: number;
}

export interface RequestLease {
  release: () => Promise<void>;
}

type RejectionReason =
  | "minute"
  | "day"
  | "client_concurrency"
  | "route_concurrency"
  | "overall_concurrency"
  | "unavailable";

export type AcquireResult =
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
  overallConcurrency: number;
  trustProxyHeaders?: boolean | (() => boolean);
}

interface RedisConfig {
  url: string;
  token: string;
}

const DEFAULT_LIMITS: Record<GuardRoute, RequestLimits> = {
  chat: { minute: 12, day: 200, clientConcurrency: 2, routeConcurrency: 16 },
  transcribe: { minute: 4, day: 40, clientConcurrency: 1, routeConcurrency: 6 },
  storybook: { minute: 4, day: 30, clientConcurrency: 1, routeConcurrency: 4 },
};
const OVERALL_CONCURRENCY = 20;
const CONCURRENCY_LEASE_SECONDS = 10 * 60;
const GUARD_UNAVAILABLE_RETRY_SECONDS = 30;
const REDIS_TIMEOUT_MS = 2_500;
const REDIS_PREFIX = "mambo:ai-guard:v2";

const ACQUIRE_SCRIPT = `
local minute = redis.call('INCR', KEYS[1])
if minute == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local day = redis.call('INCR', KEYS[2])
if day == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
if minute > tonumber(ARGV[4]) then return {'minute', redis.call('TTL', KEYS[1])} end
if day > tonumber(ARGV[5]) then return {'day', redis.call('TTL', KEYS[2])} end
local client_concurrency = tonumber(redis.call('GET', KEYS[3]) or '0')
local route_concurrency = tonumber(redis.call('GET', KEYS[4]) or '0')
local overall_concurrency = tonumber(redis.call('GET', KEYS[5]) or '0')
if client_concurrency >= tonumber(ARGV[6]) then return {'client_concurrency', 1} end
if route_concurrency >= tonumber(ARGV[7]) then return {'route_concurrency', 1} end
if overall_concurrency >= tonumber(ARGV[8]) then return {'overall_concurrency', 1} end
redis.call('INCR', KEYS[3])
redis.call('EXPIRE', KEYS[3], ARGV[3])
redis.call('INCR', KEYS[4])
redis.call('EXPIRE', KEYS[4], ARGV[3])
redis.call('INCR', KEYS[5])
redis.call('EXPIRE', KEYS[5], ARGV[3])
return {'ok', 1}
`.trim();

const RELEASE_SCRIPT = `
for index = 1, #KEYS do
  local current = tonumber(redis.call('GET', KEYS[index]) or '0')
  if current <= 1 then
    redis.call('DEL', KEYS[index])
  else
    redis.call('DECR', KEYS[index])
  end
end
return 1
`.trim();

function hashClientKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

type ForwardedHeader = "x-forwarded-for" | "x-vercel-forwarded-for";

function clientKey(request: Request, forwardedHeaders: ForwardedHeader[]): string {
  const forwarded = forwardedHeaders
    .map((header) => request.headers.get(header))
    .find((value) => value?.trim()) ?? null;
  const candidate = (forwarded?.split(",", 1)[0] ?? "local").trim().toLowerCase();
  const normalized = /^[0-9a-f:.]{1,64}$/.test(candidate) ? candidate : "unknown";
  return hashClientKey(normalized);
}

function shouldTrustProxy(value: boolean | (() => boolean) | undefined): boolean {
  return typeof value === "function" ? value() : value === true;
}

export function createRequestGuard<Route extends string>({
  now = Date.now,
  limitsByRoute,
  overallConcurrency,
  trustProxyHeaders,
}: RequestGuardOptions<Route>) {
  const clients = new Map<string, ClientState>();
  const routeConcurrent = new Map<Route, number>();
  let overallConcurrent = 0;
  let lastCleanupMinute = -1;

  return {
    async acquire(request: Request, route: Route): Promise<AcquireResult> {
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

      const forwardedHeaders: ForwardedHeader[] = shouldTrustProxy(trustProxyHeaders) ? ["x-forwarded-for"] : [];
      const key = `${route}:${clientKey(request, forwardedHeaders)}`;
      const limits = limitsByRoute[route];
      const state: ClientState = clients.get(key) ?? {
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

      // Tickets are charged before validation/concurrency checks so malformed traffic is bounded too.
      state.minuteCount += 1;
      state.dayCount += 1;
      clients.set(key, state);
      if (state.minuteCount > limits.minute) {
        return {
          ok: false,
          reason: "minute",
          retryAfter: Math.max(1, Math.ceil(((minuteBucket + 1) * 60_000 - timestamp) / 1000)),
        };
      }
      if (state.dayCount > limits.day) {
        return {
          ok: false,
          reason: "day",
          retryAfter: Math.max(1, Math.ceil(((dayBucket + 1) * 86_400_000 - timestamp) / 1000)),
        };
      }
      if (state.concurrent >= limits.clientConcurrency) {
        return { ok: false, reason: "client_concurrency", retryAfter: 1 };
      }
      if ((routeConcurrent.get(route) ?? 0) >= limits.routeConcurrency) {
        return { ok: false, reason: "route_concurrency", retryAfter: 1 };
      }
      if (overallConcurrent >= overallConcurrency) {
        return { ok: false, reason: "overall_concurrency", retryAfter: 1 };
      }

      state.concurrent += 1;
      routeConcurrent.set(route, (routeConcurrent.get(route) ?? 0) + 1);
      overallConcurrent += 1;
      let released = false;
      return {
        ok: true,
        lease: {
          async release() {
            if (released) return;
            released = true;
            state.concurrent = Math.max(0, state.concurrent - 1);
            routeConcurrent.set(route, Math.max(0, (routeConcurrent.get(route) ?? 0) - 1));
            overallConcurrent = Math.max(0, overallConcurrent - 1);
          },
        },
      };
    },
    reset() {
      clients.clear();
      routeConcurrent.clear();
      overallConcurrent = 0;
      lastCleanupMinute = -1;
    },
    trackedClientCount() {
      return clients.size;
    },
  };
}

const memoryRequestGuard = createRequestGuard({
  limitsByRoute: DEFAULT_LIMITS,
  overallConcurrency: OVERALL_CONCURRENCY,
  trustProxyHeaders: () => process.env.TRUST_PROXY_HEADERS === "true",
});

function redisConfig(): RedisConfig | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const [url, token] = upstashUrl?.trim() && upstashToken?.trim()
    ? [upstashUrl, upstashToken]
    : [kvUrl, kvToken];
  if (!url?.trim() || !token?.trim()) return null;
  return { url: url.replace(/\/+$/, ""), token: token.trim() };
}

async function redisCommand(config: RedisConfig, command: Array<string | number>): Promise<unknown> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Redis request failed");
  const payload = await response.json() as { result?: unknown; error?: unknown };
  if (payload.error || !("result" in payload)) throw new Error("Redis command failed");
  return payload.result;
}

function retryAfter(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : 1;
}

async function acquireDurableLease(
  request: Request,
  route: GuardRoute,
  config: RedisConfig,
): Promise<AcquireResult> {
  const timestamp = Date.now();
  const minuteBucket = Math.floor(timestamp / 60_000);
  const dayBucket = Math.floor(timestamp / 86_400_000);
  const client = clientKey(request, ["x-vercel-forwarded-for", "x-forwarded-for"]);
  const limits = DEFAULT_LIMITS[route];
  const concurrentKeys = [
    `${REDIS_PREFIX}:concurrent:client:${route}:${client}`,
    `${REDIS_PREFIX}:concurrent:route:${route}`,
    `${REDIS_PREFIX}:concurrent:overall`,
  ];
  const keys = [
    `${REDIS_PREFIX}:minute:${route}:${client}:${minuteBucket}`,
    `${REDIS_PREFIX}:day:${route}:${client}:${dayBucket}`,
    ...concurrentKeys,
  ];
  const dayTtl = Math.max(60, Math.ceil(((dayBucket + 1) * 86_400_000 - timestamp) / 1000) + 60);
  const result = await redisCommand(config, [
    "EVAL",
    ACQUIRE_SCRIPT,
    "5",
    ...keys,
    120,
    dayTtl,
    CONCURRENCY_LEASE_SECONDS,
    limits.minute,
    limits.day,
    limits.clientConcurrency,
    limits.routeConcurrency,
    OVERALL_CONCURRENCY,
  ]);
  if (!Array.isArray(result) || typeof result[0] !== "string") {
    throw new Error("Invalid Redis guard response");
  }
  const reason = result[0] as RejectionReason | "ok";
  if (reason !== "ok") {
    if (![
      "minute",
      "day",
      "client_concurrency",
      "route_concurrency",
      "overall_concurrency",
    ].includes(reason)) {
      throw new Error("Unknown Redis guard response");
    }
    return { ok: false, reason, retryAfter: retryAfter(result[1]) };
  }

  let released = false;
  return {
    ok: true,
    lease: {
      async release() {
        if (released) return;
        released = true;
        try {
          await redisCommand(config, ["EVAL", RELEASE_SCRIPT, "3", ...concurrentKeys]);
        } catch {
          // The bounded concurrency-key TTL fails safe if release cannot reach Redis.
        }
      },
    },
  };
}

function unavailable(): AcquireResult {
  return { ok: false, reason: "unavailable", retryAfter: GUARD_UNAVAILABLE_RETRY_SECONDS };
}

export async function acquireRequestLease(request: Request, route: GuardRoute): Promise<AcquireResult> {
  if (process.env.VERCEL !== "1") return memoryRequestGuard.acquire(request, route);
  const config = redisConfig();
  if (!config) return unavailable();
  try {
    return await acquireDurableLease(request, route, config);
  } catch {
    return unavailable();
  }
}

export function requestGuardRejectionResponse(result: Exclude<AcquireResult, { ok: true }>): Response {
  const unavailableGuard = result.reason === "unavailable";
  return Response.json(
    { error: unavailableGuard ? "AI_GUARD_UNAVAILABLE" : "RATE_LIMITED" },
    {
      status: unavailableGuard ? 503 : 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(result.retryAfter) },
    },
  );
}

export function resetRequestGuardForTests(): void {
  memoryRequestGuard.reset();
}

export function leaseReadableStream<T>(stream: ReadableStream<T>, lease: RequestLease): ReadableStream<T> {
  const reader = stream.getReader();
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await lease.release();
  };

  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          await release();
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        await release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await release();
      }
    },
  });
}
