"use client";

import { CheckCircle2, FlaskConical, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";

import {
  getComparableIndependentRuns,
  getIndependentVariable,
  INDEPENDENT_VARIABLES,
  type IndependentImageClassificationRun,
  type IndependentVariableId,
} from "./independent-image-classification";
import styles from "./independent-image-classification-flow.module.css";

export interface IndependentExperimentConclusion {
  changed: string;
  result: string;
  reason: string;
}

interface IndependentImageClassificationFlowProps {
  variableId: IndependentVariableId;
  value: string;
  runs: readonly IndependentImageClassificationRun[];
  isRunning: boolean;
  saved: boolean;
  notice: string | null;
  onVariableChange(variableId: IndependentVariableId): void;
  onValueChange(value: string): void;
  onSaveConclusion(conclusion: IndependentExperimentConclusion): void;
}

export function IndependentImageClassificationFlow({
  variableId,
  value,
  runs,
  isRunning,
  saved,
  notice,
  onVariableChange,
  onValueChange,
  onSaveConclusion,
}: IndependentImageClassificationFlowProps) {
  const [changed, setChanged] = useState("");
  const [result, setResult] = useState("");
  const [reason, setReason] = useState("");
  const variable = getIndependentVariable(variableId);
  const comparableRuns = useMemo(() => getComparableIndependentRuns(runs), [runs]);
  const variableLocked = runs.length > 0;
  const canSave = Boolean(comparableRuns) && changed.trim().length >= 6 && result.trim().length >= 6 && reason.trim().length >= 6 && !saved;

  return (
    <section className={styles.flow} aria-labelledby="independent-lab-title">
      <header className={styles.header}>
        <p>初中独立实验</p>
        <h2 id="independent-lab-title">选择一个变量，完成两次比较</h2>
      </header>
      <p className={styles.intro}>先选一个自变量，再对它的两个不同取值分别运行。第一次保存运行后，该变量会锁定，避免混入多个变量。</p>

      <div className={styles.variablePicker}>
        <span className={styles.label}>自变量</span>
        <div className={styles.pickerButtons} role="group" aria-label="独立实验自变量">
          {INDEPENDENT_VARIABLES.map((candidate) => (
            <button
              type="button"
              key={candidate.id}
              aria-pressed={variableId === candidate.id}
              disabled={variableLocked}
              onClick={() => onVariableChange(candidate.id)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.valuePicker}>
        <span className={styles.label}>本次取值</span>
        <div className={styles.pickerButtons} role="group" aria-label="独立实验变量取值">
          {variable.options.map((option) => (
            <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onValueChange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.runTable} aria-labelledby="independent-run-table-title">
        <h3 id="independent-run-table-title">已保存运行对比</h3>
        {runs.length === 0 ? <p>选择取值后运行左侧代码，第一条运行会在这里显示。</p> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>变量</th><th>取值</th><th>预测</th><th>最高分</th><th>确定性检查</th><th>提示</th></tr></thead>
              <tbody>{runs.map((run) => <tr key={run.runId}><td>{run.variableLabel}</td><td>{run.valueLabel}</td><td>{run.prediction}</td><td>{run.selectedScore}</td><td>{run.passedTests}/{run.totalTests}</td><td>{run.hintsUsed}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <p>{comparableRuns ? "两次运行可比较。请引用表中的真实指标完成结论。" : runs.length > 0 ? "请使用同一变量的另一个取值再次运行，形成可比较证据。" : ""}</p>
      </section>

      <section className={styles.summary} aria-labelledby="independent-summary-title">
        <h3 id="independent-summary-title">实验结论</h3>
        {comparableRuns ? (
          <>
            <p>结果描述需引用两次表中实际出现的分数，以及固定检查指标 `3/3`。</p>
            <label className={styles.field}><span>改变了什么</span><textarea aria-label="改变了什么" value={changed} maxLength={160} disabled={saved} onChange={(event) => setChanged(event.target.value)} /></label>
            <label className={styles.field}><span>结果如何变化</span><textarea aria-label="结果如何变化" value={result} maxLength={200} disabled={saved} onChange={(event) => setResult(event.target.value)} /></label>
            <label className={styles.field}><span>原因是什么</span><textarea aria-label="原因是什么" value={reason} maxLength={200} disabled={saved} onChange={(event) => setReason(event.target.value)} /></label>
            <button className={styles.saveButton} type="button" disabled={!canSave} onClick={() => onSaveConclusion({ changed, result, reason })}>
              {saved ? <CheckCircle2 size={16} aria-hidden="true" /> : <FlaskConical size={16} aria-hidden="true" />}
              {saved ? "独立实验已保存" : "保存独立实验结论"}
            </button>
          </>
        ) : <p><LockKeyhole size={14} aria-hidden="true" /> 至少完成两次同变量、不同取值的运行后才能提交结论。</p>}
        {isRunning ? <p className={styles.notice}>正在运行确定性检查。</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </section>
    </section>
  );
}
