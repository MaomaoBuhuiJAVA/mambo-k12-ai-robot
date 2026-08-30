import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCourseById } from "@/data/curriculum";
import { createDefaultLearningState, loadLearningState } from "@/lib/learning-store";
import { getPracticeSet } from "./practice-data";
import { PracticeSession } from "./practice-session";

const practiceSetId = "course--middle-ai-foundations";
const course = getCourseById("middle-ai-foundations")!;
const initialPracticeSet = getPracticeSet(
  "middle_school",
  practiceSetId,
  createDefaultLearningState(),
)!;

describe("PracticeSession", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("supports number keys and records answers through the existing deterministic quiz evidence", async () => {
    const user = userEvent.setup();
    const first = course.exercises[0];
    if (first.type !== "single_choice") throw new Error("Expected a choice question");
    render(<PracticeSession initialPracticeSet={initialPracticeSet} practiceSetId={practiceSetId} stage="middle_school" />);

    await user.keyboard("1");
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
    await user.click(screen.getByRole("button", { name: "提交答案" }));

    expect(screen.getByRole("status")).toBeVisible();
    expect(loadLearningState().attempts.length).toBeGreaterThan(0);
  });

  it("restores a submitted result and keeps the original answer evidence after refresh", async () => {
    const user = userEvent.setup();
    const first = course.exercises[0];
    if (first.type !== "single_choice") throw new Error("Expected a choice question");
    const wrongOption = first.options.find((option) => option !== first.answer);
    if (!wrongOption) throw new Error("Expected an incorrect option");
    const firstRender = render(<PracticeSession initialPracticeSet={initialPracticeSet} practiceSetId={practiceSetId} stage="middle_school" />);

    await user.click(screen.getByRole("radio", { name: wrongOption }));
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    expect(screen.getByText("进入错题补救")).toBeVisible();
    expect(screen.getByText("查看本题作答证据（1 次）")).toBeVisible();

    firstRender.unmount();
    render(<PracticeSession initialPracticeSet={initialPracticeSet} practiceSetId={practiceSetId} stage="middle_school" />);

    await waitFor(() => {
      expect(screen.getByText("进入错题补救")).toBeVisible();
      expect(screen.getAllByText(wrongOption).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows an explicit empty state for a direct remediation route without wrong evidence", () => {
    const emptySet = getPracticeSet("middle_school", "remediation-middle_school", createDefaultLearningState());
    if (!emptySet) throw new Error("Expected configured remediation set");
    render(<PracticeSession initialPracticeSet={emptySet} practiceSetId="remediation-middle_school" stage="middle_school" />);

    expect(screen.getByText("暂无可用题目")).toBeVisible();
    expect(screen.getByText("当前没有符合条件的题目。完成一次练习后，错题补救会在这里出现。")).toBeVisible();
  });

  it("resumes at the next question after a skipped question is restored from the session", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PracticeSession initialPracticeSet={initialPracticeSet} practiceSetId={practiceSetId} stage="middle_school" />);
    expect(screen.getByRole("heading", { name: course.exercises[0].prompt })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "跳过" }));
    unmount();
    render(<PracticeSession initialPracticeSet={initialPracticeSet} practiceSetId={practiceSetId} stage="middle_school" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: course.exercises[1].prompt })).toBeVisible();
    });
  });

  it("renders and records a deterministic training-sample classification in a practice session", async () => {
    const user = userEvent.setup();
    const classification = course.exercises.find((exercise) => exercise.type === "classification");
    if (!classification || classification.type !== "classification") throw new Error("Expected classification exercise");
    const classificationSet = {
      ...initialPracticeSet,
      id: "classification-only",
      questions: [{ key: `${course.id}:${classification.id}`, course, exercise: classification }],
    };

    render(<PracticeSession initialPracticeSet={classificationSet} practiceSetId="classification-only" stage="middle_school" />);
    await screen.findByText("先观察已标注样本");
    await user.click(screen.getByLabelText(classification.answer));
    await user.click(screen.getByRole("button", { name: "提交答案" }));

    expect(screen.getByText("分类判断正确")).toBeVisible();
    expect(loadLearningState().attempts.length).toBeGreaterThan(0);
  });

  it("supports pointer drag reordering as well as keyboard-safe controls", async () => {
    const user = userEvent.setup();
    const first = initialPracticeSet.questions[1];
    if (!first || first.exercise.type !== "order") throw new Error("Expected an order question");
    render(<PracticeSession initialPracticeSet={initialPracticeSet} practiceSetId={practiceSetId} stage="middle_school" />);
    await user.keyboard("1");
    await user.click(screen.getByRole("button", { name: "提交答案" }));
    await user.click(screen.getByRole("button", { name: "下一题" }));
    await screen.findByRole("heading", { name: first.exercise.prompt });

    const items = screen.getAllByRole("listitem");
    const firstItem = items[0];
    const lastItem = items.at(-1);
    if (!lastItem) throw new Error("Expected order items");
    const movedText = first.exercise.items[1];
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => "0"), dropEffect: "move", effectAllowed: "move" };
    fireEvent.dragStart(firstItem, { dataTransfer });
    fireEvent.dragOver(lastItem, { dataTransfer });
    fireEvent.drop(lastItem, { dataTransfer });

    expect(screen.getAllByRole("listitem").at(-1)).toHaveTextContent(movedText);
  });
});
