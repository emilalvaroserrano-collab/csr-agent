# AGENTS.md — ABI Tech Talk to Abbie (static site v5)

Pure static site. No package manager, bundler, tests, lint, CI, or `opencode.json`.

## Run
- No build step. Preview with any static server, e.g. `python3 -m http.server` in repo root, then open `index.html`.
- Production must be served over HTTPS with the deployed hostname added to Firebase Auth > Authorized domains, or mic + anonymous auth will fail.

## Structure / flow
- `index.html` → `js/index.js`: lead form (name/company/reason/phone/email). On submit saves to `sessionStorage:abi-tech-pending-lead` + `localStorage:abi-tech-last-lead`, then `location.assign("./calling.html")`.
- `calling.html` → `js/calling.js` (+ `js/firebase.js` ES module): auto-starts the Vapi call on page load (`bootstrapCallPage → startCall`). Redirects to `./index.html` if no stored lead found.
- `calling.html` embeds the assistant persona in `<script type="text/plain" id="defaultSystemPrompt">` — edit prompt text there, not in JS.
- `css/styles.css`: single hand-written stylesheet, shared by both pages.

## Config — single source of truth
- `js/config.js` defines frozen `window.ABITECH_CONFIG` (firebase creds, `vapi.publicKey`/`assistantId`, `assistant` voice/model/transcriber/KB IDs). Load order matters: `config.js` must load before `index.js` / `firebase.js` / `calling.js`.
- KB file ID `8e859b7f-...` is duplicated in `calling.js` (`BIBLE_PERSONALITY_TOOL` + `buildAssistantOverrides().model.knowledgeBase`). Keep all three in sync when rotating.
- `config.js` holds only browser-safe public keys by design (see `README.txt`). Never add Admin SDK, service-account, Anthropic/Deepgram/Gemini secrets here.

## Firebase (`js/firebase.js`)
- CDN-pinned `firebasejs/12.4.0` ES imports; anonymous auth via `signInAnonymously`.
- Exposes `window.abbieFirebase` (`createLead`/`updateLead` at `leads/{uid}/{leadId}` with `serverTimestamp`), `window.firebaseReady` promise, and `abbie-firebase-ready` / `abbie-firebase-error` window events. `calling.js:getFirebaseService()` handles all three — reuse it, don't re-init.
- Requires: Anonymous Auth enabled, Realtime Database at configured `databaseURL`, RTDB rules per `README.txt` (`leads/$uid` writable only by owner).
- Writes are serialized through `leadWriteQueue` in `calling.js`; preserve that ordering when touching `saveClientLead`/`finalizeLead`.

## Calling (`js/calling.js`)
- Vapi loaded lazily from `cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest`; `initVapi()` → `vapiSDK.run({apiKey, assistant: ASSISTANT_ID})` → `vapiInstance.start(ASSISTANT_ID, buildAssistantOverrides())`.
- Overrides inject lead context (name/company/phone/email/requirement) into the system prompt + custom `firstMessage`; lead facts are pre-provided — don't re-ask.
- Tool `save_client_details` return path is parsed leniently (`toolCallList`/`toolCalls`/`function-call` shapes) in `handleVapiMessage`; keep that tolerance.
- Call UX: 4s generated dual-oscillator ring (`startGeneratedRing`), mic permission, `inCall/connecting/ringing` guards, `beforeunload` warning, wake lock. Cancel during ring = `finalizeLead("call_cancelled")`.
