/// <reference lib="webworker" />

import { loadPyodide, type PyodideAPI } from "pyodide";
import type { PyProxy, PyProxyWithGet } from "pyodide/ffi";

import {
  parseRunRequest,
  toSafeLabError,
  type LabRunRequest,
  type LabWorkerResponse,
} from "./lab-protocol";
import { createOutputCollector, findForbiddenImport } from "./lab-guards";
import { appendDeterministicChecks } from "./lab-templates";

const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/npm/pyodide@314.0.2/";
const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

let pyodidePromise: Promise<PyodideAPI> | null = null;

function post(message: LabWorkerResponse): void {
  workerScope.postMessage(message);
}

function getPyodide(): Promise<PyodideAPI> {
  pyodidePromise ??= loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  return pyodidePromise;
}

async function execute(request: LabRunRequest): Promise<void> {
  post({ type: "running", id: request.id });
  const startedAt = performance.now();
  const collector = createOutputCollector();

  const forbiddenImport = findForbiddenImport(request.code);
  if (forbiddenImport) {
    post({
      type: "error",
      id: request.id,
      category: "validation",
      message: `课程练习暂不允许导入 ${forbiddenImport}。可用模块：math、random、statistics。`,
      output: collector.entries,
    });
    return;
  }

  let globals: (PyProxy & PyProxyWithGet) | undefined;
  try {
    const pyodide = await getPyodide();
    pyodide.setStdout({ batched: (text) => collector.capture("stdout", text) });
    pyodide.setStderr({ batched: (text) => collector.capture("stderr", text) });
    const dictFactory = pyodide.globals.get("dict") as unknown as () => PyProxy & PyProxyWithGet;
    globals = dictFactory();
    await pyodide.runPythonAsync(appendDeterministicChecks(request.templateId, request.code), {
      globals,
    });
    const passed = globals.get("_mambo_passed") === true;
    post({
      type: "result",
      id: request.id,
      durationMs: Math.round(performance.now() - startedAt),
      passed,
      output: collector.entries,
    });
  } catch (error) {
    const safe = toSafeLabError(error);
    post({
      type: "error",
      id: request.id,
      category: "python",
      message: safe.message,
      line: safe.line,
      output: collector.entries,
    });
  } finally {
    globals?.destroy();
  }
}

workerScope.onmessage = (event: MessageEvent<unknown>) => {
  let request: LabRunRequest;
  try {
    request = parseRunRequest(event.data);
  } catch (error) {
    const safe = toSafeLabError(error);
    const candidate = event.data as { id?: unknown };
    if (typeof candidate?.id === "string") {
      post({
        type: "error",
        id: candidate.id,
        category: "validation",
        message: safe.message,
        output: [],
      });
    }
    return;
  }
  void execute(request);
};

void getPyodide()
  .then(() => post({ type: "ready" }))
  .catch((error) => {
    const safe = toSafeLabError(error);
    post({
      type: "error",
      id: null,
      category: "runtime",
      message: `Python 环境加载失败：${safe.message}`.slice(0, 1_000),
      output: [],
    });
  });

export {};
