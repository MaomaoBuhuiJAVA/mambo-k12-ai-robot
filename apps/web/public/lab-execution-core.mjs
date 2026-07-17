export const MAX_CODE_LENGTH = 20000;
export const MAX_OUTPUT_TEXT_LENGTH = 4000;
export const MAX_ERROR_MESSAGE_LENGTH = 1000;
export const MAX_OUTPUT_ENTRIES = 200;
export const MAX_TOTAL_OUTPUT_LENGTH = 20000;
export const CHALLENGE_VERSIONS = Object.freeze({
  "bubble-sort": 1,
  "image-classifier": 1,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_REQUEST_KEYS = new Set([
  "type",
  "id",
  "templateId",
  "challengeVersion",
  "code",
  "timeoutMs",
]);
const GUIDED_IMPORTS = new Set(["math", "random", "statistics"]);

function deniedCapability() {
  throw new Error("课程运行时已禁用网络与跨上下文能力");
}

function lockCapability(name, replacement = deniedCapability) {
  try {
    Object.defineProperty(globalThis, name, {
      value: replacement,
      writable: false,
      configurable: false,
    });
  } catch {
    try {
      globalThis[name] = replacement;
    } catch {
      // A missing or non-configurable capability is already unavailable.
    }
  }
}

export function disableRuntimeCapabilities() {
  lockCapability("fetch", deniedCapability);
  lockCapability("WebSocket", deniedCapability);
  lockCapability("EventSource", deniedCapability);
  lockCapability("XMLHttpRequest", deniedCapability);
  lockCapability("Worker", deniedCapability);
  lockCapability("SharedWorker", deniedCapability);
  lockCapability("BroadcastChannel", deniedCapability);
  lockCapability("importScripts", deniedCapability);
  lockCapability("indexedDB", undefined);
  lockCapability("caches", undefined);
  lockCapability("postMessage", deniedCapability);
}

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseRunRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("运行请求格式无效");
  }
  if (Object.keys(value).some((key) => !ALLOWED_REQUEST_KEYS.has(key))) {
    throw new Error("运行请求包含未知字段");
  }
  if (value.type !== "run" || !isUuid(value.id)) {
    throw new Error("运行请求标识无效");
  }
  if (!Object.hasOwn(CHALLENGE_VERSIONS, value.templateId)) {
    throw new Error("课程挑战不存在");
  }
  if (value.challengeVersion !== CHALLENGE_VERSIONS[value.templateId]) {
    throw new Error("课程挑战版本不匹配，请刷新页面");
  }
  if (typeof value.code !== "string" || value.code.length < 1 || value.code.length > MAX_CODE_LENGTH) {
    throw new Error("Python 代码长度必须在 1 到 20000 个字符之间");
  }
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 500 || value.timeoutMs > 10000) {
    throw new Error("运行时限必须在 500 到 10000 毫秒之间");
  }
  return {
    type: "run",
    id: value.id,
    templateId: value.templateId,
    challengeVersion: value.challengeVersion,
    code: value.code,
    timeoutMs: value.timeoutMs,
  };
}

// This is only a course hint. Browser isolation and CSP are the security boundary.
export function findDiscouragedImport(code) {
  if (/\b__import__\s*\(/.test(code)) return "__import__";
  for (const statement of code.split(/[\n;]/)) {
    const fromMatch = /^\s*from\s+([\w.]+)\s+import\b/.exec(statement);
    if (fromMatch) {
      const moduleName = fromMatch[1].split(".")[0];
      if (!GUIDED_IMPORTS.has(moduleName)) return moduleName;
      continue;
    }
    const importMatch = /^\s*import\s+(.+)$/.exec(statement);
    if (!importMatch) continue;
    for (const item of importMatch[1].split(",")) {
      const moduleName = item.trim().split(/\s+as\s+/i)[0].split(".")[0];
      if (moduleName && !GUIDED_IMPORTS.has(moduleName)) return moduleName;
    }
  }
  return null;
}

export function createOutputCollector() {
  const entries = [];
  let totalLength = 0;
  let truncated = false;

  const markTruncated = () => {
    if (truncated || entries.length >= MAX_OUTPUT_ENTRIES) return;
    entries.push({ stream: "stderr", text: "输出过长，后续内容已省略。" });
    truncated = true;
  };

  return {
    entries,
    capture(stream, raw) {
      if (truncated || (stream !== "stdout" && stream !== "stderr")) return;
      if (entries.length >= MAX_OUTPUT_ENTRIES - 1 || totalLength >= MAX_TOTAL_OUTPUT_LENGTH) {
        markTruncated();
        return;
      }
      const source = String(raw);
      const remaining = MAX_TOTAL_OUTPUT_LENGTH - totalLength;
      const text = source.slice(0, Math.min(MAX_OUTPUT_TEXT_LENGTH, remaining));
      if (text) {
        entries.push({ stream, text });
        totalLength += text.length;
      }
      if (text.length < source.length) markTruncated();
    },
  };
}

export function toSafeLabError(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  const message = (normalized || "Python 运行失败").slice(0, MAX_ERROR_MESSAGE_LENGTH);
  const lineMatch = /(?:File\s+[^\n]*,\s*line|line)\s+(\d+)/i.exec(normalized);
  const line = lineMatch ? Number(lineMatch[1]) : undefined;
  return line && Number.isInteger(line) && line > 0 ? { message, line } : { message };
}

export function buildExecutableCode(templateId, challengeVersion, code) {
  if (challengeVersion !== CHALLENGE_VERSIONS[templateId]) {
    throw new Error("课程挑战版本不匹配");
  }
  const checks = templateId === "bubble-sort"
    ? `
_mambo_cases = [([], []), ([1], [1]), ([3, 1, 2], [1, 2, 3]), ([4, 4, -1], [-1, 4, 4])]
for _source, _expected in _mambo_cases:
    _before = _source[:]
    _actual = bubble_sort(_source)
    assert _actual == _expected, f"输入 {_source} 时得到 {_actual}，期望 {_expected}"
    assert _source == _before, "请不要修改传入的原列表"
_mambo_passed = True
print("挑战测试：全部通过")`
    : `
_mambo_cases = [
    ({"color": "green", "shape": "long", "texture": "veined"}, "leaf"),
    ({"color": "white", "shape": "round", "texture": "striped"}, "ball"),
    ({"color": "blue", "shape": "tall", "texture": "handle"}, "cup"),
]
for _features, _expected in _mambo_cases:
    _actual = classify_image(_features)
    assert _actual == _expected, f"特征 {_features} 得到 {_actual}，期望 {_expected}"
_mambo_passed = True
print("挑战测试：全部通过")`;
  return `${code}\n\n# 课程确定性检查（形成性练习 v${challengeVersion}）\n${checks}`;
}
