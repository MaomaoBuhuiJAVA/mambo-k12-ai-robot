import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requestDifyBattleFeedback, requestDifyBattleQuestion, requestDifyRecommendation } from "./client";

const validOutput = {
  schemaVersion: 1,
  traceId: "trace:test",
  workflowVersion: "primary-battle-question-v1",
  resultType: "battle_question",
  contentVersion: "2026-08-24",
  sourceIds: ["castle-lesson-01:p01"],
  payload: {
    questionId: "generated:castle-1:0",
    topic: "观察",
    prompt: "先观察什么？",
    options: ["颜色", "传闻", "猜测", "密码"],
    answerIndex: 0,
    explanation: "先记录看得见的特征。",
    knowledgePointIds: ["castle:ordered-observation"],
    sourcePageIds: ["castle-lesson-01:p01"],
  },
};

const validFeedbackOutput = {
  schemaVersion: 1,
  traceId: "trace:feedback",
  workflowVersion: "primary-battle-feedback-v1",
  resultType: "battle_feedback",
  contentVersion: "2026-08-24",
  sourceIds: [],
  payload: { feedback: "答对了，继续用证据观察。" },
};

beforeEach(() => {
  // Keep local .env.local credentials out of tests that explicitly exercise fallback and legacy modes.
  delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
});

afterEach(() => {
  delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
});

describe("requestDifyBattleQuestion", () => {
  it("degrades without exposing a missing API key", async () => {
    const previous = process.env.DIFY_PRIMARY_BATTLE_APP_KEY;
    delete process.env.DIFY_PRIMARY_BATTLE_APP_KEY;
    const result = await requestDifyBattleQuestion({});
    if (previous) process.env.DIFY_PRIMARY_BATTLE_APP_KEY = previous;
    expect(result).toMatchObject({ ok: false, reason: "DIFY_NOT_CONFIGURED" });
  });

  it("parses a blocking Dify output and strips JSON fences", async () => {
    const previous = process.env.DIFY_PRIMARY_BATTLE_APP_KEY;
    process.env.DIFY_PRIMARY_BATTLE_APP_KEY = "test-key";
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ data: { outputs: { output: `\`\`\`json\n${JSON.stringify(validOutput)}\n\`\`\`` } } }), { status: 200 });
    const result = await requestDifyBattleQuestion({}, { fetchImpl });
    if (previous) process.env.DIFY_PRIMARY_BATTLE_APP_KEY = previous;
    else delete process.env.DIFY_PRIMARY_BATTLE_APP_KEY;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload.questionId).toBe("generated:castle-1:0");
  });

  it("normalizes DeepSeek reasoning and the shared Chatflow question shape", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "shared-agent-key";
    const output = {
      question: "星宝应该怎样观察？",
      options: ["按顺序看", "随便猜", "只看一个", "不观察"],
      answer: "按顺序看",
      explanation: "按顺序观察可以减少遗漏。",
      knowledgePointId: "castle:ordered-observation",
      sourceStorybookId: "castle-lesson-01",
      sourcePageNumber: 2,
    };
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      answer: `<think>内部推理不应进入网页</think>${JSON.stringify(output)}`,
    }), { status: 200 });
    const result = await requestDifyBattleQuestion({
      module_id: "castle-1",
      question_index: 0,
      context_json: JSON.stringify({ traceId: "trace:normalized", moduleId: "castle-1" }),
    }, { fetchImpl });
    delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.payload.answerIndex).toBe(0);
      expect(result.value.payload.sourcePageIds).toEqual(["castle-lesson-01:p02"]);
    }
  });

  it("normalizes the shared Chatflow top-level questionText shape", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "shared-agent-key";
    const output = {
      schemaVersion: 1, traceId: "trace:top", questionId: "q-1",
      questionText: "按顺序观察城堡图片时，应该怎么做？",
      options: [{ index: 0, text: "从上到下，从左到右观察" }, { index: 1, text: "只观察塔楼" }, { index: 2, text: "只观察大门" }, { index: 3, text: "随意观察" }],
      answerIndex: 0, knowledgePointId: "castle:ordered-observation",
      sourceStorybookId: "castle-lesson-01", sourcePageNumber: 2,
      evidenceQuote: "门上有好多好多图案，应该按固定顺序观察。",
    };
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ answer: JSON.stringify(output) }), { status: 200 });
    const result = await requestDifyBattleQuestion({
      module_id: "castle-1", question_index: 0,
      allowed_knowledge_point_ids: JSON.stringify(["castle:ordered-observation"]),
      knowledge_context: "[castle-lesson-01 第2页] 旁白：大门上印满整整齐齐的方格花纹。",
      context_json: JSON.stringify({ traceId: "trace:top", moduleId: "castle-1", completedActivityIds: ["castle-lesson-01"] }),
    }, { fetchImpl });
    delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
    expect(result.ok).toBe(true);
  });

  it("accepts Dify's numeric sourcePageIds when the storybook and page are also explicit", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "shared-agent-key";
    const output = {
      question: "星宝在观察时，第一步应该做什么？",
      options: ["分辨颜色", "数格子", "看形状", "听声音"],
      answerIndex: 0,
      sourceStorybookId: "castle-lesson-01",
      sourcePageNumber: 4,
      evidenceQuote: "第一步，先分辨所有图案的颜色。",
      sourceIds: ["castle-lesson-01"],
      sourcePageIds: [4],
    };
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ answer: JSON.stringify(output) }), { status: 200 });
    const result = await requestDifyBattleQuestion({
      module_id: "castle-1", question_index: 0,
      allowed_knowledge_point_ids: JSON.stringify(["castle:ordered-observation"]),
      knowledge_context: "[castle-lesson-01 第4页] 第一步，先分辨所有图案的颜色。",
      context_json: JSON.stringify({ traceId: "trace:numeric-page", moduleId: "castle-1", completedActivityIds: ["castle-lesson-01"] }),
    }, { fetchImpl });
    delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload.sourcePageIds).toEqual(["castle-lesson-01:p04"]);
  });

  it("rejects structurally invalid Dify output", async () => {
    const previous = process.env.DIFY_PRIMARY_BATTLE_APP_KEY;
    process.env.DIFY_PRIMARY_BATTLE_APP_KEY = "test-key";
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ data: { outputs: { output: "{}" } } }), { status: 200 });
    const result = await requestDifyBattleQuestion({}, { fetchImpl });
    if (previous) process.env.DIFY_PRIMARY_BATTLE_APP_KEY = previous;
    else delete process.env.DIFY_PRIMARY_BATTLE_APP_KEY;
    expect(result).toMatchObject({ ok: false, reason: "DIFY_INVALID_OUTPUT" });
  });

  it("uses the shared teaching agent Chatflow before the legacy battle Workflow", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "shared-agent-key";
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain("/chat-messages");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        response_mode: "blocking",
        inputs: { teaching_mode: "battle", battle_action: "question" },
      });
      return new Response(JSON.stringify({ answer: JSON.stringify(validOutput) }), { status: 200 });
    };
    const result = await requestDifyBattleQuestion({}, { fetchImpl });
    delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
    expect(result.ok).toBe(true);
  });

  it("parses feedback output through the same blocking adapter", async () => {
    const previous = process.env.DIFY_PRIMARY_BATTLE_FEEDBACK_APP_KEY;
    process.env.DIFY_PRIMARY_BATTLE_FEEDBACK_APP_KEY = "test-key";
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ data: { outputs: { output: JSON.stringify(validFeedbackOutput) } } }), { status: 200 });
    const result = await requestDifyBattleFeedback({}, { fetchImpl });
    if (previous) process.env.DIFY_PRIMARY_BATTLE_FEEDBACK_APP_KEY = previous;
    else delete process.env.DIFY_PRIMARY_BATTLE_FEEDBACK_APP_KEY;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload.feedback).toContain("答对");
  });

  it("normalizes the shared Chatflow nested feedback shape", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "shared-agent-key";
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ answer: `<think>hidden</think>${JSON.stringify({ traceId: "trace:feedback-normalized", feedback: { explanation: "答对了，继续观察。" } })}` }), { status: 200 });
    const result = await requestDifyBattleFeedback({}, { fetchImpl });
    delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload.feedback).toBe("答对了，继续观察。");
  });

  it("normalizes the shared Chatflow flat feedback shape", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "shared-agent-key";
    const flat = { schemaVersion: 1, traceId: "trace:flat", isCorrect: true, studentAnswer: "对", correctAnswer: "对", explanation: "答对了。", knowledgePointIds: ["castle:ordered-observation"], storybookId: null, pageNumber: null };
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ answer: `<think>hidden</think>${JSON.stringify(flat)}` }), { status: 200 });
    const result = await requestDifyBattleFeedback({}, { fetchImpl });
    delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload.feedback).toBe("答对了。");
  });

  it("uses the shared teaching agent for feedback too", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "shared-agent-key";
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain("/chat-messages");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        response_mode: "blocking",
        inputs: { teaching_mode: "battle", battle_action: "feedback" },
      });
      return new Response(JSON.stringify({ answer: JSON.stringify(validFeedbackOutput) }), { status: 200 });
    };
    const result = await requestDifyBattleFeedback({}, { fetchImpl });
    delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
    expect(result.ok).toBe(true);
  });
});

