"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPublicCsr } from "../../../lib/csr";

export default function PublicAgentPage() {
  const params = useParams();
  const slug = params?.slug;
  const router = useRouter();
  const [csr, setCsr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({ name: "", company: "", requirement: "", phone: "", email: "" });

  function showToast(msg) { setToast(msg); clearTimeout(showToast._t); showToast._t = setTimeout(() => setToast(""), 2400); }

  useEffect(() => {
    let alive = true;
    (async () => {
      try { setCsr(await getPublicCsr(slug)); } catch (e) { console.error(e); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [slug]);

  function onChange(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  function submit(e) {
    e.preventDefault();
    const lead = {
      name: form.name.trim(), company: form.company.trim(), requirement: form.requirement.trim(),
      phone: form.phone.trim(), email: form.email.trim(), submittedAt: Date.now(), csrSlug: slug,
      csr: csr ? {
        slug: csr.slug, ownerUid: csr.ownerUid, csrName: csr.personaName || csr.csrName,
        companyName: csr.businessName || csr.companyName, greeting: csr.greeting,
        persona: csr.csrDescription || csr.persona, backstory: csr.agentBackstory,
        roles: csr.csrRoles, primaryGoal: csr.primaryGoal, systemPrompt: csr.systemPrompt,
        language: csr.language, voiceProvider: csr.voiceProvider, livekitAgentName: csr.livekitAgentName,
      } : null,
    };
    if (!lead.name || !lead.company || !lead.requirement || !lead.phone || !lead.email) return showToast("Please complete all fields.");
    try {
      sessionStorage.setItem(`csr-pending-lead:${slug}`, JSON.stringify(lead));
      router.push(`/agent/${slug}/call`);
    } catch (err) { console.error(err); showToast("Your browser blocked site storage."); }
  }

  if (loading) return <main className="app" style={{ justifyContent: "center", alignItems: "center" }}><div className="status-pill"><span className="dot-sm"></span>Loading agent…</div></main>;
  if (!csr) return <main className="app" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}><section className="hero"><div className="eyebrow">Not found</div><h1>Agent unavailable</h1><p>This public CSR link is invalid or unpublished.</p></section></main>;

  const title = csr.personaName || csr.csrName || "AI CSR";
  const business = csr.businessName || csr.companyName || "Customer Care";
  return (
    <>
      <main className="app">
        <header className="appbar">
          <div className="brand"><div className="brand-mark" aria-hidden="true">A</div><div><small>{business.toUpperCase()}</small><strong>{title}</strong></div></div>
          <div className="status-pill"><span className="dot-sm"></span>Online</div>
        </header>
        <section className="hero">
          <div className="eyebrow">Talk to {title}</div>
          <h1>How can we help?</h1>
          <p>Share a few details first. {title} will receive them as context before your live voice conversation.</p>
          {csr.businessUrl ? <p style={{marginTop:8}}><a href={csr.businessUrl} target="_blank" rel="noreferrer" style={{color:"var(--green)"}}>{csr.businessUrl}</a></p> : null}
        </section>
        <form className="form" onSubmit={submit}>
          <div className="form-title">Your details</div>
          <div className="field"><label htmlFor="leadName">Name</label><input id="leadName" value={form.name} onChange={e=>onChange("name",e.target.value)} required placeholder="Your full name" /></div>
          <div className="field"><label htmlFor="leadCompany">Company</label><input id="leadCompany" value={form.company} onChange={e=>onChange("company",e.target.value)} required placeholder="Company or business name" /></div>
          <div className="field"><label htmlFor="leadReason">Reason for Inquiry</label><textarea id="leadReason" value={form.requirement} onChange={e=>onChange("requirement",e.target.value)} required maxLength={120} placeholder="What do you need help with?"></textarea></div>
          <div className="field"><label htmlFor="leadPhone">Phone</label><input id="leadPhone" type="tel" value={form.phone} onChange={e=>onChange("phone",e.target.value)} required placeholder="+63..." /></div>
          <div className="field"><label htmlFor="leadEmail">Email</label><input id="leadEmail" type="email" value={form.email} onChange={e=>onChange("email",e.target.value)} required placeholder="you@company.com" /></div>
          <button className="submit" type="submit">Start Voice Conversation</button>
          <p className="note">Live voice uses the configured provider. Microphone permission is required.</p>
        </form>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab active" href={`/agent/${slug}`} aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V19a1 1 0 001 1H10v-5h4v5h2.5a1 1 0 001-1V9.5"/></svg><span>Home</span></a>
        <button className="tab" type="button" onClick={() => showToast("Submit the form to start a live voice conversation.")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12a8 8 0 0116 0v4a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h1a6 6 0 00-12 0h1a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z"/></svg><span>Call</span></button>
        <button className="tab" type="button" onClick={() => showToast(`${title} can assist with: ${csr.csrRoles || csr.primaryGoal || "customer support"}`.slice(0,120))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.7-2.5 2.2-2.5 4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg><span>Help</span></button>
      </nav>
      <div className={"toast" + (toast ? " show" : "")} aria-live="polite">{toast}</div>
    </>
  );
}
