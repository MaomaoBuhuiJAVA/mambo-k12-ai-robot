import { describe, expect, it } from "vitest";

import {
  answerBattleQuestion,
  advanceBattleQuestion,
  createBattleSession,
  restartBattleSession,
  type AiBattleQuestion,
} from "./ai-battle-engine";

const questions: AiBattleQuestion[] = Array.from({ length: 15 }, (_, index) => ({
  id: `question-${index + 1}`,
  topic: `topic-${index + 1}`,
  prompt: `Question ${index + 1}`,
  options: ["Correct", "Distractor A", "Distractor B", "Distractor C"],
  answerIndex: 0,
  explanation: `Explanation ${index + 1}`,
}));

function answerAndAdvance(session: ReturnType<typeof createBattleSession>, answerIndex: number) {
  const turn = answerBattleQuestion(session, answerIndex);
  return {
    turn,
    session: advanceBattleQuestion(turn.session),
  };
}

describe("AI battle engine", () => {
  it("starts a ten-question battle with distinct questions", () => {
    const session = createBattleSession(questions, 10, () => 0);

    expect(session.questions).toHaveLength(10);
    expect(new Set(session.questions.map((question) => question.id))).toHaveLength(10);
    expect(session.playerHp).toBe(100);
    expect(session.enemyHp).toBe(100);
    expect(session.currentQuestionIndex).toBe(0);
    expect(session.score).toBe(0);
    expect(session.streak).toBe(0);
    expect(session.status).toBe("playing");
  });

  it("shuffles option positions while retaining the correct answer", () => {
    const session = createBattleSession(questions.slice(0, 1), 1, () => 0);
    const [question] = session.questions;

    expect(question.options).toEqual(["Distractor A", "Distractor B", "Distractor C", "Correct"]);
    expect(question.answerIndex).toBe(3);
    expect(answerBattleQuestion(session, question.answerIndex).isCorrect).toBe(true);
  });

  it("damages the enemy, scores points, and grows the streak for a correct answer", () => {
    const session = createBattleSession(questions, 10, () => 0);
    const turn = answerBattleQuestion(session, session.questions[0]!.answerIndex);

    expect(turn.isCorrect).toBe(true);
    expect(turn.correctAnswer).toBe("Correct");
    expect(turn.session.enemyHp).toBe(80);
    expect(turn.session.playerHp).toBe(100);
    expect(turn.session.score).toBe(100);
    expect(turn.session.streak).toBe(1);
    expect(turn.events).toEqual(["player-attack"]);
  });

  it("damages the player and clears the streak for an incorrect answer", () => {
    const initial = createBattleSession(questions, 10, () => 0);
    const correctTurn = answerBattleQuestion(initial, initial.questions[0]!.answerIndex);
    const nextSession = advanceBattleQuestion(correctTurn.session);
    const nextQuestion = nextSession.questions[nextSession.currentQuestionIndex]!;
    const turn = answerBattleQuestion(nextSession, (nextQuestion.answerIndex + 1) % nextQuestion.options.length);

    expect(turn.isCorrect).toBe(false);
    expect(turn.session.playerHp).toBe(80);
    expect(turn.session.enemyHp).toBe(80);
    expect(turn.session.score).toBe(100);
    expect(turn.session.streak).toBe(0);
    expect(turn.events).toEqual(["enemy-attack"]);
  });

  it("heals the player after three consecutive correct answers", () => {
    let session = createBattleSession(questions, 10, () => 0);
    session = answerAndAdvance(session, (session.questions[0]!.answerIndex + 1) % 4).session;
    session = answerAndAdvance(session, session.questions[session.currentQuestionIndex]!.answerIndex).session;
    session = answerAndAdvance(session, session.questions[session.currentQuestionIndex]!.answerIndex).session;
    const thirdCorrect = answerBattleQuestion(session, session.questions[session.currentQuestionIndex]!.answerIndex);

    expect(thirdCorrect.session.playerHp).toBe(90);
    expect(thirdCorrect.session.streak).toBe(3);
    expect(thirdCorrect.events).toEqual(["player-attack", "heal"]);
  });

  it("ends with victory when enemy health reaches zero", () => {
    let session = createBattleSession(questions, 10, () => 0);
    let finalTurn = answerBattleQuestion(session, session.questions[session.currentQuestionIndex]!.answerIndex);

    for (let index = 1; index < 5; index += 1) {
      session = advanceBattleQuestion(finalTurn.session);
      finalTurn = answerBattleQuestion(session, session.questions[session.currentQuestionIndex]!.answerIndex);
    }

    expect(finalTurn.session.enemyHp).toBe(0);
    expect(finalTurn.session.status).toBe("won");
    expect(finalTurn.events).toContain("victory");
    expect(advanceBattleQuestion(finalTurn.session)).toBe(finalTurn.session);
  });

  it("ends with defeat when player health reaches zero", () => {
    let session = createBattleSession(questions, 10, () => 0);
    let finalTurn = answerBattleQuestion(session, 1);

    for (let index = 1; index < 5; index += 1) {
      session = advanceBattleQuestion(finalTurn.session);
      finalTurn = answerBattleQuestion(session, 1);
    }

    expect(finalTurn.session.playerHp).toBe(0);
    expect(finalTurn.session.status).toBe("lost");
    expect(finalTurn.events).toContain("defeat");
  });

  it("restarts with restored health, progress, score, and streak", () => {
    const session = createBattleSession(questions, 10, () => 0);
    const damaged = answerBattleQuestion(session, 1).session;
    const restarted = restartBattleSession(damaged, () => 0.5);

    expect(restarted.playerHp).toBe(100);
    expect(restarted.enemyHp).toBe(100);
    expect(restarted.currentQuestionIndex).toBe(0);
    expect(restarted.score).toBe(0);
    expect(restarted.streak).toBe(0);
    expect(restarted.status).toBe("playing");
    expect(restarted.questions).toHaveLength(10);
  });
});
