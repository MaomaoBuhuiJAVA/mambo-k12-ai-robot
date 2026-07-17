import { loadPyodide } from "https://cdn.jsdelivr.net/npm/pyodide@314.0.2/pyodide.mjs";

const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/npm/pyodide@314.0.2/";
const nativePostMessage = globalThis.postMessage.bind(globalThis);
let pyodidePromise = null;

function emit(message) {
  nativePostMessage(message);
}

async function getPyodideRuntime() {
  pyodidePromise ??= loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  return pyodidePromise;
}

async function execute(rawRequest) {
  let request;
  try {
    request = parseRunRequest(rawRequest);
  } catch (error) {
    const safe = toSafeLabError(error);
    emit({
      type: "error",
      id: isUuid(rawRequest?.id) ? rawRequest.id : null,
      category: "validation",
      message: safe.message,
      output: [],
    });
    return;
  }

  emit({ type: "running", id: request.id });
  const startedAt = performance.now();
  const collector = createOutputCollector();
  const discouragedImport = findDiscouragedImport(request.code);
  if (discouragedImport) {
    collector.capture(
      "stderr",
      `课程提示：当前任务通常不需要 ${discouragedImport}；导入提示不是安全隔离边界。`,
    );
  }

  let globals;
  try {
    const pyodide = await getPyodideRuntime();
    pyodide.setStdout({ batched: (text) => collector.capture("stdout", text) });
    pyodide.setStderr({ batched: (text) => collector.capture("stderr", text) });
    const dictFactory = pyodide.globals.get("dict");
    globals = dictFactory();
    await pyodide.runPythonAsync(
      buildExecutableCode(request.templateId, request.challengeVersion, request.code),
      { globals },
    );
    emit({
      type: "result",
      id: request.id,
      durationMs: Math.round(performance.now() - startedAt),
      passed: globals.get("_mambo_passed") === true,
      output: collector.entries,
    });
  } catch (error) {
    const safe = toSafeLabError(error);
    emit({
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

globalThis.onmessage = (event) => {
  void execute(event.data);
};

void getPyodideRuntime()
  .then(() => {
    disableRuntimeCapabilities();
    emit({ type: "ready" });
  })
  .catch((error) => {
    const safe = toSafeLabError(error);
    emit({
      type: "error",
      id: null,
      category: "runtime",
      message: `Python 环境加载失败：${safe.message}`.slice(0, 1000),
      output: [],
    });
  });
