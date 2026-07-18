import type {
  LabRuntimeTransport,
  RuntimeTransportHandlers,
} from "./runtime-transport";

const RUNTIME_PROTOCOL = "mambo-lab-runtime-v1";
const RUNTIME_ASSET_URLS = {
  html: "/lab-runtime.html",
  core: "/lab-execution-core.mjs",
  worker: "/lab-runtime-worker.mjs",
} as const;

export interface LabRuntimeSources {
  html: string;
  core: string;
  worker: string;
}

interface IframeRuntimeTransportOptions {
  fetcher?: typeof fetch;
  loadSources?: () => Promise<LabRuntimeSources>;
  tokenFactory?: () => string;
}

function randomToken(): string {
  const first = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const second = globalThis.crypto?.randomUUID?.() ?? `${performance.now()}-${Math.random()}`;
  return `${first}${second}`.replace(/[^a-zA-Z0-9-]/g, "");
}

async function fetchAsset(fetcher: typeof fetch, url: string): Promise<string> {
  const response = await fetcher(url, {
    cache: "force-cache",
    credentials: "omit",
    headers: { Accept: "text/html, text/javascript;q=0.9, text/plain;q=0.8" },
  });
  if (!response.ok) throw new Error(`运行时资源加载失败（${response.status}）`);
  return response.text();
}

export class IframeRuntimeTransport implements LabRuntimeTransport {
  private readonly fetcher: typeof fetch;
  private readonly loadSources: () => Promise<LabRuntimeSources>;
  private readonly tokenFactory: () => string;
  private token = "";
  private iframe: HTMLIFrameElement | null = null;
  private sources: LabRuntimeSources | null = null;
  private handlers: RuntimeTransportHandlers | null = null;
  private active = false;

  constructor(options: IframeRuntimeTransportOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.tokenFactory = options.tokenFactory ?? randomToken;
    this.loadSources = options.loadSources ?? (() =>
      Promise.all([
        fetchAsset(this.fetcher, RUNTIME_ASSET_URLS.html),
        fetchAsset(this.fetcher, RUNTIME_ASSET_URLS.core),
        fetchAsset(this.fetcher, RUNTIME_ASSET_URLS.worker),
      ]).then(([html, core, worker]) => ({ html, core, worker })));
  }

  start(handlers: RuntimeTransportHandlers): void {
    if (this.active) return;
    this.active = true;
    this.handlers = handlers;
    this.token = this.tokenFactory();
    window.addEventListener("message", this.handleWindowMessage);

    void this.loadSources()
      .then((sources) => {
        if (!this.active) return;
        const iframe = document.createElement("iframe");
        iframe.setAttribute("sandbox", "allow-scripts");
        iframe.setAttribute("title", "隔离的 Python 课程运行时");
        iframe.setAttribute("aria-hidden", "true");
        iframe.tabIndex = -1;
        iframe.style.display = "none";
        iframe.srcdoc = sources.html;
        this.sources = sources;
        this.iframe = iframe;
        document.body.append(iframe);
      })
      .catch((error: unknown) => {
        if (!this.active) return;
        this.handlers?.onError(
          error instanceof Error ? error.message : "Python 隔离环境加载失败。",
        );
      });
  }

  postMessage(message: unknown): void {
    this.iframe?.contentWindow?.postMessage(
      {
        protocol: RUNTIME_PROTOCOL,
        type: "runtime-command",
        token: this.token,
        payload: message,
      },
      "*",
    );
  }

  destroy(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener("message", this.handleWindowMessage);
    this.iframe?.contentWindow?.postMessage(
      { protocol: RUNTIME_PROTOCOL, type: "dispose", token: this.token },
      "*",
    );
    this.iframe?.remove();
    this.iframe = null;
    this.sources = null;
    this.handlers = null;
    this.token = "";
  }

  private readonly handleWindowMessage = (event: MessageEvent<unknown>) => {
    const iframeWindow = this.iframe?.contentWindow;
    if (!this.active || !iframeWindow || event.source !== iframeWindow) return;
    if (typeof event.data !== "object" || event.data === null) return;

    const message = event.data as Record<string, unknown>;
    if (message.protocol !== RUNTIME_PROTOCOL) return;

    if (message.type === "runtime-bootstrap") {
      iframeWindow.postMessage(
        {
          protocol: RUNTIME_PROTOCOL,
          type: "initialize",
          token: this.token,
          coreSource: this.sources?.core ?? "",
          workerSource: this.sources?.worker ?? "",
        },
        "*",
      );
      return;
    }

    if (message.token !== this.token) return;
    if (message.type === "runtime-message") {
      this.handlers?.onMessage(message.payload);
    } else if (message.type === "runtime-error") {
      this.handlers?.onError(
        typeof message.message === "string"
          ? message.message.slice(0, 1_000)
          : "Python 隔离环境发生错误。",
      );
    }
  };
}

export function createIframeRuntimeTransport(): LabRuntimeTransport {
  return new IframeRuntimeTransport();
}
