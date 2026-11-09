"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, onAuthStateChanged, signOut } from "../../lib/firebase";
import { getUserBundle, saveUserCsr } from "../../lib/csr";

const defaults = {
  personaName: "Sarah",
  businessName: "",
  businessUrl: "https://",
  csrRoles: "Answer customer questions, qualify leads, explain services, collect contact details, and route urgent issues to the team.",
  csrDescription: "Warm, professional, clear, and patient. Speaks naturally, listens carefully, and keeps responses helpful and concise.",
  agentBackstory: "An experienced customer service specialist trained to represent the business accurately and make every caller feel understood.",
  primaryGoal: "Understand the caller's need quickly, provide accurate help, and guide them to the best next step.",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState(defaults);

  function showToast(msg) { setToast(msg); clearTimeout(showToast._t); showToast._t = setTimeout(() => setToast(""), 2600); }
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) { router.replace("/"); return; }
      setUser(u);
      try {
        const bundle = await getUserBundle(u.uid);
        const existing = bundle?.agentConfig;
        if (existing?.slug || bundle?.profile?.onboardingComplete) {
          // Returning/completed user can still edit via dashboard; allow onboarding prefill but don't force away.
        }
        if (existing) {
          setForm((f) => ({
            ...f,
            personaName: existing.personaName || existing.csrName || f.personaName,
            businessName: existing.businessName || existing.companyName || f.businessName,
            businessUrl: existing.businessUrl || f.businessUrl,
            csrRoles: existing.csrRoles || existing.rolesResponsibilities || f.csrRoles,
            csrDescription: existing.csrDescription || existing.persona || f.csrDescription,
            agentBackstory: existing.agentBackstory || existing.backstory || f.agentBackstory,
            primaryGoal: existing.primaryGoal || f.primaryGoal,
          }));
        } else if (u.displayName) {
          setForm((f) => ({ ...f, businessName: f.businessName || `${u.displayName}'s Business` }));
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    if (!user) return;
    if (!form.personaName.trim() || !form.businessName.trim()) return showToast("Persona Name and Business Name are required.");
    setSaving(true);
    try {
      const bundle = await getUserBundle(user.uid);
      await saveUserCsr(
        user.uid,
        { email: user.email || "", displayName: user.displayName || bundle?.profile?.displayName || "", createdAt: bundle?.profile?.createdAt },
        { ...(bundle?.agentConfig || {}), ...form, published: true }
      );
      showToast("Agent created. Opening dashboard…");
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Failed to save agent configuration");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="app" style={{ justifyContent: "center", alignItems: "center" }}><div className="status-pill"><span className="dot-sm"></span>Loading…</div></main>;

  return (
    <>
      <main className="app">
        <header className="appbar">
          <div className="brand"><div className="brand-mark" aria-hidden="true">A</div><div><small>ABI TECH</small><strong>CSR Studio</strong></div></div>
          <button className="back" type="button" onClick={async()=>{ await signOut(auth); router.replace("/"); }} aria-label="Sign out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></button>
        </header>

        <section className="hero">
          <div className="eyebrow">Onboarding</div>
          <h1>Customize your AI CSR</h1>
          <p>Complete these details to generate your agent, save its configuration, and create a unique public URL.</p>
        </section>

        <form className="form" onSubmit={submit}>
          <div className="form-title">Business & agent details</div>

          <div className="field"><label htmlFor="personaName">Persona Name</label><input id="personaName" value={form.personaName} onChange={e=>setField("personaName",e.target.value)} required placeholder="e.g., Sarah" /><small className="field-hint">The AI CSR agent's name.</small></div>
          <div className="field"><label htmlFor="businessName">Business Name</label><input id="businessName" value={form.businessName} onChange={e=>setField("businessName",e.target.value)} required placeholder="e.g., Acme Dental Clinic" /><small className="field-hint">The company the agent represents.</small></div>
          <div className="field"><label htmlFor="businessUrl">Business URL</label><input id="businessUrl" type="url" value={form.businessUrl} onChange={e=>setField("businessUrl",e.target.value)} placeholder="https://www.example.com" /><small className="field-hint">The company's official website.</small></div>
          <div className="field"><label htmlFor="csrRoles">CSR Roles &amp; Responsibilities</label><textarea id="csrRoles" value={form.csrRoles} onChange={e=>setField("csrRoles",e.target.value)} placeholder="Answer questions, book appointments, qualify leads..." /><small className="field-hint">What the agent is authorized to do.</small></div>
          <div className="field"><label htmlFor="csrDescription">CSR Description</label><textarea id="csrDescription" value={form.csrDescription} onChange={e=>setField("csrDescription",e.target.value)} placeholder="Friendly, professional, clear, and helpful..." /><small className="field-hint">Personality, communication style, and expertise.</small></div>
          <div className="field"><label htmlFor="agentBackstory">Agent Backstory</label><textarea id="agentBackstory" value={form.agentBackstory} onChange={e=>setField("agentBackstory",e.target.value)} placeholder="An experienced support specialist who..." /><small className="field-hint">Professional background and identity.</small></div>
          <div className="field"><label htmlFor="primaryGoal">Primary Goal</label><textarea id="primaryGoal" value={form.primaryGoal} onChange={e=>setField("primaryGoal",e.target.value)} placeholder="Understand the caller's need and guide them to the right next step." /><small className="field-hint">The agent's main objective for inbound customer calls.</small></div>

          <button className="submit" type="submit" disabled={saving}>{saving ? "Creating agent…" : "Generate & Save Agent"}</button>
          <p className="note">Your agent will use the app's configured voice provider. Existing system/metadata settings are preserved.</p>
        </form>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab" href="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg><span>Access</span></a>
        <a className="tab active" href="/onboarding" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg><span>Onboarding</span></a>
        <a className="tab" href="/dashboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z"/></svg><span>Dashboard</span></a>
      </nav>
      <div className={"toast" + (toast ? " show" : "")} aria-live="polite">{toast}</div>
    </>
  );
}
