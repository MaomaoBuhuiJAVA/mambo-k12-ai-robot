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
    const legacyFlowCourse = { ...course, exercises: course.exercises.slice(0, 3) };
    render(<QuizPlayer course={legacyFlowCourse} />);

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
    const legacyFlowCourse = { ...course, exercises: course.exercises.slice(0, 3) };
    render(<QuizPlayer course={legacyFlowCourse} />);
    expect(screen.getByText("第 1 / 3 题")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
  });

  it("supports multi-select and code-fill activities in the same deterministic player", async () => {
    const user = userEvent.setup();
    const exercises = course.exercises.filter((item) => item.type === "multi_select" || item.type === "code_fill");
    const focusedCourse = { ...course, exercises };
    const multi = exercises[0];
    if (multi.type !== "multi_select") throw new Error("expected multi-select exercise");
    render(<QuizPlayer course={focusedCourse} />);

    for (const answer of multi.answers) await user.click(screen.getByLabelText(answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    await user.click(screen.getByRole("button", { name: "下一题" }));

    const fill = exercises[1];
    if (fill.type !== "code_fill") throw new Error("expected code-fill exercise");
    fireEvent.change(screen.getByLabelText("补全输出"), { target: { value: fill.answer } });
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    await user.click(screen.getByRole("button", { name: "查看总结" }));

    expect(screen.getByText("答对 2 / 2 题")).toBeVisible();
  });

  it("provides a runnable Python editor state before deterministic submission", async () => {
    const user = userEvent.setup();
    const trace = course.exercises.find((item) => item.type === "code_trace");
    if (!trace || trace.type !== "code_trace") throw new Error("Expected a code trace exercise");
    render(<QuizPlayer course={{ ...course, exercises: [trace] }} />);

    expect(screen.getByRole("textbox", { name: "代码编辑器" })).toHaveValue(trace.code);
    await user.click(screen.getByRole("button", { name: "运行代码" }));
    expect(screen.getByText(/执行完成，已运行/)).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "程序输出" }), { target: { value: trace.answer } });
    expect(screen.getByRole("button", { name: "提交答案" })).toBeEnabled();
  });

  it("shows training evidence and immediate deterministic feedback for sample classification", async () => {
    const user = userEvent.setup();
    const foundations = getCourseById("middle-ai-foundations")!;
    const classification = foundations.exercises.find((item) => item.type === "classification");
    if (!classification || classification.type !== "classification") throw new Error("Expected classification exercise");
    const focusedCourse = { ...foundations, exercises: [classification] };
    render(<QuizPlayer course={focusedCourse} />);

    expect(screen.getByText("先观察已标注样本")).toBeVisible();
    expect(screen.getByText(classification.testSample.title)).toBeVisible();
    await user.click(screen.getByLabelText(classification.answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));

    expect(screen.getByText("分类判断正确")).toBeVisible();
    expect(screen.getByText(classification.classificationEvidence)).toBeVisible();
    expect(screen.getByText(new RegExp(`参考标签：\\s*${classification.answer}`))).toBeVisible();
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

  it("shows one targeted remediation and records a correct retest without erasing the failed evidence", async () => {
    const user = userEvent.setup();
    const foundations = getCourseById("middle-ai-foundations")!;
    const interpretation = foundations.exercises.find((item) => item.type === "result_interpretation")!;
    const oneQuestionCourse = { ...foundations, exercises: [interpretation] };
    const wrongOption = interpretation.options.find((option) => option !== interpretation.answer)!;

    render(<QuizPlayer course={oneQuestionCourse} />);
    expect(screen.getByText("结果解释")).toBeVisible();
    await user.click(screen.getByLabelText(wrongOption));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    expect(screen.getByText("误区补救：预测等于事实")).toBeVisible();
    expect(screen.getByText(/图片被遮住时模型预测/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "开始一次复测" }));
    await user.click(screen.getByLabelText(interpretation.answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    await user.click(screen.getByRole("button", { name: "查看总结" }));

    const saved = JSON.parse(window.localStorage.getItem(LEARNING_STATE_STORAGE_KEY)!);
    expect(saved.attempts).toHaveLength(2);
    expect(saved.masteryByKnowledgePoint["middle-ai-foundations:模型预测与误差"].misconceptionTags)
      .not.toContain("预测等于事实");
  });
});
