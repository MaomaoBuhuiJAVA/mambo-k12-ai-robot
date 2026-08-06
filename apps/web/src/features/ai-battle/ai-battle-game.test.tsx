import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiBattleQuestion } from "./ai-battle-engine";
import { AiBattleGame } from "./ai-battle-game";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src?: string | { src: string }; alt?: string; priority?: boolean }) => {
    const imageSrc = typeof src === "string" ? src || "/test-image.png" : src?.src ?? "/test-image.png";
    delete props.priority;
    // eslint-disable-next-line @next/next/no-img-element -- This is a lightweight Image mock for jsdom.
    return <img src={imageSrc} alt={alt ?? ""} {...props} />;
  },
}));

const arenaSpy = vi.hoisted(() => ({
  destroy: vi.fn(),
  emit: vi.fn(),
  idle: vi.fn(),
  mount: vi.fn(async () => ({
    destroy: arenaSpy.destroy,
    emit: arenaSpy.emit,
    idle: arenaSpy.idle,
    reset: arenaSpy.reset,
  })),
  reset: vi.fn(),
}));

vi.mock("./ai-battle-phaser", () => ({
  mountAiBattleArena: arenaSpy.mount,
}));

const questions: AiBattleQuestion[] = Array.from({ length: 5 }, (_, index) => ({
  id: `component-question-${index + 1}`,
  topic: "AI 通识",
  prompt: `Component question ${index + 1}`,
  options: [`Correct ${index + 1}`, `Wrong A ${index + 1}`, `Wrong B ${index + 1}`, `Wrong C ${index + 1}`],
  answerIndex: 0,
  explanation: `Explanation ${index + 1}`,
}));

const DEFAULT_ENEMY_HEALTH_LABEL = "城堡守卫生命";

