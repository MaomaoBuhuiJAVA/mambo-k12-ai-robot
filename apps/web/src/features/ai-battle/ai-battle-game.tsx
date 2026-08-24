"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, HeartPulse, RotateCcw, Swords, Trophy } from "lucide-react";

import starPersonHeadAsset from "@/assets/star-person-head.png";
import { useCloudTransition } from "@/components/cloud-transition/cloud-transition-provider";
import { readCompletedImportedStorybookIds } from "@/features/storybook/imported-storybook-progress";
import { AI_BATTLE_QUESTIONS } from "./ai-battle-questions";
import { DEFAULT_AI_BATTLE_MODULE, type AiBattleModule } from "./ai-battle-modules";
import {
  advanceBattleQuestion,
  answerBattleQuestion,
  createBattleSession,
  restartBattleSession,
  type AiBattleQuestion,
  type BattleSession,
} from "./ai-battle-engine";
import { mountAiBattleArena, type AiBattleArenaController } from "./ai-battle-phaser";
import { getBattleStory, getBattleTurnDialogue, type BattleStoryLine } from "./ai-battle-story";
import styles from "./ai-battle-game.module.css";

const HYDRATION_RANDOM = () => 0.5;
const ATTACK_PRESENTATION_MS = 760;
const ATTACK_IMPACT_MS = 700;
const VICTORY_PRESENTATION_MS = 5200;
const DEFEAT_PRESENTATION_MS = 1600;
const STORY_TYPEWRITER_INTERVAL_MS = 28;
const VICTORY_EXPLOSION_SPARKS = Array.from({ length: 14 }, (_, index) => index);
const STORY_STARBAO_IDLE_STILL = "/assets/game/starbao-idle-still.png";

const BATTLE_KNOWLEDGE_POINTS: Record<string, string> = {
  "castle-1": "castle:ordered-observation",
  "core-lab": "core:data-and-patterns",
  "desert-temple": "desert:evidence-and-reliability",
  "lava-cavern": "lava:ai-safety-and-privacy",
  "tree-sanctuary": "tree:responsible-ai-use",
};

const BATTLE_STORYBOOK_IDS: Record<string, readonly string[]> = {
  "castle-1": ["castle-lesson-01", "castle-lesson-02", "castle-lesson-03"],
  "core-lab": ["technology-lesson-01", "technology-lesson-02", "technology-lesson-03"],
  "desert-temple": ["desert-lesson-07", "desert-lesson-08", "desert-lesson-09"],
  "lava-cavern": ["lava-lesson-01", "lava-lesson-02", "lava-lesson-03"],
  "tree-sanctuary": ["forest-lesson-01", "forest-lesson-02", "forest-lesson-03"],
};

function battleAgentContext(battleModule: AiBattleModule) {
  const moduleStorybookIds = BATTLE_STORYBOOK_IDS[battleModule.id] ?? [];
  const completedStorybooks = typeof window === "undefined"
    ? []
    : readCompletedImportedStorybookIds(window.localStorage);
  const completedStorybookIds = moduleStorybookIds.filter((id) => completedStorybooks.includes(id));
  return {
    schemaVersion: 1,
    traceId: `trace:battle:${battleModule.id}:${Date.now()}`,
    anonymousLearnerId: "anon:web-battle",
    stage: "lower_primary" as const,
    grade: 2,
    teachingMode: "battle" as const,
    activityId: `primary-battle:${battleModule.id}`,
    courseId: null,
    moduleId: battleModule.id,
    storybookId: completedStorybookIds[0] ?? null,
    pageNumber: null,
    knowledgePointIds: [BATTLE_KNOWLEDGE_POINTS[battleModule.id] ?? "ai:responsible-use"],
    completedActivityIds: completedStorybookIds,
    masterySummary: [],
    misconceptionTags: [],
    recentEvidenceSummary: [],
    allowedActionIds: [],
  };
}

type BattleAgentPayload = {
  questionId?: string;
  topic?: string;
  prompt?: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
};

