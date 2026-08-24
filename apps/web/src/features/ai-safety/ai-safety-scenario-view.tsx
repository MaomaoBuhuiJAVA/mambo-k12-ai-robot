"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AI_SAFETY_SCENARIOS, isSafeScenarioResponse } from "./ai-safety-scenarios";
import styles from "./ai-safety-scenario-view.module.css";

export function AiSafetyScenarioView() {
  const [index, setIndex] = useState(0);
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const scenario = AI_SAFETY_SCENARIOS[index]!;
  const actions = AI_SAFETY_SCENARIOS.map((item) => item.action).sort();
  const reasons = AI_SAFETY_SCENARIOS.map((item) => item.reason).sort();
  const correct = isSafeScenarioResponse(scenario, action, reason);

  function nextScenario() {
    setIndex((current) => (current + 1) % AI_SAFETY_SCENARIOS.length);
    setAction(""); setReason(""); setChecked(false);
  }

  return <section className={styles.panel} aria-labelledby="ai-safety-scenario-title">
    <header><div><p>星宝安全判断示范</p><h3 id="ai-safety-scenario-title">先选行动，再拿证据解释</h3></div><ShieldCheck aria-hidden="true" /></header>
    <p className={styles.counter}>情境 {index + 1} / {AI_SAFETY_SCENARIOS.length} · {scenario.title}</p>
    <p className={styles.situation}>{scenario.situation}</p>
    <fieldset><legend>你会怎么做？</legend>{actions.map((option) => <label key={option}><input type="radio" name="safety-action" checked={action === option} onChange={() => { setAction(option); setChecked(false); }} />{option}</label>)}</fieldset>
    <fieldset><legend>哪条证据最能支持这个行动？</legend>{reasons.map((option) => <label key={option}><input type="radio" name="safety-reason" checked={reason === option} onChange={() => { setReason(option); setChecked(false); }} />{option}</label>)}</fieldset>
    <div className={styles.actions}><button type="button" disabled={!action || !reason} onClick={() => setChecked(true)}>核对证据</button><button type="button" onClick={nextScenario}>下一个情境</button></div>
    {checked ? <p className={correct ? styles.correct : styles.incorrect} role="status">{correct ? "判断成立：行动和理由都与当前风险相符。" : "还不能成立：安全行动必须同时回应当前情境中的风险和证据。"}</p> : null}
  </section>;
}
