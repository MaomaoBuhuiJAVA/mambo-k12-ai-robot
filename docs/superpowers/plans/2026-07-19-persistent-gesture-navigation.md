# 常驻手势导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Orange Pi hand tracking active across every local web route, add V-sign vertical scrolling, and add pinky/thumb previous-next actions for storybook, carousels, and future video players.

**Architecture:** A client-only `RobotGestureProvider` mounted by `app/layout.tsx` becomes the only local-board hand-vision consumer. It polls the existing board service, feeds an expanded pure `GestureController`, renders the global pointer, and emits scroll or semantic previous-next actions. Route pages consume semantic actions without owning the camera lifecycle; `RobotWorkspace` only renders its local vision controls and preview from provider context.

**Tech Stack:** Next.js App Router, React context and effects, TypeScript, Vitest + Testing Library, Python `pytest`, MediaPipe hand landmarks, Orange Pi user systemd service.

---

## File Structure

- Modify: `deploy/mambo-hand-vision.py` — classify V, single-thumb, and single-pinky landmark poses while preserving existing JSON fields.
- Modify: `device/tests/test_hand_vision.py` — cover the new board gesture classifications.
- Modify: `apps/web/src/components/robot/hand-vision-client.ts` — parse new gesture names safely.
- Modify: `apps/web/src/components/robot/gesture-controller.ts` — convert raw gestures into pointer, click, scroll, and navigation events.
- Modify: `apps/web/src/components/robot/gesture-controller.test.ts` — cover scroll direction, dead zone, dwell, and release-to-repeat behavior.
- Create: `apps/web/src/components/robot/robot-gesture-provider.tsx` — root-owned board polling, global overlay, DOM click, scrolling, and semantic navigation dispatch.
- Create: `apps/web/src/components/robot/robot-gesture-provider.test.tsx` — verify root lifecycle and local-only behavior.
- Modify: `apps/web/src/components/robot/gesture-pointer.tsx` and `apps/web/src/components/robot/robot.module.css` — show a teal scroll-mode cursor without weakening green click confirmation feedback.
- Modify: `apps/web/src/components/robot/robot-workspace.tsx` and `apps/web/src/components/robot/robot-workspace.test.tsx` — consume provider state and remove route-unmount service stop ownership.
- Modify: `apps/web/src/app/layout.tsx` — mount `RobotGestureProvider` around all route children.
- Modify: `apps/web/src/app/preview/page.tsx` and `apps/web/src/app/preview/page.test.tsx` — consume previous-next events to turn the existing storybook pages.

### Task 1: Add Board Gesture Names and Landmark Classification

**Files:**
- Modify: `deploy/mambo-hand-vision.py:49-89,823-850`
- Test: `device/tests/test_hand_vision.py:99-114`

- [ ] **Step 1: Write failing board classification tests**

```python
V_SIGN = [
    (0.50, 0.86), (0.42, 0.75), (0.34, 0.62), (0.31, 0.63), (0.36, 0.68),
    (0.40, 0.64), (0.39, 0.48), (0.38, 0.30), (0.37, 0.14),
    (0.50, 0.62), (0.50, 0.42), (0.50, 0.23), (0.50, 0.07),
    (0.60, 0.64), (0.61, 0.54), (0.60, 0.63), (0.59, 0.71),
    (0.69, 0.68), (0.70, 0.58), (0.67, 0.66), (0.64, 0.72),
]

@pytest.mark.parametrize(("landmarks", "expected_gesture"), [
    (V_SIGN, "v_sign"),
    (pinky_only_landmarks(), "pinky_up"),
    (thumb_only_landmarks(), "thumb_up"),
])
def test_classifies_navigation_hand_poses(landmarks, expected_gesture):
    service = load_service()
    assert service.classify_landmarks(landmarks) == expected_gesture
```

- [ ] **Step 2: Run the board test and verify red**

Run: `.venv\\Scripts\\python.exe -m pytest device/tests/test_hand_vision.py -k navigation_hand_poses -q`

Expected: FAIL because `classify_landmarks()` only returns `open_palm`, `fist`, or `none`.

- [ ] **Step 3: Implement explicit extended-finger helpers and classifications**

```python
def finger_is_extended(landmarks, tip_index, pip_index) -> bool:
    return _distance(_point(landmarks, tip_index), _point(landmarks, 0)) > (
        _distance(_point(landmarks, pip_index), _point(landmarks, 0)) * 1.12
    )

def classify_landmarks(landmarks: list[tuple[float, float]]) -> str:
    if len(landmarks) < 21:
        return "none"
    index = finger_is_extended(landmarks, 8, 6)
    middle = finger_is_extended(landmarks, 12, 10)
    ring = finger_is_extended(landmarks, 16, 14)
    pinky = finger_is_extended(landmarks, 20, 18)
    thumb = _distance(_point(landmarks, 4), _point(landmarks, 0)) > _distance(_point(landmarks, 3), _point(landmarks, 0)) * 1.10
    if index and middle and not ring and not pinky:
        return "v_sign"
    if pinky and not index and not middle and not ring:
        return "pinky_up"
    if thumb and not index and not middle and not ring and not pinky:
        return "thumb_up"
    # Preserve the existing open-palm and fist branches after the specific poses.
```

