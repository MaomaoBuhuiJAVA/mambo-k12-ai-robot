export const AI_ROUTE_DEADLINE_MS = {
  chat: 90_000,
  transcribe: 60_000,
  storybook: 90_000,
} as const;

export interface RouteDeadline {
  signal: AbortSignal;
  cleanup: () => void;
}

export function createRouteDeadline(requestSignal: AbortSignal, timeoutMs: number): RouteDeadline {
  const controller = new AbortController();
  let cleaned = false;
  const abortFromRequest = () => controller.abort(requestSignal.reason);

  if (requestSignal.aborted) abortFromRequest();
  else requestSignal.addEventListener("abort", abortFromRequest, { once: true });

  const timeout = setTimeout(() => {
    controller.abort(new DOMException("AI route deadline exceeded", "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timeout);
      requestSignal.removeEventListener("abort", abortFromRequest);
    },
  };
}
