import {
  Room,
  RoomEvent,
  Track,
} from "https://cdn.jsdelivr.net/npm/livekit-client@2/+esm";

const cfg = window.ABITECH_CONFIG?.livekit || {};
const $ = (id) => document.getElementById(id);

let submittedLead = null;
try {
  submittedLead = JSON.parse(
    sessionStorage.getItem("abi-tech-pending-lead") ||
      localStorage.getItem("abi-tech-last-lead") ||
      "null"
  );
} catch (_) {}
if (!submittedLead) {
  window.location.replace("./index.html");
  throw new Error("No submitted lead found");
}

const firstName = (submittedLead.name || "").trim().split(/\s+/)[0] || "Caller";
const leadContextEl = $("leadContext");
if (leadContextEl) leadContextEl.textContent = `${firstName} from ${submittedLead.company} — ${submittedLead.requirement}`;

let room = null;
let remoteAudioEl = null;
let inCall = false;
let connecting = false;
let ringing = false;
let ringAbort = 0;
let startedAt = 0;
let timerId = null;
let wakeLock = null;
let firebaseLeadId = null;
let currentCallId = null;
let callStartedAt = null;
let leadWriteQueue = Promise.resolve();
let ringAudioCtx = null;
let ringMaster = null;
let ringInterval = null;
let ringStopTimer = null;
let endedHandled = false;

function toast(t) {
  const el = $("toast");
  if (!el) return;
  el.textContent = t;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}
function status(t, type = "") {
  const s = $("status");
  const d = $("dot");
  if (s) s.textContent = t;
  if (d) d.className = "dot" + (type ? " " + type : "");
}
function renderTimer() {
  const el = $("timer");
  if (!el) return;
  if (!startedAt) { el.textContent = "00:00"; return; }
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  el.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}
function startTimer() {
  if (!startedAt) startedAt = Date.now();
  clearInterval(timerId);
  renderTimer();
  timerId = setInterval(renderTimer, 1000);
}
function stopTimer() { clearInterval(timerId); timerId = null; startedAt = 0; renderTimer(); }
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function ringBurst() {
  if (!ringAudioCtx || !ringMaster) return;
  const n = ringAudioCtx.currentTime;
  const g = ringAudioCtx.createGain();
  const a = ringAudioCtx.createOscillator();
  const b = ringAudioCtx.createOscillator();
  a.type = b.type = "sine"; a.frequency.value = 440; b.frequency.value = 480;
  g.gain.setValueAtTime(0.0001, n);
  g.gain.exponentialRampToValueAtTime(0.16, n + 0.025);
  g.gain.setValueAtTime(0.16, n + 0.72);
  g.gain.exponentialRampToValueAtTime(0.0001, n + 0.8);
  a.connect(g); b.connect(g); g.connect(ringMaster);
  a.start(n); b.start(n); a.stop(n + 0.82); b.stop(n + 0.82);
}
async function startGeneratedRing() {
  stopGeneratedRing();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ringAudioCtx = new AC();
  if (ringAudioCtx.state === "suspended") await ringAudioCtx.resume();
  ringMaster = ringAudioCtx.createGain();
  ringMaster.gain.value = 0.85;
  ringMaster.connect(ringAudioCtx.destination);
  ringBurst();
  ringInterval = setInterval(ringBurst, 1200);
  ringStopTimer = setTimeout(stopGeneratedRing, 4000);
}
function stopGeneratedRing() {
  if (ringInterval) clearInterval(ringInterval);
  if (ringStopTimer) clearTimeout(ringStopTimer);
  ringInterval = ringStopTimer = null;
  if (ringMaster) try { ringMaster.disconnect(); } catch (_) {}
  ringMaster = null;
  if (ringAudioCtx) try { ringAudioCtx.close(); } catch (_) {}
  ringAudioCtx = null;
}
function stopRing() { stopGeneratedRing(); ringing = false; }

function getFirebaseService() {
  if (window.abbieFirebaseReady && window.abbieFirebase) return Promise.resolve(window.abbieFirebase);
  if (window.abbieFirebaseError) return Promise.reject(window.abbieFirebaseError);
  return new Promise((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      window.removeEventListener("abbie-firebase-ready", onReady);
      window.removeEventListener("abbie-firebase-error", onError);
      clearTimeout(timeout);
    };
    const onReady = () => { if (done) return; done = true; cleanup(); resolve(window.abbieFirebase); };
    const onError = (e) => { if (done) return; done = true; cleanup(); reject(new Error(e?.detail?.message || "Firebase failed to initialize")); };
    window.addEventListener("abbie-firebase-ready", onReady, { once: true });
    window.addEventListener("abbie-firebase-error", onError, { once: true });
    const timeout = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error("Firebase initialization timed out.")); }, 15000);
    if (window.firebaseReady && typeof window.firebaseReady.then === "function") {
      window.firebaseReady.then((api) => { if (done) return; done = true; cleanup(); resolve(api); }).catch((err) => { if (done) return; done = true; cleanup(); reject(err); });
    }
  });
}