async function fetchBattleAgentQuestion(
  context: ReturnType<typeof battleAgentContext>,
  questionIndex: number,
  allowedKnowledgePointIds: string[],
  signal: AbortSignal,
): Promise<AiBattleQuestion | null> {
  try {
    const response = await fetch("/api/ai/battle/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context,
        questionIndex,
        difficulty: questionIndex < 3 ? "introductory" : questionIndex < 7 ? "standard" : "challenge",
        excludedQuestionIds: [],
        allowedKnowledgePointIds,
      }),
      signal,
    });
    if (!response.ok) return null;
    const body = await response.json() as { data?: { payload?: BattleAgentPayload } };
    const payload = body.data?.payload;
    if (!payload?.questionId || !payload.topic || !payload.prompt || !Array.isArray(payload.options)
      || payload.options.length !== 4 || typeof payload.answerIndex !== "number"
      || !Number.isInteger(payload.answerIndex) || payload.answerIndex < 0 || payload.answerIndex > 3
      || !payload.explanation) return null;
    return {
      id: payload.questionId,
      topic: payload.topic,
      prompt: payload.prompt,
      options: payload.options as [string, string, string, string],
      answerIndex: payload.answerIndex,
      explanation: payload.explanation,
    };
  } catch {
    return null;
  }
}

function replaceBattleQuestion(session: BattleSession, index: number, question: AiBattleQuestion): BattleSession {
  if (index < 0 || index >= session.questions.length) return session;
  const questions = [...session.questions];
  questions[index] = question;
  return { ...session, questions, sourceQuestions: questions };
}

type StoryPhase = "intro" | "battle" | "outro";

export interface AiBattleGameProps {
  battleModule?: AiBattleModule;
  questions?: readonly AiBattleQuestion[];
  questionCount?: number;
  random?: () => number;
}

