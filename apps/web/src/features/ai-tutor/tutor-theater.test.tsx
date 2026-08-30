import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { getCourseLesson, getStructuredCourse } from "@/data/course-structure";
import { TutorTheater } from "./tutor-theater";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

class FakeUtterance {
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

const speak = vi.fn();
const cancel = vi.fn();
const pause = vi.fn();
const resume = vi.fn();

function renderTutor(mockEvents?: Parameters<typeof TutorTheater>[0]["mockEvents"]) {
  const course = getStructuredCourse("middle-ai-foundations");
  const lesson = getCourseLesson("middle-ai-foundations:concepts:rules-and-models");
  if (!course || !lesson) throw new Error("Expected the configured middle-school lesson");
  return render(<TutorTheater course={course.course} lesson={lesson} mockEvents={mockEvents} />);
}

function startTutor() {
  act(() => vi.advanceTimersByTime(1));
  act(() => fireEvent.click(screen.getByRole("button", { name: "开始学习" })));
  act(() => vi.advanceTimersByTime(400));
}

describe("TutorTheater", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    speak.mockReset();
    cancel.mockReset();
    pause.mockReset();
    resume.mockReset();
    window.sessionStorage.clear();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak, cancel, pause, resume },
    });
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts the local Mock lesson and reads the buffered first slide", () => {
    renderTutor();

    expect(speak).not.toHaveBeenCalled();
    startTutor();
    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getAllByRole("heading", { name: "规则、样本与模型" })[0]).toBeVisible();
    expect(screen.getByText(/欢迎来到规则、样本与模型/)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("正在讲解");
    expect(screen.getByRole("main", { name: "规则、样本与模型" })).toHaveAttribute("data-learning-context-version", "2");
    expect(speak).toHaveBeenCalledOnce();
  });

  it("requires an answer before the checkpoint can move forward", () => {
    renderTutor();
    startTutor();

    act(() => fireEvent.click(screen.getByRole("button", { name: "下一页" })));
    act(() => fireEvent.click(screen.getByRole("button", { name: "下一页" })));
    act(() => fireEvent.click(screen.getByRole("button", { name: "下一页" })));

    expect(screen.getAllByText("停下来做一次预测")[0]).toBeVisible();
    const next = screen.getByRole("button", { name: "下一页" });
    expect(next).toBeDisabled();

    act(() => fireEvent.click(screen.getByLabelText("核对输入、证据和结果限制")));
    expect(next).toBeEnabled();
    act(() => fireEvent.click(next));

    expect(screen.getAllByText("本节小结")[0]).toBeVisible();
  });

  it("pauses and resumes the active utterance without replaying it", () => {
    renderTutor();
    startTutor();
    const speechCalls = speak.mock.calls.length;

    act(() => fireEvent.click(screen.getByRole("button", { name: "暂停" })));
    expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "继续" })).toBeVisible();

    act(() => fireEvent.click(screen.getByRole("button", { name: "继续" })));
    expect(resume).toHaveBeenCalledOnce();
    expect(speak).toHaveBeenCalledTimes(speechCalls);
  });

  it("supports caption controls and keeps teaching in text-only mode after a speech error", () => {
    renderTutor();
    startTutor();

    act(() => fireEvent.click(screen.getByRole("button", { name: "关闭字幕" })));
    expect(screen.getByText("字幕已关闭")).toBeVisible();
    act(() => fireEvent.click(screen.getByRole("button", { name: "开启字幕" })));

    const utterance = speak.mock.calls.at(-1)?.[0] as FakeUtterance;
    act(() => utterance.onerror?.());

    expect(screen.getByText("语音不可用，已切换为仅字幕")).toBeVisible();
    expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();
  });

  it("restores the last slide but never starts speech before the student restarts the lesson", () => {
    window.sessionStorage.setItem(
      "mambo-tutor-session:v1:middle-ai-foundations:concepts:rules-and-models",
      JSON.stringify({ schemaVersion: 1, slideIndex: 2, answer: null, note: "上次的观察" }),
    );
    renderTutor();

    expect(speak).not.toHaveBeenCalled();
    startTutor();
    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getAllByRole("heading", { name: "用步骤核对结论" })[0]).toBeVisible();
    expect(screen.getByDisplayValue("上次的观察")).toBeVisible();
    expect(speak).toHaveBeenCalledOnce();
  });

  it("switches to the versioned static seed lesson when the local stream times out", () => {
    renderTutor([]);
    startTutor();

    act(() => vi.advanceTimersByTime(4000));
    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByRole("status")).toHaveTextContent("已切换到离线种子课程");
    expect(screen.getByText(/欢迎来到规则、样本与模型/)).toBeVisible();
    expect(speak).toHaveBeenCalledOnce();
  });

  it("falls back to captions when the browser has no speech synthesis", () => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
    renderTutor();
    startTutor();
    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByRole("status")).toHaveTextContent("语音不可用，已切换为仅字幕");
    expect(screen.getByText(/欢迎来到规则、样本与模型/)).toBeVisible();
  });
});
