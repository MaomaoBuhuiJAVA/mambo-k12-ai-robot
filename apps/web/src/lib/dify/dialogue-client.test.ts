import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestDifyDialogue, transformDifyDialogueStream } from "./dialogue-client";

async function read(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
  delete process.env.DIFY_DIALOGUE_APP_KEY;
});

beforeEach(() => {
  delete process.env.DIFY_TEACHING_AGENT_APP_KEY;
  delete process.env.DIFY_DIALOGUE_APP_KEY;
});

describe("Dify dialogue client", () => {
  it("converts Dify message SSE into website dialogue events", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: message\ndata: {"answer":"你好","metadata":{"retriever_resources":[{"document_name":"castle-lesson-01.txt"}]}}\n\n'));
        controller.enqueue(new TextEncoder().encode('event: message_end\ndata: {"event":"message_end"}\n\n'));
        controller.close();
      },
    });
    const output = await read(transformDifyDialogueStream(body, "trace:dialogue-test"));
    expect(output).toContain('event: start');
    expect(output).toContain('"text":"你好"');
    expect(output).toContain('"sourceIds":["castle-lesson-01.txt"]');
    expect(output).toContain('"degraded":false');
  });

  it("filters DeepSeek think tags even when tags cross stream chunks", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('event: message\ndata: {"answer":"<thi"}\n\n'));
        controller.enqueue(encoder.encode('event: message\ndata: {"answer":"nk>内部推理"}\n\n'));
        controller.enqueue(encoder.encode('event: message\ndata: {"answer":"</think>你好，星宝！"}\n\n'));
        controller.close();
      },
    });
    const output = await read(transformDifyDialogueStream(body, "trace:think-filter"));
    expect(output).toContain("你好，星宝！");
    expect(output).not.toContain("内部推理");
    expect(output).not.toContain("<think>");
  });

  it("drops citations outside the active source allow-list", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: message\ndata: {"answer":"已核对","metadata":{"retriever_resources":[{"document_name":"castle-lesson-01.txt"},{"document_name":"lava-lesson-01.txt"}]}}\n\n'));
        controller.close();
      },
    });
    const output = await read(transformDifyDialogueStream(body, "trace:source-filter", 1000, "test-v1", ["castle-lesson-01.txt"]));
    expect(output).toContain("castle-lesson-01.txt");
    expect(output).not.toContain("lava-lesson-01.txt");
  });

  it("returns a stable not-configured result without making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await requestDifyDialogue({ trace_id: "trace:missing" }, { fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: "DIFY_NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses streaming mode and the server-side dialogue key", async () => {
    vi.stubEnv("DIFY_DIALOGUE_APP_KEY", "dialogue-test-key");
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    const result = await requestDifyDialogue({ trace_id: "trace:dialogue" }, { fetchImpl });
    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("/chat-messages");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer dialogue-test-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({ response_mode: "streaming" });
  });

  it("prefers the shared teaching-agent key and sends the Chatflow query", async () => {
    vi.stubEnv("DIFY_TEACHING_AGENT_APP_KEY", "teaching-agent-key");
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    const result = await requestDifyDialogue({ trace_id: "trace:shared", question: "当前页讲了什么？" }, { fetchImpl });
    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("/chat-messages");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer teaching-agent-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      query: "[网站上下文] stage=unknown; teaching_mode=unknown; activity_id=unknown\n[学生问题] 当前页讲了什么？",
    });
  });

  it("scopes storybook retrieval to the active book and page", async () => {
    vi.stubEnv("DIFY_TEACHING_AGENT_APP_KEY", "teaching-agent-key");
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    await requestDifyDialogue({
      trace_id: "trace:storybook-scope",
      stage: "lower_primary",
      storybook_id: "castle-lesson-01",
      page_number: 6,
      question: "这一页讲了什么？",
    }, { fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      query: "[网站上下文] stage=lower_primary; teaching_mode=unknown; activity_id=unknown; storybook_id=castle-lesson-01; page_number=6\n[学生问题] 这一页讲了什么？",
    });
    expect(JSON.parse(String(init?.body)).inputs.page_number).toBe("6");
  });

  it("passes validated lab fields to the shared Chatflow query", async () => {
    vi.stubEnv("DIFY_TEACHING_AGENT_APP_KEY", "teaching-agent-key");
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    await requestDifyDialogue({
      trace_id: "trace:lab-scope",
      stage: "middle_school",
      teaching_mode: "lab",
      activity_id: "middle-neural-signals-guided-lab",
      template_id: "image-classifier",
      metrics_json: '{"accuracy":0.8}',
      question: "下一次只改变一个变量时应该观察什么？",
    }, { fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      query: expect.stringContaining("teaching_mode=lab"),
    });
    expect(JSON.parse(String(init?.body)).query).toContain('metrics={"accuracy":0.8}');
  });

  it("compacts the learning context before sending it to Dify", async () => {
    vi.stubEnv("DIFY_TEACHING_AGENT_APP_KEY", "teaching-agent-key");
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    const context = {
      schemaVersion: 1,
      traceId: "trace:compact",
      stage: "middle_school",
      activityId: "middle-neural-signals-guided-lab",
      moduleId: null,
      storybookId: null,
      pageNumber: null,
      knowledgePointIds: Array.from({ length: 12 }, (_, index) => `knowledge-point-${index}`),
      completedActivityIds: Array.from({ length: 8 }, (_, index) => `activity-${index}`),
    };
    await requestDifyDialogue({ trace_id: "trace:compact", context_json: JSON.stringify(context) }, { fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    const sent = JSON.parse(String(init?.body));
    expect(sent.inputs.context_json.length).toBeLessThan(256);
    expect(sent.inputs.context_json).toContain("middle-neural-signals-guided-lab");
  });

  it("ends a stalled upstream stream with a degraded completion event", async () => {
    const body = new ReadableStream<Uint8Array>({});
    const outputPromise = read(transformDifyDialogueStream(body, "trace:stall", 5));
    await expect(outputPromise).resolves.toContain('"reason":"DIFY_TIMEOUT"');
  });
});