async function saveClientLead(data = {}) {
  leadWriteQueue = leadWriteQueue.then(async () => {
    const fb = await getFirebaseService();
    if (!fb || typeof fb.createLead !== "function" || typeof fb.updateLead !== "function") {
      throw new Error("Firebase service failed to initialize");
    }
    const clean = {};
    for (const key of ["name", "phone", "email", "company", "requirement", "status"]) {
      if (typeof data[key] === "string" && data[key].trim()) clean[key] = data[key].trim();
    }
    if (typeof data.proposalRequested === "boolean") clean.proposalRequested = data.proposalRequested;
    if (data.callId) clean.callId = data.callId;
    clean.provider = "livekit";
    if (data.roomName) clean.roomName = data.roomName;

    if (!firebaseLeadId) {
      firebaseLeadId = await fb.createLead({
        source: "Abbie Lead Form + LiveKit Voice",
        status: "submitted",
        callId: currentCallId || null,
        ...clean,
      });
    } else {
      await fb.updateLead(firebaseLeadId, clean);
    }
  });
  return leadWriteQueue;
}

async function finalizeLead(value = "call_ended") {
  try {
    if (!firebaseLeadId) return;
    const fb = await getFirebaseService();
    await fb.updateLead(firebaseLeadId, {
      status: value,
      callEndedAt: fb.serverTime(),
      durationSeconds: callStartedAt ? Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)) : 0,
    });
  } catch (e) {
    console.error("Lead finalization failed:", e);
  }
}

async function requestMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported in this browser");
  const s = await navigator.mediaDevices.getUserMedia({ audio: true });
  s.getTracks().forEach((t) => t.stop());
}

function makeRoomName() {
  const rand = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  return `csr-${Date.now()}-${rand}`;
}

