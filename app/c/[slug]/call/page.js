"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Room, RoomEvent, Track } from "livekit-client";
import { getPublicCsr } from "../../../../lib/csr";
import { auth, db, ref, push, update, serverTimestamp, signInAnonymously } from "../../../../lib/firebase";

const LIVEKIT_URL = "wss://csr-agent-19lzgbvy.livekit.cloud";
const TOKEN_ENDPOINT = "/api/livekit-token";

export default function PublicCallPage() {
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
  const roomRef = useRef(null);
  const audioRef = useRef(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const endedRef = useRef(false);
  const inquiryIdRef = useRef(null);
  const inquiryUidRef = useRef(null);

  function showToast(msg) { setToast(msg); clearTimeout(showToast._t); showToast._t = setTimeout(() => setToast(""), 2400); }

  useEffect(() => { document.body.classList.add("callBody"); return () => document.body.classList.remove("callBody"); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPublicCsr(slug);
        if (cancelled) return;
        if (!data) { router.replace(`/c/${slug}`); return; }
        setCsr(data);
        const display = data.csrName || "Abbie";
        setTitle(`Calling ${display}`);
        let pending = null;
        try { pending = JSON.parse(sessionStorage.getItem(`csr-pending-lead:${slug}`) || sessionStorage.getItem("abi-tech-pending-lead") || "null"); } catch {}
        if (!pending) { router.replace(`/c/${slug}`); return; }
        setLead(pending);
      } catch (e) {
        console.error(e);
        setStatus(e?.message || "Failed to load CSR");
        setStatusType("bad");
      }
    })();
    return () => { cancelled = true; };
  }, [slug, router]);

  useEffect(() => {
    if (!csr || !lead) return;
    let cancelled = false;
    const display = csr.csrName || "Abbie";

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
        // Best-effort: anonymous auth to persist inquiry; RTD rules may restrict.
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
            csrSlug: slug,
            ownerUid: csr.ownerUid || null,
            status: statusValue,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (inquiryIdRef.current) {
          await update(ref(db, `publicInquiries/${slug}/${inquiryIdRef.current}`), { status: statusValue, updatedAt: serverTimestamp(), ...extra });
        }
      } catch (e) { console.warn("Inquiry save skipped:", e?.message); }
    }

    async function run() {
      try {
        await saveInquiry("submitted");
        setLiveStatus(`Calling ${display}…`, "live");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported.");
        const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t=>t.stop());

        const roomName = `csr-${slug}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        await saveInquiry("calling", { roomName });
        setLiveStatus("Connecting…", "live");

        const body = {
          roomName,
          participantName: lead.name || "Guest",
          identity: `web-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          metadata: {
            source: "ABI Tech Public CSR",
            csrSlug: slug,
            agentName: csr.livekitAgentName || "customer-support-1bda",
            csr: { name: csr.csrName, company: csr.companyName, greeting: csr.greeting, persona: csr.persona, language: csr.language },
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
        const onConnected = () => { setTitle(display); setLiveStatus("Connected", "live"); startTimer(); saveInquiry("in_call", { roomName }); };
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
    if (endedRef.current) { router.push(`/c/${slug}`); return; }
    endedRef.current = true;
    try { roomRef.current?.removeAllListeners?.(); await roomRef.current?.disconnect(); } catch {}
    setEnded(true); setTitle("Call ended"); setStatus("Call ended"); setStatusType("");
    showToast("Call ended");
  }

  const display = csr?.csrName || "Abbie";
  return (
    <>
      <main className="call">
        <div className="top appbar">
          <div className="brand"><div className="brand-mark" aria-hidden="true">A</div><div><small>{(csr?.companyName || "ABI TECH").toUpperCase()}</small><strong>Customer Care</strong></div></div>
          <button className="back" type="button" onClick={endCall} aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <section className="center">
          <div className={"avatar" + (ended ? "" : " live")} id="avatar"></div>
          <h1>{title}</h1>
          <p className="sub">{csr?.companyName || "ABI Tech"} Customer Care</p>
          <div className="context">{lead ? `${lead.name} from ${lead.company} — ${lead.requirement}` : "Preparing your inquiry…"}</div>
          <div className="state"><span className={"dot " + (statusType || "")} style={statusType==="bad"?{background:"var(--red)"}:statusType==="live"?{}:{}}></span><span>{status}</span></div>
          <div className="timer">{timer}</div>
        </section>
        <button className="end" type="button" onClick={endCall}>{ended ? "Back" : "End Call"}</button>
        <p className="hint">Your inquiry details are available to {display}.</p>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab" href={`/c/${slug}`} onClick={(e)=>{e.preventDefault(); endCall();}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V19a1 1 0 001 1H10v-5h4v5h2.5a1 1 0 001-1V9.5"/></svg><span>Home</span></a>
        <a className="tab active" href={`/c/${slug}/call`} aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 12a8 8 0 0116 0v4a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h1a6 6 0 00-12 0h1a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z"/></svg><span>Support</span></a>
        <button className="tab" type="button" onClick={()=>showToast(`You're connected to ${csr?.companyName || "support"}.`)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.7-2.5 2.2-2.5 4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg><span>Help</span></button>
      </nav>
      <div className={"toast" + (toast ? " show" : "")} aria-live="polite">{toast}</div>
    </>
  );
}
