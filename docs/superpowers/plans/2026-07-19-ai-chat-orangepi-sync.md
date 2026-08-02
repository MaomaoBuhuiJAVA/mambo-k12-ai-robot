# AI Chat And OrangePi Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore production AI replies and make the existing shared Starbao conversation appear and play through the OrangePi speaker when the user enables board playback.

**Architecture:** The Vercel web app already persists Starbao messages in Core and the `/robot` page polls that canonical conversation. Add the missing DeepSeek production configuration, then point the OrangePi's loopback web proxy at the production site so its local WebKit page receives the same conversation and the existing `/api/voice/tts` interception plays audio locally. Leave the computer's local port `3015` gesture-development server untouched, and keep `mambo-hand-vision.service` and `mambo-wakeword.service` untouched.

**Tech Stack:** Next.js/Vercel, DeepSeek OpenAI-compatible API, Railway Core API, OrangePi WebKitGTK local proxy, Baidu TTS.

---

### Task 1: Restore Production AI Configuration

**Files:**
- Modify: Vercel Production environment variables only
- Test: `POST https://medical-device-ops-platform.asia/api/starbao/turn`

- [ ] **Step 1: Confirm the failure is configuration-only**

Run:

```powershell
Invoke-WebRequest https://medical-device-ops-platform.asia/api/starbao/turn
```

Expected: the existing valid request returns `503` with `AI_NOT_CONFIGURED` before the environment variables are added.

- [ ] **Step 2: Add the existing local DeepSeek settings to Vercel Production**

Run the Vercel CLI from the repository root with the local `DEEPSEEK_API_KEY` read only into process memory. Add `DEEPSEEK_API_KEY` as sensitive, and add `DEEPSEEK_BASE_URL=https://api.deepseek.com` and `DEEPSEEK_MODEL=deepseek-v4-flash` as non-sensitive production variables.

- [ ] **Step 3: Redeploy the existing production artifact**

Run:

```powershell
npx vercel redeploy <current-production-url> --prod --yes
```

Expected: Vercel reports `READY` and preserves the already deployed site source rather than publishing unrelated local gesture work.

- [ ] **Step 4: Verify a real AI turn**

Send a valid `POST /api/starbao/turn` request with `lower_primary` and `lower-bubble-sort`.

Expected: `200`, a stored user message, and a non-empty assistant reply.

### Task 2: Point The OrangePi Robot Page At Production

**Files:**
- Modify: OrangePi runtime process configuration only
- Preserve: `/opt/mambo-k12-ai-robot/deploy/mambo-hand-vision.py`
- Preserve: `mambo-hand-vision.service` and `mambo-wakeword.service`
- Test: `GET http://127.0.0.1:3010/robot` on the OrangePi

- [ ] **Step 1: Record protected service state**

Run:

```bash
systemctl --user is-active mambo-hand-vision.service
systemctl --user is-active mambo-wakeword.service
```

Expected: save the current state without restarting either service.

- [ ] **Step 2: Restart only the local page proxy and WebKit page**

Stop only the existing `launch-robot-webkit.py` and `local-web-proxy.py` processes by their verified PIDs. Do not stop the computer's port `3015` server. Start `deploy/launch-robot-browser.sh` as user `orangepi` with:

```bash
ROBOT_BROWSER=webkit
ROBOT_LOCAL_PROXY=1
ROBOT_PROXY_UPSTREAM=https://medical-device-ops-platform.asia
```

Expected: WebKit returns to `http://127.0.0.1:3010/robot`, while the proxy forwards application requests to production and retains its local wake, hand, face, and TTS routes.

- [ ] **Step 3: Verify the local page sees the production device state**

Run:

```bash
curl -fsS http://127.0.0.1:3010/api/device
```

Expected: `online: true` for `orangepi4pro`.

- [ ] **Step 4: Verify protected services remain unchanged**

Run the two `systemctl --user is-active` commands again.

Expected: their state matches Step 1. Do not start, stop, reload, or edit either service.

### Task 3: Validate Shared Display And Speaker Playback

**Files:**
- Use existing: `apps/web/src/features/starbao/use-shared-starbao-conversation.ts`
- Use existing: `apps/web/src/components/robot/robot-workspace.tsx`
- Use existing: `deploy/local-web-proxy.py`
- Test: production `/api/starbao`, local `/api/starbao`, and local `/api/voice/tts`

- [ ] **Step 1: Enable OrangePi playback in the canonical conversation**

Run:

```powershell
Invoke-RestMethod https://medical-device-ops-platform.asia/api/starbao -Method Patch -ContentType application/json -Body '{"speakOnOrangePi":true}'
```

Expected: the conversation reports `speakOnOrangePi: true`.

- [ ] **Step 2: Send one bounded production chat turn**

Send a valid Starbao request asking for a short reply.

Expected: both `/api/starbao` endpoints eventually return the same latest sequence and assistant message.

- [ ] **Step 3: Verify speaker path without camera or pointer commands**

Call only `POST http://127.0.0.1:3010/api/voice/tts` with a short text payload.

Expected: the proxy returns `204` with `X-Mambo-Device-Playback: complete`; it invokes local audio playback and does not access `/dev/video0` or XTest mouse control.

- [ ] **Step 4: Verify browser flow**

Open the production `/robot` page, send a message, enable playback, and confirm the shared conversation is visible. Check for a successful response and no console errors relevant to Starbao.
