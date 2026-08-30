import { describe, expect, it } from "vitest";
import { createProject, getProjectDefinition, isProjectComplete, PROJECT_FIELDS, PROJECT_IDS, PROJECT_SCHEMA_VERSION, PROJECT_STEPS } from "./project-schema";
describe("project schema", () => { it("requires all structured evidence fields and starts at the first step", () => { const project = createProject("capstone"); expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION); expect(project.currentStep).toBe(PROJECT_STEPS[0].id); expect(isProjectComplete(project)).toBe(false); for (const field of PROJECT_FIELDS) project[field] = "已引用实验记录"; expect(isProjectComplete(project)).toBe(true); }); });
describe("registered project definitions", () => {
  it("keeps the audit and capstone identities distinct", () => {
    expect(PROJECT_IDS).toEqual(["model-audit", "capstone"]);
    expect(getProjectDefinition("model-audit")?.title).toBe("图像模型审计项目");
    expect(getProjectDefinition("capstone")?.title).toBe("AI 综合项目与答辩");
    expect(getProjectDefinition("unknown")).toBeUndefined();
  });
});
