import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getFeaturedCourses } from "@/data/curriculum";
import { conversationStorageKey } from "@/lib/conversation-store";

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

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ConversationClassroom", () => {
  it("restores completed text turns for the selected course", async () => {
    localStorage.setItem(conversationStorageKey(course.id), JSON.stringify([
      { id: "saved-user", author: "learner", text: "为什么大的数会往后走？" },
      { id: "saved-assistant", author: "assistant", text: "因为相邻比较后，较大的数会交换到右边。" },
    ]));

    render(<ConversationClassroom course={course} stage="lower_primary" />);

    expect(await screen.findByText("为什么大的数会往后走？")).toBeVisible();
    expect(screen.getByText("因为相邻比较后，较大的数会交换到右边。")).toBeVisible();
  });

  it("persists a completed answer so it survives a remount", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse(["保存后的回答"]));
    const first = render(<ConversationClassroom course={course} stage="lower_primary" />);

    await user.type(screen.getByRole("textbox", { name: "给 Mambo 发消息" }), "请记住这一问");
    await user.click(screen.getByRole("button", { name: "发送消息" }));
    await screen.findByText("保存后的回答");
    first.unmount();

    render(<ConversationClassroom course={course} stage="lower_primary" />);
    expect(await screen.findByText("请记住这一问")).toBeVisible();
    expect(screen.getByText("保存后的回答")).toBeVisible();
  });

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

    expect(await screen.findByText(/AI 服务暂时不可用/)).toBeVisible();
    expect(screen.getByText(/\[S1\]/)).toBeVisible();
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

  it("removes an empty aborted answer and keeps the next request history valid", async () => {
    const user = userEvent.setup();
    let call = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      call += 1;
      if (call === 1) {
        return new Promise<Response>((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
      return Promise.resolve(streamResponse(["Second answer"]));
    });

    render(<ConversationClassroom course={course} stage="lower_primary" />);
    const input = screen.getByRole("textbox", { name: "给 Mambo 发消息" });
    await user.type(input, "First question");
    await user.click(screen.getByRole("button", { name: "发送消息" }));
    await user.click(screen.getByRole("button", { name: "停止回答" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "停止回答" })).not.toBeInTheDocument());

    await user.type(input, "Second question");
    await user.click(screen.getByRole("button", { name: "发送消息" }));
    await screen.findByText("Second answer");

    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondRequest.messages).toEqual([{ role: "user", content: "Second question" }]);
    expect(screen.queryByText("First question")).toBeVisible();
    expect(screen.queryAllByText("", { selector: ".message__body p" })).toHaveLength(0);
  });

  it("does not resend an image from an earlier learner turn", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse(["answered"]));
    render(<ConversationClassroom course={course} stage="lower_primary" />);

    await user.upload(screen.getByLabelText("添加图片"), new File([new Uint8Array([137, 80, 78, 71])], "work.png", { type: "image/png" }));
    await user.type(screen.getByRole("textbox", { name: "给 Mambo 发消息" }), "First image question");
    await user.click(screen.getByRole("button", { name: "发送消息" }));
    await screen.findByText("answered");

    await user.type(screen.getByRole("textbox", { name: "给 Mambo 发消息" }), "Follow up");
    await user.click(screen.getByRole("button", { name: "发送消息" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondRequest.messages).toEqual([
      { role: "user", content: "First image question" },
      { role: "assistant", content: "answered" },
      { role: "user", content: "Follow up" },
    ]);
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

  it("stops media resources on unmount without uploading a transcription", async () => {
    const user = userEvent.setup();
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) } });
    class FakeMediaRecorder {
      onstop: (() => void) | null = null;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      mimeType = "audio/webm";
      start = vi.fn();
      stop = vi.fn(() => this.onstop?.());
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { unmount } = render(<ConversationClassroom course={course} stage="lower_primary" />);

    await user.click(screen.getByRole("button", { name: "录音" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "停止录音" })).toBeVisible());
    unmount();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/transcribe", expect.anything());
  });

  it("allows only one microphone permission request while permission is pending", async () => {
    let resolvePermission: ((stream: MediaStream) => void) | undefined;
    const track = { stop: vi.fn() };
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { resolvePermission = resolve; }));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    class FakeMediaRecorder {
      onstop: (() => void) | null = null;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      mimeType = "audio/webm";
      start = vi.fn();
      stop = vi.fn();
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    render(<ConversationClassroom course={course} stage="lower_primary" />);

    const recordButton = screen.getByRole("button", { name: "录音" });
    fireEvent.click(recordButton);
    fireEvent.click(recordButton);

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(recordButton).toBeDisabled();
    expect(recordButton).toHaveAttribute("aria-busy", "true");

    await act(async () => { resolvePermission?.({ getTracks: () => [track] } as unknown as MediaStream); });
    expect(await screen.findByRole("button", { name: "停止录音" })).toBeVisible();
  });

  it("stops a permission stream that resolves after unmount without creating a recorder", async () => {
    let resolvePermission: ((stream: MediaStream) => void) | undefined;
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => new Promise<MediaStream>((resolve) => { resolvePermission = resolve; })) },
    });
    const recorderConstructor = vi.fn();
    class FakeMediaRecorder {
      onstop: (() => void) | null = null;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      mimeType = "audio/webm";
      constructor() { recorderConstructor(); }
      start = vi.fn();
      stop = vi.fn();
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { unmount } = render(<ConversationClassroom course={course} stage="lower_primary" />);

    fireEvent.click(screen.getByRole("button", { name: "录音" }));
    unmount();
    await act(async () => { resolvePermission?.({ getTracks: () => [track] } as unknown as MediaStream); });

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(recorderConstructor).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/transcribe", expect.anything());
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
