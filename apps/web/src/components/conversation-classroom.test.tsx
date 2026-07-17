import { act, render, screen, waitFor } from "@testing-library/react";
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

  it("previews a valid PNG and sends its data URL with the newest chat message", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse(["received"]));
    render(<ConversationClassroom course={course} stage="lower_primary" />);

    await user.upload(screen.getByLabelText("添加图片"), new File([new Uint8Array([137, 80, 78, 71])], "work.png", { type: "image/png" }));
    expect(await screen.findByAltText("待发送图片预览")).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "给 Mambo 发消息" }), "Look at this");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.messages.at(-1)).toMatchObject({ content: "Look at this", image: expect.stringMatching(/^data:image\/png;base64,/) });
  });

  it("stops recording at thirty seconds and places a transcription in the draft without sending chat", async () => {
    vi.useFakeTimers();
    const track = { stop: vi.fn() };
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    class FakeMediaRecorder {
      static stop = vi.fn();
      onstop: (() => void) | null = null;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      mimeType = "audio/webm";
      start = vi.fn();
      stop = () => { FakeMediaRecorder.stop(); this.onstop?.(); };
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ transcript: "语音转写内容" }), { status: 200 }));
    render(<ConversationClassroom course={course} stage="lower_primary" />);

    await act(async () => { screen.getByRole("button", { name: "录音" }).click(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    vi.useRealTimers();

    expect(FakeMediaRecorder.stop).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "给 Mambo 发消息" })).toHaveValue("语音转写内容"));
    expect(fetchMock).toHaveBeenCalledWith("/api/transcribe", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/chat", expect.anything());
  });

  it("uses child-friendly Chinese speech settings and can stop reading", async () => {
    const user = userEvent.setup();
    const speak = vi.fn();
    const cancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak, cancel } });
    class FakeUtterance { text: string; lang = ""; rate = 1; constructor(text: string) { this.text = text; } }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: FakeUtterance });
    render(<ConversationClassroom course={course} stage="lower_primary" />);

    await user.click(screen.getAllByRole("button", { name: "朗读回答" })[0]);
    const utterance = speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.lang).toBe("zh-CN");
    expect(utterance.rate).toBe(0.85);
    await user.click(screen.getAllByRole("button", { name: "停止朗读" })[0]);
    expect(cancel).toHaveBeenCalled();
  });
});
