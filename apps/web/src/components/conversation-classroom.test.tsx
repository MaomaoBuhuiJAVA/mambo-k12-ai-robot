import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getFeaturedCourses } from "@/data/curriculum";

import { ConversationClassroom } from "./conversation-classroom";

const course = getFeaturedCourses("lower_primary")[0]!;

function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ConversationClassroom", () => {
  it("sends the course context and renders streamed assistant text", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse(["First part", " and final part"]),
    );

    render(<ConversationClassroom course={course} stage="lower_primary" />);
    await user.type(screen.getByRole("textbox", { name: "给 Mambo 发消息" }), "What is this?");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    await waitFor(() => expect(screen.getByText("First part and final part")).toBeVisible());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"courseId":"lower-bubble-sort"'),
      }),
    );
  });

  it("uses a natural course fallback when chat is unavailable", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    render(<ConversationClassroom course={course} stage="lower_primary" />);
    await user.type(screen.getByRole("textbox", { name: "给 Mambo 发消息" }), "Help");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    expect(await screen.findByText(/我先用课程内容回答/)).toBeVisible();
    expect(screen.queryByText(/network|503/i)).not.toBeInTheDocument();
  });

  it("aborts the active answer when Stop answering is clicked", async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      signal = (init as RequestInit).signal ?? undefined;
      return new Promise(() => undefined);
    });

    render(<ConversationClassroom course={course} stage="lower_primary" />);
    await user.type(screen.getByRole("textbox", { name: "给 Mambo 发消息" }), "Wait");
    await user.click(screen.getByRole("button", { name: "发送消息" }));
    await user.click(screen.getByRole("button", { name: "停止回答" }));

    expect(signal?.aborted).toBe(true);
  });

  it("rejects an unsupported image before sending", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ConversationClassroom course={course} stage="lower_primary" />);
    const input = screen.getByLabelText("添加图片");
    await user.upload(input, new File(["x"], "note.txt", { type: "text/plain" }));

    expect(screen.getByText(/JPEG、PNG 或 WebP/)).toBeVisible();
  });

  it("shows a natural recording status when recording is unsupported", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: undefined });
    render(<ConversationClassroom course={course} stage="lower_primary" />);

    await user.click(screen.getByRole("button", { name: "录音" }));
    expect(screen.getByText(/当前设备不支持录音/)).toBeVisible();
  });
});
