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

  it("compiles the inline bridge and declares the opaque-runtime CSP", () => {
    const html = readFileSync(htmlPath, "utf8");
    const inlineScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (!inlineScript) throw new Error("runtime bridge script is missing");
    expect(() => new Function(inlineScript)).not.toThrow();
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

  it("treats import inspection as guidance while CSP and capability freezing block network", async () => {
    const core = await import(/* @vite-ignore */ pathToFileURL(corePath).href) as {
      findDiscouragedImport(code: string): string | null;
      buildExecutableCode(templateId: string, version: number, code: string): string;
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
    expect(core.CHALLENGE_VERSIONS["bubble-sort"]).toBe(
      getLabTemplate("bubble-sort").challengeVersion,
    );
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
