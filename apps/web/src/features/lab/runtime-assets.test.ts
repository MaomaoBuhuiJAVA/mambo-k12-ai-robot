import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { getLabTemplate } from "./lab-templates";

const publicDirectory = resolve(process.cwd(), "public");
const htmlPath = `${publicDirectory}/lab-runtime.html`;
const corePath = `${publicDirectory}/lab-execution-core.mjs`;
const workerPath = `${publicDirectory}/lab-runtime-worker.mjs`;

describe("isolated lab runtime assets", () => {
  it("ships parseable JavaScript without TypeScript or local source imports", () => {
    execFileSync(process.execPath, ["--check", corePath]);
    execFileSync(process.execPath, ["--check", workerPath]);

    const core = readFileSync(corePath, "utf8");
    const worker = readFileSync(workerPath, "utf8");
    execFileSync(process.execPath, ["--input-type=module", "--check"], {
      input: `${core}\n${worker}`,
    });
    expect(`${core}\n${worker}`).not.toMatch(/\bimport\s+type\b|\binterface\s+\w+|:\s*(?:string|number|boolean)\b/);
    expect(worker).not.toMatch(/from\s+["']\.\.?\//);
    expect(worker).toContain('from "https://cdn.jsdelivr.net/npm/pyodide@314.0.2/pyodide.mjs"');
  });

  it("declares the opaque-runtime CSP", () => {
    const html = readFileSync(htmlPath, "utf8");
    const moduleScript = /<script type="module">([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (!moduleScript) throw new Error("runtime module bridge is missing");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("'wasm-unsafe-eval'");
    expect(html).toContain("'unsafe-eval'");
    expect(html).toContain("worker-src blob:");
    expect(html).toContain(
      "connect-src https://cdn.jsdelivr.net/npm/pyodide@314.0.2/",
    );
    expect(html).not.toContain("connect-src https://cdn.jsdelivr.net;");
    expect(html).not.toContain("allow-same-origin");
  });

  it("loads Pyodide directly in the opaque iframe instead of a module worker", () => {
    const html = readFileSync(htmlPath, "utf8");

    expect(html).toContain('<script type="module">');
    expect(html).toContain(
      'import { loadPyodide } from "https://cdn.jsdelivr.net/npm/pyodide@314.0.2/pyodide.mjs";',
    );
    expect(html).not.toContain("new Worker(");
    expect(html).not.toContain("allow-same-origin");
  });

  it("treats import inspection as guidance while CSP and capability freezing block network", async () => {
    const core = await import(/* @vite-ignore */ pathToFileURL(corePath).href) as {
      findDiscouragedImport(code: string): string | null;
      buildExecutableCode(templateId: string, version: number, code: string): string;
      buildScriptCode(code: string): string;
      CHALLENGE_VERSIONS: Record<string, number>;
      parseRunRequest(value: unknown): unknown;
      createOutputCollector(): {
        entries: Array<{ stream: string; text: string }>;
        capture(stream: "stdout" | "stderr", text: string): void;
      };
    };
    const worker = readFileSync(workerPath, "utf8");
    const coreSource = readFileSync(corePath, "utf8");

    expect(core.findDiscouragedImport('exec("from js import fetch")')).toBeNull();
    expect(core.findDiscouragedImport("import json")).toBeNull();
    expect(core.findDiscouragedImport("import csv")).toBeNull();
    expect(worker).toContain("disableRuntimeCapabilities");
    expect(coreSource).toContain('lockCapability("fetch"');
    expect(coreSource).toContain('lockCapability("WebSocket"');
    expect(coreSource).toContain('lockCapability("postMessage"');
    expect(coreSource).not.toContain('lockCapability("eval"');
    expect(coreSource).not.toContain('lockCapability("Function"');
    const executable = core.buildExecutableCode(
      "bubble-sort",
      1,
      "def bubble_sort(values): return sorted(values)",
    );
    expect(executable).toContain("assert _actual == _expected");
    expect(executable).toContain("_mambo_passed = True");
    expect(executable).not.toMatch(/Gemini|LLM|大模型判分/i);
    expect(core.buildScriptCode("print(1)")).toBe("print(1)");
    expect(core.CHALLENGE_VERSIONS["bubble-sort"]).toBe(
      getLabTemplate("bubble-sort").challengeVersion,
    );
    expect(core.CHALLENGE_VERSIONS["middle-python-basics"]).toBe(
      getLabTemplate("middle-python-basics").challengeVersion,
    );
    expect(core.CHALLENGE_VERSIONS["python-data-basics"]).toBe(
      getLabTemplate("python-data-basics").challengeVersion,
    );
    const sortingExecutable = core.buildExecutableCode(
      "bubble-sort-analysis",
      1,
      "def count_comparisons(values): return len(values) * (len(values) - 1) // 2",
    );
    expect(sortingExecutable).toContain("count_comparisons([5, 4, 3, 2, 1]) == 10");
    expect(sortingExecutable).toContain("_size * (_size - 1) // 2");
    expect(core.buildExecutableCode(
      "python-data-basics",
      3,
      "import csv\nimport json\ndef summarize_scores(raw_data, input_format=\"json\"): return {}\ndef prepare_chart_data(summary): return {}",
    )).toContain("scores-csv-v1");
    const dataChecks = core.buildExecutableCode(
      "python-data-basics",
      3,
      "import csv\\nimport json\\ndef summarize_scores(raw_data, input_format=\\\"json\\\"): return {}\\ndef prepare_chart_data(summary): return {}",
    );
    expect(dataChecks).toContain("malformed JSON must be rejected");
    expect(dataChecks).toContain("unsupported input format must be rejected");
    expect(core.CHALLENGE_VERSIONS["dataset-split"]).toBe(
      getLabTemplate("dataset-split").challengeVersion,
    );
    expect(core.buildExecutableCode(
      "dataset-split",
      3,
      "def build_pipeline(rows, baseline_source=\"train\"): return {}",
    )).toContain("leakage_detected");
    const splitChecks = core.buildExecutableCode(
      "dataset-split",
      3,
      "def build_pipeline(rows, baseline_source=\"train\"): return {}",
    );
    expect(splitChecks).toContain("baseline_predictions");
    expect(splitChecks).toContain('baseline_source"] == "test"');
    expect(core.CHALLENGE_VERSIONS["classification-metrics"]).toBe(
      getLabTemplate("classification-metrics").challengeVersion,
    );
    expect(core.buildExecutableCode(
      "classification-metrics",
      3,
      "def evaluate_metrics(classification_rows, regression_rows, error_cost): return {}",
    )).toContain('"mse"');
    const metricChecks = core.buildExecutableCode(
      "classification-metrics",
      3,
      "def evaluate_metrics(classification_rows, regression_rows, error_cost): return {}",
    );
    expect(metricChecks).toContain("confusion_matrix");
    expect(metricChecks).toContain("regression_sample_count");
    expect(metricChecks).toContain('"false_alarm"');
    expect(metricChecks).toContain("_no_positive");
    expect(core.CHALLENGE_VERSIONS["gradient-descent-demo"]).toBe(
      getLabTemplate("gradient-descent-demo").challengeVersion,
    );
    expect(core.buildExecutableCode(
      "gradient-descent-demo",
      3,
      "def analyze_training_curve(train_losses, validation_losses, learning_rate, parameter_set_id=\"weights-init-v1\", sample_count=8): return {}",
    )).toContain("overfit_detected");
    const curveChecks = core.buildExecutableCode(
      "gradient-descent-demo",
      3,
      "def analyze_training_curve(train_losses, validation_losses, learning_rate, parameter_set_id=\"weights-init-v1\", sample_count=8): return {}",
    );
    expect(curveChecks).toContain("parameter_set_id");
    expect(curveChecks).toContain("sample_count");
    expect(curveChecks).toContain("best_step");
    expect(curveChecks).toContain("_fast");
    expect(curveChecks).toContain("训练曲线长度不一致时必须拒绝");
    expect(curveChecks).toContain("训练轮数少于五轮时必须拒绝");
    expect(core.CHALLENGE_VERSIONS["rag-citation-check"]).toBe(
      getLabTemplate("rag-citation-check").challengeVersion,
    );
    expect(core.buildExecutableCode(
      "rag-citation-check",
      3,
      "def compare_retrieval(without_retrieval, with_retrieval, knowledge_base_version, query_version, allowed_sources, requested_tools): return {}",
    )).toContain("unsupported_claims");
    expect(core.buildExecutableCode(
      "middle-python-basics",
      1,
      "def choose_ready_tools(tools): return [tool['name'] for tool in tools if tool['ready']]",
    )).toContain("choose_ready_tools([]) == []");
    expect(core.CHALLENGE_VERSIONS["multimodal-input-audit"]).toBe(
      getLabTemplate("multimodal-input-audit").challengeVersion,
    );
    expect(getLabTemplate("multimodal-input-audit").challengeVersion).toBe(2);
    expect(core.CHALLENGE_VERSIONS["rag-citation-check"]).toBe(
      getLabTemplate("rag-citation-check").challengeVersion,
    );
    expect(core.buildExecutableCode(
      "multimodal-input-audit",
      2,
      "def compare_modalities(rows, dataset_version, input_version): return {}",
    )).toContain("multimodal-samples-v2");
    const multimodalChecks = core.buildExecutableCode(
      "multimodal-input-audit",
      2,
      "def compare_modalities(rows, dataset_version, input_version): return {}",
    );
    expect(multimodalChecks).toContain("vision-inputs-v2");
    expect(multimodalChecks).toContain("failed_samples");
    expect(multimodalChecks).toContain("excluded_samples");
    expect(multimodalChecks).toContain("privacy_boundary");
    expect(core.buildExecutableCode(
      "rag-citation-check",
      3,
      "def compare_retrieval(without_retrieval, with_retrieval, knowledge_base_version, query_version, allowed_sources, requested_tools): return {}",
    )).toContain("fixed-kb-v2");
    const ragChecks = core.buildExecutableCode(
      "rag-citation-check",
      3,
      "def compare_retrieval(without_retrieval, with_retrieval, knowledge_base_version, query_version, allowed_sources, requested_tools): return {}",
    );
    expect(ragChecks).toContain("rag-query-v2");
    expect(ragChecks).toContain("unsupported_claims");
    expect(ragChecks).toContain("blocked_tools");
    expect(ragChecks).toContain("来源白名单变化时必须拒绝");
    expect(() => core.parseRunRequest({
      type: "run",
      id: "550e8400-e29b-41d4-a716-446655440000",
      templateId: "bubble-sort",
      challengeVersion: 2,
      code: "print(1)",
      timeoutMs: 1_000,
    })).toThrow(/版本/);
    const collector = core.createOutputCollector();
    for (let index = 0; index < 500; index += 1) {
      collector.capture("stdout", String(index));
    }
    expect(collector.entries.length).toBeLessThanOrEqual(200);
    expect(
      collector.entries.filter((entry) => entry.text.includes("省略")),
    ).toHaveLength(1);
  });

  it("does not reference a TypeScript worker from the production controller", () => {
    const controller = readFileSync(
      resolve(process.cwd(), "src/features/lab/worker-controller.ts"),
      "utf8",
    );
    expect(controller).not.toContain("pyodide.worker.ts");
    expect(controller).not.toMatch(/new\s+Worker\s*\(/);
  });
});
