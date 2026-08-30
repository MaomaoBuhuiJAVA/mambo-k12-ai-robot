# Middle-School Lab Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PC-first `/middle-map` underground laboratory map with five accessible, glowing FoldText hotspots, and send only a victorious tree-guardian battle to that map.

**Architecture:** The new client route owns its 1872 by 560 coordinate system and JSON hotspot layout so it cannot regress the elementary `/map` implementation. One JPG is rendered as the artwork, then reused inside clipped SVG zoom layers; SVG paths remain the source of truth for hit testing and cyan glow. The battle component derives the tree-guardian result CTA from its existing module and result state without changing other modules' restart behavior.

**Tech Stack:** Next.js App Router, React 19 client components, TypeScript, CSS Modules, SVG, Vitest, Testing Library.

---

### Task 1: Add the Middle-School Map Contract

**Files:**
- Create: `apps/web/src/app/middle-map/middle-region-layout.json`
- Create: `apps/web/src/app/middle-map/page.test.tsx`
- Create: `apps/web/public/assets/learning-map/middle-school-lab.jpg`

- [ ] **Step 1: Write the failing page test for the static map contract**

```tsx
it("declares the middle-school map route, art asset, and editable hotspot geometry", () => {
  expect(existsSync(resolve(process.cwd(), "src/app/middle-map/page.tsx"))).toBe(true);
  expect(existsSync(resolve(process.cwd(), "src/app/middle-map/middle-region-layout.json"))).toBe(true);
  expect(existsSync(resolve(process.cwd(), "public/assets/learning-map/middle-school-lab.jpg"))).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the route does not exist**

Run: `npm test --workspace apps/web -- --run src/app/middle-map/page.test.tsx`

Expected: FAIL only because `src/app/middle-map/page.tsx` does not exist yet; the test must be an assertion failure rather than an import/configuration error.

- [ ] **Step 3: Copy the supplied JPG and add the five-region JSON geometry**

```json
{
  "mapWidth": 1872,
  "mapHeight": 560,
  "regions": [
    { "id": "mission-board", "label": "任务总览", "x": 338, "y": 42, "width": 390, "height": 396 },
    { "id": "knowledge-library", "label": "知识资料室", "x": 744, "y": 42, "width": 390, "height": 244 },
    { "id": "ai-foundations", "label": "人工智能基础", "x": 1128, "y": 42, "width": 704, "height": 246 },
    { "id": "guided-lab", "label": "引导实验", "x": 744, "y": 298, "width": 420, "height": 226 },
    { "id": "model-studio", "label": "模型训练", "x": 1158, "y": 288, "width": 676, "height": 236 }
  ]
}
```

Each JSON item must also include a closed SVG `path` and stable `centerX`/`centerY` for zoom and label positioning. Copy `C:\Users\Administrator\Desktop\初中背景.jpg` byte-for-byte to `apps/web/public/assets/learning-map/middle-school-lab.jpg`.

- [ ] **Step 4: Run the static test again**

Run: `npm test --workspace apps/web -- --run src/app/middle-map/page.test.tsx`

Expected: still FAIL until the page implementation is added; JSON and asset paths must be present.

- [ ] **Step 5: Commit the contract files**

```powershell
git add apps/web/public/assets/learning-map/middle-school-lab.jpg apps/web/src/app/middle-map/middle-region-layout.json apps/web/src/app/middle-map/page.test.tsx
git commit -m "test: define middle school map contract"
```

### Task 2: Implement the Interactive Lab Map

**Files:**
- Create: `apps/web/src/app/middle-map/page.tsx`
- Create: `apps/web/src/app/middle-map/page.module.css`
- Modify: `apps/web/src/app/middle-map/page.test.tsx`

- [ ] **Step 1: Extend the failing test for hover, keyboard, selection, and return navigation**

```tsx
it("shows one FoldText label for the hovered or pinned region and clears a pinned region with Escape", () => {
  render(<MiddleSchoolMapPage />);
  const region = screen.getByLabelText("人工智能基础");

  fireEvent.pointerEnter(region);
  expect(region).toHaveAttribute("data-active", "true");
  expect(screen.getByTestId("middle-map-fold-label")).toHaveTextContent("人工智能基础");

  fireEvent.click(region);
  fireEvent.pointerLeave(region);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByTestId("middle-map-fold-label")).not.toBeInTheDocument();
});

