# Cloud Map Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enter the primary-school learning map through a full-viewport, video-inspired cloud transition with a two-second covered hold and an irregular outward reveal.

**Architecture:** A root-level client provider owns a small deterministic transition state machine so the cloud overlay survives the `/preview` to `/map` navigation. The journey card requests the transition instead of pushing the route directly; the map reports that its image is ready, allowing the provider to reveal only after both readiness and the required two-second hold.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Next Image, Vitest, React Testing Library.

---

## File Structure

- Create: `apps/web/public/assets/cloud-transition/cloud-spritesheet.png` - the supplied high-resolution transparent cloud sprite sheet copied from `C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-cb2a675e-545e-440d-b201-f391f7c156ca.png`.
- Create: `apps/web/src/components/cloud-transition/cloud-transition-machine.ts` - durations, phases, reducer, and transition guards with no React dependency.
- Create: `apps/web/src/components/cloud-transition/cloud-transition-machine.test.ts` - unit tests for the state-machine sequence and fallback path.
- Create: `apps/web/src/components/cloud-transition/cloud-transition-provider.tsx` - root client context, route timing, cloud overlay markup, map-ready API, and interaction lock.
- Create: `apps/web/src/components/cloud-transition/cloud-transition-provider.module.css` - fixed overlay, cloud-sprite positioning, cover/hold/reveal animation, and reduced-motion rules.
- Create: `apps/web/src/components/cloud-transition/cloud-transition-provider.test.tsx` - provider timing, routing, readiness, fallback, and input-lock tests.
- Modify: `apps/web/src/app/layout.tsx` - wrap the existing `RobotGestureProvider` with `CloudTransitionProvider`.
- Modify: `apps/web/src/components/star-journey-card/StarJourneyCard.jsx` - request primary-school transition rather than directly calling `router.push`.
- Modify: `apps/web/src/components/star-journey-card/Stepper.jsx` - lock the journey controls while the transition is active.
- Modify: `apps/web/src/app/map/page.tsx` - report map-image readiness to the cloud provider.
- Modify: `apps/web/src/app/map/page.test.tsx` - mock the provider and assert map readiness is published.
- Modify: `apps/web/src/app/preview/page.test.tsx` - assert the primary journey invokes the transition API instead of a direct route push.

### Task 1: Create the deterministic cloud transition state machine

**Files:**
- Create: `apps/web/src/components/cloud-transition/cloud-transition-machine.ts`
- Create: `apps/web/src/components/cloud-transition/cloud-transition-machine.test.ts`

- [ ] **Step 1: Write the failing state-machine tests**

```ts
import { describe, expect, it } from "vitest";

import { initialCloudTransitionState, transitionCloudState } from "./cloud-transition-machine";

describe("cloud transition state machine", () => {
  it("requires a covered hold and map readiness before revealing", () => {
    const covering = transitionCloudState(initialCloudTransitionState, { type: "START" });
    const holding = transitionCloudState(covering, { type: "COVERED" });
    const readyButHolding = transitionCloudState(holding, { type: "MAP_READY" });
    const revealing = transitionCloudState(readyButHolding, { type: "MINIMUM_HOLD_ELAPSED" });

    expect(covering.phase).toBe("covering");
    expect(holding.phase).toBe("holding");
    expect(readyButHolding.phase).toBe("holding");
    expect(revealing.phase).toBe("revealing");
  });

  it("reveals after the maximum hold even when the map-ready signal never arrives", () => {
    const holding = transitionCloudState(
      transitionCloudState(initialCloudTransitionState, { type: "START" }),
      { type: "COVERED" },
    );

    expect(transitionCloudState(holding, { type: "MAXIMUM_HOLD_ELAPSED" }).phase).toBe("revealing");
  });

  it("ignores duplicate starts and returns to idle after the reveal", () => {
    const covering = transitionCloudState(initialCloudTransitionState, { type: "START" });

    expect(transitionCloudState(covering, { type: "START" })).toEqual(covering);
    expect(transitionCloudState({ phase: "revealing", mapReady: true, minimumHoldElapsed: true }, { type: "REVEAL_FINISHED" }))
      .toEqual(initialCloudTransitionState);
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```powershell
npm test -- src/components/cloud-transition/cloud-transition-machine.test.ts
```

Expected: FAIL because `cloud-transition-machine.ts` does not exist.

- [ ] **Step 3: Implement the phase model and reducer**

```ts
export const CLOUD_COVER_DURATION_MS = 550;
export const CLOUD_MINIMUM_HOLD_MS = 2_000;
export const CLOUD_MAXIMUM_HOLD_MS = 5_000;
export const CLOUD_REVEAL_DURATION_MS = 650;

