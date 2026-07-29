'use client';

import React, { Children, useEffect, useMemo, useState } from 'react';
import forestChoiceButtonImage from './assets/forest-choice-button.png';
import forestNextButtonImage from './assets/forest-next-button.png';
import forestPineconeStepImage from './assets/forest-pinecone-step.png';
import forestVineConnectorImage from './assets/forest-vine-connector.png';
import navSelectedStarImage from './assets/nav-selected-star.png';

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
                      <img src={assetSrc(forestPineconeStepImage)} alt="" style={styles.stepAssetImage} />
                      <span style={styles.stepAssetNumber}>{stepNumber}</span>
                    </span>
                  )}
                </button>
                {stepNumber < totalSteps && (
                  <img
                    src={assetSrc(forestVineConnectorImage)}
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
          {useNextArtwork ? <img src={assetSrc(forestNextButtonImage)} alt="" style={styles.nextButtonArtwork} /> : finalButtonText}
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
    zIndex: 2,
    top: '7%',
    left: '6.5%',
    right: '6.5%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStep: {
    display: 'grid',
    placeItems: 'center',
    width: '8.3cqw',
    height: '9.4cqw',
    flex: '0 0 8.3cqw',
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
    width: '7.7cqw',
    height: '7.7cqw',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 0.58cqw rgba(255, 239, 136, 0.92))',
  },
  starMarkActive: {
    filter: 'drop-shadow(0 0 0.82cqw rgba(255, 239, 136, 1))',
  },
  stepAsset: {
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    width: '8.3cqw',
    height: '9.4cqw',
  },
  stepAssetImage: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  stepAssetNumber: {
    position: 'absolute',
    top: '78%',
    left: '50%',
    marginTop: '0.8cqw',
    marginLeft: '-0.65cqw',
    display: 'grid',
    placeItems: 'center',
    width: '50%',
    aspectRatio: '1.08',
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    background: 'radial-gradient(ellipse at 50% 45%, #a56d3f 0 53%, #704326 57% 70%, transparent 72%)',
    color: '#fff9dc',
    fontFamily: '"YouYuan", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    fontSize: '2.65cqw',
    fontWeight: 800,
    lineHeight: 1,
    textShadow: '0 0.14cqw 0 #4b2d1e',
  },
  progressLine: {
    display: 'block',
    flex: '1 1 0',
    width: '100%',
    minWidth: 0,
    height: '2.35cqw',
    margin: '0 -0.35cqw',
    objectFit: 'fill',
  },
  progressLineComplete: {
    filter: 'brightness(1.08) saturate(1.2) drop-shadow(0 0 0.38cqw rgba(156, 224, 106, 0.45))',
  },
  content: {
    position: 'absolute',
    zIndex: 1,
    inset: 0,
    display: 'block',
  },
  actions: {
    position: 'absolute',
    zIndex: 3,
    right: '6.5%',
    bottom: '7.5%',
    left: '6.5%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1.5cqw',
  },
  button: {
    minHeight: '5.6cqw',
    padding: '0.75cqw 1.55cqw',
    border: 0,
    borderRadius: '999px',
    font: 'inherit',
    fontSize: '2.4cqw',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'transform 160ms ease, filter 160ms ease',
  },
  backButton: {
    border: '0.16cqw solid rgba(221, 238, 198, 0.46)',
    color: '#e8f4dc',
    backgroundColor: 'rgba(29, 58, 42, 0.7)',
    boxShadow: '0 0.32cqw 0 rgba(12, 25, 17, 0.5)',
    textShadow: '0 0.12cqw 0 rgba(14, 31, 19, 0.94)',
  },
  nextButton: {
    width: '16.5cqw',
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
    filter: 'drop-shadow(0 0.5cqw 0 rgba(27, 21, 12, 0.64))',
  },
  finalButton: {
    width: '19cqw',
    minHeight: '7.2cqw',
    padding: '0 2.1cqw',
    border: 0,
    color: '#fff7db',
    backgroundColor: 'transparent',
    backgroundImage: `url(${assetSrc(forestChoiceButtonImage)})`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% 140%',
    boxShadow: 'none',
    fontSize: 'clamp(15px, 2.65cqw, 17px)',
    fontWeight: 900,
    textShadow: '0 0.16cqw 0 #4a2e1b, 0 0 0.65cqw rgba(16, 14, 8, 0.65)',
  },
  disabledButton: {
    visibility: 'hidden',
    pointerEvents: 'none',
  },
};