it("pins a region with Enter and returns to the elementary map", () => {
  render(<MiddleSchoolMapPage />);
  fireEvent.keyDown(screen.getByLabelText("任务总览"), { key: "Enter" });

  expect(screen.getByTestId("middle-map-fold-label")).toHaveTextContent("任务总览");
  expect(screen.getByRole("link", { name: "返回小学地图" })).toHaveAttribute("href", "/map");
});
```

- [ ] **Step 2: Run the focused test and verify the interaction assertions fail**

Run: `npm test --workspace apps/web -- --run src/app/middle-map/page.test.tsx`

Expected: FAIL because the page has no active/selected state, visual label, or link.

- [ ] **Step 3: Implement the client page with a single coordinate system**

```tsx
const displayedRegion = selectedRegion ?? activeRegion;

<svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-label="初中实验室热点区域">
  <defs>{mapRegions.map((region) => <clipPath id={`middle-map-clip-${region.id}`} key={region.id}><path d={region.path} /></clipPath>)}</defs>
  {mapRegions.map((region) => (
    <g clipPath={`url(#middle-map-clip-${region.id})`} className={styles.regionZoom} data-active={displayedRegion === region.id || undefined} key={`zoom-${region.id}`}>
      <image href={mapArtworkSrc} height={mapHeight} transform={zoomTransform(region)} width={mapWidth} x="0" y="0" />
    </g>
  ))}
  {mapRegions.map((region) => <path className={styles.regionGlow} data-active={displayedRegion === region.id || undefined} d={region.path} key={`glow-${region.id}`} />)}
  <rect data-testid="middle-map-backdrop" fill="transparent" height={mapHeight} onClick={clearSelection} width={mapWidth} x="0" y="0" />
  {mapRegions.map((region) => <path aria-label={region.label} className={styles.hotspot} data-active={displayedRegion === region.id || undefined} data-testid="middle-map-hotspot" d={region.path} key={region.id} onKeyDown={handleRegionKeyDown(region.id)} role="button" tabIndex={0} />)}
</svg>
```

Use `selectedRegion ?? activeRegion` so a pinned region is the only rendered active region. Escape and transparent-map clicks clear both active and selected state. Render the label as an HTML overlay with an accessible whole-string label plus `aria-hidden` per-character spans. This lets CSS re-run the FoldText animation with a new key every time a different hotspot becomes active.

- [ ] **Step 4: Implement PC-first visual behavior in the CSS module**

```css
.mapCanvas {
  width: min(100vw, calc(1872 / 560 * 100dvh));
  height: min(100dvh, calc(560 / 1872 * 100vw));
  aspect-ratio: 1872 / 560;
}

.foldCharacter {
  animation: foldCharacter 520ms cubic-bezier(0.18, 0.86, 0.32, 1) both;
  animation-delay: calc(var(--character-index) * 45ms);
  transform-origin: 50% 0%;
}

