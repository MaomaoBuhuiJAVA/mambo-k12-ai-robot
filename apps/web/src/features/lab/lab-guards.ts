import { MAX_OUTPUT_TEXT_LENGTH, type LabOutputEntry } from "./lab-protocol";

const ALLOWED_IMPORTS = new Set(["math", "random", "statistics"]);
const MAX_TOTAL_OUTPUT_LENGTH = 20_000;
const MAX_OUTPUT_ENTRIES = 200;

export function findForbiddenImport(code: string): string | null {
  if (/\b__import__\s*\(/.test(code)) return "__import__";

  for (const statement of code.split(/[\n;]/)) {
    const fromMatch = /^\s*from\s+([\w.]+)\s+import\b/.exec(statement);
    if (fromMatch) {
      const moduleName = fromMatch[1].split(".")[0];
      if (!ALLOWED_IMPORTS.has(moduleName)) return moduleName;
      continue;
    }

    const importMatch = /^\s*import\s+(.+)$/.exec(statement);
    if (!importMatch) continue;
    for (const item of importMatch[1].split(",")) {
      const moduleName = item.trim().split(/\s+as\s+/i)[0].split(".")[0];
      if (moduleName && !ALLOWED_IMPORTS.has(moduleName)) return moduleName;
    }
  }
  return null;
}

export function createOutputCollector(): {
  entries: LabOutputEntry[];
  capture(stream: LabOutputEntry["stream"], raw: string): void;
} {
  const entries: LabOutputEntry[] = [];
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
      if (truncated) return;
      if (entries.length >= MAX_OUTPUT_ENTRIES - 1 || totalLength >= MAX_TOTAL_OUTPUT_LENGTH) {
        markTruncated();
        return;
      }

      const remaining = MAX_TOTAL_OUTPUT_LENGTH - totalLength;
      const text = raw.slice(0, Math.min(MAX_OUTPUT_TEXT_LENGTH, remaining));
      if (text) {
        entries.push({ stream, text });
        totalLength += text.length;
      }
      if (text.length < raw.length) markTruncated();
    },
  };
}