export type CloudTransitionPhase = "idle" | "covering" | "holding" | "revealing";

export type CloudTransitionState = {
  phase: CloudTransitionPhase;
  mapReady: boolean;
  minimumHoldElapsed: boolean;
};

export type CloudTransitionEvent =
  | { type: "START" }
  | { type: "COVERED" }
  | { type: "MAP_READY" }
  | { type: "MINIMUM_HOLD_ELAPSED" }
  | { type: "MAXIMUM_HOLD_ELAPSED" }
  | { type: "REVEAL_FINISHED" };

export const initialCloudTransitionState: CloudTransitionState = {
  phase: "idle",
  mapReady: false,
  minimumHoldElapsed: false,
};

function revealWhenReady(state: CloudTransitionState): CloudTransitionState {
  return state.mapReady && state.minimumHoldElapsed ? { ...state, phase: "revealing" } : state;
}

export function transitionCloudState(
  state: CloudTransitionState,
  event: CloudTransitionEvent,
): CloudTransitionState {
  switch (event.type) {
    case "START":
      return state.phase === "idle" ? { phase: "covering", mapReady: false, minimumHoldElapsed: false } : state;
    case "COVERED":
      return state.phase === "covering" ? { phase: "holding", mapReady: false, minimumHoldElapsed: false } : state;
    case "MAP_READY":
      return state.phase === "holding" ? revealWhenReady({ ...state, mapReady: true }) : state;
    case "MINIMUM_HOLD_ELAPSED":
      return state.phase === "holding" ? revealWhenReady({ ...state, minimumHoldElapsed: true }) : state;
    case "MAXIMUM_HOLD_ELAPSED":
      return state.phase === "holding" ? { ...state, phase: "revealing" } : state;
    case "REVEAL_FINISHED":
      return state.phase === "revealing" ? initialCloudTransitionState : state;
  }
}
```

- [ ] **Step 4: Run the state-machine tests and type check**

Run:

```powershell
npm test -- src/components/cloud-transition/cloud-transition-machine.test.ts
npm run typecheck
```

Expected: all selected tests and TypeScript checks pass.

- [ ] **Step 5: Commit the state machine**

```powershell
git add apps/web/src/components/cloud-transition/cloud-transition-machine.ts apps/web/src/components/cloud-transition/cloud-transition-machine.test.ts
git commit -m "feat: add cloud transition state machine"
```

### Task 2: Build the full-viewport cloud provider and visual layers

**Files:**
- Create: `apps/web/public/assets/cloud-transition/cloud-spritesheet.png`
- Create: `apps/web/src/components/cloud-transition/cloud-transition-provider.tsx`
- Create: `apps/web/src/components/cloud-transition/cloud-transition-provider.module.css`
- Create: `apps/web/src/components/cloud-transition/cloud-transition-provider.test.tsx`

- [ ] **Step 1: Add failing provider tests with fake timers and a route mock**

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudTransitionProvider, useCloudTransition } from "./cloud-transition-provider";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Trigger() {
  const { isTransitioning, notifyMapReady, startMapTransition } = useCloudTransition();
  return <><button onClick={startMapTransition}>start</button><button onClick={notifyMapReady}>ready</button><output>{String(isTransitioning)}</output></>;
}

describe("CloudTransitionProvider", () => {
  beforeEach(() => { push.mockReset(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it("covers, routes, holds two seconds, then reveals after map readiness", () => {
    render(<CloudTransitionProvider><Trigger /></CloudTransitionProvider>);
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "covering");

    act(() => vi.advanceTimersByTime(550));
    expect(push).toHaveBeenCalledWith("/map");
    fireEvent.click(screen.getByRole("button", { name: "ready" }));
    act(() => vi.advanceTimersByTime(1_999));
    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "holding");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "revealing");
  });
});
```