describe("requestDifyRecommendation", () => {
  it("parses a blocking recommendation envelope", async () => {
    process.env.DIFY_RECOMMENDATION_APP_KEY = "recommendation-key";
    const output = {
      schemaVersion: 1,
      traceId: "trace:recommendation",
      workflowVersion: "learning-path-suggestion-v1",
      resultType: "learning_path_suggestion",
      contentVersion: "2026-08-24",
      sourceIds: ["course:middle-ai-foundations"],
      payload: { recommendations: [{ actionId: "middle-next", reason: "继续学习", priority: 1 }] },
    };
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ data: { outputs: { output: JSON.stringify(output) } } }), { status: 200 });
    const result = await requestDifyRecommendation({}, { fetchImpl });
    delete process.env.DIFY_RECOMMENDATION_APP_KEY;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload.recommendations[0]?.actionId).toBe("middle-next");
  });

  it("adds an explicit structured-output task when using the shared Chatflow", async () => {
    process.env.DIFY_TEACHING_AGENT_APP_KEY = "shared-agent-key";
    const output = {
      schemaVersion: 1,
      traceId: "trace:recommendation",
      workflowVersion: "learning-path-suggestion-v1",
      resultType: "learning_path_suggestion",
      contentVersion: "2026-08-24",
      sourceIds: ["course:middle-ai-foundations"],
      payload: { recommendations: [{ actionId: "middle-next", reason: "继续学习", priority: 1 }] },
    };
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.inputs.teaching_mode).toBe("recommendation");
      expect(body.query).toContain("learning_path_suggestion-v1");
      return new Response(JSON.stringify({ answer: JSON.stringify(output) }), { status: 200 });
    };
    const result = await requestDifyRecommendation({}, { fetchImpl });
    delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
    expect(result.ok).toBe(true);
  });
});
