import type { AiBattleQuestion } from "./ai-battle-questions";

export type BattleStatus = "playing" | "won" | "lost";
export type BattleAnimationEvent = "player-attack" | "enemy-attack" | "heal" | "victory" | "defeat";

export interface BattleSession {
  sourceQuestions: readonly AiBattleQuestion[];
  questions: readonly AiBattleQuestion[];
  questionCount: number;
  currentQuestionIndex: number;
  playerHp: number;
  enemyHp: number;
  score: number;
  streak: number;
  status: BattleStatus;
}

export interface BattleAnswerResult {
  session: BattleSession;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  events: readonly BattleAnimationEvent[];
}

export type { AiBattleQuestion } from "./ai-battle-questions";

const MAX_HP = 100;
const DAMAGE_PER_ANSWER = 20;
const SCORE_PER_CORRECT = 100;
const HEAL_EVERY_CORRECT_STREAK = 3;
const HEAL_AMOUNT = 10;

export function createBattleSession(
  sourceQuestions: readonly AiBattleQuestion[],
  questionCount = 10,
  random: () => number = Math.random,
): BattleSession {
  if (sourceQuestions.length === 0) {
    throw new Error("At least one battle question is required.");
  }

  const selectedCount = Math.max(1, Math.min(questionCount, sourceQuestions.length));
  return {
    sourceQuestions,
    questions: selectQuestions(sourceQuestions, selectedCount, random),
    questionCount: selectedCount,
    currentQuestionIndex: 0,
    playerHp: MAX_HP,
    enemyHp: MAX_HP,
    score: 0,
    streak: 0,
    status: "playing",
  };
}

export function answerBattleQuestion(session: BattleSession, answerIndex: number): BattleAnswerResult {
  const question = session.questions[session.currentQuestionIndex];
  if (!question) {
    throw new Error("The battle has no current question.");
  }

  if (session.status !== "playing") {
    return {
      session,
      isCorrect: false,
      correctAnswer: question.options[question.answerIndex],
      explanation: question.explanation,
      events: [],
    };
  }

  const isCorrect = answerIndex === question.answerIndex;
  const events: BattleAnimationEvent[] = [];
  let playerHp = session.playerHp;
  let enemyHp = session.enemyHp;
  let score = session.score;
  let streak = session.streak;

  if (isCorrect) {
    enemyHp = Math.max(0, enemyHp - DAMAGE_PER_ANSWER);
    score += SCORE_PER_CORRECT;
    streak += 1;
    events.push("player-attack");

    if (streak % HEAL_EVERY_CORRECT_STREAK === 0 && playerHp < MAX_HP) {
      playerHp = Math.min(MAX_HP, playerHp + HEAL_AMOUNT);
      events.push("heal");
    }
  } else {
    playerHp = Math.max(0, playerHp - DAMAGE_PER_ANSWER);
    streak = 0;
    events.push("enemy-attack");
  }

  let status: BattleStatus = "playing";
  if (enemyHp === 0) {
    status = "won";
    events.push("victory");
  } else if (playerHp === 0) {
    status = "lost";
    events.push("defeat");
  } else if (session.currentQuestionIndex === session.questions.length - 1) {
    status = playerHp >= enemyHp ? "won" : "lost";
    events.push(status === "won" ? "victory" : "defeat");
  }

  return {
    isCorrect,
    correctAnswer: question.options[question.answerIndex],
    explanation: question.explanation,
    events,
    session: {
      ...session,
      playerHp,
      enemyHp,
      score,
      streak,
      status,
    },
  };
}

export function advanceBattleQuestion(session: BattleSession): BattleSession {
  if (session.status !== "playing") return session;
  if (session.currentQuestionIndex >= session.questions.length - 1) return session;
  return {
    ...session,
    currentQuestionIndex: session.currentQuestionIndex + 1,
  };
}

export function restartBattleSession(
  session: BattleSession,
  random: () => number = Math.random,
): BattleSession {
  return createBattleSession(session.sourceQuestions, session.questionCount, random);
}

function selectQuestions(
  sourceQuestions: readonly AiBattleQuestion[],
  count: number,
  random: () => number,
): readonly AiBattleQuestion[] {
  const remaining = [...sourceQuestions];
  const selected: AiBattleQuestion[] = [];

  while (selected.length < count && remaining.length > 0) {
    const index = randomIndex(remaining.length, random());
    const [question] = remaining.splice(index, 1);
    if (question) selected.push(shuffleQuestionOptions(question, random));
  }

  return selected;
}

function shuffleQuestionOptions(question: AiBattleQuestion, random: () => number): AiBattleQuestion {
  const shuffled = question.options.map((option, index) => ({
    option,
    isCorrect: index === question.answerIndex,
  }));

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, random());
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return {
    ...question,
    options: [shuffled[0]!.option, shuffled[1]!.option, shuffled[2]!.option, shuffled[3]!.option],
    answerIndex: shuffled.findIndex((option) => option.isCorrect),
  };
}

function randomIndex(length: number, value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(value * length)));
}
