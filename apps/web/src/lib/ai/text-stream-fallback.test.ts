import { describe, expect, it } from "vitest";

import { withTextStreamFallback } from "./text-stream-fallback";

async function collect(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let output = "";
  for (;;) {
    const result = await reader.read();
    if (result.done) return output;
    output += result.value;
  }
}

describe("withTextStreamFallback", () => {
  it("passes through a healthy stream", async () => {
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("第一段");
        controller.enqueue("第二段");
        controller.close();
      },
    });
    await expect(collect(withTextStreamFallback(source, "降级"))).resolves.toBe("第一段第二段");
  });

  it("turns an empty or failed-before-output stream into a course fallback", async () => {
    await expect(collect(withTextStreamFallback(new ReadableStream({ start: (controller) => controller.close() }), "课程降级回答")))
      .resolves.toBe("课程降级回答");

    const failed = new ReadableStream<string>({ start: (controller) => controller.error(new Error("upstream")) });
    await expect(collect(withTextStreamFallback(failed, "课程降级回答")))
      .resolves.toBe("课程降级回答");
  });

  it("marks an interrupted partial answer instead of failing the response body", async () => {
    let pulls = 0;
    const partial = new ReadableStream<string>({
      pull(controller) {
        if (pulls === 0) controller.enqueue("已经生成的部分");
        else controller.error(new Error("disconnected"));
        pulls += 1;
      },
    });
    const text = await collect(withTextStreamFallback(partial, "课程降级回答"));
    expect(text).toContain("已经生成的部分");
    expect(text).toContain("回答连接中断");
  });
});