Update `gesture_confidence()` so it scores the same extended or folded fingers required by each new gesture. Leave `cursor_from_mirrored_palm()` and all snapshot field names unchanged.

- [ ] **Step 4: Run focused board tests and verify green**

Run: `.venv\\Scripts\\python.exe -m pytest device/tests/test_hand_vision.py -k "navigation_hand_poses or classifies_21" -q`

Expected: PASS.

- [ ] **Step 5: Commit the board gesture feature**

```powershell
git add deploy/mambo-hand-vision.py device/tests/test_hand_vision.py
git commit -m "feat: classify navigation hand gestures"
```

### Task 2: Expand the Pure Web Gesture State Machine

**Files:**
- Modify: `apps/web/src/components/robot/hand-vision-client.ts:3-18,85-118`
- Modify: `apps/web/src/components/robot/gesture-controller.ts:1-112`
- Test: `apps/web/src/components/robot/gesture-controller.test.ts`

- [ ] **Step 1: Write failing controller tests**

```typescript
it("converts a stable V sign moving upward into downward page scrolling", () => {
  const controller = new GestureController({ scrollActivationMs: 200, scrollDeadZone: 0.02 });
  controller.update(observation({ gesture: "v_sign", x: 0.5, y: 0.70, timestamp: 0 }));
  expect(controller.update(observation({ gesture: "v_sign", x: 0.5, y: 0.60, timestamp: 240 }))).toContainEqual({
    type: "scroll",
    deltaY: 0.10,
  });
});

it("emits one previous action for a held pinky and requires release before repeating", () => {
  const controller = new GestureController({ navigationDwellMs: 350 });
  controller.update(observation({ gesture: "pinky_up", timestamp: 0 }));
  expect(controller.update(observation({ gesture: "pinky_up", timestamp: 360 }))).toContainEqual({ type: "navigate", direction: "previous" });
  expect(controller.update(observation({ gesture: "pinky_up", timestamp: 720 }))).toEqual([]);
});
```

- [ ] **Step 2: Run the controller test and verify red**

Run: `npm exec vitest run src/components/robot/gesture-controller.test.ts`

Expected: FAIL because `GestureName` does not accept `v_sign` or `pinky_up`, and no scroll or navigation events exist.

- [ ] **Step 3: Implement the expanded event contract**

```typescript
export type GestureName = "open_palm" | "fist" | "v_sign" | "thumb_up" | "pinky_up" | "none";
export type GestureEvent =
  | { type: "cursor_move"; x: number; y: number }
  | { type: "progress"; value: number }
  | { type: "click"; x: number; y: number }
  | { type: "scroll"; deltaY: number }
  | { type: "navigate"; direction: "previous" | "next" }
  | { type: "tracking_lost" };
```

On `v_sign`, clear click dwell state, require an open palm before later fist clicks, wait 200ms, then emit only deltas whose absolute value is at least `0.02`. Emit `deltaY = previousY - currentY` so raising the hand produces a positive window scroll amount. On `pinky_up` and `thumb_up`, wait 350ms, emit one `previous` or `next` event, then require release before a second event. Update `parseHandVisionSnapshot()` to accept the three new names and require a 21-point cursor-bearing hand for all non-`none` gestures.

- [ ] **Step 4: Run focused web tests and verify green**

Run: `npm exec vitest run src/components/robot/gesture-controller.test.ts src/components/robot/hand-vision-client.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the pure client state machine**

```powershell
git add apps/web/src/components/robot/gesture-controller.ts apps/web/src/components/robot/gesture-controller.test.ts apps/web/src/components/robot/hand-vision-client.ts apps/web/src/components/robot/hand-vision-client.test.ts
git commit -m "feat: map hand poses to scroll and navigation events"
```

### Task 3: Create the Root-Owned Local Gesture Provider

**Files:**
- Create: `apps/web/src/components/robot/robot-gesture-provider.tsx`
- Create: `apps/web/src/components/robot/robot-gesture-provider.test.tsx`
- Modify: `apps/web/src/components/robot/gesture-pointer.tsx`
- Modify: `apps/web/src/components/robot/robot.module.css:1147-1214`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Write failing provider tests**

```tsx
it("starts the local board service once and keeps polling while route children change", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(jsonResponse(runningSnapshot({ sequence: 1, gesture: "open_palm" })))
    .mockResolvedValue(jsonResponse(runningSnapshot({ sequence: 2, gesture: "open_palm" }))));
  const { rerender } = render(<RobotGestureProvider><div>preview</div></RobotGestureProvider>);
  rerender(<RobotGestureProvider><div>robot</div></RobotGestureProvider>);
  expect(fetch).not.toHaveBeenCalledWith("/_mambo/hand/stop", expect.anything());
});

