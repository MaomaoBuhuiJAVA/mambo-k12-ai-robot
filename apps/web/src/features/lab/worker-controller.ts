import {
  parseRunRequest,
  parseWorkerResponse,
  type LabErrorCategory,
  type LabRunRequest,
  type LabTemplateId,
  type LabTerminalResponse,
} from "./lab-protocol";

export type LabRunnerStatus = "loading" | "ready" | "running" | "error";
export type LabRunInput = Pick<LabRunRequest, "templateId" | "code" | "timeoutMs">;
type StatusListener = (status: LabRunnerStatus) => void;
type WorkerFactory = () => Worker;

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

function defaultWorkerFactory(): Worker {
  return new Worker(new URL("./pyodide.worker.ts", import.meta.url), {
    type: "module",
    name: "mambo-pyodide-lab",
  });
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
  category: Extract<LabErrorCategory, "timeout" | "cancelled" | "runtime">,
  message: string,
): LabTerminalResponse {
  return { type: "error", id, category, message, output: [] };
}

export class PyodideWorkerController implements LabRunner {
  private worker: Worker | null = null;
  private pending: PendingRun | null = null;
  private status: LabRunnerStatus = "loading";
  private readonly listeners = new Set<StatusListener>();
  private disposed = false;

  constructor(private readonly workerFactory: WorkerFactory = defaultWorkerFactory) {
    this.initialize();
  }

  initialize(): void {
    if (this.worker || this.disposed) return;
    this.spawnWorker();
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
    if (this.disposed) {
      return Promise.resolve(localError(createId(), "runtime", "实验环境已关闭，请刷新页面后重试。"));
    }
    if (this.pending) {
      return Promise.resolve(localError(createId(), "runtime", "已有代码正在运行。"));
    }
    if (!this.worker) this.spawnWorker();

    const request = parseRunRequest({ type: "run", id: createId(), ...input });
    this.setStatus("running");

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending?.id !== request.id) return;
        this.pending = null;
        resolve(localError(request.id, "timeout", "运行超过时限，实验环境已重新启动。"));
        this.rebuildWorker();
      }, request.timeoutMs);

      this.pending = { id: request.id, resolve, timer };
      this.worker?.postMessage(request);
    });
  }

  stop(): void {
    const pending = this.pending;
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve(localError(pending.id, "cancelled", "已停止本次运行。"));
    this.rebuildWorker();
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
    this.worker?.terminate();
    this.worker = null;
    this.listeners.clear();
  }

  private spawnWorker(): void {
    this.worker = this.workerFactory();
    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      let response;
      try {
        response = parseWorkerResponse(event.data);
      } catch {
        return;
      }

      if (response.type === "ready") {
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
        this.worker?.terminate();
        this.worker = null;
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
      this.setStatus(response.type === "error" && response.category === "runtime" ? "error" : "ready");
    };
    this.worker.onerror = () => {
      const pending = this.pending;
      if (pending) {
        clearTimeout(pending.timer);
        this.pending = null;
        pending.resolve(localError(pending.id, "runtime", "Python 环境已停止，请点击重试加载。"));
      }
      this.worker?.terminate();
      this.worker = null;
      this.setStatus("error");
    };
    this.setStatus("loading");
  }

  private rebuildWorker(): void {
    this.worker?.terminate();
    this.worker = null;
    if (!this.disposed) this.spawnWorker();
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