export function AiBattleGame({
  battleModule = DEFAULT_AI_BATTLE_MODULE,
  questions = AI_BATTLE_QUESTIONS,
  questionCount = 10,
  random = Math.random,
}: AiBattleGameProps) {
  const { startMiddleMapTransition } = useCloudTransition();
  const arenaElement = useRef<HTMLDivElement | null>(null);
  const arenaController = useRef<AiBattleArenaController | null>(null);
  const arenaEntranceRequested = useRef(false);
  const arenaEntranceRun = useRef(0);
  const randomizationApplied = useRef(false);
  const turnResolutionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackImpactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentQuestionController = useRef<AbortController | null>(null);
  const [session, setSession] = useState<BattleSession>(() => createBattleSession(questions, questionCount, HYDRATION_RANDOM));
  const [agentQuestionState, setAgentQuestionState] = useState<"loading" | "ready" | "fallback">("loading");
  const [storyPhase, setStoryPhase] = useState<StoryPhase>("intro");
  const [storyIndex, setStoryIndex] = useState(0);
  const [turnDialogue, setTurnDialogue] = useState<BattleStoryLine | null>(null);
  const [isArenaEntranceComplete, setIsArenaEntranceComplete] = useState(false);
  const [isResolvingTurn, setIsResolvingTurn] = useState(false);
  const [isVictoryExplosionVisible, setIsVictoryExplosionVisible] = useState(false);
  const story = getBattleStory(battleModule.id, battleModule.enemyName);
  const currentQuestion = session.questions[session.currentQuestionIndex];
  const activeStoryLines = storyPhase === "intro"
    ? story.intro
    : storyPhase === "outro"
      ? session.status === "won" ? story.victory : story.defeat
      : null;
  const activeStoryLine = activeStoryLines?.[storyIndex] ?? null;
  const showQuestionDialog = storyPhase === "battle" && isArenaEntranceComplete && session.status === "playing" && !isResolvingTurn && agentQuestionState !== "loading";

  useEffect(() => {
    if (randomizationApplied.current) return;
    randomizationApplied.current = true;
    setSession(createBattleSession(questions, questionCount, random));
    setStoryPhase("intro");
    setStoryIndex(0);
    setTurnDialogue(null);
    setIsArenaEntranceComplete(false);
  }, [questionCount, questions, random]);

  useEffect(() => {
    // Do not spend or abort a Dify request during the intro. The first question
    // is generated only after the arena entrance has completed, when the battle
    // dialog can safely be revealed.
    if (typeof window === "undefined" || storyPhase !== "battle" || !isArenaEntranceComplete) return;
    const controller = new AbortController();
    agentQuestionController.current?.abort();
    agentQuestionController.current = controller;
    const context = battleAgentContext(battleModule);
    const allowedKnowledgePointIds = [BATTLE_KNOWLEDGE_POINTS[battleModule.id] ?? "ai:responsible-use"];
    void fetchBattleAgentQuestion(context, 0, allowedKnowledgePointIds, controller.signal)
      .then((agentQuestion) => {
        if (controller.signal.aborted) return;
        setSession((current) => agentQuestion
          ? replaceBattleQuestion(current, 0, agentQuestion)
          : current);
        setAgentQuestionState(agentQuestion ? "ready" : "fallback");
      });
    return () => {
      controller.abort();
      if (agentQuestionController.current === controller) agentQuestionController.current = null;
    };
  }, [battleModule, isArenaEntranceComplete, questionCount, questions, storyPhase]);

  useEffect(() => {
    const parent = arenaElement.current;
    if (!parent) return;
    let disposed = false;

    void mountAiBattleArena(parent, battleModule)
      .then((controller) => {
        if (disposed) {
          controller.destroy();
          return;
        }
        arenaController.current = controller;
        if (arenaEntranceRequested.current) {
          beginArenaEntrance(controller, arenaEntranceRun.current);
        }
      })
      .catch((error: unknown) => {
        console.error("Unable to mount the AI battle arena.", error);
      });

    return () => {
      disposed = true;
      arenaController.current?.destroy();
      arenaController.current = null;
    };
  }, [battleModule]);

  useEffect(() => {
    return () => {
      agentQuestionController.current?.abort();
      if (turnResolutionTimer.current !== null) {
        clearTimeout(turnResolutionTimer.current);
      }
      if (attackImpactTimer.current !== null) {
        clearTimeout(attackImpactTimer.current);
      }
    };
  }, []);

  if (!currentQuestion) return null;

  function clearTurnResolution() {
    if (turnResolutionTimer.current !== null) {
      clearTimeout(turnResolutionTimer.current);
      turnResolutionTimer.current = null;
    }
    if (attackImpactTimer.current !== null) {
      clearTimeout(attackImpactTimer.current);
      attackImpactTimer.current = null;
    }
    setIsVictoryExplosionVisible(false);
  }

  function selectAnswer(answerIndex: number) {
    if (isResolvingTurn || session.status !== "playing") return;

    const result = answerBattleQuestion(session, answerIndex);
    if (result.session.status === "playing") {
      const nextQuestionIndex = result.session.currentQuestionIndex + 1;
      const context = battleAgentContext(battleModule);
      const allowedKnowledgePointIds = [BATTLE_KNOWLEDGE_POINTS[battleModule.id] ?? "ai:responsible-use"];
      const controller = new AbortController();
      agentQuestionController.current?.abort();
      agentQuestionController.current = controller;
      setAgentQuestionState("loading");
      void fetchBattleAgentQuestion(context, nextQuestionIndex, allowedKnowledgePointIds, controller.signal)
        .then((agentQuestion) => {
          if (controller.signal.aborted) return;
          setSession((current) => agentQuestion
            ? replaceBattleQuestion(current, nextQuestionIndex, agentQuestion)
            : current);
          setAgentQuestionState(agentQuestion ? "ready" : "fallback");
        });
    }
    clearTurnResolution();
    setIsResolvingTurn(true);
    setTurnDialogue(getBattleTurnDialogue(result.isCorrect, result.explanation));
    arenaController.current?.emit(result.events);
    attackImpactTimer.current = setTimeout(() => {
      attackImpactTimer.current = null;
      setSession((current) => ({
        ...result.session,
        questions: current.questions,
        sourceQuestions: current.sourceQuestions,
      }));
      if (result.session.status === "won") {
        setIsVictoryExplosionVisible(true);
      }
    }, ATTACK_IMPACT_MS);
    const presentationDuration = result.session.status === "playing"
      ? ATTACK_PRESENTATION_MS
      : result.session.status === "won"
        ? VICTORY_PRESENTATION_MS
        : DEFEAT_PRESENTATION_MS;
    turnResolutionTimer.current = setTimeout(() => {
      turnResolutionTimer.current = null;
      if (result.session.status === "playing") {
        setSession((current) => advanceBattleQuestion({
          ...result.session,
          questions: current.questions,
          sourceQuestions: current.sourceQuestions,
        }));
        arenaController.current?.idle();
        setTurnDialogue(null);
      } else {
        setStoryPhase("outro");
        setStoryIndex(0);
        setTurnDialogue(null);
      }
      setIsVictoryExplosionVisible(false);
      setIsResolvingTurn(false);
    }, presentationDuration);
  }

  function restart() {
    clearTurnResolution();
    agentQuestionController.current?.abort();
    setAgentQuestionState("loading");
    arenaEntranceRequested.current = false;
    arenaEntranceRun.current += 1;
    setSession((current) => restartBattleSession(current, random));
    setIsResolvingTurn(false);
    setStoryPhase("intro");
    setStoryIndex(0);
    setTurnDialogue(null);
    setIsArenaEntranceComplete(false);
    arenaController.current?.reset();
  }

  function beginArenaEntrance(controller: AiBattleArenaController, run: number) {
    controller.begin(() => {
      if (!arenaEntranceRequested.current || arenaEntranceRun.current !== run) return;
      setIsArenaEntranceComplete(true);
    });
  }

  function advanceStory() {
    if (!activeStoryLines) return;
    if (storyIndex < activeStoryLines.length - 1) {
      setStoryIndex((current) => current + 1);
      return;
    }

    if (storyPhase === "intro") {
      const entranceRun = arenaEntranceRun.current + 1;
      arenaEntranceRun.current = entranceRun;
      arenaEntranceRequested.current = true;
      setIsArenaEntranceComplete(false);
      if (arenaController.current) {
        beginArenaEntrance(arenaController.current, entranceRun);
      }
      setStoryPhase("battle");
      setStoryIndex(0);
      return;
    }

    restart();
  }

  return (
    <section className={styles.game} aria-labelledby="ai-battle-title" data-agent-question={agentQuestionState}>
      <h1 id="ai-battle-title" className={styles.screenReaderOnly}>星宝 AI 知识大作战</h1>

      <div className={styles.arena} aria-label={`星宝与${battleModule.enemyName}的战斗动画`}>
        <div ref={arenaElement} className={styles.arenaMount} aria-hidden="true" />
        {isResolvingTurn && turnDialogue ? (
          <div className={styles.battleMessage} data-testid="battle-turn-dialogue" aria-live="polite">
            <Swords size={17} aria-hidden="true" />
            <span><strong>{turnDialogue.speaker === "starbao" ? "星宝" : battleModule.enemyName}</strong>{turnDialogue.text}</span>
          </div>
        ) : null}
      </div>

      {isVictoryExplosionVisible ? <VictoryExplosion /> : null}

      <Combatant
        side="enemy"
        name={battleModule.enemyName}
        health={session.enemyHp}
      />
      <Combatant
        side="player"
        name="星宝"
        health={session.playerHp}
        avatar={starPersonHeadAsset}
      />

      {showQuestionDialog ? (
        <QuestionDialog
          question={currentQuestion}
          currentQuestionNumber={session.currentQuestionIndex + 1}
          totalQuestions={session.questions.length}
          onSelect={selectAnswer}
        />
      ) : null}

      {storyPhase === "battle" && isArenaEntranceComplete && agentQuestionState === "loading" ? (
        <div className={styles.agentQuestionLoading} role="status" aria-live="polite">
          正在根据已学绘本生成题目…
        </div>
      ) : null}

      {activeStoryLine ? (
        <StoryDialogue
          key={`${storyPhase}-${session.status}-${storyIndex}-${activeStoryLine.text}`}
          line={activeStoryLine}
          phase={storyPhase}
          status={session.status}
          score={session.score}
          battleModuleId={battleModule.id}
          enemyName={battleModule.enemyName}
          enemyAsset={battleModule.enemyAsset}
          isLastLine={storyIndex === activeStoryLines!.length - 1}
          onAdvance={advanceStory}
          onStartMiddleMapTransition={startMiddleMapTransition}
        />
      ) : null}
    </section>
  );
}

