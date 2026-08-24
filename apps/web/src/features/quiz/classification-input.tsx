import type { ClassificationExercise } from "@/data/curriculum";
import type { GradeResult } from "./quiz-engine";
import styles from "./classification-input.module.css";

export function ClassificationInput({
  exercise,
  answer,
  disabled,
  result,
  setAnswer,
}: {
  exercise: ClassificationExercise;
  answer: string;
  disabled: boolean;
  result: GradeResult | null;
  setAnswer: (answer: string) => void;
}) {
  return (
    <div className={styles.root}>
      <section className={styles.training} aria-labelledby={`${exercise.id}-training-title`}>
        <div className={styles.sectionHeading}>
          <span>训练集</span>
          <h4 id={`${exercise.id}-training-title`}>先观察已标注样本</h4>
        </div>
        <div className={styles.sampleGrid}>
          {exercise.trainingSamples.map((sample) => (
            <article className={styles.sample} key={sample.id}>
              <header><strong>{sample.title}</strong><span>{sample.label}</span></header>
              <ul>{sample.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <p>{sample.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.test} aria-labelledby={`${exercise.id}-test-title`}>
        <div className={styles.sectionHeading}>
          <span>测试样本</span>
          <h4 id={`${exercise.id}-test-title`}>{exercise.testSample.title}</h4>
        </div>
        <ul className={styles.featureList} aria-label="待分类样本特征">
          {exercise.testSample.features.map((feature) => <li key={feature}>{feature}</li>)}
        </ul>
        <p className={styles.observation}><strong>观察证据：</strong>{exercise.testSample.evidence}</p>
        <fieldset className={styles.labelChoices} disabled={disabled}>
          <legend>选择样本标签</legend>
          {exercise.labels.map((label) => (
            <label data-selected={answer === label || undefined} key={label}>
              <input
                checked={answer === label}
                name={exercise.id}
                onChange={() => setAnswer(label)}
                type="radio"
                value={label}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </section>

      {result ? (
        <aside className={styles.evidence} data-correct={result.correct || undefined} aria-live="polite">
          <strong>{result.correct ? "分类判断正确" : "分类判断需要修正"}</strong>
          <p>你的标签：{answer || "（未选择）"}　参考标签：{exercise.answer}</p>
          <p>{exercise.classificationEvidence}</p>
        </aside>
      ) : null}
    </div>
  );
}
