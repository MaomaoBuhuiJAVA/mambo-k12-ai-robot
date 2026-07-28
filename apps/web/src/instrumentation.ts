export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const proxyUrl = process.env.AI_HTTP_PROXY?.trim()
    || process.env.GEMINI_HTTP_PROXY?.trim()
    || process.env.HTTPS_PROXY?.trim()
    || process.env.HTTP_PROXY?.trim();
  if (!proxyUrl) return;

  // Keep the optional proxy dependency out of the Webpack instrumentation bundle.
  const loadUndici = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<typeof import("undici")>;
  const { ProxyAgent, setGlobalDispatcher } = await loadUndici("undici");
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