it("does not access the local hand endpoint outside the board loopback page", () => {
  mockLocation("http://192.168.1.18:3015/preview");
  render(<RobotGestureProvider><div>remote</div></RobotGestureProvider>);
  expect(fetch).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the provider tests and verify red**

Run: `npm exec vitest run src/components/robot/robot-gesture-provider.test.tsx`

Expected: FAIL because `RobotGestureProvider` does not exist.

- [ ] **Step 3: Implement provider context, polling, and route-independent overlay**

```tsx
export const GESTURE_NAVIGATE_EVENT = "mambo:gesture-navigate";
export type GestureNavigationDirection = "previous" | "next";

export function RobotGestureProvider({ children }: { children: ReactNode }) {
  const local = usesLocalDeviceProxy(window.location);
  // Keep one GestureController, one polling loop, and one pointer overlay for all child routes.
  // On scroll: window.scrollBy({ top: deltaY * window.innerHeight * 2.4, behavior: "auto" }).
  // On navigate: window.dispatchEvent(new CustomEvent(GESTURE_NAVIGATE_EVENT, { detail: { direction } })).
  return <RobotGestureContext.Provider value={value}>{children}<GesturePointer cursor={cursor} progress={progress} mode={mode} /></RobotGestureContext.Provider>;
}
```

Start the local service with `fetchHandVisionAction("start")` only when `usesLocalDeviceProxy(window.location)` is true. The provider cleanup cancels polling and disposes local pointer commands, but does not stop the board service during child-route changes because the provider is mounted by the root layout. Add `mode="scroll"` to `GesturePointer` during V-sign processing; CSS uses teal for the ring and dot in that mode while preserving the existing green completion state.

- [ ] **Step 4: Mount the provider in the root layout**

```tsx
import { RobotGestureProvider } from "@/components/robot/robot-gesture-provider";

<body><RobotGestureProvider>{children}</RobotGestureProvider></body>
```

- [ ] **Step 5: Run provider and overlay tests and verify green**

Run: `npm exec vitest run src/components/robot/robot-gesture-provider.test.tsx src/components/robot/gesture-pointer.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit global gesture ownership**

```powershell
git add apps/web/src/app/layout.tsx apps/web/src/components/robot/robot-gesture-provider.tsx apps/web/src/components/robot/robot-gesture-provider.test.tsx apps/web/src/components/robot/gesture-pointer.tsx apps/web/src/components/robot/robot.module.css
git commit -m "feat: keep local gesture control across routes"
```

### Task 4: Move Robot Workspace to Provider Consumption

**Files:**
- Modify: `apps/web/src/components/robot/robot-workspace.tsx:734-1395`
- Modify: `apps/web/src/components/robot/robot-workspace.test.tsx`

- [ ] **Step 1: Write a failing regression test for route cleanup**

```tsx
it("does not stop board hand vision when the classroom workspace unmounts", () => {
  const stop = vi.fn();
  render(<RobotGestureProvider><RobotWorkspace /></RobotGestureProvider>);
  cleanup();
  expect(stop).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the workspace test and verify red**

Run: `npm exec vitest run src/components/robot/robot-workspace.test.tsx -t "does not stop board hand vision"`

Expected: FAIL because `RobotWorkspace` currently calls `fetchHandVisionAction("stop")` in its unmount cleanup.

- [ ] **Step 3: Replace duplicated board ownership with context values**

```tsx
const {
  handVision,
  gestureStatus,
  gestureError,
  startGesture,
  stopGesture,
  resetGesture,
  localHandVisionMode,
} = useRobotGesture();
```

Delete the workspace-local board polling effect, board `GestureController`, global `GesturePointer`, and the `fetchHandVisionAction("stop")` unmount call. Keep only browser-only preview fallback code for non-local visitors. Bind existing vision-tab controls to context `startGesture`, `stopGesture`, and `resetGesture` so the classroom retains its current controls without owning the board service.

- [ ] **Step 4: Run workspace tests and verify green**

Run: `npm exec vitest run src/components/robot/robot-workspace.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit workspace migration**

```powershell
git add apps/web/src/components/robot/robot-workspace.tsx apps/web/src/components/robot/robot-workspace.test.tsx
git commit -m "refactor: consume global robot gesture context"
```

### Task 5: Connect Horizontal Gestures to the Existing Storybook

**Files:**
- Modify: `apps/web/src/app/preview/page.tsx:192-195,573,750,760-762`
- Modify: `apps/web/src/app/preview/page.test.tsx`

- [ ] **Step 1: Write failing storybook navigation tests**

```tsx
it("turns the preview storybook from global gesture navigation events", () => {
  render(<PreviewPage />);
  window.dispatchEvent(new CustomEvent(GESTURE_NAVIGATE_EVENT, { detail: { direction: "next" } }));
  expect(screen.getByText("第 2 / 3 页")).toBeInTheDocument();
  window.dispatchEvent(new CustomEvent(GESTURE_NAVIGATE_EVENT, { detail: { direction: "previous" } }));
  expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the preview test and verify red**

Run: `npm exec vitest run src/app/preview/page.test.tsx -t "global gesture navigation"`

Expected: FAIL because the preview page does not listen for `mambo:gesture-navigate`.

- [ ] **Step 3: Implement semantic event consumption**

```tsx
useEffect(() => {
  const onGestureNavigate = (event: Event) => {
    const direction = (event as CustomEvent<{ direction?: GestureNavigationDirection }>).detail?.direction;
    if (direction === "previous") setStoryPreviewPage((page) => Math.max(0, page - 1));
    if (direction === "next") setStoryPreviewPage((page) => Math.min(storyPreviewPages.length - 1, page + 1));
  };
  window.addEventListener(GESTURE_NAVIGATE_EVENT, onGestureNavigate);
  return () => window.removeEventListener(GESTURE_NAVIGATE_EVENT, onGestureNavigate);
}, []);
```

Keep the event semantic: future video components listen to the same event and seek `-10` or `+10` seconds; they do not change browser history.

- [ ] **Step 4: Run preview test and verify green**

Run: `npm exec vitest run src/app/preview/page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit storybook horizontal controls**

```powershell
git add apps/web/src/app/preview/page.tsx apps/web/src/app/preview/page.test.tsx
git commit -m "feat: control storybook pages with gestures"
```

### Task 6: Full Verification and Orange Pi Deployment

**Files:**
- Modify: `deploy/mambo-hand-vision.service` only if testing demonstrates the existing 12 FPS / 150% CPU configuration cannot sustain the expanded classifier.

- [ ] **Step 1: Run complete automated verification**

```powershell
.venv\Scripts\python.exe -m pytest device/tests -q
npm exec vitest run src/components/robot src/app/preview/page.test.tsx
npm run typecheck
npm run lint
npm run build
```

Expected: all tests pass, one existing skipped Python test remains acceptable, typecheck/lint/build exit with code 0.

- [ ] **Step 2: Deploy the changed board service and restart only the user service**

```powershell
scp deploy/mambo-hand-vision.py orangepi:/opt/mambo-k12-ai-robot/deploy/mambo-hand-vision.py
scp deploy/mambo-hand-vision.service orangepi:/home/orangepi/.config/systemd/user/mambo-hand-vision.service
ssh orangepi "systemctl --user daemon-reload"
ssh orangepi "systemctl --user restart mambo-hand-vision.service"
```

If the unit file did not change, copy only `mambo-hand-vision.py`. Start the local hand endpoint after restart and verify `status=running` before restarting the browser proxy.

- [ ] **Step 3: Deploy the web build on a new local port and point the board proxy to it**

```powershell
npm run build
cmd.exe /c 'start "" /b "C:\Program Files\nodejs\node.exe" "D:\Orange pi System\mambo-k12-ai-robot\node_modules\next\dist\bin\next" start --port 3016'
ssh orangepi "pkill -TERM -f '[l]ocal-web-proxy.py' || true"
ssh orangepi "pkill -TERM -f '[l]aunch-robot-webkit.py' || true"
ssh orangepi "nohup env ROBOT_BROWSER=webkit ROBOT_LOCAL_PROXY=1 ROBOT_PROXY_UPSTREAM=http://192.168.1.18:3016 /opt/mambo-k12-ai-robot/deploy/launch-robot-browser.sh >/tmp/mambo-robot-browser.log 2>&1 </dev/null &"
```

- [ ] **Step 4: Perform board acceptance checks**

```powershell
ssh orangepi "curl -sS http://127.0.0.1:3010/_mambo/hand/status"
ssh orangepi "DISPLAY=:0 XAUTHORITY=/home/orangepi/.Xauthority gnome-screenshot -f /tmp/mambo-persistent-gesture.png"
```

Verify on the device: navigate from `/robot` to `/preview` without a hand-service stop; open palm shows the global pointer; V scrolls down and up; pinky and thumb advance or rewind storybook pages; fist confirmation still clicks an enabled page control.

- [ ] **Step 5: Commit deployment-facing changes**

```powershell
git add deploy/mambo-hand-vision.py deploy/mambo-hand-vision.service device/tests/test_hand_vision.py apps/web
git commit -m "feat: persist gesture navigation on robot pages"
```
