'use client';

import React, { useState } from 'react';
import Stepper, { Step } from './Stepper';
import cardStyles from './StarJourneyCard.module.css';

const learningStages = [
  { value: 'primary', label: '小学', detail: '从故事、观察和互动开始' },
  { value: 'middle', label: '初中', detail: '用问题和实验认识 AI' },
  { value: 'high', label: '高中', detail: '把 AI 用进项目和创作' },
];

const familiarityLevels = [
  { value: 'new', label: '刚刚认识AI', detail: '我想先了解 AI 是什么' },
  { value: 'used', label: '我已经用过AI工具', detail: '我会问问题、生成内容' },
  { value: 'ready', label: '我能用AI完成学习任务', detail: '我想试试更有挑战的事' },
];

const learningFormats = [
  { value: 'storybook', label: '互动绘本', detail: '跟着故事认识 AI' },
  { value: 'video', label: '观看视频', detail: '用短片快速入门' },
  { value: 'chat', label: '和星宝聊天', detail: '边问边学' },
  { value: 'coding', label: '直接实践编程', detail: '动手写出第一个程序' },
];

function ChoiceGroup({ name, value, onChange, options, label, compact = false }) {
  return (
    <fieldset className={`${cardStyles.choiceGroup} ${compact ? cardStyles.choiceGroupCompact : ''}`} style={styles.choiceFieldset}>
      <legend style={styles.choiceLegend}>{label}</legend>
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
            <small>{option.detail}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function StarJourneyCard() {
  const [stage, setStage] = useState('primary');
  const [familiarity, setFamiliarity] = useState('new');
  const [format, setFormat] = useState('storybook');

  return (
    <div role="region" aria-label="星宝学习旅程" style={styles.card}>
      <Stepper
        initialStep={1}
        backButtonText="上一步"
        nextButtonText="下一步"
        finalButtonText="开始学习"
        onFinalStepCompleted={() => undefined}
        disableStepIndicators={false}
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
  );
}

const styles = {
  card: {
    position: 'relative',
    width: 'min(100%, 64rem)',
    aspectRatio: '86 / 55',
    containerType: 'inline-size',
    overflow: 'hidden',
    boxSizing: 'border-box',
    border: '0.45rem solid #986508',
    borderRadius: '3rem',
    backgroundColor: '#fbd66d',
    backgroundImage: 'radial-gradient(rgba(255, 251, 203, 0.42) 1px, transparent 1px), radial-gradient(rgba(140, 88, 5, 0.12) 1px, transparent 1px)',
    backgroundPosition: '0 0, 9px 11px',
    backgroundSize: '22px 22px, 31px 31px',
    color: '#fff8d5',
    fontFamily: '"YouYuan", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    boxShadow: 'inset 0 0 0 3px rgba(255, 241, 149, 0.65), 0 0.6rem 0 #704908',
  },
  stepContent: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 0,
    textAlign: 'left',
  },
  heading: {
    maxWidth: '100%',
    margin: 0,
    color: '#4c2c91',
    fontSize: '4.65cqw',
    fontWeight: 900,
    lineHeight: 1.18,
    textShadow: '0 2px 0 rgba(255, 240, 153, 0.5)',
  },
  paragraph: {
    maxWidth: '88%',
    margin: '0.85cqw 0 0',
    color: '#fffdf0',
    fontSize: '3.35cqw',
    fontWeight: 800,
    lineHeight: 1.2,
    textShadow: '0 2px 0 rgba(150, 98, 5, 0.28)',
  },
  mascotFrame: {
    position: 'absolute',
    top: '57%',
    left: 0,
    width: '29cqw',
    height: '33%',
    overflow: 'visible',
    pointerEvents: 'none',
  },
  mascotImage: {
    position: 'absolute',
    bottom: '-2%',
    left: '1cqw',
    display: 'block',
    width: 'auto',
    height: '24cqw',
    maxWidth: 'none',
  },
  choiceFieldset: {
    minWidth: 0,
    margin: '1.25cqw 0 0',
    padding: 0,
    border: 0,
  },
  choiceLegend: {
    padding: 0,
    color: '#9a5d0a',
    fontSize: '2.4cqw',
    fontWeight: 900,
  },
};
