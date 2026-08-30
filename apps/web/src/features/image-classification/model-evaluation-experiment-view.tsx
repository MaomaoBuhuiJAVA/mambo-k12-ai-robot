"use client";

import { BarChart3, Split, TableProperties } from "lucide-react";
import { useMemo, useState } from "react";

import {
  createEvaluationSplit,
  EVALUATION_BATCHES,
  MODEL_EVALUATION_LABELS,
  type EvaluationBatchId,
} from "./model-evaluation-experiment";
import styles from "./model-evaluation-experiment.module.css";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ModelEvaluationExperiment() {
  const [testBatchId, setTestBatchId] = useState<EvaluationBatchId>("backlit");
  const split = useMemo(() => createEvaluationSplit(testBatchId), [testBatchId]);

  return (
    <section className={styles.experiment} aria-labelledby="model-evaluation-title">
      <header className={styles.header}>
        <div>
          <p>星宝模型评价台</p>
          <h3 id="model-evaluation-title">先留出测试集，再让指标解释模型表现</h3>
        </div>
        <BarChart3 size={22} aria-hidden="true" />
      </header>

      <section className={styles.splitSelector} aria-labelledby="test-batch-title">
        <div>
          <h4 id="test-batch-title"><Split size={17} aria-hidden="true" /> 1. 按拍摄批次切分</h4>
          <p>被选中的批次完全留作测试，其余固定样本留在训练集。这样同一拍摄条件不会同时出现在训练和测试中。</p>
        </div>
        <div className={styles.batchButtons} role="group" aria-label="选择测试批次">
          {EVALUATION_BATCHES.map((batch) => (
            <button
              key={batch.id}
              type="button"
              aria-pressed={testBatchId === batch.id}
              onClick={() => setTestBatchId(batch.id)}
            >
              {batch.label}
            </button>
          ))}
        </div>
      </section>

      <div className={styles.datasetSummary}>
        <section aria-label="训练集">
          <span>训练集</span>
          <strong>{split.trainingSamples.length} 张固定样本</strong>
          <p>保留的批次：{EVALUATION_BATCHES.filter((batch) => batch.id !== testBatchId).map((batch) => batch.label).join("、")}</p>
        </section>
        <section aria-label="测试集">
          <span>测试集</span>
          <strong>{split.testSamples.length} 张固定样本</strong>
          <p>{split.testBatch.label}：{split.testBatch.description}</p>
        </section>
      </div>

      <div className={styles.analysisGrid}>
        <section className={styles.testCases} aria-labelledby="test-cases-title">
          <h4 id="test-cases-title"><TableProperties size={17} aria-hidden="true" /> 2. 测试集逐项核对</h4>
          <table>
            <caption>固定测试集预测结果</caption>
            <thead><tr><th scope="col">样本</th><th scope="col">真实标签</th><th scope="col">模型预测</th><th scope="col">结果</th></tr></thead>
            <tbody>
              {split.testSamples.map((sample) => {
                const correct = sample.actualLabel === sample.predictedLabel;
                return <tr key={sample.id} data-correct={correct}>
                  <th scope="row">{sample.title}</th>
                  <td>{sample.actualLabel}</td>
                  <td>{sample.predictedLabel}</td>
                  <td>{correct ? "正确" : "错误"}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </section>

        <section className={styles.metrics} aria-labelledby="metrics-title">
          <h4 id="metrics-title">3. 指标</h4>
          <dl>
            <div><dt>准确率</dt><dd>{percent(split.metrics.accuracy)}</dd><small>{split.metrics.correct} / {split.metrics.total} 正确</small></div>
            <div><dt>错误率</dt><dd>{percent(split.metrics.errorRate)}</dd><small>{split.metrics.incorrect} / {split.metrics.total} 错误</small></div>
          </dl>
          <p>准确率告诉我们正确比例；错误率提醒我们还有多少预测需要检查。两者都来自同一批留出的测试样本。</p>
        </section>
      </div>

      <section className={styles.matrix} aria-labelledby="matrix-title">
        <h4 id="matrix-title">4. 混淆矩阵</h4>
        <p>行是真实标签，列是模型预测。对角线是正确预测，非对角线说明模型把一种物品认成了另一种。</p>
        <table aria-label="测试集混淆矩阵">
          <thead><tr><th scope="col">真实标签 \ 预测标签</th>{MODEL_EVALUATION_LABELS.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{MODEL_EVALUATION_LABELS.map((actualLabel) => <tr key={actualLabel}>
            <th scope="row">{actualLabel}</th>
            {MODEL_EVALUATION_LABELS.map((predictedLabel) => {
              const count = split.metrics.confusionMatrix[actualLabel][predictedLabel];
              return <td data-diagonal={actualLabel === predictedLabel || undefined} key={predictedLabel}>{count}</td>;
            })}
          </tr>)}</tbody>
        </table>
      </section>

      <p className={styles.interpretation} role="status" aria-live="polite">
        当前测试批次是“{split.testBatch.label}”，准确率 {percent(split.metrics.accuracy)}。这是对这批留出样本的测量，不代表模型在所有新图片上都同样准确。
      </p>
    </section>
  );
}
