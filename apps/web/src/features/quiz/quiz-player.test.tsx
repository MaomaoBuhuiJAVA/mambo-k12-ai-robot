import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCourseById } from "@/data/curriculum";
import { LEARNING_STATE_STORAGE_KEY } from "@/lib/learning-store";
import { QuizPlayer } from "./quiz-player";

const course = getCourseById("lower-bubble-sort")!;

describe("QuizPlayer", () => {
  beforeEach(() => window.localStorage.clear());

  it("provides immediate feedback, retry, and an aria-live update", async () => {
    const user = userEvent.setup();
    render(<QuizPlayer course={course} />);

    const choice = course.exercises[0];
    if (choice.type !== "single_choice") throw new Error("expected choice exercise");
    await user.click(screen.getByLabelText(choice.options.find((option) => option !== choice.answer)!));
    await user.click(screen.getByRole("button", { name: "提交答案" }));

    expect(screen.getByRole("status")).toHaveTextContent(course.exercises[0].feedback.incorrect);
    expect(screen.getByRole("button", { name: "再试一次" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "再试一次" }));
    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
  });

  it("completes choice, keyboard-friendly ordering, and code trace with real persistence", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    window.addEventListener("mambo:learning-state-changed", changed);
    render(<QuizPlayer course={course} />);

    const choice = course.exercises[0];
    if (choice.type !== "single_choice") throw new Error("expected choice exercise");
    await user.click(screen.getByLabelText(choice.answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    await user.click(screen.getByRole("button", { name: "下一题" }));

    const order = course.exercises[1];
    if (order.type !== "order") throw new Error("expected order exercise");
    await user.click(screen.getByRole("button", { name: `将${order.answer[0]}上移` }));
    await user.click(screen.getByRole("button", { name: `将${order.answer[0]}上移` }));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    expect(screen.getByRole("status")).toHaveTextContent(order.feedback.correct);
    await user.click(screen.getByRole("button", { name: "下一题" }));

    const trace = course.exercises[2];
    if (trace.type !== "code_trace") throw new Error("expected trace exercise");
    fireEvent.change(screen.getByLabelText("程序输出"), { target: { value: trace.answer } });
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    await user.click(screen.getByRole("button", { name: "查看总结" }));

    expect(screen.getByRole("heading", { name: "本次练习完成" })).toBeVisible();
    expect(screen.getByText("答对 3 / 3 题")).toBeVisible();
    expect(changed).toHaveBeenCalledTimes(3);

    await waitFor(() => {
      const persisted = JSON.parse(window.localStorage.getItem(LEARNING_STATE_STORAGE_KEY)!);
      expect(persisted.attempts).toHaveLength(5);
      expect(persisted.attempts.every((attempt: Record<string, unknown>) => !("answer" in attempt))).toBe(true);
    });
    window.removeEventListener("mambo:learning-state-changed", changed);
  });

  it("shows stable question progress and only enables answerable submissions", () => {
    render(<QuizPlayer course={course} />);
    expect(screen.getByText("第 1 / 3 题")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
  });

  it("counts a retry as hint evidence and prevents duplicate rapid submission", async () => {
    const user = userEvent.setup();
    render(<QuizPlayer course={course} />);
    const choice = course.exercises[0];
    if (choice.type !== "single_choice") throw new Error("expected choice exercise");

    await user.click(screen.getByLabelText(choice.options.find((option) => option !== choice.answer)!));
    const submit = screen.getByRole("button", { name: "提交答案" });
    submit.click();
    submit.click();
    await screen.findByRole("button", { name: "再试一次" });

    await user.click(screen.getByRole("button", { name: "再试一次" }));
    await user.click(screen.getByLabelText(choice.answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));

    const persisted = JSON.parse(localStorage.getItem(LEARNING_STATE_STORAGE_KEY)!);
    expect(persisted.attempts).toHaveLength(2);
    expect(persisted.attempts.at(-1)).toMatchObject({ score: 1, hints: 1 });
  });

  it("honestly reports when the current session could not be persisted", async () => {
    const user = userEvent.setup();
    const oneQuestionCourse = { ...course, exercises: [course.exercises[0]] };
    const choice = oneQuestionCourse.exercises[0];
    if (choice.type !== "single_choice") throw new Error("expected choice exercise");
    const storageFailure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    render(<QuizPlayer course={oneQuestionCourse} />);
    await user.click(screen.getByLabelText(choice.answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    await user.click(screen.getByRole("button", { name: "查看总结" }));

    expect(screen.getByText(/未能保存.*当前会话/)).toBeVisible();
    expect(screen.queryByText(/结果已经写入/)).not.toBeInTheDocument();
    storageFailure.mockRestore();
  });
});