- [ ] **Step 2: Run the provider test and verify it fails**

Run:

```powershell
npm test -- src/components/cloud-transition/cloud-transition-provider.test.tsx
```

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Copy the supplied cloud sprite sheet into the public asset folder**

Run:

```powershell
New-Item -ItemType Directory -Force apps/web/public/assets/cloud-transition
Copy-Item 'C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-cb2a675e-545e-440d-b201-f391f7c156ca.png' apps/web/public/assets/cloud-transition/cloud-spritesheet.png
```

Expected: `apps/web/public/assets/cloud-transition/cloud-spritesheet.png` exists and retains transparency.

- [ ] **Step 4: Implement the provider API, timers, and cloud markup**

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  CLOUD_COVER_DURATION_MS,
  CLOUD_MAXIMUM_HOLD_MS,
  CLOUD_MINIMUM_HOLD_MS,
  CLOUD_REVEAL_DURATION_MS,
  initialCloudTransitionState,
  transitionCloudState,
} from "./cloud-transition-machine";
import styles from "./cloud-transition-provider.module.css";

type CloudTransitionContextValue = {
  isTransitioning: boolean;
  startMapTransition: () => boolean;
  notifyMapReady: () => void;
};

const CloudTransitionContext = createContext<CloudTransitionContextValue | null>(null);

const cloudInstances = [
  { id: "back-northwest", layer: "back", sprite: "0 0", size: "58vw", startX: "-64vw", startY: "-25vh", coveredX: "-15vw", coveredY: "-13vh", exitX: "-63vw", exitY: "-23vh", delay: "0ms", opacity: "0.48" },
  { id: "back-northeast", layer: "back", sprite: "50% 0", size: "62vw", startX: "103vw", startY: "-22vh", coveredX: "49vw", coveredY: "-15vh", exitX: "106vw", exitY: "-25vh", delay: "20ms", opacity: "0.44" },
  { id: "back-southwest", layer: "back", sprite: "25% 0", size: "59vw", startX: "-57vw", startY: "84vh", coveredX: "-15vw", coveredY: "47vh", exitX: "-60vw", exitY: "89vh", delay: "40ms", opacity: "0.47" },
  { id: "back-southeast", layer: "back", sprite: "100% 0", size: "64vw", startX: "56vw", startY: "78vh", coveredX: "28vw", coveredY: "42vh", exitX: "60vw", exitY: "82vh", delay: "55ms", opacity: "0.46" },
  { id: "middle-north", layer: "middle", sprite: "50% 25%", size: "47vw", startX: "15vw", startY: "-52vh", coveredX: "21vw", coveredY: "-10vh", exitX: "15vw", exitY: "-55vh", delay: "45ms", opacity: "0.87" },
  { id: "middle-west", layer: "middle", sprite: "0 25%", size: "45vw", startX: "-52vw", startY: "20vh", coveredX: "-4vw", coveredY: "18vh", exitX: "-54vw", exitY: "16vh", delay: "70ms", opacity: "0.88" },
  { id: "middle-east", layer: "middle", sprite: "75% 25%", size: "48vw", startX: "104vw", startY: "8vh", coveredX: "54vw", coveredY: "13vh", exitX: "106vw", exitY: "4vh", delay: "30ms", opacity: "0.9" },
  { id: "middle-south", layer: "middle", sprite: "50% 50%", size: "50vw", startX: "25vw", startY: "112vh", coveredX: "23vw", coveredY: "47vh", exitX: "28vw", exitY: "112vh", delay: "100ms", opacity: "0.84" },
  { id: "middle-center", layer: "middle", sprite: "25% 25%", size: "52vw", startX: "118vw", startY: "42vh", coveredX: "23vw", coveredY: "24vh", exitX: "119vw", exitY: "38vh", delay: "85ms", opacity: "0.86" },
  { id: "front-north", layer: "front", sprite: "25% 50%", size: "33vw", startX: "29vw", startY: "-43vh", coveredX: "29vw", coveredY: "-4vh", exitX: "23vw", exitY: "-44vh", delay: "125ms", opacity: "1" },
  { id: "front-west", layer: "front", sprite: "75% 50%", size: "32vw", startX: "-39vw", startY: "45vh", coveredX: "7vw", coveredY: "30vh", exitX: "-42vw", exitY: "47vh", delay: "110ms", opacity: "0.98" },
  { id: "front-east", layer: "front", sprite: "100% 50%", size: "34vw", startX: "108vw", startY: "48vh", coveredX: "58vw", coveredY: "33vh", exitX: "111vw", exitY: "51vh", delay: "135ms", opacity: "0.99" },
  { id: "front-southwest", layer: "front", sprite: "0 75%", size: "30vw", startX: "-38vw", startY: "88vh", coveredX: "10vw", coveredY: "53vh", exitX: "-40vw", exitY: "92vh", delay: "145ms", opacity: "0.96" },
  { id: "front-southeast", layer: "front", sprite: "75% 75%", size: "31vw", startX: "107vw", startY: "82vh", coveredX: "62vw", coveredY: "50vh", exitX: "110vw", exitY: "86vh", delay: "160ms", opacity: "0.94" },
] as const;