async function fetchLiveKitToken(roomName) {
  // DEV ONLY: allow ?lk_token=... for local testing. Never use in production.
  const params = new URLSearchParams(location.search);
  const override = params.get("lk_token");
  if (override) {
    console.warn("[LiveKit] Using lk_token URL override for local testing only. Do not use in production.");
    return override;
  }

  const endpoint = cfg.tokenEndpoint || "/api/livekit-token";
  const body = {
    roomName,
    participantName: submittedLead.name || "Guest",
    identity: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    metadata: {
      source: "ABI Tech CSR Web",
      lead: {
        name: submittedLead.name,
        company: submittedLead.company,
        phone: submittedLead.phone,
        email: submittedLead.email,
        requirement: submittedLead.requirement,
      },
      agentName: cfg.agentName || "Samantha",
    },
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Cannot reach the LiveKit token service. A secure backend endpoint is required (API secret must never be in the browser).");
  }
  if (!res.ok) {
    let msg = `Token service error (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch (_) {}
    throw new Error(msg + ". Configure js/config.js livekit.tokenEndpoint and deploy a token server (see livekit-agent/token-server-example.mjs).");
  }
  const data = await res.json().catch(() => ({}));
  const token = data?.token || data?.accessToken || data?.jwt;
  if (!token) throw new Error("Token service did not return a token.");
  return token;
}

function ensureRemoteAudio() {
  if (remoteAudioEl) return remoteAudioEl;
  remoteAudioEl = document.createElement("audio");
  remoteAudioEl.autoplay = true;
  remoteAudioEl.playsInline = true;
  remoteAudioEl.setAttribute("data-lk-remote", "1");
  document.body.appendChild(remoteAudioEl);
  return remoteAudioEl;
}

function markCallStarted(roomName) {
  if (inCall) return;
  inCall = true;
  connecting = false;
  callStartedAt = Date.now();
  if ($("callTitle")) $("callTitle").textContent = cfg.displayName || "Samantha";
  if ($("endBtn")) $("endBtn").textContent = "End Call";
  status("Connected", "live");
  startTimer();
  saveClientLead({ status: "in_call", callId: currentCallId, roomName }).catch(console.error);
  try { navigator.wakeLock?.request("screen").then((x) => (wakeLock = x)); } catch (_) {}
}

async function markCallEnded(reason = "call_ended") {
  if (endedHandled) return;
  endedHandled = true;
  inCall = false;
  connecting = false;
  ringing = false;
  stopGeneratedRing();
  stopTimer();
  await finalizeLead(reason);
  const avatar = $("avatar");
  if (avatar) avatar.classList.remove("live");
  if ($("callTitle")) $("callTitle").textContent = "Call ended";
  if ($("endBtn")) $("endBtn").textContent = "Back to Form";
  status("Call ended");
  try { sessionStorage.removeItem("abi-tech-pending-lead"); } catch (_) {}
  try { if (wakeLock) await wakeLock.release(); } catch (_) {}
  wakeLock = null;
}

function handleCallError(e) {
  connecting = false;
  ringing = false;
  stopGeneratedRing();
  const avatar = $("avatar");
  if (avatar) avatar.classList.remove("live");
  if ($("callTitle")) $("callTitle").textContent = "Unable to connect";
  if ($("endBtn")) $("endBtn").textContent = "Back to Form";
  const msg = e?.message || "Call connection error";
  status(msg, "bad");
  toast(msg);
  console.error("LiveKit call error:", e);
}

function bindRoomEvents(r, roomName) {
  r.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      const el = ensureRemoteAudio();
      track.attach(el);
      // Some browsers need an explicit play after attach
      el.play?.().catch(() => {});
      if (!inCall) markCallStarted(roomName);
    }
  });
  r.on(RoomEvent.Disconnected, () => {
    markCallEnded("call_ended").catch(console.error);
  });
  r.on(RoomEvent.ParticipantConnected, (p) => {
    // Agent/remote participant joined; connection is live.
    if (!p.isLocal && !inCall) markCallStarted(roomName);
  });
  r.on(RoomEvent.MediaDevicesError, (e) => {
    console.error("Media device error", e);
  });
}

async function startCall() {
  if (inCall || connecting || ringing) return;
  if (!cfg.url) { handleCallError(new Error("LiveKit URL is not configured.")); return; }

  currentCallId = crypto.randomUUID ? crypto.randomUUID() : `call-${Date.now()}`;
  const roomName = makeRoomName();
  endedHandled = false;

  try {
    status("Saving your inquiry…", "live");
    await getFirebaseService();
    await saveClientLead({ ...submittedLead, status: "submitted", roomName });

    ringing = true;
    status(`Calling ${cfg.displayName || "Samantha"}…`, "live");
    if ($("endBtn")) $("endBtn").textContent = "Cancel Call";
    await startGeneratedRing();
    const tokenAbort = ++ringAbort;
    await wait(4000);
    if (tokenAbort !== ringAbort || !ringing) return;
    stopRing();

    connecting = true;
    status("Connecting…", "live");
    await requestMicrophonePermission();
    await saveClientLead({ status: "calling", callId: currentCallId, roomName });

    const token = await fetchLiveKitToken(roomName);
    if (tokenAbort !== ringAbort) return; // cancelled while fetching

    room = new Room({ adaptiveStream: true, dynacast: true });
    bindRoomEvents(room, roomName);
    await room.connect(cfg.url, token, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);

    // If no remote track event fired yet, still mark connected (agent may join shortly)
    if (!inCall) markCallStarted(roomName);
  } catch (e) {
    handleCallError(e);
  }
}

async function cleanupRoom() {
  try { if (room) { room.removeAllListeners?.(); await room.disconnect(); } } catch (_) {}
  room = null;
  if (remoteAudioEl) {
    try { remoteAudioEl.srcObject = null; remoteAudioEl.remove(); } catch (_) {}
    remoteAudioEl = null;
  }
}

async function endCall() {
  ++ringAbort;
  if (ringing || connecting) {
    stopRing();
    connecting = false;
    await cleanupRoom();
    await finalizeLead("call_cancelled");
    try { sessionStorage.removeItem("abi-tech-pending-lead"); } catch (_) {}
    window.location.href = "./index.html";
    return;
  }
  if (inCall) {
    status("Ending call…");
    await cleanupRoom();
    await markCallEnded("call_ended");
    return;
  }
  window.location.href = "./index.html";
}

function confirmLeave() {
  if (inCall || connecting || ringing) {
    if (confirm("End the current call?")) endCall();
  } else {
    window.location.href = "./index.html";
  }
}

$("endBtn")?.addEventListener("click", endCall);
$("backBtn")?.addEventListener("click", confirmLeave);
$("navHome")?.addEventListener("click", (e) => { e.preventDefault(); confirmLeave(); });
$("navHelpCall")?.addEventListener("click", () => toast("You're connected to ABI Tech support. End the call to return to the form."));

window.addEventListener("beforeunload", (e) => {
  if (inCall || connecting) { e.preventDefault(); e.returnValue = ""; }
});

async function bootstrapCallPage() {
  status("Initializing secure connection…", "live");
  try {
    await getFirebaseService();
    await startCall();
  } catch (err) {
    console.error("Call page initialization failed:", err);
    const avatar = $("avatar");
    if (avatar) avatar.classList.remove("live");
    if ($("callTitle")) $("callTitle").textContent = "Unable to connect";
    if ($("endBtn")) $("endBtn").textContent = "Back to Form";
    status(err?.message || "Initialization failed", "bad");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapCallPage, { once: true });
} else {
  bootstrapCallPage();
}
