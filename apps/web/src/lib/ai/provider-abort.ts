export const AI_PROVIDER_TIMEOUT_MS = {
  chat: 90_000,
  transcribe: 60_000,
  storybook: 90_000,
} as const;

export interface ProviderAbort {
  signal: AbortSignal;
  cleanup: () => void;
}

export function createProviderAbort(requestSignal: AbortSignal, timeoutMs: number): ProviderAbort {
  const controller = new AbortController();
  let cleaned = false;
  const abortFromRequest = () => controller.abort(requestSignal.reason);

  if (requestSignal.aborted) abortFromRequest();
  else requestSignal.addEventListener("abort", abortFromRequest, { once: true });

  const timeout = setTimeout(() => {
    controller.abort(new DOMException("AI provider deadline exceeded", "TimeoutError"));
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
