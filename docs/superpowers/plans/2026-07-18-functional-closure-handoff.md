# P0 Functional Closure and Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the current K12 teaching prototype as a truthful, reproducible functional baseline and deliver a handoff document for the next frontend redesign.

**Architecture:** Keep the existing Next.js student workspace, server-side AI Route Handlers, FastAPI Core/device gateway, and browser-local learning records unchanged. This closure pass only removes configuration drift, documents the real end-to-end boundaries, and records external deployment actions that cannot be completed from the repository alone.

**Tech Stack:** Next.js 16, React 19, Vercel AI SDK, Google Gemini, Upstash Redis REST, FastAPI, WebSocket, OrangePi device agent, Vitest, Pytest.

---

### Task 1: Align model configuration and operational references

**Files:**
- Modify: `apps/web/.env.example`
- Modify: `apps/web/README.md`
- Modify: `docs/report/project-report.md`
- Modify: `apps/web/.env.local` (local-only, never commit)
- Test: `apps/web/src/lib/ai/provider.test.ts`

- [ ] **Step 1: Update every non-secret reference from `gemini-2.5-flash` to `gemini-3.5-flash`.**
- [ ] **Step 2: Confirm the provider regression test asserts the new default and custom `GEMINI_MODEL` override.**
- [ ] **Step 3: Run `npm test --workspace apps/web -- --run src/lib/ai/provider.test.ts`.**
- [ ] **Step 4: Run `git diff --check` and verify `.env.local` is ignored.**

### Task 2: Write the functional handoff

**Files:**
- Create: `docs/handoff/functional-handoff.md`
- Modify: `docs/evidence/index.md`

- [ ] **Step 1: Record the six competition interaction modes and exact working routes.**
- [ ] **Step 2: Record the learner persistence boundary (`localStorage`) and device boundary (Core API + WSS), without calling them cloud sync.**
- [ ] **Step 3: Record Vercel environment names, Redis guard behavior, Gemini failure fallback, OrangePi systemd setup, and safe credential handling.**
- [ ] **Step 4: Add a reproducible acceptance checklist with local commands, browser actions, and required external operator actions.**
- [ ] **Step 5: Add a clear “not delivered” section covering login/RBAC, teacher CMS, official textbook RAG, cross-device session sync, public Core/WSS, and production promotion.**

### Task 3: Functional verification and evidence

**Files:**
- Create: `docs/verification/2026-07-18-functional-closure.md`
- Modify: `docs/evidence/index.md`

- [ ] **Step 1: Run Web Vitest, ESLint, TypeScript, Next build, Pytest, compileall, shell syntax checks, and `git diff --check`.**
- [ ] **Step 2: Run the existing lab smoke command and record its result without claiming server-side sandboxing.**
- [ ] **Step 3: Verify the deployed Preview chat returns HTTP 200 with a real Gemini answer and no browser console errors.**
- [ ] **Step 4: Verify Vercel has Redis URL/token pairs scoped to Preview and Production without reading secret values.**
- [ ] **Step 5: Record any blocked GitHub/Vercel/OrangePi operation as an operator action, not as completed functionality.**

### Task 4: Commit and hand off

**Files:**
- Commit the files from Tasks 1-3 only.

- [ ] **Step 1: Run `git status --short --branch` and confirm no secrets or generated visual companion files are staged.**
- [ ] **Step 2: Commit with `docs: close P0 functionality and add handoff`.**
- [ ] **Step 3: Push the feature branch when GitHub connectivity is available.**
- [ ] **Step 4: Give the next frontend designer the handoff path and the exact stable Preview URL.**
