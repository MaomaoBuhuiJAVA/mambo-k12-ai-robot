# Instant Starbao Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage Starbao chat show the learner's message immediately and show a 3D cube inside the chat panel until the assistant reply arrives.

**Architecture:** Keep the existing `/api/starbao/turn` request and OrangePi synchronization unchanged. The shared conversation hook will add an in-memory optimistic user message before starting the network request, then replace that local message with the canonical Core message when the turn response arrives. The preview page will render the cube from the hook's existing `isSending` state inside its message list.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Vitest, Testing Library.

---

### Task 1: Prove Immediate Message and Loading State

**Files:**
- Modify: `apps/web/src/features/starbao/use-shared-starbao-conversation.test.tsx`
- Modify: `apps/web/src/app/preview/page.test.tsx`

- [ ] **Step 1: Write a failing Hook test for the in-flight state**

Add a deferred response to the shared-conversation test. After `sendTurn()` has started but before the deferred response resolves, assert that `result.current.isSending` is true and `result.current.messages` contains exactly one local user message with the submitted text.

- [ ] **Step 2: Run the Hook test to verify it fails**

Run: `npm test -- --run apps/web/src/features/starbao/use-shared-starbao-conversation.test.tsx`

Expected: the new assertion fails because `sendTurn()` currently waits for the complete server response before inserting the message.

- [ ] **Step 3: Write a failing page test for the cube**

Make the mocked shared-conversation state report `isSending: true`, open the Starbao chat, and assert that an element with role `status` and accessible name `Starbao is thinking` is rendered inside the dialog.

- [ ] **Step 4: Run the page test to verify it fails**

Run: `npm test -- --run apps/web/src/app/preview/page.test.tsx`

Expected: the new assertion fails because the dialog currently has no pending-reply indicator.

### Task 2: Add Optimistic Shared-Conversation State

**Files:**
- Modify: `apps/web/src/features/starbao/use-shared-starbao-conversation.ts`
- Test: `apps/web/src/features/starbao/use-shared-starbao-conversation.test.tsx`

- [ ] **Step 1: Create a local message from the request input**

Use the same generated client message ID sent to `/api/starbao/turn` to construct a temporary user message. Insert it into `messages` synchronously before `fetch()` starts. Set `messageId` to `pending:<clientMessageId>`, preserve the request origin and text, and set `announceOnOrangePi` to false.

- [ ] **Step 2: Replace the temporary message with the canonical response**

Extend message merging so an incoming canonical user message removes the temporary user message with the same `clientMessageId`. Keep sorting by canonical sequence and do not duplicate a user message after the turn resolves.

- [ ] **Step 3: Remove the temporary message on failure**

If the POST fails or its response is invalid, remove only the matching pending message, preserve prior history, set the existing error state, and rethrow the failure to retain existing caller behavior.

- [ ] **Step 4: Run the Hook test to verify it passes**

Run: `npm test -- --run apps/web/src/features/starbao/use-shared-starbao-conversation.test.tsx`

Expected: all Hook tests pass, including immediate rendering, replacement with canonical messages, polling, and pagination behavior.

### Task 3: Render the Cube in the Homepage Chat Dialog

**Files:**
- Modify: `apps/web/src/app/preview/page.tsx`
- Modify: `apps/web/src/app/preview/page.module.css`
- Test: `apps/web/src/app/preview/page.test.tsx`

- [ ] **Step 1: Add an accessible thinking indicator after the chat messages**

When `starbaoSending` is true, render a `role="status"` element with `aria-label="Starbao is thinking"` inside `.messageList`. It contains exactly six empty cube faces and one visually readable status label. It appears after the optimistic user bubble and before the composer.

- [ ] **Step 2: Add the supplied cube CSS as module-scoped styling**

Create stable 70.4px cube dimensions, apply the supplied transform and keyframes, and keep it contained inside the 360px chat dialog without changing the dialog's size while it animates. Respect reduced-motion users by pausing the rotation.

- [ ] **Step 3: Run the page test to verify it passes**

Run: `npm test -- --run apps/web/src/app/preview/page.test.tsx`

Expected: all page tests pass, including the thinking cube assertion and existing gesture/chat coverage.

### Task 4: Validate the Integrated Experience

**Files:**
- Verify: `apps/web/src/features/starbao/use-shared-starbao-conversation.ts`
- Verify: `apps/web/src/app/preview/page.tsx`
- Verify: `apps/web/src/app/preview/page.module.css`

- [ ] **Step 1: Run focused tests together**

Run: `npm test -- --run apps/web/src/features/starbao/use-shared-starbao-conversation.test.tsx apps/web/src/app/preview/page.test.tsx`

Expected: both suites pass with no failures.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Verify in the local browser**

Open `/preview`, open the Starbao chat, send one message, and verify this sequence: the user bubble is shown before the response resolves, the cube appears in the chat dialog during the request, then the cube is removed when the assistant bubble appears. Check that the page has no framework overlay or relevant console errors.