function renderGame() {
  return render(<AiBattleGame questions={questions} questionCount={5} random={() => 0} />);
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function expectHealth(name: string, value: number) {
  expect(screen.getByRole("progressbar", { name })).toHaveAttribute("aria-valuenow", String(value));
}

async function answerCorrectQuestions(user: ReturnType<typeof userEvent.setup>) {
  for (let index = 1; index <= 5; index += 1) {
    await user.click(screen.getByRole("button", { name: `Correct ${index}` }));
    if (index < 5) {
      await screen.findByRole("dialog", { name: `Component question ${index + 1}` });
    }
  }
}

async function answerIncorrectQuestions(user: ReturnType<typeof userEvent.setup>) {
  for (let index = 1; index <= 5; index += 1) {
    await user.click(screen.getByRole("button", { name: `Wrong A ${index}` }));
    if (index < 5) {
      await screen.findByRole("dialog", { name: `Component question ${index + 1}` });
    }
  }
}

describe("AiBattleGame", () => {
  it("renders a stable initial question before client-side randomization", () => {
    const differentRandomValues = [0, 0.99];
    let callCount = 0;
    const random = () => differentRandomValues[callCount++ % differentRandomValues.length];

    const firstRender = renderToString(<AiBattleGame questions={questions} questionCount={5} random={random} />);
    const secondRender = renderToString(<AiBattleGame questions={questions} questionCount={5} random={random} />);

    expect(firstRender).toContain("Component question 3");
    expect(secondRender).toContain("Component question 3");
  });

  it("delegates Starbao's transparent cutout animation to Phaser without a legacy video overlay", () => {
    renderGame();

    expect(screen.queryByTestId("starbao-entrance-source")).not.toBeInTheDocument();
    expect(screen.queryByTestId("starbao-entrance-canvas")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("对战数据")).not.toBeInTheDocument();
  });

  it("loads the selected module's map and monster into the arena", async () => {
    const treeSanctuary = {
      id: "tree-sanctuary",
      enemyName: "古树守卫",
      arenaAsset: "/assets/game/battle-tree-sanctuary.jpg",
      enemyAsset: "/assets/game/enemy-tree-guardian.png",
      enemyScale: 1.08,
    };

    render(<AiBattleGame battleModule={treeSanctuary} questions={questions} questionCount={5} random={() => 0} />);

    await waitFor(() => {
      expect(arenaSpy.mount).toHaveBeenCalledWith(expect.any(HTMLDivElement), treeSanctuary);
    });
    expect(screen.getByRole("progressbar", { name: "古树守卫生命" })).toBeInTheDocument();
  });

  it("routes Starbao's attack to the Phaser cutout sprite", async () => {
    renderGame();

    await waitFor(() => expect(arenaSpy.mount).toHaveBeenCalled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Correct 1" }));

    expect(arenaSpy.emit).toHaveBeenCalledWith(["player-attack"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(760);
    });

    expect(arenaSpy.idle).toHaveBeenCalled();
  });

  it("shows a question, grades a correct answer, and advances automatically", async () => {
    const user = userEvent.setup();
    renderGame();

    expect(screen.getByRole("dialog", { name: "Component question 1" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^(Correct|Wrong)/ })).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Correct 1" }));

    expect(screen.queryByRole("dialog", { name: "Component question 1" })).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Component question 2" })).toBeVisible();
    expect(screen.queryByText("Explanation 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一题" })).not.toBeInTheDocument();
    expectHealth(DEFAULT_ENEMY_HEALTH_LABEL, 80);
  });

  it("damages Starbao and clears the streak for an incorrect answer", async () => {
    const user = userEvent.setup();
    renderGame();

    await user.click(screen.getByRole("button", { name: "Wrong A 1" }));

    expect(await screen.findByRole("dialog", { name: "Component question 2" })).toBeVisible();
    expectHealth("星宝生命", 80);
  });

  it("applies enemy damage only when Starbao's attack lands", async () => {
    vi.useFakeTimers();
    renderGame();

    fireEvent.click(screen.getByRole("button", { name: "Correct 1" }));

    expectHealth(DEFAULT_ENEMY_HEALTH_LABEL, 100);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(699);
    });

    expectHealth(DEFAULT_ENEMY_HEALTH_LABEL, 100);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expectHealth(DEFAULT_ENEMY_HEALTH_LABEL, 80);
  });

  it("applies Starbao damage only when the enemy attack lands", async () => {
    vi.useFakeTimers();
    renderGame();

    fireEvent.click(screen.getByRole("button", { name: "Wrong A 1" }));

    expectHealth("星宝生命", 100);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(699);
    });

    expectHealth("星宝生命", 100);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expectHealth("星宝生命", 80);
  });

  it("hides the question dialog while the attack animation is playing", async () => {
    const user = userEvent.setup();
    renderGame();

    expect(screen.getByRole("dialog", { name: "Component question 1" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Correct 1" }));

    expect(screen.queryByRole("dialog", { name: "Component question 1" })).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Component question 2" })).toBeVisible();
  });

  it("returns the static battle sprite to idle after combat presentation", async () => {
    vi.useFakeTimers();
    renderGame();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Correct 1" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(760);
    });

    expect(arenaSpy.idle).toHaveBeenCalledTimes(1);
  });

  it("automatically advances to the next question after the attack animation", async () => {
    vi.useFakeTimers();
    renderGame();

    fireEvent.click(screen.getByRole("button", { name: "Correct 1" }));

    expect(screen.queryByRole("dialog", { name: "Component question 1" })).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(screen.getByRole("dialog", { name: "Component question 2" })).toBeVisible();
    expect(screen.queryByText("Explanation 1")).not.toBeInTheDocument();
  });

  it("waits for the victory presentation before showing the result dialog", async () => {
    vi.useFakeTimers();
    render(<AiBattleGame questions={questions.slice(0, 1)} questionCount={1} random={() => 0} />);

    fireEvent.click(screen.getByRole("button", { name: "Correct 1" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("victory-explosion")).toBeVisible();
  });

  it("shows a victory summary and can restart after five correct answers", async () => {
    const user = userEvent.setup();
    renderGame();

    await answerCorrectQuestions(user);

    expect(await screen.findByRole("dialog", {}, { timeout: 2500 })).toHaveTextContent("胜利");
    expect(screen.getByText("最终得分 500")).toBeVisible();
    expectHealth(DEFAULT_ENEMY_HEALTH_LABEL, 0);

    await user.click(screen.getByRole("dialog").querySelector("button")!);

    expect(screen.getByText("第 1 / 5 题")).toBeVisible();
    expectHealth("星宝生命", 100);
    expect(screen.getByRole("dialog", { name: "Component question 1" })).toBeVisible();
  }, 8_000);

  it("shows a failure summary after five incorrect answers", async () => {
    const user = userEvent.setup();
    renderGame();

    await answerIncorrectQuestions(user);

    expect(await screen.findByRole("dialog", {}, { timeout: 2500 })).toHaveTextContent("挑战失败");
    expect(screen.getByText("最终得分 0")).toBeVisible();
    expectHealth("星宝生命", 0);
  }, 8_000);

  it("destroys the Phaser instance when the component unmounts", async () => {
    arenaSpy.destroy.mockClear();
    const { unmount } = renderGame();

    unmount();

    await waitFor(() => expect(arenaSpy.destroy).toHaveBeenCalledOnce());
  });
});
