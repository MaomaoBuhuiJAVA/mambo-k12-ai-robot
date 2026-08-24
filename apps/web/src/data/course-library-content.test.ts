import { describe, expect, it } from "vitest";
import { getCourseLibraryContent } from "./course-library-content";

describe("course library content", () => {
  it("provides versioned terms and a recoverable failure case for every initial middle-school course", () => {
    for (const id of ["middle-ai-foundations", "middle-data-and-algorithms", "middle-python-basics", "middle-neural-signals", "middle-model-evaluation", "middle-data-bias", "middle-generative-ai", "middle-ai-safety"]) {
      const content = getCourseLibraryContent(id);
      expect(content?.version).toBe(1);
      expect(content?.terms.length).toBeGreaterThan(1);
      expect(content?.failureCases[0]?.nextStep).toBeTruthy();
    }
  });

  it("provides versioned terms and a recoverable failure case for every high-school course", () => {
    for (const id of ["high-python-data-lab", "high-bubble-analysis", "high-ml-pipeline", "high-classification-regression", "high-neural-network-training", "high-multimodal-ai", "high-generative-ai-rag", "high-image-model-audit"]) {
      const content = getCourseLibraryContent(id);
      expect(content?.version).toBe(["high-python-data-lab", "high-ml-pipeline", "high-classification-regression", "high-neural-network-training", "high-multimodal-ai", "high-generative-ai-rag"].includes(id) ? 2 : 1);
      expect(content?.terms.length).toBeGreaterThanOrEqual(3);
      expect(content?.failureCases[0]).toMatchObject({
        title: expect.any(String),
        observation: expect.any(String),
        nextStep: expect.any(String),
      });
    }
  });

  it("teaches H-04 boundary metrics, complete regression samples and error-cost choices", () => {
    const content = getCourseLibraryContent("high-classification-regression");

    expect(content?.terms.map((term) => term.term)).toEqual(expect.arrayContaining([
      "混淆矩阵",
      "精确率",
      "召回率",
      "F1",
      "均方误差",
    ]));
    expect(content?.failureCases.map((failure) => failure.title)).toEqual(expect.arrayContaining([
      "零分母被当作异常",
      "MSE 只用两条样本",
      "错误代价没有对应指标",
    ]));
  });

  it("teaches H-05 reproducible curves, parameter versions and recoverable overfitting signals", () => {
    const content = getCourseLibraryContent("high-neural-network-training");

    expect(content?.terms.map((term) => term.term)).toEqual(expect.arrayContaining([
      "学习率",
      "训练曲线",
      "参数集版本",
    ]));
    expect(content?.failureCases.map((failure) => failure.title)).toEqual(expect.arrayContaining([
      "只看最后一轮",
      "学习率没有版本",
      "曲线长度不一致",
      "把验证回升当作训练失败",
    ]));
  });

  it("teaches H-01 CSV/JSON parity and chart preparation as a recoverable skill", () => {
    const content = getCourseLibraryContent("high-python-data-lab");

    expect(content?.terms.map((term) => term.term)).toEqual(expect.arrayContaining(["数据格式", "图表数据"]));
    expect(content?.failureCases[1]).toMatchObject({
      title: "只验证一种格式",
      nextStep: expect.stringContaining("scores-csv-v1"),
    });
  });

  it("teaches H-06 versioned modality comparison with authorization and privacy boundaries", () => {
    const content = getCourseLibraryContent("high-multimodal-ai");

    expect(content?.version).toBe(2);
    expect(content?.terms.map((term) => term.term)).toEqual(expect.arrayContaining([
      "输入版本",
      "失败样本",
      "授权边界",
      "隐私边界",
    ]));
    expect(content?.failureCases.map((failure) => failure.title)).toEqual(expect.arrayContaining([
      "只报告最高分",
      "把未授权输入算进准确率",
      "版本或样本混用",
    ]));
    expect(content?.failureCases[1]?.nextStep).toContain("excluded_samples");
  });

  it("teaches H-03 baseline provenance and leakage as a recoverable skill", () => {
    const content = getCourseLibraryContent("high-ml-pipeline");

    expect(content?.version).toBe(2);
    expect(content?.terms.map((term) => term.term)).toEqual(expect.arrayContaining(["基线预测", "实验版本"]));
    expect(content?.failureCases[0]).toMatchObject({
      title: "测试集选择基线",
      nextStep: expect.stringContaining("leakage_detected=true"),
    });
  });

  it("teaches H-07 fixed retrieval comparison, failed claims and tool permissions", () => {
    const content = getCourseLibraryContent("high-generative-ai-rag");

    expect(content?.version).toBe(2);
    expect(content?.terms.map((term) => term.term)).toEqual(expect.arrayContaining([
      "固定知识库版本",
      "引用匹配",
      "未支持主张",
      "工具权限",
    ]));
    expect(content?.failureCases.map((failure) => failure.title)).toEqual(expect.arrayContaining([
      "只看有检索的匹配数",
      "未知引用被当作可信来源",
      "工具权限没有证据",
      "版本或主张字段缺失",
    ]));
    expect(content?.failureCases[0]?.nextStep).toContain("unsupported_claims");
  });
});
