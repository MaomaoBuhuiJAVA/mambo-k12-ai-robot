"use client";

import Link from "next/link";
import { CheckCircle2, FlaskConical, Lightbulb, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";

import {
  evaluateResearchImageClassificationChallenge,
  getResearchChallengeHints,
  RESEARCH_BACKLIT_BASELINE_ACCURACY,
  RESEARCH_BACKLIT_TARGET_ACCURACY,
  RESEARCH_GROUP_SIZE,
  RESEARCH_SAMPLE_OPTIONS,
  type ResearchImageClassificationAttempt,
  type ResearchSampleId,
} from "./research-image-classification";
import styles from "./research-image-classification-flow.module.css";

interface ResearchImageClassificationFlowProps {
  attempts: readonly ResearchImageClassificationAttempt[];
  saved: boolean;
  notice: string | null;
  onEvaluate(selectedSampleIds: readonly ResearchSampleId[]): void;
  onSaveConclusion(conclusion: string): void;
}

export function ResearchImageClassificationFlow({
  attempts,
  saved,
  notice,
  onEvaluate,
  onSaveConclusion,
}: ResearchImageClassificationFlowProps) {
  const [selectedSampleIds, setSelectedSampleIds] = useState<ResearchSampleId[]>([]);
  const [conclusion, setConclusion] = useState("");
  const [hintCount, setHintCount] = useState(1);
  const evaluation = useMemo(
    () => evaluateResearchImageClassificationChallenge(attempts, conclusion),
    [attempts, conclusion],
  );
  const hints = getResearchChallengeHints(attempts);

  const toggleSample = (sampleId: ResearchSampleId) => {
    setSelectedSampleIds((current) => current.includes(sampleId)
      ? current.filter((id) => id !== sampleId)
      : [...current, sampleId]);
  };

  return (
    <section className={styles.flow} aria-labelledby="research-challenge-title">
      <header className={styles.header}>
        <p>初中研究挑战</p>
        <h2 id="research-challenge-title">改善逆光图片分类表现</h2>
        <p>目标：将逆光组准确率从固定基线 {RESEARCH_BACKLIT_BASELINE_ACCURACY}/{RESEARCH_GROUP_SIZE} 提升至至少 {RESEARCH_BACKLIT_TARGET_ACCURACY}/{RESEARCH_GROUP_SIZE}。</p>
      </header>

      <section className={styles.baseline} aria-labelledby="research-baseline-title">
        <h3 id="research-baseline-title">固定评估数据（v1）</h3>
        <table>
          <thead><tr><th>图片分组</th><th>样本数</th><th>基线准确率</th></tr></thead>
          <tbody>
            <tr><td>室内明亮组</td><td>10</td><td>9/10</td></tr>
            <tr><td>逆光组</td><td>10</td><td>4/10</td></tr>
            <tr><td>总体</td><td>20</td><td>13/20（65%）</td></tr>
          </tbody>
        </table>
        <p>总体 65% 看起来并不低，但逆光组只有 4/10。补样本方案要优先回应这个分组缺口，而不是只让总体数字变大。</p>
      </section>

      <fieldset className={styles.samples} disabled={saved}>
        <legend>选择本次要补充的训练样本</legend>
        {RESEARCH_SAMPLE_OPTIONS.map((sample) => (
          <label key={sample.id}>
            <input type="checkbox" checked={selectedSampleIds.includes(sample.id)} onChange={() => toggleSample(sample.id)} />
            <span><strong>{sample.label}</strong>{sample.description}</span>
          </label>
        ))}
        <button type="button" onClick={() => onEvaluate(selectedSampleIds)} disabled={saved}>
          <FlaskConical size={16} aria-hidden="true" />
          评估补样本方案
        </button>
      </fieldset>

      <section className={styles.attempts} aria-labelledby="research-attempts-title">
        <h3 id="research-attempts-title">方案评估记录</h3>
        {attempts.length === 0 ? <p>先运行一个方案，记录室内组和逆光组的确定性结果。</p> : (
          <div className={styles.tableWrap}><table><thead><tr><th>补充样本</th><th>室内组</th><th>逆光组</th><th>总体</th></tr></thead><tbody>
            {attempts.map((attempt) => <tr key={attempt.runId}><td>{attempt.selectedSampleIds.length === 0 ? "不补充（对照）" : attempt.selectedSampleIds.map((id) => RESEARCH_SAMPLE_OPTIONS.find((sample) => sample.id === id)?.label).join("、")}</td><td>{attempt.indoorAccuracy}/10</td><td>{attempt.backlitAccuracy}/10</td><td>{attempt.overallCorrect}/{attempt.overallTotal}（{attempt.overallPercent}%）</td></tr>)}
          </tbody></table></div>
        )}
      </section>

      <section className={styles.hints} aria-labelledby="research-hints-title">
        <div><Lightbulb size={16} aria-hidden="true" /><h3 id="research-hints-title">分级提示</h3></div>
        <ol>{hints.slice(0, hintCount).map((hint) => <li key={hint}>{hint}</li>)}</ol>
        <button type="button" onClick={() => setHintCount((count) => Math.min(count + 1, hints.length))} disabled={hintCount >= hints.length}>再看一条提示</button>
      </section>

      <section className={styles.conclusion} aria-labelledby="research-conclusion-title">
        <h3 id="research-conclusion-title">研究结论</h3>
        <p>说明你补充了哪一组样本，并引用逆光组实际从 4/10 到 7/10 的指标变化。</p>
        <textarea aria-label="研究结论" value={conclusion} maxLength={320} disabled={saved} onChange={(event) => setConclusion(event.target.value)} />
        <button type="button" disabled={!evaluation.passed || saved} onClick={() => onSaveConclusion(conclusion)}>
          {saved ? <CheckCircle2 size={16} aria-hidden="true" /> : <FlaskConical size={16} aria-hidden="true" />}
          {saved ? "研究挑战已保存" : "保存研究挑战证据"}
        </button>
        {!evaluation.passed ? <p className={styles.feedback}><LockKeyhole size={14} aria-hidden="true" /> {evaluation.feedback}</p> : <p className={styles.feedback}><CheckCircle2 size={14} aria-hidden="true" /> {evaluation.feedback}</p>}
        {evaluation.remediationActivityId ? <Link href="/workspace?course=middle-data-bias">返回数据偏差调查小课复习分组指标</Link> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </section>
    </section>
  );
}
