'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useCloudTransition } from '@/components/cloud-transition/cloud-transition-provider';
import Stepper, { Step } from './Stepper';
import cardStyles from './StarJourneyCard.module.css';
import forestVineFrame from './assets/forest-vine-frame.png';

const learningStages = [
  { value: 'primary', label: '小学' },
  { value: 'middle', label: '初中' },
  { value: 'high', label: '高中' },
];

const familiarityLevels = [
  { value: 'new', label: '新人' },
  { value: 'used', label: '高手' },
  { value: 'ready', label: '程序员' },
];

const learningFormats = [
  { value: 'storybook', label: '绘本' },
  { value: 'video', label: '视频' },
  { value: 'chat', label: '聊天' },
  { value: 'coding', label: '编程' },
];

function ChoiceGroup({ name, value, onChange, options, label, compact = false }) {
  return (
    <fieldset aria-label={label} className={`${cardStyles.choiceGroup} ${compact ? cardStyles.choiceGroupCompact : ''}`} style={styles.choiceFieldset}>
      <div className={compact ? cardStyles.choiceGridCompact : cardStyles.choiceGrid}>
        {options.map((option) => (
          <label className={cardStyles.choiceOption} data-selected={value === option.value} key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-label={option.label}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function StarJourneyCard() {
  const { isTransitioning, startMapTransition } = useCloudTransition();
  const [stage, setStage] = useState('primary');
  const [familiarity, setFamiliarity] = useState('new');
  const [format, setFormat] = useState('storybook');

  function handleFinalStepCompleted() {
    if (stage === 'primary') {
      startMapTransition();
    }
  }

  return (
    <div role="region" aria-label="星宝学习旅程" className={cardStyles.card} style={styles.card}>
      <div aria-hidden="true" className={cardStyles.glassPanel} />
      <div className={cardStyles.contentLayer}>
        <Stepper
          initialStep={1}
          backButtonText="上一步"
          nextButtonText="下一步"
          finalButtonText="开始"
          onFinalStepCompleted={handleFinalStepCompleted}
          disableStepIndicators={false}
          interactionLocked={isTransitioning}
        >
          <Step>
            <div style={styles.stepContent}>
              <div className={cardStyles.stepCopy}>
                <h2 style={styles.heading}>欢迎来到星宝Ai通识教育课堂!</h2>
                <p style={styles.paragraph}>先告诉星宝一点你的学习偏好吧。</p>
              </div>
              <div aria-hidden="true" className={cardStyles.mascotFrame} style={styles.mascotFrame}>
                <span className={cardStyles.mascotSparkleOne} />
                <span className={cardStyles.mascotSparkleTwo} />
                <img src="/assets/starbao-nav-peek.png" alt="" style={styles.mascotImage} />
              </div>
            </div>
          </Step>

          <Step>
            <div style={styles.stepContent}>
              <div className={cardStyles.stepBody}>
                <h2 style={styles.heading}>你现在在哪个学习阶段？</h2>
                <ChoiceGroup
                  name="learning-stage"
                  value={stage}
                  onChange={setStage}
                  options={learningStages}
                  label="选择学段"
                />
              </div>
            </div>
          </Step>

          <Step>
            <div style={styles.stepContent}>
              <div className={cardStyles.stepBody}>
                <h2 style={styles.heading}>你对AI了解多少？</h2>
                <ChoiceGroup
                  name="ai-familiarity"
                  value={familiarity}
                  onChange={setFamiliarity}
                  options={familiarityLevels}
                  label="选择 AI 学习熟练度"
                />
              </div>
            </div>
          </Step>

          <Step>
            <div style={styles.stepContent}>
              <div className={`${cardStyles.stepBody} ${cardStyles.stepBodyCompact}`}>
                <h2 style={styles.heading}>你想先从哪一部分开始学习？</h2>
                <ChoiceGroup
                  name="learning-format"
                  value={format}
                  onChange={setFormat}
                  options={learningFormats}
                  label="选择你想开始的学习方式"
                  compact
                />
              </div>
            </div>
          </Step>
        </Stepper>
      </div>
      <Image className={cardStyles.vineFrame} src={forestVineFrame} alt="" aria-hidden="true" fill sizes="(max-width: 680px) calc(100vw - 30px), min(49.7vw, 640px)" />
    </div>
  );
}

const styles = {
  card: {
    position: 'relative',
    width: 'min(100%, 64rem)',
    aspectRatio: '86 / 55',
    containerType: 'inline-size',
    isolation: 'isolate',
    overflow: 'visible',
    boxSizing: 'border-box',
    color: '#f7f1d1',
    fontFamily: '"YouYuan", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
  },
  stepContent: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 0,
    textAlign: 'center',
  },
  heading: {
    maxWidth: '100%',
    margin: 0,
    color: '#fff8df',
    fontSize: '4.15cqw',
    fontWeight: 900,
    lineHeight: 1.18,
    textShadow: '0 0.18cqw 0 rgba(54, 38, 21, 0.9), 0 0 1.1cqw rgba(16, 32, 23, 0.74)',
  },
  paragraph: {
    maxWidth: '100%',
    margin: '0.85cqw 0 0',
    color: '#e2f1d8',
    fontSize: '2.8cqw',
    fontWeight: 800,
    lineHeight: 1.2,
    textShadow: '0 0.14cqw 0 rgba(37, 51, 31, 0.88)',
  },
  mascotFrame: {
    position: 'absolute',
    bottom: '2%',
    left: '3%',
    width: '23cqw',
    height: '31%',
    overflow: 'visible',
    pointerEvents: 'none',
  },
  mascotImage: {
    position: 'absolute',
    bottom: 0,
    left: '1.5cqw',
    display: 'block',
    width: 'auto',
    height: '19cqw',
    maxWidth: 'none',
  },
  choiceFieldset: {
    minWidth: 0,
    margin: '1.05cqw 0 0',
    padding: 0,
    border: 0,
  },
};