export function CloudTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(transitionCloudState, initialCloudTransitionState);
  const startLockRef = useRef(false);
  const isTransitioning = state.phase !== "idle";
  const startMapTransition = useCallback(() => {
    if (startLockRef.current || state.phase !== "idle") return false;
    startLockRef.current = true;
    dispatch({ type: "START" });
    return true;
  }, [state.phase]);
  const notifyMapReady = useCallback(() => dispatch({ type: "MAP_READY" }), []);

  useEffect(() => {
    if (state.phase === "idle") startLockRef.current = false;
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "covering") return;
    const timer = window.setTimeout(() => { dispatch({ type: "COVERED" }); router.push("/map"); }, CLOUD_COVER_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [router, state.phase]);

  useEffect(() => {
    if (state.phase !== "holding") return;
    const minimumTimer = window.setTimeout(() => dispatch({ type: "MINIMUM_HOLD_ELAPSED" }), CLOUD_MINIMUM_HOLD_MS);
    const fallbackTimer = window.setTimeout(() => dispatch({ type: "MAXIMUM_HOLD_ELAPSED" }), CLOUD_MAXIMUM_HOLD_MS);
    return () => { window.clearTimeout(minimumTimer); window.clearTimeout(fallbackTimer); };
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "revealing") return;
    const timer = window.setTimeout(() => dispatch({ type: "REVEAL_FINISHED" }), CLOUD_REVEAL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  const value = useMemo(() => ({ isTransitioning, startMapTransition, notifyMapReady }), [isTransitioning, notifyMapReady, startMapTransition]);
  return <CloudTransitionContext.Provider value={value}>{children}{isTransitioning ? <div aria-busy="true" aria-label="正在前往小学学习地图" className={styles.overlay} data-phase={state.phase} data-testid="cloud-transition-overlay">{cloudInstances.map((cloud) => <span aria-hidden="true" className={styles.cloud} data-layer={cloud.layer} key={cloud.id} style={{ "--cloud-size": cloud.size, "--cloud-start-x": cloud.startX, "--cloud-start-y": cloud.startY, "--cloud-covered-x": cloud.coveredX, "--cloud-covered-y": cloud.coveredY, "--cloud-exit-x": cloud.exitX, "--cloud-exit-y": cloud.exitY, "--cloud-delay": cloud.delay, "--cloud-opacity": cloud.opacity, "--cloud-sprite": cloud.sprite } as CSSProperties} />)}</div> : null}</CloudTransitionContext.Provider>;
}

export function useCloudTransition(): CloudTransitionContextValue {
  const context = useContext(CloudTransitionContext);
  if (!context) throw new Error("useCloudTransition must be used within CloudTransitionProvider");
  return context;
}
```

- [ ] **Step 5: Add cloud-only CSS with depth, irregular paths, and reduced motion**

```css
.overlay { position: fixed; z-index: 100; inset: 0; overflow: hidden; isolation: isolate; pointer-events: auto; background: transparent; }
.cloud { position: absolute; width: var(--cloud-size); aspect-ratio: 1.5; background: url("/assets/cloud-transition/cloud-spritesheet.png") var(--cloud-sprite) / 400% 500% no-repeat; opacity: 0; filter: drop-shadow(0 1.5vw 1.8vw rgb(83 118 150 / 0.28)); will-change: transform, opacity; }
.cloud[data-layer="back"] { filter: blur(0.45vw) drop-shadow(0 2vw 2.6vw rgb(61 93 127 / 0.38)); }
.cloud[data-layer="middle"] { filter: drop-shadow(0 1.1vw 1.7vw rgb(92 132 169 / 0.31)); }
.cloud[data-layer="front"] { filter: brightness(1.07) drop-shadow(0 0.8vw 1.3vw rgb(162 198 232 / 0.34)); }
.overlay[data-phase="covering"] .cloud { animation: cloud-cover 550ms cubic-bezier(.24,.82,.35,1) var(--cloud-delay) both; }
.overlay[data-phase="holding"] .cloud { opacity: var(--cloud-opacity); transform: translate(var(--cloud-covered-x), var(--cloud-covered-y)) scale(1.04); animation: cloud-drift 2.4s ease-in-out infinite alternate; }
.overlay[data-phase="revealing"] .cloud { animation: cloud-reveal 650ms cubic-bezier(.2,.67,.38,1) var(--cloud-delay) both; }
@keyframes cloud-cover { from { opacity: 0; transform: translate(var(--cloud-start-x), var(--cloud-start-y)) scale(.86); } to { opacity: var(--cloud-opacity); transform: translate(var(--cloud-covered-x), var(--cloud-covered-y)) scale(1.04); } }
@keyframes cloud-reveal { from { opacity: var(--cloud-opacity); transform: translate(var(--cloud-covered-x), var(--cloud-covered-y)) scale(1.04); } to { opacity: 0; transform: translate(var(--cloud-exit-x), var(--cloud-exit-y)) scale(1.15); } }
@keyframes cloud-drift { to { transform: translate(calc(var(--cloud-covered-x) + 1.2vw), calc(var(--cloud-covered-y) - .9vh)) scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .overlay[data-phase="covering"] .cloud, .overlay[data-phase="revealing"] .cloud { animation-duration: 120ms; } .overlay[data-phase="holding"] .cloud { animation: none; } }
```

- [ ] **Step 6: Extend provider tests for duplicate requests, fallback, and locked pointer interaction**

```tsx
it("does not start a second route transition while the first transition is active", () => {
  render(<CloudTransitionProvider><Trigger /></CloudTransitionProvider>);
  fireEvent.click(screen.getByRole("button", { name: "start" }));
  fireEvent.click(screen.getByRole("button", { name: "start" }));
  act(() => vi.advanceTimersByTime(550));
  expect(push).toHaveBeenCalledTimes(1);
});

it("reveals after the fallback wait when map readiness is unavailable", () => {
  render(<CloudTransitionProvider><Trigger /></CloudTransitionProvider>);
  fireEvent.click(screen.getByRole("button", { name: "start" }));
  act(() => vi.advanceTimersByTime(550 + 5_000));
  expect(screen.getByTestId("cloud-transition-overlay")).toHaveAttribute("data-phase", "revealing");
});
```

- [ ] **Step 7: Run provider and state-machine tests**

Run:

```powershell
npm test -- src/components/cloud-transition/cloud-transition-machine.test.ts src/components/cloud-transition/cloud-transition-provider.test.tsx
npm run typecheck
```

Expected: all cloud-transition tests pass; TypeScript resolves the CSS module and React context types.

- [ ] **Step 8: Commit the provider and cloud asset**

```powershell
git add apps/web/public/assets/cloud-transition/cloud-spritesheet.png apps/web/src/components/cloud-transition/cloud-transition-provider.tsx apps/web/src/components/cloud-transition/cloud-transition-provider.module.css apps/web/src/components/cloud-transition/cloud-transition-provider.test.tsx
git commit -m "feat: add full-screen cloud map transition"
```

### Task 3: Integrate the transition with layout, the primary journey, and map readiness

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/components/star-journey-card/StarJourneyCard.jsx`
- Modify: `apps/web/src/components/star-journey-card/Stepper.jsx`
- Modify: `apps/web/src/app/map/page.tsx`
- Modify: `apps/web/src/app/map/page.test.tsx`
- Modify: `apps/web/src/app/preview/page.test.tsx`

- [ ] **Step 1: Change the preview test to expect the transition request rather than direct routing**

Replace the direct-push assertion in `opens the primary-school learning map when the journey starts` with a mock of the cloud hook:

```tsx
const startMapTransition = vi.fn(() => true);

vi.mock("@/components/cloud-transition/cloud-transition-provider", () => ({
  useCloudTransition: () => ({ isTransitioning: false, startMapTransition, notifyMapReady: vi.fn() }),
}));

expect(startMapTransition).toHaveBeenCalledTimes(1);
expect(push).not.toHaveBeenCalledWith("/map");
```

- [ ] **Step 2: Run the focused preview test and verify it fails**

Run:

```powershell
npm test -- src/app/preview/page.test.tsx -t "opens the primary-school learning map when the journey starts"
```

Expected: FAIL because `StarJourneyCard` still calls `router.push("/map")`.

- [ ] **Step 3: Wrap the root application and replace direct journey routing**

Update `layout.tsx` so the existing gesture provider remains intact:

```tsx
import { CloudTransitionProvider } from "@/components/cloud-transition/cloud-transition-provider";

<body>
  <CloudTransitionProvider>
    <RobotGestureProvider>{children}</RobotGestureProvider>
  </CloudTransitionProvider>
</body>
```

Update `StarJourneyCard.jsx` to remove `useRouter`, call the context API only for the primary-school path, and pass the lock into `Stepper`:

```jsx
import { useCloudTransition } from "@/components/cloud-transition/cloud-transition-provider";

const { isTransitioning, startMapTransition } = useCloudTransition();

function handleFinalStepCompleted() {
  if (stage === "primary") startMapTransition();
}

<Stepper
  initialStep={1}
  backButtonText="上一步"
  nextButtonText="下一步"
  finalButtonText="开始"
  onFinalStepCompleted={handleFinalStepCompleted}
  disableStepIndicators={false}
  interactionLocked={isTransitioning}
/>
```

Update `Stepper.jsx` with the optional prop and attach it to every step and action control:

```jsx
export default function Stepper({
  children,
  initialStep = 1,
  onStepChange,
  onFinalStepCompleted,
  backButtonText = "Previous",
  nextButtonText = "Next",
  finalButtonText = "Finish",
  disableStepIndicators = false,
  interactionLocked = false,
}) {
  <section aria-busy={interactionLocked || undefined} aria-label="星宝步骤" style={styles.root}>
    <button
      type="button"
      aria-current={isActive ? "step" : undefined}
      aria-label={`前往第 ${stepNumber} 步`}
      disabled={interactionLocked}
      onClick={() => goToStep(stepNumber)}
      style={{ ...styles.progressStep, ...(isStar ? styles.starProgressStep : {}) }}
    >
      {isStar ? <img src={assetSrc(navSelectedStarImage)} alt="" style={{ ...styles.starMark, ...styles.starMarkActive }} /> : <span aria-hidden="true" style={styles.stepAsset}><img src={assetSrc(forestPineconeStepImage)} alt="" style={styles.stepAssetImage} /><span style={styles.stepAssetNumber}>{stepNumber}</span></span>}
    </button>
    <button
      type="button"
      disabled={isFirstStep || interactionLocked}
      onClick={() => goToStep(currentStep - 1)}
      style={{ ...styles.button, ...styles.backButton, ...(isFirstStep || interactionLocked ? styles.disabledButton : {}) }}
    >
      {backButtonText}
    </button>
    <button
      type="button"
      aria-label={isFinalStep ? finalButtonText : nextButtonText}
      disabled={interactionLocked}
      onClick={handleNext}
      style={{ ...styles.button, ...styles.nextButton, ...(isFinalStep ? styles.finalButton : {}) }}
    >
      {useNextArtwork ? <img src={assetSrc(forestNextButtonImage)} alt="" style={styles.nextButtonArtwork} /> : finalButtonText}
    </button>
  </section>
}
```

- [ ] **Step 4: Add map-image readiness coverage, then implement it**

Add the provider mock and readiness assertion in `page.test.tsx`:

```tsx
const notifyMapReady = vi.fn();
vi.mock("@/components/cloud-transition/cloud-transition-provider", () => ({
  useCloudTransition: () => ({ notifyMapReady }),
}));

it("reports readiness after the full map artwork has loaded", () => {
  render(<LearningMapPage />);
  fireEvent.load(screen.getByRole("img", { name: "小学学习地图" }));
  expect(notifyMapReady).toHaveBeenCalledTimes(1);
});
```

Implement that behavior in `map/page.tsx`:

```tsx
import { useEffect, useState, type CSSProperties } from "react";
import { useCloudTransition } from "@/components/cloud-transition/cloud-transition-provider";

const { notifyMapReady } = useCloudTransition();
const [mapImageLoaded, setMapImageLoaded] = useState(false);

useEffect(() => {
  if (mapImageLoaded) notifyMapReady();
}, [mapImageLoaded, notifyMapReady]);

<Image
  className={styles.mapArtwork}
  src="/assets/learning-map/starbao-learning-islands-transparent-water.png"
  alt="小学学习地图"
  width={mapWidth}
  height={mapHeight}
  priority
  onLoad={() => setMapImageLoaded(true)}
/>
```

- [ ] **Step 5: Run the modified integration tests and type check**

Run:

```powershell
npm test -- src/app/preview/page.test.tsx src/app/map/page.test.tsx
npm run typecheck
```

Expected: the journey test observes `startMapTransition`, map readiness fires after the image load event, and existing hotspot/card tests remain green.

- [ ] **Step 6: Commit the integration**

```powershell
git add apps/web/src/app/layout.tsx apps/web/src/components/star-journey-card/StarJourneyCard.jsx apps/web/src/components/star-journey-card/Stepper.jsx apps/web/src/app/map/page.tsx apps/web/src/app/map/page.test.tsx apps/web/src/app/preview/page.test.tsx
git commit -m "feat: route primary learners through cloud transition"
```

### Task 4: Validate the end-to-end visual behavior on desktop and mobile

**Files:**
- Modify if required: `apps/web/src/components/cloud-transition/cloud-transition-provider.module.css`

- [ ] **Step 1: Run the complete cloud and route test set**

Run:

```powershell
npm test -- src/components/cloud-transition src/app/map/page.test.tsx src/app/preview/page.test.tsx
npm run lint
npm run typecheck
```

Expected: all selected tests, lint, and type checks pass.

- [ ] **Step 2: Start the local web application**

Run from `apps/web`:

```powershell
npm run dev -- --port 3001
```

Expected: Next.js reports a usable localhost URL. Use a different unused port if `3001` is already serving another process.

- [ ] **Step 3: Verify the full reference flow in the browser**

1. Open `/preview`, advance to the final journey step, leave the stage as “小学”, then click “开始”.
2. Capture a screenshot during `covering` and verify no viewport corner shows a white rectangular fallback or source page control.
3. Verify the overlay remains entirely cloud-based for at least two seconds after `/map` becomes the route.
4. Capture a screenshot during `revealing` and verify the map appears from the center while cloud remnants exit irregularly at the edges.
5. After completion, hover a hotspot, open its card deck, close it via the dimmed backdrop, and use “返回首页”.

- [ ] **Step 4: Repeat at a mobile viewport**

Set the viewport to `390x844`, repeat Steps 1-4 above, and confirm every viewport edge is covered during the hold phase and that the full map remains usable after reveal.

- [ ] **Step 5: Make only scoped CSS corrections if evidence shows uncovered edges or a sheet-like layer**

Use the screenshot evidence to adjust only the cloud instance bounds, opacity, timing, blur, or CSS `background-position`. Do not introduce a full-screen white background, random runtime layout, or changes to hotspot geometry.

- [ ] **Step 6: Commit any evidence-based visual correction**

```powershell
git add apps/web/src/components/cloud-transition/cloud-transition-provider.module.css
git commit -m "fix: refine cloud transition coverage"
```