@keyframes foldCharacter {
  from { opacity: 0; transform: rotateX(-92deg); }
  to { opacity: 1; transform: rotateX(0deg); }
}
```

Keep the background color dark but varied enough to distinguish letterboxing from the artwork. Make the glow a cyan SVG edge filter, use clipped zoomed artwork at `1.025`, prevent label pointer capture, and include a `prefers-reduced-motion` media query that disables transition/animation while preserving visible labels.

- [ ] **Step 5: Run the focused map tests and typecheck**

Run: `npm test --workspace apps/web -- --run src/app/middle-map/page.test.tsx && npm run typecheck --workspace apps/web`

Expected: PASS with all middle-map tests green and TypeScript exit code 0.

- [ ] **Step 6: Commit the route implementation**

```powershell
git add apps/web/src/app/middle-map
git commit -m "feat: add middle school laboratory map"
```

### Task 3: Connect Tree-Guardian Victory to the New Map

**Files:**
- Modify: `apps/web/src/features/ai-battle/ai-battle-game.tsx`
- Modify: `apps/web/src/features/ai-battle/ai-battle-game.test.tsx`

- [ ] **Step 1: Write a failing tree-victory CTA test**

```tsx
it("offers the middle-school laboratory after a tree guardian victory", async () => {
  render(<AiBattleGame battleModule={treeSanctuary} questions={questions.slice(0, 1)} questionCount={1} random={() => 0} />);
  await startBattle();
  fireEvent.click(screen.getByRole("button", { name: "Correct 1" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(5_200); });

  expect(screen.getByRole("link", { name: "进入初中实验室" })).toHaveAttribute("href", "/middle-map");
});
```

Add a companion assertion that a non-tree victory still exposes `再来一次` as its command button.

- [ ] **Step 2: Run the battle test and verify it fails for the absent link**

Run: `npm test --workspace apps/web -- --run src/features/ai-battle/ai-battle-game.test.tsx`

Expected: FAIL because the result CTA is only `再来一次`.

- [ ] **Step 3: Add the narrow result-action branch**

```tsx
const hasMiddleSchoolNextStep = isLastLine && isResult && isVictory && battleModuleId === "tree-sanctuary";

{hasMiddleSchoolNextStep ? (
  <a className={styles.storyAction} href="/middle-map">
    <ArrowRight size={17} aria-hidden="true" />
    进入初中实验室
  </a>
) : (
  <button type="button" onClick={onAdvance}>...</button>
)}
```

Pass only the module ID needed by `StoryDialogue`, retain existing restart behavior for every other state, and share the existing button appearance with the action link using one CSS selector.

- [ ] **Step 4: Run the focused battle tests and regression test for non-tree restart**

Run: `npm test --workspace apps/web -- --run src/features/ai-battle/ai-battle-game.test.tsx`

Expected: PASS with the new tree link and existing restart behavior both covered.

- [ ] **Step 5: Commit the battle result integration**

```powershell
git add apps/web/src/features/ai-battle/ai-battle-game.tsx apps/web/src/features/ai-battle/ai-battle-game.module.css apps/web/src/features/ai-battle/ai-battle-game.test.tsx
git commit -m "feat: link tree victory to middle school map"
```

### Task 4: Verify the Whole Local Flow

**Files:**
- Verify: `apps/web/src/app/middle-map/page.tsx`
- Verify: `apps/web/src/features/ai-battle/ai-battle-game.tsx`

- [ ] **Step 1: Run targeted automated checks**

Run:

```powershell
npm test --workspace apps/web -- --run src/app/middle-map/page.test.tsx src/features/ai-battle/ai-battle-game.test.tsx
npm run typecheck --workspace apps/web
npm run lint --workspace apps/web -- --file src/app/middle-map/page.tsx --file src/features/ai-battle/ai-battle-game.tsx
npm run build --workspace apps/web
git -c safe.directory='E:/Orange pi System/mambo-k12-ai-robot-online-preview-source' diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Inspect the local desktop rendering and target interaction**

Run the local app and inspect `/middle-map` at a 1920 by 1080 desktop viewport. Hover all five hotspots, then click one and press Escape. Verify: artwork is not cropped or stretched, only one region has glow/zoom/text at a time, FoldText does not overlap its panel boundary, the return link is visible, and the console has no relevant errors. Then drive a one-question `tree-sanctuary` win and verify its final action navigates to `/middle-map`.

- [ ] **Step 3: Commit only the intended feature files after successful verification**

```powershell
git status --short
git add apps/web/public/assets/learning-map/middle-school-lab.jpg apps/web/src/app/middle-map apps/web/src/features/ai-battle/ai-battle-game.tsx apps/web/src/features/ai-battle/ai-battle-game.module.css apps/web/src/features/ai-battle/ai-battle-game.test.tsx docs/superpowers/plans/2026-08-17-middle-school-map.md
git commit -m "feat: add middle school laboratory stage"
```

Do not stage `.superpowers/` or `apps/web/tmp/`. Do not push or deploy; this phase ends with a local preview for review.