function VictoryExplosion() {
  return (
    <div className={styles.victoryExplosion} data-testid="victory-explosion" aria-hidden="true">
      <span className={styles.explosionFlash} />
      <span className={styles.explosionCore} />
      {VICTORY_EXPLOSION_SPARKS.map((index) => (
        <span
          key={index}
          className={styles.explosionSpark}
          style={{
            "--spark-angle": `${index * (360 / VICTORY_EXPLOSION_SPARKS.length)}deg`,
            "--spark-distance": `${86 + (index % 4) * 18}px`,
            "--spark-delay": `${(index % 3) * 24}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function Combatant({
  side,
  name,
  health,
  avatar,
}: {
  side: "player" | "enemy";
  name: string;
  health: number;
  avatar?: { src: string };
}) {
  return (
    <aside className={styles.combatant} data-side={side}>
      <div className={styles.combatantName}>
        {avatar ? <Image className={styles.combatantAvatar} src={avatar.src} alt="" width={48} height={48} priority /> : null}
        <strong>{name}</strong>
      </div>
      <div className={styles.healthTrack} role="progressbar" aria-label={`${name}生命`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={health}>
        <span style={{ width: `${health}%` }} />
      </div>
    </aside>
  );
}

function QuestionDialog({
  question,
  currentQuestionNumber,
  totalQuestions,
  onSelect,
}: {
  question: AiBattleQuestion;
  currentQuestionNumber: number;
  totalQuestions: number;
  onSelect: (answerIndex: number) => void;
}) {
  return (
    <div className={styles.dialogBackdrop} role="dialog" aria-modal="true" aria-labelledby="battle-question-title">
      <div className={styles.questionCard}>
        <div className={styles.questionMeta}>
          <span>{question.topic}</span>
          <span>第 {currentQuestionNumber} / {totalQuestions} 题</span>
        </div>
        <h2 id="battle-question-title">{question.prompt}</h2>
        <div className={styles.options} aria-label="选择答案">
          {question.options.map((option, index) => (
            <button
              key={option}
              className={styles.option}
              type="button"
              aria-label={option}
              onClick={() => onSelect(index)}
            >
              <span aria-hidden="true">{String.fromCharCode(65 + index)}</span>
              <span>{option}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function useStoryTypewriter(text: string) {
  const characters = Array.from(text);
  const characterCount = characters.length;
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(() => Math.min(1, characterCount));

  useEffect(() => {
    if (characterCount < 2) return;

    let currentCount = 1;
    const timer = window.setInterval(() => {
      currentCount = Math.min(characterCount, currentCount + 1);
      setVisibleCharacterCount(currentCount);
      if (currentCount === characterCount) window.clearInterval(timer);
    }, STORY_TYPEWRITER_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [characterCount, text]);

  return {
    text: characters.slice(0, visibleCharacterCount).join(""),
    isTyping: visibleCharacterCount < characterCount,
  };
}

function StoryDialogue({
  line,
  phase,
  status,
  score,
  battleModuleId,
  enemyName,
  enemyAsset,
  isLastLine,
  onAdvance,
  onStartMiddleMapTransition,
}: {
  line: BattleStoryLine;
  phase: StoryPhase;
  status: BattleSession["status"];
  score: number;
  battleModuleId: string;
  enemyName: string;
  enemyAsset: string;
  isLastLine: boolean;
  onAdvance: () => void;
  onStartMiddleMapTransition: () => boolean;
}) {
  const isResult = phase === "outro";
  const isVictory = status === "won";
  const hasMiddleSchoolNextStep = isLastLine && isResult && isVictory && battleModuleId === "tree-sanctuary";
  const speakerName = line.speaker === "starbao" ? "星宝" : enemyName;
  const actionLabel = isLastLine
    ? isResult ? isVictory ? "再来一次" : "再试一次" : "开始答题"
    : "继续";
  const storyText = useStoryTypewriter(line.text);

  return (
    <div className={styles.storyBackdrop} role="dialog" aria-modal="true" aria-labelledby="battle-story-title" data-testid="battle-story-dialogue">
      <div className={styles.storyPanel} data-phase={phase} data-status={status} data-speaker={line.speaker} data-testid="battle-story-panel">
        <div className={styles.storyPortrait} data-speaker={line.speaker} aria-hidden="true">
          {line.speaker === "starbao" ? (
            <div className={styles.storyStarbaoShip} data-testid="battle-story-starbao-ship">
              <Image src={STORY_STARBAO_IDLE_STILL} alt="" width={512} height={512} priority />
            </div>
          ) : (
            <Image src={enemyAsset} alt="" width={360} height={330} priority />
          )}
        </div>
        <div className={styles.storyContent}>
          <div className={styles.storyHeading}>
            <span>{isResult ? isVictory ? "战斗结算" : "继续积累知识" : "知识星图守护行动"}</span>
            {isResult ? <span>最终得分 {score}</span> : null}
          </div>
          <h2 id="battle-story-title">{isResult ? isVictory ? "胜利" : "挑战失败" : speakerName}</h2>
          <p className={styles.storyText} data-typing={storyText.isTyping} data-testid="battle-story-text">{storyText.text}</p>
          {hasMiddleSchoolNextStep ? (
            <button className={styles.storyAction} type="button" onClick={onStartMiddleMapTransition}>
              <ArrowRight size={17} aria-hidden="true" />
              进入初中实验室
            </button>
          ) : (
            <button className={styles.storyAction} type="button" onClick={onAdvance}>
              {isLastLine && isResult ? <RotateCcw size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
              {actionLabel}
            </button>
          )}
        </div>
        {isResult ? (
          <div className={styles.storyResultIcon} aria-hidden="true">
            {isVictory ? <Trophy size={34} /> : <HeartPulse size={34} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}
