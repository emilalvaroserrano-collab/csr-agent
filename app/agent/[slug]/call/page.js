"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Room, RoomEvent, Track } from "livekit-client";
import { getPublicCsr } from "../../../../lib/csr";
import { auth, db, ref, push, update, serverTimestamp, signInAnonymously } from "../../../../lib/firebase";

const LIVEKIT_URL = "wss://csr-agent-19lzgbvy.livekit.cloud";
const TOKEN_ENDPOINT = "/api/livekit-token";

export default function PublicAgentCallPage() {
  const params = useParams();
  const slug = params?.slug;
  const router = useRouter();
  const [csr, setCsr] = useState(null);
  const [lead, setLead] = useState(null);
  const [title, setTitle] = useState("Calling…");
  const [status, setStatus] = useState("Preparing call…");
  const [statusType, setStatusType] = useState("live");
  const [timer, setTimer] = useState("00:00");
  const [toast, setToast] = useState("");
  const [ended, setEnded] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [transcriptStatus, setTranscriptStatus] = useState("waiting"); // waiting | active | unavailable
  const roomRef = useRef(null);
  const audioRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const endedRef = useRef(false);
  const inquiryIdRef = useRef(null);
  const inquiryUidRef = useRef(null);
  const transcriptSeenRef = useRef(new Set());

  function showToast(msg) { setToast(msg); clearTimeout(showToast._t); showToast._t = setTimeout(() => setToast(""), 2400); }

  useEffect(() => { document.body.classList.add("callBody"); return () => document.body.classList.remove("callBody"); }, []);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" }); }, [transcripts]);

  function addTranscript(speaker, text, isFinal = true, id) {
    const clean = String(text || "").trim();
    if (!clean) return;
    const key = id || `${speaker}:${clean}:${isFinal ? "f" : "p"}`;
    if (isFinal && transcriptSeenRef.current.has(key)) return;
    if (isFinal) transcriptSeenRef.current.add(key);
    setTranscriptStatus("active");
    setTranscripts((prev) => {
      // update last partial from same speaker if not final
      if (!isFinal && prev.length) {
        const last = prev[prev.length - 1];
        if (last && last.speaker === speaker && !last.final) {
          const next = prev.slice();
          next[next.length - 1] = { ...last, text: clean, final: false };
          return next;
        }
      }
      // if final, replace matching partial or append
      if (isFinal && prev.length) {
        const last = prev[prev.length - 1];
        if (last && last.speaker === speaker && !last.final) {
          const next = prev.slice();
          next[next.length - 1] = { speaker, text: clean, final: true, at: Date.now() };
          return next;
        }
      }
      return [...prev, { speaker, text: clean, final: isFinal, at: Date.now() }].slice(-120);
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPublicCsr(slug);
        if (cancelled) return;
        if (!data) { router.replace(`/agent/${slug}`); return; }
        setCsr(data);
        const display = data.personaName || data.csrName || "AI CSR";
        setTitle(`Calling ${display}`);
        let pending = null;
        try { pending = JSON.parse(sessionStorage.getItem(`csr-pending-lead:${slug}`) || "null"); } catch {}
        if (!pending) { router.replace(`/agent/${slug}`); return; }
        setLead(pending);
      } catch (e) {
        console.error(e);
        setStatus(e?.message || "Failed to load agent");
        setStatusType("bad");
      }
    })();
    return () => { cancelled = true; };
  }, [slug, router]);

  useEffect(() => {
    if (!csr || !lead) return;
    let cancelled = false;
    const display = csr.personaName || csr.csrName || "AI CSR";

    function setLiveStatus(t, type = "live") { setStatus(t); setStatusType(type); }
    function startTimer() {
      if (!startedAtRef.current) startedAtRef.current = Date.now();
      clearInterval(timerRef.current);
      const tick = () => {
        const s = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
        setTimer(String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"));
      };
      tick(); timerRef.current = setInterval(tick, 1000);
    }
    function stopTimer() { clearInterval(timerRef.current); startedAtRef.current = 0; }

    async function saveInquiry(statusValue, extra = {}) {
      try {
        if (!inquiryUidRef.current) {
          try { if (!auth.currentUser) await signInAnonymously(auth); inquiryUidRef.current = auth.currentUser?.uid || null; } catch {}
        }
        if (!inquiryIdRef.current && inquiryUidRef.current) {
          const r = push(ref(db, `publicInquiries/${slug}`));
          inquiryIdRef.current = r.key;
          await update(r, {
            ...extra,
            visitorUid: inquiryUidRef.current,
            lead: { name: lead.name, company: lead.company, phone: lead.phone, email: lead.email, requirement: lead.requirement },
            csrSlug: slug, agentId: csr.agentId || null, ownerUid: csr.ownerUid || null,
            status: statusValue, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        } else if (inquiryIdRef.current) {
          await update(ref(db, `publicInquiries/${slug}/${inquiryIdRef.current}`), { status: statusValue, updatedAt: serverTimestamp(), ...extra });
        }
      } catch (e) { console.warn("Inquiry save skipped:", e?.message); }
    }

    function wireTranscripts(room) {
      let gotAny = false;
      // 1) LiveKit transcription events (when published by agent/provider)
      try {
        const ev = RoomEvent?.TranscriptionReceived;
        if (ev && typeof room.on === "function") {
          room.on(ev, (segments, participant) => {
            if (!Array.isArray(segments)) return;
            const isLocal = !!participant?.isLocal;
            segments.forEach((seg) => {
              const text = seg?.text || seg?.transcript || "";
              if (!text) return;
              gotAny = true;
              addTranscript(isLocal ? "You" : display, text, seg?.final !== false, seg?.id || seg?.segment_id);
            });
          });
        }
      } catch (e) { console.warn("Transcription event wiring failed", e); }
      // 2) Data messages fallback (some agents send {type:'transcript'|'transcription', ...})
      try {
        const dev = RoomEvent?.DataReceived;
        if (dev && typeof room.on === "function") {
          room.on(dev, (payload, participant) => {
            try {
              const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
              const msg = JSON.parse(text);
              const t = msg?.type || msg?.event || "";
              if (!/transcript|transcription|user_speech|agent_speech|text/i.test(String(t))) return;
              const body = msg?.text || msg?.transcript || msg?.content || msg?.message || "";
              if (!body) return;
              gotAny = true;
              const role = /user/i.test(String(msg?.role || msg?.speaker || t)) || participant?.isLocal ? "You" : display;
              addTranscript(role, body, msg?.final !== false, msg?.id);
            } catch {}
          });
        }
      } catch {}
      // Honest state if no transcripts arrive
      setTimeout(() => { if (!gotAny && !endedRef.current) setTranscriptStatus("unavailable"); }, 12000);
    }

    async function run() {
      try {
        await saveInquiry("submitted");
        setLiveStatus(`Calling ${display}…`, "live");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported in this browser.");
        const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t=>t.stop());

        const roomName = `csr-${slug}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        await saveInquiry("calling", { roomName });
        setLiveStatus("Connecting to voice agent…", "live");

        const body = {
          roomName,
          participantName: lead.name || "Guest",
          identity: `web-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          metadata: {
            source: "ABI Tech Public CSR",
            csrSlug: slug,
            agentName: csr.livekitAgentName || "customer-support-1bda",
            csr: {
              agentId: csr.agentId, slug: csr.slug,
              name: csr.personaName || csr.csrName, personaName: csr.personaName || csr.csrName,
              company: csr.businessName || csr.companyName, businessName: csr.businessName || csr.companyName,
              businessUrl: csr.businessUrl, roles: csr.csrRoles, csrRoles: csr.csrRoles,
              persona: csr.csrDescription || csr.persona, csrDescription: csr.csrDescription || csr.persona,
              backstory: csr.agentBackstory, agentBackstory: csr.agentBackstory,
              primaryGoal: csr.primaryGoal, greeting: csr.greeting, systemPrompt: csr.systemPrompt,
              language: csr.language, voiceProvider: csr.voiceProvider, livekitAgentName: csr.livekitAgentName,
            },
            lead: { name: lead.name, company: lead.company, phone: lead.phone, email: lead.email, requirement: lead.requirement },
          },
        };
        const res = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) {
          let msg = `Token service error (${res.status})`;
          try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
          throw new Error(msg);
        }
        const data = await res.json();
        const token = data?.token || data?.accessToken || data?.jwt;
        if (!token) throw new Error("Token service did not return a token.");
        if (cancelled) return;

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        wireTranscripts(room);
        const onConnected = () => { if (endedRef.current) return; setTitle(display); setLiveStatus("Connected — live voice active", "live"); startTimer(); saveInquiry("in_call", { roomName }); };
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            let el = audioRef.current;
            if (!el) { el = document.createElement("audio"); el.autoplay = true; el.playsInline = true; document.body.appendChild(el); audioRef.current = el; }
            track.attach(el); el.play?.().catch(()=>{});
            onConnected();
          }
        });
        room.on(RoomEvent.ParticipantConnected, (p) => { if (!p.isLocal) onConnected(); });
        room.on(RoomEvent.Disconnected, () => { if (!endedRef.current) { endedRef.current = true; stopTimer(); saveInquiry("call_ended"); setEnded(true); setTitle("Call ended"); setLiveStatus("Call ended", ""); } });

        await room.connect(LIVEKIT_URL, token, { autoSubscribe: true });
        await room.localParticipant.setMicrophoneEnabled(true);
        if (!endedRef.current) onConnected();
      } catch (e) {
        console.error(e);
        setTitle("Unable to connect");
        setLiveStatus(e?.message || "Call connection error", "bad");
        setTranscriptStatus("unavailable");
      }
    }
    run();

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      try { roomRef.current?.removeAllListeners?.(); roomRef.current?.disconnect(); } catch {}
      roomRef.current = null;
      try { if (audioRef.current) { audioRef.current.srcObject = null; audioRef.current.remove(); } } catch {}
      audioRef.current = null;
    };
  }, [csr, lead, slug]);

  async function endCall() {
    if (endedRef.current) { router.push(`/agent/${slug}`); return; }
    endedRef.current = true;
    try { roomRef.current?.removeAllListeners?.(); await roomRef.current?.disconnect(); } catch {}
    setEnded(true); setTitle("Call ended"); setStatus("Call ended"); setStatusType("");
    showToast("Call ended");
  }

  const display = csr?.personaName || csr?.csrName || "AI CSR";
  const business = csr?.businessName || csr?.companyName || "Customer Care";
  return (
    <>
      <main className="call" style={{ paddingBottom: 90 }}>
        <div className="top appbar">
          <div className="brand"><div className="brand-mark" aria-hidden="true">A</div><div><small>{business.toUpperCase()}</small><strong>{display}</strong></div></div>
          <button className="back" type="button" onClick={endCall} aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>

        <section className="center" style={{ marginTop: 8 }}>
          <div className={"avatar" + (ended ? "" : " live")} id="avatar" style={{ width: 88, height: 88 }}></div>
          <h1 style={{ fontSize: 24 }}>{title}</h1>
          <p className="sub">{business}</p>
          <div className="state"><span className={"dot " + (statusType || "")} style={statusType==="bad"?{background:"var(--red)"}:statusType==="live"?{}:{}}></span><span>{status}</span></div>
          <div className="timer">{timer}</div>
        </section>

        <section className="form" style={{ marginTop: 12, maxHeight: 260, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="form-title" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>Live Transcript</span>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
              {transcriptStatus === "active" ? "Receiving events" : transcriptStatus === "unavailable" ? "Not available from provider" : "Waiting for events…"}
            </span>
          </div>
          <div aria-live="polite" style={{ overflowY: "auto", minHeight: 90, maxHeight: 180, paddingRight: 4, fontSize: 13, lineHeight: 1.45 }}>
            {transcripts.length ? transcripts.map((t, i) => (
              <p key={i} style={{ margin: "0 0 8px", color: t.final ? "#e8ecf4" : "#9aa3b2" }}>
                <strong style={{ color: t.speaker === "You" ? "var(--green)" : "#7dd3fc" }}>{t.speaker}:</strong> {t.text}
              </p>
            )) : (
              <p className="note" style={{ textAlign: "left", margin: 0 }}>
                {transcriptStatus === "unavailable"
                  ? "Real-time transcript events were not received from the configured voice provider for this call. Voice audio may still work if the agent is connected."
                  : "Only real transcript events from the voice session will appear here."}
              </p>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </section>

        <button className="end" type="button" onClick={endCall}>{ended ? "Back to Agent" : "End Conversation"}</button>
        <p className="hint">Microphone is used for live voice. No private keys are exposed to the browser.</p>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab" href={`/agent/${slug}`} onClick={(e)=>{e.preventDefault(); endCall();}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V19a1 1 0 001 1H10v-5h4v5h2.5a1 1 0 001-1V9.5"/></svg><span>Agent</span></a>
        <a className="tab active" href={`/agent/${slug}/call`} aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12a8 8 0 0116 0v4a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h1a6 6 0 00-12 0h1a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z"/></svg><span>Call</span></a>
        <button className="tab" type="button" onClick={()=>showToast(`${display} · ${lead ? lead.requirement : business}`.slice(0,120))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.7-2.5 2.2-2.5 4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg><span>Help</span></button>
      </nav>
      <div className={"toast" + (toast ? " show" : "")} aria-live="polite">{toast}</div>
    </>
  );
}
