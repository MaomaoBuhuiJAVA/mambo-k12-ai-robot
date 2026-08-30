"use client";

import { BarChart3, Eye, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import {
  DATA_BIAS_METRIC_SCENARIOS,
  getDataBiasMetricScenario,
  summarizeDataBiasMetrics,
  type DataBiasMetricScenarioId,
} from "./data-bias-metrics";
import styles from "./data-bias-metrics.module.css";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function DataBiasMetricsComparison() {
  const [scenarioId, setScenarioId] = useState<DataBiasMetricScenarioId>("baseline");
  const scenario = useMemo(() => getDataBiasMetricScenario(scenarioId), [scenarioId]);
  const overall = useMemo(() => summarizeDataBiasMetrics(scenario.groupMetrics), [scenario.groupMetrics]);
  const weakestGroup = scenario.groupMetrics.reduce((weakest, metric) => (
    metric.correct / metric.total < weakest.correct / weakest.total ? metric : weakest
  ));

  return (
    <section className={styles.comparison} aria-labelledby="data-bias-comparison-title">
      <header className={styles.header}>
        <div>
          <p>星宝分组指标示范</p>
          <h3 id="data-bias-comparison-title">总体分数不错，也要看谁被模型持续认错</h3>
        </div>
        <Eye size={22} aria-hidden="true" />
      </header>

      <div className={styles.scenarios} role="group" aria-label="选择固定评价方案">
        {DATA_BIAS_METRIC_SCENARIOS.map((candidate) => (
          <button key={candidate.id} type="button" aria-pressed={candidate.id === scenarioId} onClick={() => setScenarioId(candidate.id)}>
            {candidate.id === "targeted-resampling" ? <RefreshCw size={15} aria-hidden="true" /> : <BarChart3 size={15} aria-hidden="true" />}
            {candidate.label}
          </button>
        ))}
      </div>

      <section className={styles.overall} aria-labelledby="overall-metric-title">
        <div>
          <span id="overall-metric-title">总体准确率</span>
          <strong>{percent(overall.accuracy)}</strong>
          <p>{overall.correct}/{overall.total} 张固定评估图片预测正确</p>
        </div>
        <p>{scenario.description}</p>
      </section>

      <section className={styles.groups} aria-labelledby="group-metrics-title">
        <h4 id="group-metrics-title">分组准确率</h4>
        <table>
          <caption>同一套固定评估图片，按光照条件拆分后得到的指标</caption>
          <thead><tr><th scope="col">图片分组</th><th scope="col">正确数</th><th scope="col">准确率</th></tr></thead>
          <tbody>{scenario.groupMetrics.map((metric) => {
            const accuracy = metric.correct / metric.total;
            const isWeakest = metric.group === weakestGroup.group;
            return <tr key={metric.group} data-weakest={isWeakest || undefined}>
              <th scope="row">{metric.group}{isWeakest ? "（需优先检查）" : ""}</th>
              <td>{metric.correct}/{metric.total}</td>
              <td><span className={styles.bar} aria-hidden="true"><span style={{ width: percent(accuracy) }} /></span><strong>{percent(accuracy)}</strong></td>
            </tr>;
          })}</tbody>
        </table>
      </section>

      <p className={styles.interpretation} role="status" aria-live="polite">
        {scenarioId === "baseline"
          ? `总体是 ${percent(overall.accuracy)}，但逆光组只有 ${weakestGroup.correct}/${weakestGroup.total}。只看总体会掩盖逆光条件下的集中错误。`
          : `补充逆光样本后，逆光组升至 ${weakestGroup.correct}/${weakestGroup.total}；室内组保持不变。下一步仍要用相同分组重新评价。`}
      </p>
    </section>
  );
}
