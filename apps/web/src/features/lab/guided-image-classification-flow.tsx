"use client";

import { CheckCircle2, FlaskConical, LockKeyhole } from "lucide-react";
import { useState } from "react";

import {
  IMAGE_CLASSIFICATION_LAB_DATASET_VERSION,
  IMAGE_CLASSIFICATION_LAB_SAMPLES,
} from "@/features/image-classification/image-classification-lab-dataset";
import styles from "./guided-image-classification-flow.module.css";

export const GUIDED_IMAGE_CLASSIFICATION_VARIABLE = {
  id: "texture",
  label: "纹理线索",
  before: "striped",
  after: "handle",
  actualLabel: "cup",
} as const;

export const GUIDED_IMAGE_CLASSIFICATION_PREDICTIONS = ["leaf", "ball", "cup"] as const;
export type GuidedImageClassificationPrediction = (typeof GUIDED_IMAGE_CLASSIFICATION_PREDICTIONS)[number];

export interface GuidedImageClassificationObservation {
  observation: string;
  conclusion: string;
}

export function canRunGuidedImageClassification(
  prediction: GuidedImageClassificationPrediction | null,
): boolean {
  return prediction !== null;
}

interface GuidedImageClassificationFlowProps {
  prediction: GuidedImageClassificationPrediction | null;
  hasPassedRun: boolean;
  isRunning: boolean;
  saved: boolean;
  saveNotice: string | null;
  initialObservation?: string;
  initialConclusion?: string;
  predictionLocked?: boolean;
  onPredictionChange(prediction: GuidedImageClassificationPrediction): void;
  onSaveObservation(input: GuidedImageClassificationObservation): void;
}

export function GuidedImageClassificationFlow({
  prediction,
  hasPassedRun,
  isRunning,
  saved,
  saveNotice,
  initialObservation = "",
  initialConclusion = "",
  predictionLocked = false,
  onPredictionChange,
  onSaveObservation,
}: GuidedImageClassificationFlowProps) {
  const [observation, setObservation] = useState(initialObservation);
  const [conclusion, setConclusion] = useState(initialConclusion);
  const canSave = hasPassedRun
    && observation.trim().length >= 8
    && conclusion.trim().length >= 8
    && conclusion.replaceAll(" ", "").includes("3/3")
    && !saved;

  return (
    <section className={styles.flow} aria-labelledby="guided-lab-title">
      <header className={styles.header}>
        <p>初中引导实验</p>
        <h2 id="guided-lab-title">一次只改变一个变量</h2>
      </header>
      <ol className={styles.steps}>
        <li className={styles.step} data-complete={prediction !== null} data-active={prediction === null}>
          <span className={styles.stepLabel}>步骤 1：先作预测</span>
          <p>本轮只比较一条特征，其他条件保持不变。</p>
          <div className={styles.fixedVariable}>
            <div><span>改变变量</span><strong>{GUIDED_IMAGE_CLASSIFICATION_VARIABLE.label}</strong></div>
            <strong>{GUIDED_IMAGE_CLASSIFICATION_VARIABLE.before} -&gt; {GUIDED_IMAGE_CLASSIFICATION_VARIABLE.after}</strong>
          </div>
          <div className={styles.sampleSet} aria-label="固定样本集">
            <div className={styles.sampleSetHeading}>
              <span>固定样本集</span>
              <small>{IMAGE_CLASSIFICATION_LAB_DATASET_VERSION}</small>
            </div>
            <table>
              <thead><tr><th>样本</th><th>颜色</th><th>形状</th><th>纹理</th><th>目标标签</th></tr></thead>
              <tbody>
                {IMAGE_CLASSIFICATION_LAB_SAMPLES.map((sample) => (
                  <tr key={sample.id}>
                    <td title={sample.id}>{sample.labelText}</td>
                    <td>{sample.features.color}</td>
                    <td>{sample.features.shape}</td>
                    <td>{sample.features.texture}</td>
                    <td>{hasPassedRun ? sample.labelText : "运行后核对"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.predictionChoices} role="group" aria-label="预测标签">
            {GUIDED_IMAGE_CLASSIFICATION_PREDICTIONS.map((candidate) => (
              <button
                type="button"
                key={candidate}
                aria-pressed={prediction === candidate}
                disabled={predictionLocked || saved}
                onClick={() => onPredictionChange(candidate)}
              >
                预测 {candidate}
              </button>
            ))}
          </div>
        </li>
        <li className={styles.step} data-complete={hasPassedRun} data-active={prediction !== null && !hasPassedRun}>
          <span className={styles.stepLabel}>步骤 2：运行确定性检查</span>
          <p className={styles.runState}>
            {hasPassedRun
              ? "三组固定样本的分类检查已通过。"
              : prediction === null
                ? "选择预测后才能运行代码。"
                : isRunning
                  ? "正在运行固定样本检查。"
                  : "预测已记录，现在运行左侧代码。"}
          </p>
        </li>
        <li className={styles.step} data-complete={hasPassedRun && observation.trim().length >= 8} data-active={hasPassedRun && observation.trim().length < 8}>
          <span className={styles.stepLabel}>步骤 3：记录观察</span>
          {hasPassedRun ? (
            <>
              <p>写下纹理从 striped 变为 handle 后，分类结果为何改变。预测正确与否都应如实记录。</p>
              <textarea
                className={styles.observation}
                aria-label="观察记录"
                value={observation}
                maxLength={400}
                onChange={(event) => setObservation(event.target.value)}
                disabled={saved}
              />
            </>
          ) : (
            <p><LockKeyhole size={14} aria-hidden="true" /> 运行通过后才能填写观察。</p>
          )}
        </li>
        <li className={styles.step} data-complete={saved} data-active={hasPassedRun && !saved}>
          <span className={styles.stepLabel}>步骤 4：写出结论</span>
          {hasPassedRun ? (
            <>
              <label className={styles.conclusionField}>
                <span>结论（请引用固定检查指标，例如 3/3）</span>
                <textarea
                  className={styles.observation}
                  aria-label="实验结论"
                  value={conclusion}
                  maxLength={400}
                  onChange={(event) => setConclusion(event.target.value)}
                  disabled={saved || observation.trim().length < 8}
                />
              </label>
              <button className={styles.saveButton} type="button" onClick={() => onSaveObservation({ observation, conclusion })} disabled={!canSave}>
                {saved ? <CheckCircle2 size={16} aria-hidden="true" /> : <FlaskConical size={16} aria-hidden="true" />}
                {saved ? "实验记录已保存" : "保存实验记录"}
              </button>
            </>
          ) : (
            <p><LockKeyhole size={14} aria-hidden="true" /> 完成观察后再写结论。</p>
          )}
          {saveNotice ? <p className={styles.saveNotice} role="status">{saveNotice}</p> : null}
        </li>
      </ol>
    </section>
  );
}
