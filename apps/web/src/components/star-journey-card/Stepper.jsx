'use client';

import React, { Children, useEffect, useMemo, useState } from 'react';
import navConnectorImage from './assets/nav-connector.png';
import navSelectedStarImage from './assets/nav-selected-star.png';
import navStepBaseImage from './assets/nav-step-base.png';
import nextStepButtonImage from './assets/next-step-button.png';

const assetSrc = (asset) => (typeof asset === 'string' ? asset : asset.src);

export function Step({ children }) {
  return <>{children}</>;
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange,
  onFinalStepCompleted,
  backButtonText = 'Previous',
  nextButtonText = 'Next',
  finalButtonText = 'Finish',
  disableStepIndicators = false,
}) {
  const steps = useMemo(() => Children.toArray(children), [children]);
  const totalSteps = steps.length;
  const firstStep = Math.min(Math.max(initialStep, 1), Math.max(totalSteps, 1));
  const [currentStep, setCurrentStep] = useState(firstStep);

  useEffect(() => {
    if (totalSteps > 0) {
      onStepChange?.(currentStep);
    }
  }, [currentStep, onStepChange, totalSteps]);

  if (totalSteps === 0) {
    return null;
  }

  const isFirstStep = currentStep === 1;
  const isFinalStep = currentStep === totalSteps;
  const useNextArtwork = !isFinalStep;

  const goToStep = (step) => {
    setCurrentStep(Math.min(Math.max(step, 1), totalSteps));
  };

  const handleNext = () => {
    if (isFinalStep) {
      onFinalStepCompleted?.();
      return;
    }

    goToStep(currentStep + 1);
  };

  return (
    <section aria-label="星宝步骤" style={styles.root}>
      {!disableStepIndicators && (
        <div aria-label={`第 ${currentStep} 步，共 ${totalSteps} 步`} style={styles.progressTrack}>
          {steps.map((_, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isComplete = stepNumber < currentStep;
            const isStar = isActive;

            return (
              <React.Fragment key={stepNumber}>
                <button
                  type="button"
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`前往第 ${stepNumber} 步`}
                  onClick={() => goToStep(stepNumber)}
                  style={{
                    ...styles.progressStep,
                    ...(isStar ? styles.starProgressStep : {}),
                  }}
                >
                  {isStar ? (
                    <img
                      src={assetSrc(navSelectedStarImage)}
                      alt=""
                      style={{ ...styles.starMark, ...styles.starMarkActive }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={styles.stepAsset}
                    >
                      <img src={assetSrc(navStepBaseImage)} alt="" style={styles.stepAssetImage} />
                      <span style={styles.stepAssetNumber}>{stepNumber}</span>
                    </span>
                  )}
                </button>
                {stepNumber < totalSteps && (
                  <img
                    src={assetSrc(navConnectorImage)}
                    alt=""
                    style={{
                      ...styles.progressLine,
                      ...(isComplete ? styles.progressLineComplete : {}),
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div style={styles.content}>{steps[currentStep - 1]}</div>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => goToStep(currentStep - 1)}
          disabled={isFirstStep}
          style={{
            ...styles.button,
            ...styles.backButton,
            ...(isFirstStep ? styles.disabledButton : {}),
          }}
        >
          {backButtonText}
        </button>
        <button
          type="button"
          aria-label={isFinalStep ? finalButtonText : nextButtonText}
          onClick={handleNext}
          style={{ ...styles.button, ...styles.nextButton, ...(isFinalStep ? styles.finalButton : {}) }}
        >
          {useNextArtwork ? <img src={assetSrc(nextStepButtonImage)} alt="" style={styles.nextButtonArtwork} /> : finalButtonText}
        </button>
      </div>
    </section>
  );
}

const styles = {
  root: {
    position: 'relative',
    width: '100%',
    height: '100%',
    fontFamily: '"YouYuan", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
  },
  progressTrack: {
    position: 'absolute',
    top: '10%',
    left: '7.5%',
    right: '7.5%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStep: {
    display: 'grid',
    placeItems: 'center',
    width: '8.8cqw',
    height: '8.8cqw',
    flex: '0 0 8.8cqw',
    padding: 0,
    border: 0,
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  starProgressStep: {
    border: 0,
    backgroundColor: 'transparent',
    boxShadow: 'none',
  },
  starMark: {
    display: 'block',
    width: '8.8cqw',
    height: '8.8cqw',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 0.7rem rgba(255, 249, 199, 0.92))',
  },
  starMarkActive: {
    filter: 'drop-shadow(0 0 1rem rgba(255, 249, 199, 1))',
  },
  stepAsset: {
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    width: '7.5cqw',
    height: '7.5cqw',
  },
  stepAssetImage: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  stepAssetNumber: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    display: 'grid',
    placeItems: 'center',
    width: '52%',
    aspectRatio: '1',
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    backgroundColor: '#eab12d',
    color: '#fffbea',
    fontFamily: '"YouYuan", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    fontSize: '3.3cqw',
    fontWeight: 800,
    lineHeight: 1,
    textShadow: '0 0.12rem 0 #a36a0d',
  },
  progressLine: {
    display: 'block',
    flex: '1 1 0',
    width: '100%',
    minWidth: 0,
    height: '0.8cqw',
    margin: '0 1.2cqw',
    objectFit: 'fill',
  },
  progressLineComplete: {
    filter: 'brightness(0.88) saturate(0.9)',
  },
  content: {
    position: 'absolute',
    inset: 0,
    display: 'block',
  },
  actions: {
    position: 'absolute',
    right: '7.5%',
    bottom: '10%',
    left: '7.5%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1.5cqw',
  },
  button: {
    minHeight: '5.5cqw',
    padding: '1cqw 2cqw',
    border: '0.6cqw solid #965f06',
    borderRadius: '999px',
    font: 'inherit',
    fontSize: '3.2cqw',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: 'inset 0 2px 0 rgba(255, 224, 117, 0.5), 0 4px 0 #7a4e08',
  },
  backButton: {
    backgroundColor: '#d99a18',
    color: '#fff7cf',
  },
  nextButton: {
    width: '17cqw',
    minHeight: 0,
    padding: 0,
    border: 0,
    backgroundColor: 'transparent',
    boxShadow: 'none',
  },
  nextButtonArtwork: {
    display: 'block',
    width: '100%',
    height: 'auto',
  },
  finalButton: {
    width: '17cqw',
    minHeight: '6.2cqw',
    padding: '0 1.8cqw',
    border: '0.5cqw solid #6f3b93',
    color: '#fff9d7',
    backgroundColor: '#653793',
    boxShadow: 'inset 0 0.35cqw 0 #a879cf, 0 0.65cqw 0 #3e1f5c',
    fontSize: '3cqw',
    textShadow: '0 0.2cqw 0 #3e1f5c',
  },
  disabledButton: {
    visibility: 'hidden',
    pointerEvents: 'none',
  },
};
