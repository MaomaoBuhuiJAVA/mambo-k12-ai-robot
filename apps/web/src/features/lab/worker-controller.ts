import { createIframeRuntimeTransport } from "./iframe-runtime-transport";
import {
  parseRunRequest,
  parseWorkerResponse,
  toSafeLabError,
  type LabErrorCategory,
  type LabRunRequest,
  type LabTemplateId,
  type LabTerminalResponse,
} from "./lab-protocol";
import type {
  LabRuntimeTransport,
  RuntimeTransportFactory,
} from "./runtime-transport";

export type LabRunnerStatus = "loading" | "ready" | "running" | "error";
export type LabRunInput = Pick<
  LabRunRequest,
  "templateId" | "challengeVersion" | "code" | "timeoutMs"
>;
type StatusListener = (status: LabRunnerStatus) => void;
export const LAB_RUNTIME_INIT_TIMEOUT_MS = 30_000;

export interface LabRunner {
  initialize(): void;
  getStatus(): LabRunnerStatus;
  subscribe(listener: StatusListener): () => void;
  run(input: LabRunInput): Promise<LabTerminalResponse>;
  stop(): void;
  dispose(): void;
}

interface PendingRun {
  id: string;
  resolve(response: LabTerminalResponse): void;
  timer: ReturnType<typeof setTimeout>;
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = character === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

function localError(
  id: string,
  category: Extract<
    LabErrorCategory,
    "validation" | "timeout" | "cancelled" | "runtime"
  >,
  message: string,
): LabTerminalResponse {
  return { type: "error", id, category, message, output: [] };
}

export class PyodideWorkerController implements LabRunner {
  private transport: LabRuntimeTransport | null = null;
  private pending: PendingRun | null = null;
  private status: LabRunnerStatus = "loading";
  private initializationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<StatusListener>();
  private disposed = false;

  constructor(
    private readonly transportFactory: RuntimeTransportFactory = createIframeRuntimeTransport,
  ) {
    this.initialize();
  }

  initialize(): void {
    if (this.transport || this.disposed) return;
    this.spawnRuntime();
  }

  getStatus(): LabRunnerStatus {
    return this.status;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  run(input: LabRunInput): Promise<LabTerminalResponse> {
    const id = createId();
    if (this.disposed) {
      return Promise.resolve(localError(id, "runtime", "实验环境已关闭，请刷新页面后重试。"));
    }
    if (this.pending) {
      return Promise.resolve(localError(id, "runtime", "已有代码正在运行。"));
    }

    let request: LabRunRequest;
    try {
      request = parseRunRequest({ type: "run", id, ...input });
    } catch (error) {
      return Promise.resolve(
        localError(id, "validation", toSafeLabError(error).message),
      );
    }

    if (!this.transport) this.spawnRuntime();
    this.setStatus("running");

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending?.id !== request.id) return;
        this.pending = null;
        resolve(localError(request.id, "timeout", "运行超过时限，隔离环境已重新启动。"));
        this.rebuildRuntime();
      }, request.timeoutMs);

      this.pending = { id: request.id, resolve, timer };
      this.transport?.postMessage(request);
    });
  }

  stop(): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve(localError(pending.id, "cancelled", "已停止本次运行。"));
    this.rebuildRuntime();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const pending = this.pending;
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve(localError(pending.id, "cancelled", "实验页面已关闭。"));
      this.pending = null;
    }
    this.transport?.destroy();
    this.transport = null;
    this.clearInitializationTimer();
    this.listeners.clear();
  }

  private spawnRuntime(): void {
    const transport = this.transportFactory();
    this.transport = transport;
    transport.start({
      onMessage: (value) => this.handleRuntimeMessage(transport, value),
      onError: (message) => this.handleRuntimeError(transport, message),
    });
    this.clearInitializationTimer();
    this.initializationTimer = setTimeout(() => {
      if (transport !== this.transport) return;
      const pending = this.pending;
      if (pending) {
        clearTimeout(pending.timer);
        this.pending = null;
        pending.resolve(
          localError(
            pending.id,
            "runtime",
            "Python 隔离环境加载超时，请点击重试加载。",
          ),
        );
      }
      this.stopRuntime(transport);
      this.setStatus("error");
    }, LAB_RUNTIME_INIT_TIMEOUT_MS);
    this.setStatus("loading");
  }

  private handleRuntimeMessage(
    source: LabRuntimeTransport,
    value: unknown,
  ): void {
    if (source !== this.transport) return;
    let response;
    try {
      response = parseWorkerResponse(value);
    } catch {
      return;
    }

    if (response.type === "ready") {
      this.clearInitializationTimer();
      if (!this.pending) this.setStatus("ready");
      return;
    }
    if (response.type === "error" && response.id === null) {
      const pending = this.pending;
      if (pending) {
        clearTimeout(pending.timer);
        this.pending = null;
        pending.resolve(localError(pending.id, "runtime", response.message));
      }
      this.stopRuntime(source);
      this.setStatus("error");
      return;
    }
    if (!this.pending || response.id !== this.pending.id) return;
    if (response.type === "running") {
      this.setStatus("running");
      return;
    }

    const pending = this.pending;
    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve(response);
    this.setStatus(
      response.type === "error" && response.category === "runtime"
        ? "error"
        : "ready",
    );
  }

  private handleRuntimeError(
    source: LabRuntimeTransport,
    message: string,
  ): void {
    if (source !== this.transport) return;
    const pending = this.pending;
    if (pending) {
      clearTimeout(pending.timer);
      this.pending = null;
      pending.resolve(
        localError(
          pending.id,
          "runtime",
          `${message.slice(0, 900)} 请点击重试加载。`,
        ),
      );
    }
    this.stopRuntime(source);
    this.setStatus("error");
  }

  private stopRuntime(runtime: LabRuntimeTransport): void {
    runtime.destroy();
    if (this.transport === runtime) {
      this.transport = null;
      this.clearInitializationTimer();
    }
  }

  private rebuildRuntime(): void {
    this.transport?.destroy();
    this.transport = null;
    this.clearInitializationTimer();
    if (!this.disposed) this.spawnRuntime();
  }

  private clearInitializationTimer(): void {
    if (this.initializationTimer !== null) {
      clearTimeout(this.initializationTimer);
      this.initializationTimer = null;
    }
  }

  private setStatus(status: LabRunnerStatus): void {
    this.status = status;
    this.listeners.forEach((listener) => listener(status));
  }
}

export function createPyodideWorkerController(): LabRunner {
  return new PyodideWorkerController();
}

export function isLabTemplateId(value: string): value is LabTemplateId {
  return value === "bubble-sort" || value === "image-classifier";
}
