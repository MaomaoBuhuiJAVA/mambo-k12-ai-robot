"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HeartPulse, RotateCcw, Swords, Trophy } from "lucide-react";

import starPersonHeadAsset from "@/assets/star-person-head.png";
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
import styles from "./ai-battle-game.module.css";

const HYDRATION_RANDOM = () => 0.5;
const ATTACK_PRESENTATION_MS = 760;
const ATTACK_IMPACT_MS = 700;
const VICTORY_PRESENTATION_MS = 5200;
const DEFEAT_PRESENTATION_MS = 1600;
const VICTORY_EXPLOSION_SPARKS = Array.from({ length: 14 }, (_, index) => index);

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
  const arenaElement = useRef<HTMLDivElement | null>(null);
  const arenaController = useRef<AiBattleArenaController | null>(null);
  const randomizationApplied = useRef(false);
  const turnResolutionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackImpactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [session, setSession] = useState<BattleSession>(() => createBattleSession(questions, questionCount, HYDRATION_RANDOM));
  const [isResolvingTurn, setIsResolvingTurn] = useState(false);
  const [isVictoryExplosionVisible, setIsVictoryExplosionVisible] = useState(false);
  const currentQuestion = session.questions[session.currentQuestionIndex];
  const showQuestionDialog = session.status === "playing" && !isResolvingTurn;
  const showEndOverlay = session.status !== "playing" && !isResolvingTurn;

  useEffect(() => {
    if (randomizationApplied.current) return;
    randomizationApplied.current = true;
    setSession(createBattleSession(questions, questionCount, random));
  }, [questionCount, questions, random]);

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
    clearTurnResolution();
    setIsResolvingTurn(true);
    arenaController.current?.emit(result.events);
    attackImpactTimer.current = setTimeout(() => {
      attackImpactTimer.current = null;
      setSession(result.session);
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
        setSession(advanceBattleQuestion(result.session));
      }
      arenaController.current?.idle();
      setIsVictoryExplosionVisible(false);
      setIsResolvingTurn(false);
    }, presentationDuration);
  }

  function restart() {
    clearTurnResolution();
    setSession((current) => restartBattleSession(current, random));
    setIsResolvingTurn(false);
    arenaController.current?.reset();
  }

  return (
    <section className={styles.game} aria-labelledby="ai-battle-title">
      <h1 id="ai-battle-title" className={styles.screenReaderOnly}>星宝 AI 知识大作战</h1>

      <div className={styles.arena} aria-label={`星宝与${battleModule.enemyName}的战斗动画`}>
        <div ref={arenaElement} className={styles.arenaMount} aria-hidden="true" />
        {isResolvingTurn ? (
          <div className={styles.battleMessage} aria-live="polite">
            <Swords size={17} aria-hidden="true" />
            <span>知识能量正在碰撞！</span>
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

      {showEndOverlay ? (
        <EndOverlay status={session.status} score={session.score} onRestart={restart} />
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

function EndOverlay({
  status,
  score,
  onRestart,
}: {
  status: BattleSession["status"];
  score: number;
  onRestart: () => void;
}) {
  const isVictory = status === "won";

  return (
    <div className={styles.endOverlay} role="dialog" aria-modal="true" aria-labelledby="battle-result-title">
      <div className={styles.endContent} data-status={status}>
        {isVictory ? <Trophy size={38} aria-hidden="true" /> : <HeartPulse size={38} aria-hidden="true" />}
        <span>{isVictory ? "战斗结算" : "继续积累知识"}</span>
        <h2 id="battle-result-title">{isVictory ? "胜利" : "挑战失败"}</h2>
        <p>最终得分 {score}</p>
        <button type="button" onClick={onRestart}>
          <RotateCcw size={17} aria-hidden="true" />
          重新开始
        </button>
      </div>
    </div>
  );
}
