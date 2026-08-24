import { describe, expect, it } from "vitest";

import { listLabCodeVersions, loadLatestLabCodeVersion, saveLabCodeVersion } from "./lab-version-store";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
}

describe("lab-version-store", () => {
  it("keeps the latest version scoped by stage, mode, template and challenge", () => {
    const storage = memoryStorage();
    expect(saveLabCodeVersion({
      stage: "high_school",
      mode: "project",
      templateId: "model-audit",
      challengeVersion: 1,
      code: "print('first')",
      savedAt: "2026-08-23T01:00:00.000Z",
    }, storage)).toBe(true);
    expect(saveLabCodeVersion({
      stage: "high_school",
      mode: "project",
      templateId: "model-audit",
      challengeVersion: 1,
      code: "print('latest')",
      savedAt: "2026-08-23T01:01:00.000Z",
    }, storage)).toBe(true);

    expect(loadLatestLabCodeVersion({
      stage: "high_school",
      mode: "project",
      templateId: "model-audit",
      challengeVersion: 1,
    }, storage)?.code).toBe("print('latest')");
    expect(loadLatestLabCodeVersion({
      stage: "middle_school",
      mode: "project",
      templateId: "model-audit",
      challengeVersion: 1,
    }, storage)).toBeNull();
  });

  it("drops malformed records and caps oversized source", () => {
    const storage = memoryStorage();
    storage.setItem("mambo.lab-versions.v1", JSON.stringify([
      { id: "bad", stage: "high_school", mode: "project", templateId: "unknown", challengeVersion: 1, code: "x", savedAt: "2026-08-23T01:00:00.000Z" },
      { id: "bad-date", stage: "high_school", mode: "project", templateId: "model-audit", challengeVersion: 1, code: "x", savedAt: "nope" },
    ]));
    expect(listLabCodeVersions(storage)).toEqual([]);
    expect(saveLabCodeVersion({
      stage: "high_school",
      mode: "project",
      templateId: "model-audit",
      challengeVersion: 1,
      code: "x".repeat(12_001),
      savedAt: "2026-08-23T01:00:00.000Z",
    }, storage)).toBe(false);
  });
});
