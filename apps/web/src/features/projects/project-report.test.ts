import { describe, expect, it } from "vitest";
import { createProject } from "./project-schema";
import { formatProjectReport } from "./project-report";

describe("project report", () => {
  it("exports structured project fields and schema versions", () => {
    const project = createProject("capstone");
    project.researchQuestion = "固定样本的研究问题";

    expect(formatProjectReport(project, { passed: false, missing: ["metrics"] }))
      .toContain("评价规则版本：2");
    expect(formatProjectReport(project, { passed: false, missing: ["metrics"] }))
      .toContain("项目结构版本：2");
  });

  it("prints reproducible metadata from selected experiment evidence", () => {
    const project = createProject("capstone");
    project.evidenceRefs = ["experiment:data:v2"];
    const report = formatProjectReport(project, { passed: true, missing: [] }, [{
      runId: "experiment:data:v2",
      activityId: "high-python-data-lab-code",
      courseId: "high-python-data-lab",
      templateId: "python-data-basics",
      mode: "independent",
      variables: {
        evidenceType: "deterministic-challenge",
        challengeVersion: 2,
        templateVersion: "python-data-basics:v2",
        datasetVersion: "scores-json-v1",
        parameterSetId: "default:python-data-basics:v2",
        runDurationMs: 142,
        resultCode: "passed",
        inputFormat: "json",
        hintsUsed: 1,
      },
      metrics: { rowCount: 4, mean: 4 },
      conclusion: "固定测试通过",
      completedAt: "2026-08-23T02:00:00.000Z",
    }]);

    expect(report).toContain("证据 runId：experiment:data:v2");
    expect(report).toContain("# AI 综合项目与答辩报告");
    expect(report).toContain("模板版本：python-data-basics:v2");
    expect(report).toContain("挑战版本：2");
    expect(report).toContain("数据集/知识库版本：scores-json-v1");
    expect(report).toContain("输入格式：json");
    expect(report).toContain("参数集：default:python-data-basics:v2");
    expect(report).toContain("运行参数：hintsUsed=1");
    expect(report).toContain("实际运行耗时：142 ms");
    expect(report).toContain("结果代码：passed");
    expect(report).toContain("运行时间：2026-08-23T02:00:00.000Z");
    expect(report).toContain("结果指标：mean=4；rowCount=4");
  });
});
