# Robot Gesture and Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the robot screen respond smoothly to a hand, confirm a fist dwell with a full-screen circular cursor action, support the spoken command "点击拍照", and add local face enrollment/identity recognition without opening a second camera.

**Architecture:** The existing Orange Pi native hand-vision process remains the sole owner of `/dev/video0`; the browser polls its normalized observations. The browser renders a fixed, pointer-transparent gesture overlay over the entire screen and performs local DOM clicks immediately. Face detection and matching are added to the same Python process as a low-rate optional pipeline using OpenCV YuNet and SFace ONNX models, with feature vectors stored locally rather than source photos.

**Tech Stack:** Next.js client component, React, Vitest, MediaPipe Tasks, OpenCV DNN (`FaceDetectorYN` / `FaceRecognizerSF`), Python `unittest`, Orange Pi user services.

---

### Task 1: Bound a Stalled Local Hand-Service Poll

**Files:**
- Modify: `apps/web/src/components/robot/robot-workspace.test.tsx`
- Modify: `apps/web/src/components/robot/robot-workspace.tsx`
- Verify: `deploy/launch-robot-browser.sh`

- [ ] **Step 1: Write a failing regression test for a hung status request**

```tsx
it("abandons a board status request that never responds", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
  const pending = fetchHandVisionStatus();
  await vi.advanceTimersByTimeAsync(HAND_VISION_STATUS_TIMEOUT_MS);
  await expect(pending).rejects.toThrow("hand_vision_unavailable");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails for the missing regression assertion**

Run: `npm.cmd exec vitest run src/components/robot/hand-vision-client.test.ts -t "abandons a board status request"`

Expected: FAIL because there is no bounded `fetchHandVisionStatus` helper.

- [ ] **Step 3: Add a bounded local-status client and use it in the poller**

```ts
export async function fetchHandVisionStatus(): Promise<HandVisionSnapshot> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HAND_VISION_STATUS_TIMEOUT_MS);
  try {
    const response = await fetch("/_mambo/hand/status", { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("hand_vision_unavailable");
    const snapshot = parseHandVisionSnapshot(await response.json());
    if (!snapshot) throw new Error("hand_vision_unavailable");
    return snapshot;
  } finally {
    window.clearTimeout(timeout);
  }
}
```

Keep the existing `/_mambo/hand/start` branch unchanged; the documented recovery for a stale old WebKit bundle remains a browser reload, not a model reinstall.

- [ ] **Step 4: Re-run the focused test**

Run: `npm.cmd exec vitest run src/components/robot/hand-vision-client.test.ts -t "abandons a board status request"`

Expected: PASS.

### Task 2: Make Gesture State Safe and Coordinate Mapping Testable

**Files:**
- Create: `apps/web/src/components/robot/gesture-screen-target.ts`
- Create: `apps/web/src/components/robot/gesture-screen-target.test.ts`
- Modify: `apps/web/src/components/robot/gesture-controller.ts`
- Create or modify: `apps/web/src/components/robot/gesture-controller.test.ts`

- [ ] **Step 1: Write failing tests for stale-cursor loss and viewport mapping**

```ts
it("requires a new open palm after tracking is lost before a fist can click", () => {
  const controller = new GestureController({ dwellMs: 1 });
  controller.update(openPalmAt(0));
  controller.update(noHandAt(2));
  expect(controller.update(fistAt(4)).some((event) => event.type === "click")).toBe(false);
});

it("maps a normalized gesture coordinate to the full browser viewport", () => {
  expect(toViewportPoint({ x: 0.5, y: 0.25 }, { width: 800, height: 480 })).toEqual({ x: 400, y: 120 });
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm.cmd exec vitest run src/components/robot/gesture-controller.test.ts src/components/robot/gesture-screen-target.test.ts`

Expected: FAIL because a lost tracking session retains its old cursor and the viewport helper does not exist.

- [ ] **Step 3: Implement minimal state reset and coordinate helpers**

```ts
export function toViewportPoint(point: GesturePoint, viewport: Viewport) {
  return { x: clamp(point.x) * viewport.width, y: clamp(point.y) * viewport.height };
}

// in the invalid-observation branch
this.cursor = null;
this.fistStartedAt = null;
this.clicked = false;
```

- [ ] **Step 4: Re-run the focused tests**

Run: `npm.cmd exec vitest run src/components/robot/gesture-controller.test.ts src/components/robot/gesture-screen-target.test.ts`

Expected: PASS.

### Task 3: Render a Full-Screen Circular Gesture Pointer

**Files:**
- Create: `apps/web/src/components/robot/gesture-pointer.tsx`
- Create: `apps/web/src/components/robot/gesture-pointer.test.tsx`
- Modify: `apps/web/src/components/robot/robot-workspace.tsx`
- Modify: `apps/web/src/components/robot/robot.module.css`

- [ ] **Step 1: Write the failing pointer tests**

```tsx
it("places the pointer in a fixed full-screen overlay and exposes dwell progress", () => {
  render(<GesturePointer cursor={{ x: 0.5, y: 0.25 }} progress={0.6} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  expect(screen.getByTestId("gesture-pointer")).toHaveStyle({ left: "50%", top: "25%" });
});

it("marks a completed dwell for the green confirmation animation", () => {
  render(<GesturePointer cursor={{ x: 0.5, y: 0.5 }} progress={1} />);
  expect(screen.getByTestId("gesture-pointer")).toHaveAttribute("data-complete", "true");
});
```

- [ ] **Step 2: Run the pointer tests and confirm they fail**

Run: `npm.cmd exec vitest run src/components/robot/gesture-pointer.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the fixed overlay and circular SVG progress ring**

```tsx
<div className={styles.gesturePointerLayer} aria-hidden="true">
  <div
    className={styles.gesturePointer}
    data-complete={progress >= 1}
    data-testid="gesture-pointer"
    style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
  >
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle className={styles.gesturePointerTrack} cx="24" cy="24" r="20" pathLength="100" />
      <circle className={styles.gesturePointerProgress} cx="24" cy="24" r="20" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} />
    </svg>
  </div>
</div>
```

Use `position: fixed; inset: 0; pointer-events: none` for the layer. On `[data-complete="true"]`, switch ring color to green and run a short `transform`/`box-shadow` confirmation animation; include a `prefers-reduced-motion` rule. Remove the card-local horizontal progress bar and local cursor.

- [ ] **Step 4: Mount the pointer at the `<main>` level and use viewport coordinates for DOM hit testing**

```ts
const point = toViewportPoint(event, { width: window.innerWidth, height: window.innerHeight });
const target = document.elementFromPoint(point.x, point.y);
const interactive = target?.closest<HTMLElement>("button,a,input,[role=button]");
interactive?.click();
```

Use the same normalized point for the optional physical pointer command, but keep the local DOM click on the critical path.

- [ ] **Step 5: Re-run pointer and workspace tests**

Run: `npm.cmd exec vitest run src/components/robot/gesture-pointer.test.tsx src/components/robot/robot-workspace.test.tsx`

Expected: PASS.

### Task 4: Coalesce Physical Pointer Commands Without Delaying Page Interaction

**Files:**
- Create: `apps/web/src/components/robot/latest-pointer-command.ts`
- Create: `apps/web/src/components/robot/latest-pointer-command.test.ts`
- Modify: `apps/web/src/components/robot/robot-workspace.tsx`

- [ ] **Step 1: Write a failing coalescing test**

```ts
it("keeps only the newest point while one device move is in flight", async () => {
  const sent: GesturePoint[] = [];
  const queue = new LatestPointerCommand(async (point) => { sent.push(point); await release.promise; });
  void queue.submit({ x: 0.1, y: 0.1 });
  void queue.submit({ x: 0.2, y: 0.2 });
  void queue.submit({ x: 0.3, y: 0.3 });
  release.resolve();
  await queue.idle();
  expect(sent).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }]);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm.cmd exec vitest run src/components/robot/latest-pointer-command.test.ts`

Expected: FAIL because the coalescing queue does not exist.

- [ ] **Step 3: Implement the single-flight latest-point queue and wire it to `move_mouse`**

```ts
submit(point: GesturePoint) {
  this.pending = point;
  if (!this.inFlight) void this.flush();
}
```

The queue must never block `setCursor`, the local DOM click, or the circular dwell animation.

- [ ] **Step 4: Re-run the queue test**

Run: `npm.cmd exec vitest run src/components/robot/latest-pointer-command.test.ts`

Expected: PASS.

### Task 5: Recognize Explicit Spoken Device Commands

**Files:**
- Modify: `apps/web/src/components/robot/gesture-voice-command.ts`
- Modify: `apps/web/src/components/robot/gesture-voice-command.test.ts`
- Modify: `apps/web/src/components/robot/robot-workspace.tsx`

- [ ] **Step 1: Write a failing parser test for photo capture and a non-command**

```ts
expect(parseGestureVoiceCommand("点击拍照")).toEqual({ type: "device", action: "capture_snapshot" });
expect(parseGestureVoiceCommand("帮我拍一张照片")).toEqual({ type: "device", action: "capture_snapshot" });
expect(parseGestureVoiceCommand("拍照功能怎么用")).toBeNull();
```

- [ ] **Step 2: Run the parser test and confirm it fails**

Run: `npm.cmd exec vitest run src/components/robot/gesture-voice-command.test.ts`

Expected: FAIL because only start/stop hand commands are currently recognized.

- [ ] **Step 3: Add the constrained command union and route only explicit capture phrases**

```ts
export type GestureVoiceCommand =
  | { type: "gesture"; action: "start" | "stop" }
  | { type: "device"; action: "capture_snapshot" };
```

In `ask`, invoke `issueDeviceCommand("capture_snapshot", {})` only for the parsed `device` command; ordinary questions must continue to the normal dialogue model.

- [ ] **Step 4: Re-run the command and workspace tests**

Run: `npm.cmd exec vitest run src/components/robot/gesture-voice-command.test.ts src/components/robot/robot-workspace.test.tsx`

Expected: PASS.

### Task 6: Add Optional Local Face Identity Service to the Existing Camera Process

**Files:**
- Create: `deploy/models/README.md`
- Modify: `deploy/mambo-hand-vision.py`
- Modify: `deploy/local-web-proxy.py`
- Modify: `device/tests/test_hand_vision.py`
- Modify: `deploy/test_local_web_proxy.py`

- [ ] **Step 1: Document and obtain the two model files before enabling the feature**

```text
deploy/models/face_detection_yunet_2023mar.onnx
deploy/models/face_recognition_sface_2021dec.onnx
```

The README must state that they are official OpenCV Zoo YuNet/SFace models, must stay on the Orange Pi, and should be loaded only when face identity is enabled. Do not add a second camera process.

- [ ] **Step 2: Write failing Python tests for model-unavailable and enrollment state**

```python
def test_face_status_reports_model_unavailable_without_onnx_files(tmp_path: Path) -> None:
    service = HandVisionService(face_models_dir=tmp_path)
    assert service.face_status()["status"] == "unavailable"

def test_face_enrollment_requires_a_detected_stable_face(tmp_path: Path) -> None:
    service = HandVisionService(face_models_dir=tmp_path, face_backend=FakeFaceBackend())
    service.begin_face_enrollment("小明")
    assert service.face_status()["enrollment"]["samples"] == 0
```

- [ ] **Step 3: Run the focused Python tests and confirm they fail**

Run: `python -m pytest device/tests/test_hand_vision.py -k "face_status or face_enrollment" -q`

Expected: FAIL because face APIs do not exist.

- [ ] **Step 4: Implement a lazy, low-rate face backend in the same frame loop**

```python
class FaceIdentityBackend:
    def observe(self, frame: np.ndarray) -> FaceObservation | None: ...

class HandVisionService:
    def face_status(self) -> dict[str, object]: ...
    def begin_face_enrollment(self, name: str) -> dict[str, object]: ...
```

Use `cv2.FaceDetectorYN` and `cv2.FaceRecognizerSF`; run detection no more than 4 FPS, derive embeddings only from stable frontal faces, and require multiple samples before persisting `{name, embeddings}` to `~/.local/share/mambo-face-identities/identities.json`. Keep raw camera frames in memory only. The existing hand loop remains 8 FPS and keeps priority.

- [ ] **Step 5: Add local proxy routes and tests**

```python
FACE_IDENTITY_PREFIX = "/_mambo/face"
FACE_IDENTITY_PATHS = frozenset({"/status", "/enroll", "/cancel"})
```

Require the same localhost restriction as wake endpoints for mutation requests. Forward only explicit face routes to the loopback hand-vision service.

- [ ] **Step 6: Re-run all focused Python tests**

Run: `python -m pytest device/tests/test_hand_vision.py deploy/test_local_web_proxy.py -q`

Expected: PASS.

### Task 7: Add the Robot-Side Face UI and Deploy

**Files:**
- Create: `apps/web/src/components/robot/face-identity-client.ts`
- Create: `apps/web/src/components/robot/face-identity-client.test.ts`
- Modify: `apps/web/src/components/robot/robot-workspace.tsx`
- Modify: `apps/web/src/components/robot/robot.module.css`
- Modify: `deploy/install-mambo-hand-vision.sh`

- [ ] **Step 1: Write failing client tests for face status parsing and enrollment requests**

```ts
it("posts a Chinese nickname to the local enrollment endpoint", async () => {
  await beginFaceEnrollment("小明");
  expect(fetch).toHaveBeenCalledWith("/_mambo/face/enroll", expect.objectContaining({ method: "POST" }));
});
```

- [ ] **Step 2: Run the client test and confirm it fails**

Run: `npm.cmd exec vitest run src/components/robot/face-identity-client.test.ts`

Expected: FAIL because the face client does not exist.

- [ ] **Step 3: Implement the smallest local-only enrollment panel**

```tsx
<button type="button" onClick={() => void beginFaceEnrollment(name)}>录入当前人脸</button>
<p role="status">{faceStatus.message}</p>
```

Show model missing, low light, no face, collecting samples, recognized nickname, and unknown-person states in Chinese. Do not present a false match as an identity.

- [ ] **Step 4: Build and run full automated validation**

Run: `npm.cmd exec vitest run src/components/robot`

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Run: `python -m pytest device/tests/test_hand_vision.py deploy/test_local_web_proxy.py -q`

Expected: all PASS.

- [ ] **Step 5: Deploy only changed artifacts and validate on the Orange Pi**

```powershell
scp deploy/mambo-hand-vision.py deploy/local-web-proxy.py orangepi:/opt/mambo-k12-ai-robot/deploy/
ssh orangepi "systemctl --user restart mambo-hand-vision.service"
```

Then query `/_mambo/hand/status` and `/_mambo/face/status`, rebuild the host web application, reload only the robot browser, and capture an X11 screenshot. Verify a real hand yields landmarks, the full-screen pointer moves, a fist dwell triggers a local button, `点击拍照` produces a snapshot, and face enrollment shows actual collection progress.

## Review Checklist

- [ ] The prior stale WebKit page issue is covered by a local-proxy startup regression test and browser reload step.
- [ ] Full-screen gesture cursor, circular dwell, green completion animation, DOM click, physical pointer coalescing, and spoken photo capture each have a focused test task.
- [ ] Face identity reuses one camera process and stores embeddings, not raw photos.
- [ ] Model absence, low light, no face, and unknown identity remain explicit user-visible states.
- [ ] No passwords, API keys, sudo, reboot, shutdown, or destructive filesystem operation appear in the plan.
