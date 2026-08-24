export const MAX_CODE_LENGTH = 20000;
export const MAX_OUTPUT_TEXT_LENGTH = 4000;
export const MAX_ERROR_MESSAGE_LENGTH = 1000;
export const MAX_OUTPUT_ENTRIES = 200;
export const MAX_TOTAL_OUTPUT_LENGTH = 20000;
export const CHALLENGE_VERSIONS = Object.freeze({
  "bubble-sort": 1,
  "image-classifier": 1,
  "middle-python-basics": 1,
  "python-data-basics": 3,
  "bubble-sort-analysis": 1,
  "dataset-split": 3,
  "classification-metrics": 3,
  "gradient-descent-demo": 3,
  "multimodal-input-audit": 2,
  "rag-citation-check": 3,
  "model-audit": 1,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_REQUEST_KEYS = new Set([
  "type",
  "id",
  "templateId",
  "challengeVersion",
  "executionMode",
  "code",
  "timeoutMs",
]);
const GUIDED_IMPORTS = new Set(["csv", "json", "math", "random", "statistics"]);

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
  const executionMode = value.executionMode ?? "challenge";
  if (executionMode !== "challenge" && executionMode !== "script") {
    throw new Error("运行模式无效");
  }
  if (executionMode === "challenge" && value.challengeVersion !== CHALLENGE_VERSIONS[value.templateId]) {
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
    executionMode,
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
  const lineMatch = /File\s+["']?<exec>["']?,\s*line\s+(\d+)/i.exec(normalized)
    ?? /(?:File\s+[^\n]*,\s*line|line)\s+(\d+)/i.exec(normalized);
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
    : templateId === "image-classifier" ? `
_mambo_cases = [
    ({"color": "green", "shape": "long", "texture": "veined"}, "leaf"),
    ({"color": "white", "shape": "round", "texture": "striped"}, "ball"),
    ({"color": "blue", "shape": "tall", "texture": "handle"}, "cup"),
]
for _features, _expected in _mambo_cases:
    _actual = classify_image(_features)
    assert _actual == _expected, f"特征 {_features} 得到 {_actual}，期望 {_expected}"
_mambo_passed = True
print("挑战测试：全部通过")`
    : "";
  const highChecks = {
    "middle-python-basics": `_source = [{"name": "sensor", "ready": True}, {"name": "wire", "ready": False}, {"name": "robot", "ready": True}]
_before = [item.copy() for item in _source]
assert choose_ready_tools([]) == []
assert choose_ready_tools(_source) == ["sensor", "robot"]
assert choose_ready_tools([{"name": "camera", "ready": False}]) == []
assert _source == _before, "请不要修改传入的器材记录"`,
    "python-data-basics": `_json_data = '[{"score": "2"}, {"score": null}, {"score": "4"}, {"score": "6"}]'\n_csv_data = "score\\n2\\n\\"\\"\\n4\\n6\\n"\n_expected = {"rowCount": 4, "validRowCount": 3, "missingCount": 1, "mean": 4, "maximum": 6}\n_json_result = summarize_scores(_json_data, "json")\n_csv_result = summarize_scores(_csv_data, "csv")\nassert _json_result == _expected, _json_result\nassert _csv_result == _expected, _csv_result\nassert summarize_scores('[]', "json") == {"rowCount": 0, "validRowCount": 0, "missingCount": 0, "mean": 0, "maximum": 0}\nassert summarize_scores('score\\n', "csv") == {"rowCount": 0, "validRowCount": 0, "missingCount": 0, "mean": 0, "maximum": 0}\nassert prepare_chart_data(_json_result) == {"labels": ["有效", "缺失"], "values": [3, 1]}\nprint("JSON 数据集 scores-json-v1：4 条记录，清洗后 3 条，缺失 1 条，均值 4，最大值 6")\nprint("CSV 数据集 scores-csv-v1：4 条记录，清洗后 3 条，缺失 1 条，均值 4，最大值 6")\nprint("图表数据：有效 3，缺失 1")`,
    "bubble-sort-analysis": `# 比较次数只由输入长度和标准双层循环决定，与初始顺序无关。
assert count_comparisons([]) == 0
assert count_comparisons([1]) == 0
assert count_comparisons([3, 1, 2]) == 3
assert count_comparisons([1, 2, 3, 4, 5]) == 10
assert count_comparisons([5, 4, 3, 2, 1]) == 10
assert count_comparisons([4, 4, -1, -1]) == 6
for _size in range(7):
    assert count_comparisons(list(range(_size))) == _size * (_size - 1) // 2`,
    "dataset-split": `_rows = [{"label": "cat"}, {"label": "cat"}, {"label": "dog"}, {"label": "cat"}, {"label": "dog"}, {"label": "cat"}, {"label": "cat"}, {"label": "dog"}, {"label": "dog"}, {"label": "cat"}]\n_actual = build_pipeline(_rows)\nassert _actual == {"train": [0, 1, 2, 5, 6, 7], "validation": [3, 8], "test": [4, 9], "baseline_label": "cat", "baseline_source": "train", "baseline_predictions": ["cat", "cat"], "baseline_accuracy": 0.5, "leakage_detected": False}, _actual\nassert build_pipeline([], "train") == {"train": [], "validation": [], "test": [], "baseline_label": None, "baseline_source": "train", "baseline_predictions": [], "baseline_accuracy": 0.0, "leakage_detected": False}\n_leak_rows = [{"label": "cat"}, {"label": "cat"}, {"label": "cat"}, {"label": "cat"}, {"label": "dog"}, {"label": "cat"}, {"label": "cat"}, {"label": "cat"}, {"label": "dog"}, {"label": "dog"}]\n_leak = build_pipeline(_leak_rows, "test")\nassert _leak["baseline_label"] == "dog", _leak\nassert _leak["baseline_source"] == "test", _leak\nassert _leak["baseline_predictions"] == ["dog", "dog"], _leak\nassert _leak["baseline_accuracy"] == 1.0, _leak\nassert _leak["leakage_detected"] is True, _leak`,
    "classification-metrics": `_actual = evaluate_metrics([(True, True), (False, True), (True, False), (False, False)], [(3.0, 2.0), (5.0, 4.0), (10.0, 7.0), (0.0, 0.0)], "miss")
assert _actual == {"classification": {"accuracy": 0.5, "precision": 0.5, "recall": 0.5, "f1": 0.5, "confusion_matrix": {"tp": 1, "fp": 1, "fn": 1, "tn": 1}}, "regression": {"mse": 2.75, "regression_sample_count": 4}, "error_cost": "miss", "selected_metric": "recall"}, _actual
_false_alarm = evaluate_metrics([(True, True), (False, True), (True, False), (False, False)], [(1.0, 0.0), (2.0, 2.0), (3.0, 4.0), (4.0, 4.0)], "false_alarm")
assert _false_alarm["selected_metric"] == "precision", _false_alarm
assert _false_alarm["error_cost"] == "false_alarm", _false_alarm
assert _false_alarm["regression"]["regression_sample_count"] == 4, _false_alarm
assert _false_alarm["regression"]["mse"] == 0.5, _false_alarm
_no_positive = evaluate_metrics([(False, False), (False, False)], [], "miss")
assert _no_positive["classification"] == {"accuracy": 1.0, "precision": 0.0, "recall": 0.0, "f1": 0.0, "confusion_matrix": {"tp": 0, "fp": 0, "fn": 0, "tn": 2}}, _no_positive
_no_prediction = evaluate_metrics([(True, False), (True, False)], [], "miss")
assert _no_prediction["classification"] == {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0, "confusion_matrix": {"tp": 0, "fp": 0, "fn": 2, "tn": 0}}, _no_prediction
_empty = evaluate_metrics([], [], "false_alarm")
assert _empty["classification"] == {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0, "confusion_matrix": {"tp": 0, "fp": 0, "fn": 0, "tn": 0}}, _empty
assert _empty["regression"] == {"mse": 0.0, "regression_sample_count": 0}, _empty`,
    "gradient-descent-demo": `_actual = analyze_training_curve([0.95, 0.7, 0.45, 0.2, 0.1], [1.0, 0.65, 0.4, 0.45, 0.55], 0.1, "weights-init-v1", 8)
assert _actual == {"steps": 5, "sample_count": 8, "learning_rate": 0.1, "parameter_set_id": "weights-init-v1", "train_curve": [0.95, 0.7, 0.45, 0.2, 0.1], "validation_curve": [1.0, 0.65, 0.4, 0.45, 0.55], "final_train_loss": 0.1, "final_validation_loss": 0.55, "best_validation_loss": 0.4, "best_step": 3, "overfit_detected": True}, _actual
_fast = analyze_training_curve([0.95, 0.5, 0.35, 0.3, 0.25], [1.0, 0.75, 0.7, 0.72, 0.8], 0.2, "weights-init-v1", 8)
assert _fast["steps"] == 5 and _fast["learning_rate"] == 0.2, _fast
assert _fast["best_validation_loss"] == 0.7 and _fast["best_step"] == 3, _fast
assert _fast["overfit_detected"] is True, _fast
_stable = analyze_training_curve([0.95, 0.7, 0.45, 0.3, 0.2], [1.0, 0.8, 0.7, 0.6, 0.55], 0.1, "weights-init-v1", 8)
assert _stable["overfit_detected"] is False, _stable
try:
    analyze_training_curve([0.9, 0.5], [1.0], 0.1, "weights-init-v1", 8)
except ValueError:
    pass
else:
    raise AssertionError("训练曲线长度不一致时必须拒绝")
try:
    analyze_training_curve([], [], 0.1, "weights-init-v1", 8)
except ValueError:
    pass
else:
    raise AssertionError("空训练曲线必须拒绝")
try:
    analyze_training_curve([0.9, 0.8, 0.7, 0.6], [1.0, 0.9, 0.8, 0.7], 0.1, "weights-init-v1", 8)
except ValueError:
    pass
else:
    raise AssertionError("训练轮数少于五轮时必须拒绝")`,
    "multimodal-input-audit": `MULTIMODAL_DATASET_VERSION = "multimodal-samples-v2"
MULTIMODAL_INPUT_VERSION = "vision-inputs-v2"
_rows = [
    {"sample_id":"s1","modality":"text","available":True,"correct":True,"source_id":"text-s1-v2","authorized":True,"privacy_boundary":"public"},
    {"sample_id":"s1","modality":"image","available":True,"correct":False,"source_id":"image-s1-v2","authorized":True,"privacy_boundary":"public"},
    {"sample_id":"s1","modality":"structured","available":True,"correct":True,"source_id":"structured-s1-v2","authorized":True,"privacy_boundary":"public"},
    {"sample_id":"s1","modality":"combined","available":True,"correct":True,"source_id":"combined-s1-v2","authorized":True,"privacy_boundary":"public"},
    {"sample_id":"s2","modality":"text","available":True,"correct":False,"source_id":"text-s2-v2","authorized":True,"privacy_boundary":"public"},
    {"sample_id":"s2","modality":"image","available":True,"correct":True,"source_id":"image-s2-v2","authorized":True,"privacy_boundary":"public"},
    {"sample_id":"s2","modality":"structured","available":True,"correct":True,"source_id":"structured-s2-v2","authorized":False,"privacy_boundary":"restricted"},
    {"sample_id":"s2","modality":"combined","available":True,"correct":True,"source_id":"combined-s2-v2","authorized":True,"privacy_boundary":"public"},
]
_actual = compare_modalities(_rows, MULTIMODAL_DATASET_VERSION, MULTIMODAL_INPUT_VERSION)
assert _actual == {
    "dataset_version": "multimodal-samples-v2",
    "input_version": "vision-inputs-v2",
    "modalities": {
        "text": {"available": 2, "correct": 1, "accuracy": 0.5, "failed_samples": ["s2"], "unavailable_samples": [], "excluded_samples": []},
        "image": {"available": 2, "correct": 1, "accuracy": 0.5, "failed_samples": ["s1"], "unavailable_samples": [], "excluded_samples": []},
        "structured": {"available": 1, "correct": 1, "accuracy": 1.0, "failed_samples": [], "unavailable_samples": [], "excluded_samples": ["s2"]},
        "combined": {"available": 2, "correct": 2, "accuracy": 1.0, "failed_samples": [], "unavailable_samples": [], "excluded_samples": []},
    },
    "comparison": {"accuracy_by_modality": {"text": 0.5, "image": 0.5, "structured": 1.0, "combined": 1.0}, "best_accuracy": 1.0, "best_modalities": ["structured", "combined"]},
    "sources": ["combined-s1-v2", "combined-s2-v2", "image-s1-v2", "image-s2-v2", "structured-s1-v2", "structured-s2-v2", "text-s1-v2", "text-s2-v2"],
    "authorization": {"eligible_input_count": 7, "excluded_input_count": 1, "excluded_samples": ["s2"], "policy": "仅统计已授权且符合当前用途的输入；未授权输入保留在审计边界中"},
    "privacy_boundary": {"restricted_input_count": 1, "restricted_samples": ["s2"], "policy": "受限输入不得用于模型训练或展示"},
}, _actual
_with_unavailable = compare_modalities(_rows + [{"sample_id":"s3","modality":"image","available":False,"correct":False,"source_id":"image-s3-v2","authorized":True,"privacy_boundary":"public"}], MULTIMODAL_DATASET_VERSION, MULTIMODAL_INPUT_VERSION)
assert _with_unavailable["modalities"]["image"]["unavailable_samples"] == ["s3"], _with_unavailable
try:
    compare_modalities(_rows, "multimodal-samples-v1", MULTIMODAL_INPUT_VERSION)
except ValueError:
    pass
else:
    raise AssertionError("数据集版本不匹配时必须拒绝")
try:
    compare_modalities(_rows + [_rows[0]], MULTIMODAL_DATASET_VERSION, MULTIMODAL_INPUT_VERSION)
except ValueError:
    pass
else:
    raise AssertionError("重复的 sample_id + modality 必须拒绝")`,
    "rag-citation-check": `KNOWLEDGE_BASE_VERSION = "fixed-kb-v2"\nQUERY_VERSION = "rag-query-v2"\nALLOWED_SOURCES = ["课程手册", "审核片段"]\n_without = {"claims": ["实验室周末免费开放"], "supported_claims": [], "citations": []}\n_with = {"claims": ["课程手册说明工作日开放", "实验室周末免费开放"], "supported_claims": ["课程手册说明工作日开放"], "citations": ["课程手册", "未知网页"]}\n_actual = compare_retrieval(_without, _with, KNOWLEDGE_BASE_VERSION, QUERY_VERSION, ALLOWED_SOURCES, ["web_search", "code_execution"])\nassert _actual == {\n    "knowledge_base_version": "fixed-kb-v2",\n    "query_version": "rag-query-v2",\n    "without_retrieval": {"status": "unverified", "citation_count": 0, "matched_citations": [], "unmatched_citations": [], "unsupported_claims": ["实验室周末免费开放"]},\n    "with_retrieval": {"status": "needs_review", "citation_count": 2, "matched_citations": ["课程手册"], "unmatched_citations": ["未知网页"], "unsupported_claims": ["实验室周末免费开放"]},\n    "citation_comparison": {"allowed_sources": ["课程手册", "审核片段"], "matched_count": 1, "unmatched_count": 1, "coverage": 0.5, "all_citations_allowed": False},\n    "failure_evidence": {"without_retrieval": ["实验室周末免费开放"], "with_retrieval": ["实验室周末免费开放"], "policy": "没有可核对来源或出现未支持主张时必须标记待核对"},\n    "tool_policy": {"requested_tools": ["web_search", "code_execution"], "allowed_tools": ["fixed_retrieval"], "blocked_tools": ["web_search", "code_execution"], "all_requested_blocked": True},\n}, _actual\ntry:\n    compare_retrieval(_without, _with, "fixed-kb-v1", QUERY_VERSION, ALLOWED_SOURCES, [])\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("知识库版本不匹配时必须拒绝")\ntry:\n    compare_retrieval(_without, _with, KNOWLEDGE_BASE_VERSION, QUERY_VERSION, ["课程手册", "外部网页"], [])\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError("来源白名单变化时必须拒绝")`,
    "model-audit": `_actual = audit_groups([{"group":"A","actual":"cat","predicted":"cat"},{"group":"A","actual":"cat","predicted":"dog"},{"group":"B","actual":"dog","predicted":"dog"}])\nassert _actual == {"A": {"correct": 1, "total": 2}, "B": {"correct": 1, "total": 1}}, _actual`,
  };
  const deterministicChecks = highChecks[templateId];
  if (templateId === "python-data-basics") {
    const robustnessChecks = `
try:
    summarize_scores('{bad json}', "json")
except Exception:
    pass
else:
    raise AssertionError("malformed JSON must be rejected")
try:
    summarize_scores('value\\n2', "csv")
except Exception:
    pass
else:
    raise AssertionError("CSV without a score header must be rejected")
try:
    summarize_scores(_json_data, "yaml")
except Exception:
    pass
else:
    raise AssertionError("unsupported input format must be rejected")`;
    return `${code}\n\n# 课程确定性检查（形成性练习 v${challengeVersion}）\n${deterministicChecks}\n${robustnessChecks}\n_mambo_passed = True\nprint("挑战测试：全部通过")`;
  }
  if (deterministicChecks) return `${code}\n\n# 课程确定性检查（形成性练习 v${challengeVersion}）\n${deterministicChecks}\n_mambo_passed = True\nprint("挑战测试：全部通过")`;
  return `${code}\n\n# 课程确定性检查（形成性练习 v${challengeVersion}）\n${checks}`;
}

export function buildScriptCode(code) {
  return code;
}
