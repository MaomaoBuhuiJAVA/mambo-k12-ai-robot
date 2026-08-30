import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEARNING_STATE_CHANGED_EVENT } from "@/lib/learning-events";
import { createDefaultLearningState, loadLearningState, saveLearningState } from "@/lib/learning-store";
import { getActivity } from "@/data/learning-paths";
import type { LearningPathStage } from "@/data/learning-paths";
import type { LabTerminalResponse } from "./lab-protocol";
import type { LabRunner } from "./worker-controller";
import { listLabCodeVersions } from "./lab-version-store";
import { PythonLab } from "./python-lab";

vi.mock("./monaco-python-editor", () => ({
  MonacoPythonEditor: ({ value, onChange }: { value: string; onChange(value: string): void }) => (
    <textarea aria-label="Python 代码" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

function fakeRunner(): LabRunner {
  return {
    initialize: vi.fn(),
    getStatus: vi.fn(() => "ready" as const),
    subscribe: vi.fn((listener: (status: "ready") => void) => {
      listener("ready");
      return () => undefined;
    }),
    run: vi.fn(async () => ({
      type: "result" as const,
      id: "550e8400-e29b-41d4-a716-446655440000",
      durationMs: 12,
      passed: true,
      output: [{ stream: "stdout" as const, text: "挑战测试：全部通过" }],
    })),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
}

const completedThroughPython = [
  "middle-ai-foundations-lesson",
  "middle-ai-foundations-demonstration",
  "middle-ai-foundations-assessment",
  "middle-data-and-algorithms-lesson",
  "middle-data-and-algorithms-demonstration",
  "middle-data-and-algorithms-lab",
  "middle-data-and-algorithms-assessment",
  "middle-python-basics-lesson",
  "middle-python-basics-demonstration",
  "middle-python-basics-lab",
  "middle-python-basics-assessment",
];

const completedThroughNeuralSignals = [
  ...completedThroughPython,
  "middle-neural-signals-lesson",
  "middle-neural-signals-demonstration",
  "middle-neural-signals-guided-lab",
  "middle-neural-signals-independent-lab",
  "middle-neural-signals-assessment",
];

const completedThroughModelEvaluation = [
  ...completedThroughNeuralSignals,
  "middle-model-evaluation-lesson",
  "middle-model-evaluation-demonstration",
  "middle-model-evaluation-assessment",
];

const independentLearningLabRoutes = [
  ["middle_school", "bubble-sort", "middle-data-and-algorithms-lab"],
  ["middle_school", "middle-python-basics", "middle-python-basics-lab"],
  ["middle_school", "image-classifier", "middle-neural-signals-independent-lab"],
  ["high_school", "python-data-basics", "high-python-data-lab-code"],
  ["high_school", "bubble-sort-analysis", "high-bubble-analysis-code"],
  ["high_school", "dataset-split", "high-ml-pipeline-code"],
  ["high_school", "classification-metrics", "high-classification-regression-code"],
  ["high_school", "gradient-descent-demo", "high-neural-network-training-code"],
  ["high_school", "multimodal-input-audit", "high-multimodal-ai-code"],
  ["high_school", "rag-citation-check", "high-generative-ai-rag-code"],
] as const;

function completedPrerequisites(activityId: string): string[] {
  const completed: string[] = [];
  const visit = (candidateId: string) => {
    const candidate = getActivity(candidateId);
    if (!candidate) return;
    candidate.prerequisites.forEach(visit);
    if (!completed.includes(candidate.id)) completed.push(candidate.id);
  };
  getActivity(activityId)?.prerequisites.forEach(visit);
  return completed;
}

describe("PythonLab", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it.each(independentLearningLabRoutes)(
    "unlocks the registered %s %s experiment only for its active learning activity",
    (stage, templateId, activityId) => {
      const activity = getActivity(activityId);
      if (!activity) throw new Error(`Missing activity fixture: ${activityId}`);
      const state = createDefaultLearningState();
      saveLearningState({
        ...state,
        stageProgressByStage: {
          ...state.stageProgressByStage,
          [stage as LearningPathStage]: {
            ...state.stageProgressByStage[stage as LearningPathStage],
            completedActivityIds: completedPrerequisites(activity.id),
            activeActivityId: activity.id,
          },
        },
      });

      render(
        <PythonLab
          createRunner={fakeRunner}
          initialStage={stage}
          initialTemplateId={templateId}
          initialMode="independent"
        />,
      );

      return waitFor(() => {
        expect(screen.getByRole("button", { name: "运行代码" })).toBeEnabled();
        expect(screen.queryByText(/请先从学习路径完成前置活动/)).not.toBeInTheDocument();
      });
    },
  );

  it("keeps an independent experiment locked when its activity is not active", () => {
    render(
      <PythonLab
        createRunner={fakeRunner}
        initialStage="high_school"
        initialTemplateId="python-data-basics"
        initialMode="independent"
      />,
    );

    expect(screen.getByRole("button", { name: "运行代码" })).toBeDisabled();
    expect(screen.getByText(/请先从学习路径完成前置活动/)).toBeInTheDocument();
  });

  it("offers templates plus run, stop and reset controls", async () => {
    const user = userEvent.setup();
    const runner = fakeRunner();
    render(<PythonLab createRunner={() => runner} />);

    expect(screen.getByRole("button", { name: "冒泡排序" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "图像分类" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "运行代码" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "停止运行" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重置代码" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "运行代码" }));
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      templateId: "bubble-sort",
      challengeVersion: 1,
    }));
    expect(await screen.findByText("挑战测试：全部通过")).toBeInTheDocument();
  });

  it("switches templates and reset restores starter code", async () => {
    const user = userEvent.setup();
    render(<PythonLab createRunner={fakeRunner} />);

    await user.click(screen.getByRole("button", { name: "图像分类" }));
    const editor = screen.getByRole("textbox", { name: "Python 代码" });
    expect((editor as HTMLTextAreaElement).value).toContain("classify_image");

    await user.clear(editor);
    await user.type(editor, "print('changed')");
    await user.click(screen.getByRole("button", { name: "重置代码" }));
    expect((editor as HTMLTextAreaElement).value).toContain("classify_image");
  });

  it("starts from an entry-flow template and keeps its requested stage guidance", async () => {
    render(
      <PythonLab
        createRunner={fakeRunner}
        initialStage="lower_primary"
        initialTemplateId="image-classifier"
      />,
    );

    expect(screen.getByRole("button", { name: "图像分类" })).toHaveAttribute("aria-pressed", "true");
    expect((screen.getByRole("textbox", { name: "Python 代码" }) as HTMLTextAreaElement).value).toContain("classify_image");
    expect(screen.getByText("给叶子、球和杯子分别计分，再选出分数最高的图片标签。")).toBeInTheDocument();
  });

  it("keeps the project experiment scoped and exposes local version and mentor controls", async () => {
    const user = userEvent.setup();
    render(
      <PythonLab
        createRunner={fakeRunner}
        initialStage="high_school"
        initialTemplateId="model-audit"
        initialMode="project"
      />,
    );

    expect(screen.queryByRole("group", { name: "实验模板" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "高中项目实验上下文" })).toHaveTextContent("图像模型审计");
    expect(screen.getByRole("button", { name: "运行代码" })).toBeDisabled();
    expect(screen.getByText(/直接打开链接不会写入学习证据/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存版本" }));
    expect(screen.getByText(/当前代码版本已保存/)).toBeInTheDocument();
    expect(listLabCodeVersions()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "询问星宝" }));
    expect(screen.getByText(/星宝提示（本地实验教练）/)).toBeInTheDocument();
  });

  it("runs the H-01 CSV/JSON parity challenge and exposes its reproducible output", async () => {
    const user = userEvent.setup();
    const runner = fakeRunner();
    vi.mocked(runner.run).mockResolvedValue({
      type: "result",
      id: "550e8400-e29b-41d4-a716-446655440000",
      durationMs: 18,
      passed: true,
      output: [
        { stream: "stdout", text: "JSON 数据集 scores-json-v1：4 条记录，清洗后 3 条" },
        { stream: "stdout", text: "CSV 数据集 scores-csv-v1：4 条记录，清洗后 3 条" },
        { stream: "stdout", text: "图表数据：有效 3，缺失 1" },
        { stream: "stdout", text: "挑战测试：全部通过" },
      ],
    });

    render(
      <PythonLab
        createRunner={() => runner}
        initialStage="high_school"
        initialTemplateId="python-data-basics"
      />,
    );

    expect(screen.getByRole("heading", { name: "读取、清洗与汇总 CSV / JSON" })).toBeVisible();
    expect(screen.getByText(/固定 JSON 和 CSV/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "运行代码" }));

    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      templateId: "python-data-basics",
      challengeVersion: 3,
    }));
    expect(await screen.findByText(/CSV 数据集 scores-csv-v1/)).toBeInTheDocument();
    expect(screen.getByText(/图表数据：有效 3，缺失 1/)).toBeInTheDocument();
    expect(loadLearningState().attempts.at(-1)).toMatchObject({
      attemptId: "lab:python-data-basics:v3",
      knowledgePointId: "high.python-data-basics",
    });
  });

  it("requires a guided prediction, deterministic run, and observation before saving structured evidence", async () => {
    const user = userEvent.setup();
    const runner = fakeRunner();
    const state = createDefaultLearningState();
    saveLearningState({
      ...state,
      stageProgressByStage: {
        ...state.stageProgressByStage,
        middle_school: {
          ...state.stageProgressByStage.middle_school,
          completedActivityIds: [
            ...completedThroughPython,
            "middle-neural-signals-lesson",
            "middle-neural-signals-demonstration",
          ],
          activeActivityId: "middle-neural-signals-guided-lab",
        },
      },
    });
    render(
      <PythonLab
        createRunner={() => runner}
        initialStage="middle_school"
        initialTemplateId="image-classifier"
        initialMode="guided"
      />,
    );

    expect(screen.getByRole("heading", { name: "一次只改变一个变量" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "实验模板" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "运行代码" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "预测 ball" }));
    expect(screen.getByRole("button", { name: "运行代码" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "查看第一条提示" }));
    await user.click(screen.getByRole("button", { name: "运行代码" }));
    expect(await screen.findByText("三组固定样本的分类检查已通过。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存实验记录" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "运行代码" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "预测 ball" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "预测 cup" }));
    expect(screen.getByRole("button", { name: "预测 ball" })).toHaveAttribute("aria-pressed", "true");

    await user.type(screen.getByRole("textbox", { name: "观察记录" }), "纹理改成 handle 后，杯子类别得到更多支持，因此应重新判断标签。");
    await user.type(screen.getByRole("textbox", { name: "实验结论" }), "固定检查通过 3/3；把手线索增强了 cup 的支持，但预测仍需核对真实标签。");
    await user.click(screen.getByRole("button", { name: "保存实验记录" }));

    const evidence = loadLearningState().stageProgressByStage.middle_school.experimentEvidence.at(-1);
    expect(evidence).toMatchObject({
      activityId: "middle-neural-signals-guided-lab",
      mode: "guided",
      variables: {
        changedVariable: "texture",
        learnerPrediction: "ball",
        predictionBeforeRun: "ball",
        hintsUsed: 1,
        resultCode: "passed",
      },
      metrics: { passedTests: 3, totalTests: 3, predictionCorrect: 0, sampleCount: 3 },
    });
    expect(evidence?.variables.runDurationMs).toBe(12);
    expect(evidence?.variables.challengeVersion).toBe(1);
    expect(evidence?.variables.datasetVersion).toBe("image-classifier-lab-v1");
    expect(evidence?.variables.hintsUsed).toBe(1);
    expect(await screen.findByText(/已保存预测、变量、测试指标、提示次数、观察和结论/)).toBeInTheDocument();
  });

  it("keeps independent work locked until two comparable runs and metric-grounded conclusion are saved", async () => {
    const user = userEvent.setup();
    const state = createDefaultLearningState();
    saveLearningState({
      ...state,
      stageProgressByStage: {
        ...state.stageProgressByStage,
        middle_school: {
          ...state.stageProgressByStage.middle_school,
          completedActivityIds: [
            ...completedThroughPython,
            "middle-neural-signals-lesson",
            "middle-neural-signals-demonstration",
            "middle-neural-signals-guided-lab",
          ],
          activeActivityId: "middle-neural-signals-independent-lab",
        },
      },
    });
    render(
      <PythonLab
        createRunner={fakeRunner}
        initialStage="middle_school"
        initialTemplateId="image-classifier"
        initialMode="independent"
      />,
    );

    expect(screen.getByRole("heading", { name: "选择一个变量，完成两次比较" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "实验模板" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "运行代码" }));
    expect(await screen.findByText(/本次独立运行已保存/)).toBeInTheDocument();
    expect(screen.getAllByText("条纹")).toHaveLength(2);
    expect(screen.getByText(/请使用同一变量的另一个取值再次运行/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "把手" }));
    await user.click(screen.getByRole("button", { name: "运行代码" }));
    expect(await screen.findByText("两次运行可比较。请引用表中的真实指标完成结论。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存独立实验结论" })).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "改变了什么" }), "我改变了纹理线索，从条纹改为把手。");
    await user.type(screen.getByRole("textbox", { name: "结果如何变化" }), "两次固定检查都是 3/3，cup 分数从 3 增到 5。");
    await user.type(screen.getByRole("textbox", { name: "原因是什么" }), "把手是杯子的明显线索，因此得分会提高。");
    await user.click(screen.getByRole("button", { name: "保存独立实验结论" }));

    const evidence = loadLearningState().stageProgressByStage.middle_school.experimentEvidence;
    expect(evidence).toHaveLength(3);
    expect(evidence.at(-1)).toMatchObject({
      activityId: "middle-neural-signals-independent-lab",
      variables: { evidenceType: "summary", independentVariable: "texture" },
      metrics: { runCount: 2, distinctValues: 2, firstSelectedScore: 3, secondSelectedScore: 5 },
    });
    expect(await screen.findByText(/两次可比较运行和实验结论已保存/)).toBeInTheDocument();
  });

  it("restores a saved guided evidence record after a refresh", async () => {
    const state = createDefaultLearningState();
    saveLearningState({
      ...state,
      stageProgressByStage: {
        ...state.stageProgressByStage,
        middle_school: {
          ...state.stageProgressByStage.middle_school,
          completedActivityIds: [
            ...completedThroughPython,
            "middle-neural-signals-lesson",
            "middle-neural-signals-demonstration",
          ],
          activeActivityId: "middle-neural-signals-guided-lab",
          experimentEvidence: [{
            runId: "550e8400-e29b-41d4-a716-446655440000",
            activityId: "middle-neural-signals-guided-lab",
            courseId: "middle-neural-signals",
            templateId: "image-classifier",
            mode: "guided",
            variables: {
              changedVariable: "texture",
              baselineTexture: "striped",
              changedTexture: "handle",
              learnerPrediction: "cup",
              predictionBeforeRun: "cup",
              datasetVersion: "image-classifier-lab-v1",
              challengeVersion: 1,
              runDurationMs: 12,
              hintsUsed: 0,
              resultCode: "passed",
              observation: "把手线索让杯子更容易识别。",
              learnerConclusion: "固定检查通过 3/3，仍需核对真实标签。",
            },
            metrics: { passedTests: 3, totalTests: 3, predictionCorrect: 1, sampleCount: 3 },
            conclusion: "观察：把手线索让杯子更容易识别。\n结论：固定检查通过 3/3，仍需核对真实标签。",
            completedAt: "2026-08-23T04:00:00.000Z",
          }],
        },
      },
    });
    render(
      <PythonLab
        createRunner={fakeRunner}
        initialStage="middle_school"
        initialTemplateId="image-classifier"
        initialMode="guided"
      />,
    );

    expect(await screen.findByRole("button", { name: "实验记录已保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "预测 cup" })).toBeDisabled();
    expect((screen.getByRole("textbox", { name: "观察记录" }) as HTMLTextAreaElement).value).toContain("把手线索");
    expect((screen.getByRole("textbox", { name: "实验结论" }) as HTMLTextAreaElement).value).toContain("3/3");
  });

  it("keeps the guided observation locked after a failed deterministic run and allows retry", async () => {
    const user = userEvent.setup();
    const state = createDefaultLearningState();
    saveLearningState({
      ...state,
      stageProgressByStage: {
        ...state.stageProgressByStage,
        middle_school: {
          ...state.stageProgressByStage.middle_school,
          completedActivityIds: [
            ...completedThroughPython,
            "middle-neural-signals-lesson",
            "middle-neural-signals-demonstration",
          ],
          activeActivityId: "middle-neural-signals-guided-lab",
        },
      },
    });
    const runner = fakeRunner();
    runner.run = vi.fn(async () => ({
      type: "result" as const,
      id: "550e8400-e29b-41d4-a716-446655440000",
      durationMs: 21,
      passed: false,
      output: [{ stream: "stderr" as const, text: "第 1 个样本未通过" }],
    }));
    render(
      <PythonLab
        createRunner={() => runner}
        initialStage="middle_school"
        initialTemplateId="image-classifier"
        initialMode="guided"
      />,
    );

    await user.click(screen.getByRole("button", { name: "预测 ball" }));
    await user.click(screen.getByRole("button", { name: "运行代码" }));
    expect(await screen.findByText("代码已运行，但挑战检查尚未全部通过")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "观察记录" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预测 ball" })).toBeEnabled();
    expect(loadLearningState().stageProgressByStage.middle_school.experimentEvidence).toHaveLength(0);
  });

  it("evaluates the fixed backlit research challenge and saves evidence only after a comparison and metric-grounded conclusion", async () => {
    const user = userEvent.setup();
    const state = createDefaultLearningState();
    saveLearningState({
      ...state,
      stageProgressByStage: {
        ...state.stageProgressByStage,
        middle_school: {
          ...state.stageProgressByStage.middle_school,
          completedActivityIds: [
            ...completedThroughModelEvaluation,
            "middle-data-bias-lesson",
            "middle-data-bias-demonstration",
          ],
          activeActivityId: "middle-data-bias-research",
        },
      },
    });
    const runner = fakeRunner();
    render(
      <PythonLab
        createRunner={() => runner}
        initialStage="middle_school"
        initialTemplateId="image-classifier"
        initialMode="research"
      />,
    );

    expect(await screen.findByRole("heading", { name: "改善逆光图片分类表现" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Python 代码" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "评估补样本方案" }));
    expect(await screen.findByText(/方案和分组指标已保存/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /逆光叶子样本/ }));
    await user.click(screen.getByRole("checkbox", { name: /逆光球样本/ }));
    await user.click(screen.getByRole("checkbox", { name: /逆光杯子样本/ }));
    await user.click(screen.getByRole("button", { name: "评估补样本方案" }));
    await user.type(
      screen.getByRole("textbox", { name: "研究结论" }),
      "我补充了逆光叶子、球和杯子样本，逆光组从 4/10 提升到 7/10，说明应补充逆光场景的样本。",
    );
    await user.click(screen.getByRole("button", { name: "保存研究挑战证据" }));

    expect(runner.run).not.toHaveBeenCalled();
    expect(loadLearningState().stageProgressByStage.middle_school.experimentEvidence).toHaveLength(3);
    expect(await screen.findByText(/研究挑战证据已保存/)).toBeInTheDocument();
    expect(screen.getByLabelText("研究数据工作台")).toBeInTheDocument();
    expect(screen.getByLabelText("研究指标与运行记录")).toBeInTheDocument();
  });

  it("enables stop while running and disposes the worker on unmount", async () => {
    const user = userEvent.setup();
    let listener: ((status: "ready" | "running") => void) | undefined;
    const runner = fakeRunner();
    runner.subscribe = vi.fn((nextListener) => {
      listener = nextListener;
      nextListener("ready");
      return () => undefined;
    });
    runner.run = vi.fn(() => {
      listener?.("running");
      return new Promise<LabTerminalResponse>(() => undefined);
    });
    const { unmount } = render(<PythonLab createRunner={() => runner} />);

    await user.click(screen.getByRole("button", { name: "运行代码" }));
    const stop = screen.getByRole("button", { name: "停止运行" });
    expect(stop).toBeEnabled();
    await user.click(stop);
    expect(runner.stop).toHaveBeenCalledOnce();

    unmount();
    expect(runner.dispose).toHaveBeenCalledOnce();
  });

  it("offers an explicit retry after initialization failure", async () => {
    const user = userEvent.setup();
    let listener: ((status: "ready" | "error") => void) | undefined;
    const runner = fakeRunner();
    runner.subscribe = vi.fn((nextListener) => {
      listener = nextListener;
      nextListener("ready");
      return () => undefined;
    });
    render(<PythonLab createRunner={() => runner} />);

    listener?.("error");
    await user.click(await screen.findByRole("button", { name: "重试加载" }));

    expect(runner.initialize).toHaveBeenCalledTimes(2);
  });

  it("shows a recoverable message when the runner rejects a run request", async () => {
    const user = userEvent.setup();
    const runner = fakeRunner();
    runner.run = vi.fn(async () => {
      throw new Error("transport closed");
    });
    render(<PythonLab createRunner={() => runner} />);

    await user.click(screen.getByRole("button", { name: "运行代码" }));
    expect(await screen.findByText(/运行请求失败，实验环境已重置/)).toBeInTheDocument();
  });

  it("records real hint use as low-weight evidence and announces the saved change", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    window.addEventListener(LEARNING_STATE_CHANGED_EVENT, changed);
    render(<PythonLab createRunner={fakeRunner} />);

    await user.click(screen.getByRole("button", { name: "查看第一条提示" }));
    await user.click(screen.getByRole("button", { name: "运行代码" }));

    const attempt = loadLearningState().attempts.at(-1);
    expect(attempt).toMatchObject({
      attemptId: "lab:bubble-sort:v1",
      score: 0.7,
      hints: 1,
      mode: "code",
    });
    expect(changed).toHaveBeenCalledOnce();
    expect(await screen.findByText("形成性练习已保存到本机学习记录")).toBeInTheDocument();
    window.removeEventListener(LEARNING_STATE_CHANGED_EVENT, changed);
  });

  it("reports storage failure honestly and does not announce a saved change", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    window.addEventListener(LEARNING_STATE_CHANGED_EVENT, changed);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    render(<PythonLab createRunner={fakeRunner} />);

    await user.click(screen.getByRole("button", { name: "运行代码" }));

    expect(await screen.findByText("挑战已通过，但本机学习记录保存失败")).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
    window.removeEventListener(LEARNING_STATE_CHANGED_EVENT, changed);
  });
});
