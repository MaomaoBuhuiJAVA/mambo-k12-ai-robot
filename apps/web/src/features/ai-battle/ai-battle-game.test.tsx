import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  begin: vi.fn((onComplete?: () => void) => onComplete?.()),
  destroy: vi.fn(),
  emit: vi.fn(),
  idle: vi.fn(),
  mount: vi.fn(async () => ({
    begin: arenaSpy.begin,
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

const storyStarbaoIdleStillPath = resolve(process.cwd(), "public/assets/game/starbao-idle-still.png");

function getPngDimensions(path: string) {
  const image = readFileSync(path);
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

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

async function startBattle() {
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  fireEvent.click(screen.getByRole("button", { name: "开始答题" }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(arenaSpy.begin).toHaveBeenCalled();
}

beforeEach(() => {
  arenaSpy.begin.mockImplementation((onComplete?: () => void) => onComplete?.());
});

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
  it("opens an elementary story dialogue before the first battle question", () => {
    render(<AiBattleGame questions={questions} questionCount={5} random={() => 0} />);

    expect(screen.getByTestId("battle-story-dialogue")).toHaveTextContent("知识星图守护行动");
    expect(screen.getByRole("dialog", { name: "星宝" })).toBeVisible();
    expect(existsSync(storyStarbaoIdleStillPath)).toBe(true);
    expect(getPngDimensions(storyStarbaoIdleStillPath)).toEqual({ width: 720, height: 720 });
    expect(screen.getByTestId("battle-story-starbao-ship").querySelector("img")).toHaveAttribute("src", "/assets/game/starbao-idle-still.png");
    expect(screen.queryByRole("dialog", { name: "Component question 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续" })).toBeVisible();
  });

  it("reveals story dialogue text progressively", async () => {
    vi.useFakeTimers();
    renderGame();

    const storyText = screen.getByTestId("battle-story-text");
    expect(storyText).toHaveTextContent("知");
    expect(storyText).not.toHaveTextContent("知识星图守护行动开始！城堡守卫的观察之章被知识碎片扰乱了。");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(28);
    });

    expect(storyText).toHaveTextContent("知识");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(storyText).toHaveTextContent("知识星图守护行动开始！城堡守卫的观察之章被知识碎片扰乱了。");
  });

  it("renders a stable initial story before client-side randomization", () => {
    const differentRandomValues = [0, 0.99];
    let callCount = 0;
    const random = () => differentRandomValues[callCount++ % differentRandomValues.length];

    const firstRender = renderToString(<AiBattleGame questions={questions} questionCount={5} random={random} />);
    const secondRender = renderToString(<AiBattleGame questions={questions} questionCount={5} random={random} />);

    expect(firstRender).toContain("知识星图守护行动");
    expect(secondRender).toContain("知识星图守护行动");
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
      enemyAnimations: {
        spawn: "/assets/game/enemy-videos/tree-guardian-spawn.mp4",
        defeat: "/assets/game/enemy-videos/tree-guardian-defeat.mp4",
      },
    };

    render(<AiBattleGame battleModule={treeSanctuary} questions={questions} questionCount={5} random={() => 0} />);

    await waitFor(() => {
      expect(arenaSpy.mount).toHaveBeenCalledWith(expect.any(HTMLDivElement), treeSanctuary);
    });
    expect(screen.getByRole("progressbar", { name: "古树守卫生命" })).toBeInTheDocument();
  });

  it("starts the battle entrances only after the opening subtitles finish", async () => {
    renderGame();

    await waitFor(() => expect(arenaSpy.mount).toHaveBeenCalledOnce());
    expect(arenaSpy.begin).not.toHaveBeenCalled();

    await startBattle();

    await waitFor(() => expect(arenaSpy.begin).toHaveBeenCalledOnce());
  });

  it("waits for both entrance animations before offering the first question", async () => {
    let completeEntrance: (() => void) | undefined;
    arenaSpy.begin.mockImplementationOnce((onComplete?: () => void) => {
      completeEntrance = onComplete;
    });
    renderGame();

    await waitFor(() => expect(arenaSpy.mount).toHaveBeenCalledOnce());
    await startBattle();

    expect(completeEntrance).toEqual(expect.any(Function));
    expect(screen.queryByRole("dialog", { name: "Component question 1" })).not.toBeInTheDocument();

    act(() => completeEntrance?.());

    expect(screen.getByRole("dialog", { name: "Component question 1" })).toBeVisible();
  });

  it("routes Starbao's attack to the Phaser cutout sprite", async () => {
    renderGame();
    await startBattle();

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
    await startBattle();

    expect(screen.getByRole("dialog", { name: "Component question 1" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^(Correct|Wrong)/ })).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Correct 1" }));

    expect(screen.queryByRole("dialog", { name: "Component question 1" })).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-turn-dialogue")).toHaveTextContent("Explanation 1");
    expect(await screen.findByRole("dialog", { name: "Component question 2" })).toBeVisible();
    expect(screen.queryByTestId("battle-turn-dialogue")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一题" })).not.toBeInTheDocument();
    expectHealth(DEFAULT_ENEMY_HEALTH_LABEL, 80);
  });

  it("damages Starbao and clears the streak for an incorrect answer", async () => {
    const user = userEvent.setup();
    renderGame();
    await startBattle();

    await user.click(screen.getByRole("button", { name: "Wrong A 1" }));

    expect(await screen.findByRole("dialog", { name: "Component question 2" })).toBeVisible();
    expectHealth("星宝生命", 80);
  });

  it("applies enemy damage only when Starbao's attack lands", async () => {
    vi.useFakeTimers();
    renderGame();
    await startBattle();

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
    await startBattle();

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
    await startBattle();

    expect(screen.getByRole("dialog", { name: "Component question 1" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Correct 1" }));

    expect(screen.queryByRole("dialog", { name: "Component question 1" })).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Component question 2" })).toBeVisible();
  });

  it("returns the static battle sprite to idle after combat presentation", async () => {
    vi.useFakeTimers();
    renderGame();
    await startBattle();

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
    await startBattle();

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
    await startBattle();

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
    await startBattle();

    await answerCorrectQuestions(user);

    expect(await screen.findByRole("dialog", {}, { timeout: 7000 })).toHaveTextContent("胜利");
    expect(screen.getByText("最终得分 500")).toBeVisible();
    expectHealth(DEFAULT_ENEMY_HEALTH_LABEL, 0);

    await user.click(screen.getByRole("button", { name: "继续" }));
    await user.click(screen.getByRole("button", { name: "再来一次" }));

    expect(screen.getByTestId("battle-story-dialogue")).toHaveTextContent("知识星图守护行动");
    expectHealth("星宝生命", 100);
    expect(screen.queryByRole("dialog", { name: "Component question 1" })).not.toBeInTheDocument();
  }, 15_000);

  it("shows a failure summary after five incorrect answers", async () => {
    const user = userEvent.setup();
    renderGame();
    await startBattle();

    await answerIncorrectQuestions(user);

    expect(await screen.findByRole("dialog", {}, { timeout: 2500 })).toHaveTextContent("挑战失败");
    expect(screen.getByText("最终得分 0")).toBeVisible();
    expectHealth("星宝生命", 0);
  }, 8_000);

  it("does not return Starbao to idle when the defeat summary appears", async () => {
    vi.useFakeTimers();
    renderGame();
    await startBattle();

    for (let index = 1; index <= 4; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: `Wrong A ${index}` }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(760);
      });
    }

    arenaSpy.idle.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Wrong A 5" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(screen.getByRole("dialog")).toHaveTextContent("挑战失败");
    expect(arenaSpy.idle).not.toHaveBeenCalled();
  });

  it("destroys the Phaser instance when the component unmounts", async () => {
    arenaSpy.destroy.mockClear();
    const { unmount } = renderGame();

    unmount();

    await waitFor(() => expect(arenaSpy.destroy).toHaveBeenCalledOnce());
  });
});
