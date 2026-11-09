"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, onAuthStateChanged, signOut } from "../../lib/firebase";
import { embedSnippet, getUserBundle, publicAgentUrl, saveUserCsr } from "../../lib/csr";

const fields = [
  { key: "personaName", label: "Persona Name", hint: "The AI CSR agent's name.", placeholder: "e.g., Sarah" },
  { key: "businessName", label: "Business Name", hint: "The company the agent represents.", placeholder: "e.g., Acme Dental Clinic" },
  { key: "businessUrl", label: "Business URL", hint: "The company's official website.", placeholder: "https://www.example.com", type: "url" },
  { key: "csrRoles", label: "CSR Roles & Responsibilities", hint: "What the agent is authorized to do.", placeholder: "Answer questions, qualify leads...", area: true },
  { key: "csrDescription", label: "CSR Description", hint: "Personality, communication style, and expertise.", placeholder: "Warm, professional, clear...", area: true },
  { key: "agentBackstory", label: "Agent Backstory", hint: "Professional background and identity.", placeholder: "An experienced support specialist...", area: true },
  { key: "primaryGoal", label: "Primary Goal", hint: "Main objective for inbound customer calls.", placeholder: "Understand the caller's need...", area: true },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const [origin, setOrigin] = useState("");
  const [bundle, setBundle] = useState(null);
  const [form, setForm] = useState({});

  function showToast(msg) { setToast(msg); clearTimeout(showToast._t); showToast._t = setTimeout(() => setToast(""), 2600); }
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  useEffect(() => { setOrigin(window.location.origin); }, []);

  async function load(u) {
    const b = await getUserBundle(u.uid);
    setBundle(b);
    const c = b?.agentConfig || {};
    setForm({
      personaName: c.personaName || c.csrName || "Sarah",
      businessName: c.businessName || c.companyName || "",
      businessUrl: c.businessUrl || "https://",
      csrRoles: c.csrRoles || c.rolesResponsibilities || "",
      csrDescription: c.csrDescription || c.persona || "",
      agentBackstory: c.agentBackstory || c.backstory || "",
      primaryGoal: c.primaryGoal || "",
    });
    if (!c?.slug && !b?.profile?.onboardingComplete) { router.replace("/onboarding"); return false; }
    return true;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) { router.replace("/"); return; }
      setUser(u);
      try { await load(u); }
      catch (e) { console.error(e); showToast(e?.message || "Failed to load dashboard"); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router]);

  const config = bundle?.agentConfig || {};
  const url = useMemo(() => config.slug ? publicAgentUrl(origin, config.slug) : "", [config.slug, origin]);
  const embed = useMemo(() => config.slug ? embedSnippet(origin || "https://yourdomain.com", config.slug) : "", [config.slug, origin]);

  async function save(e) {
    e.preventDefault();
    if (!user) return;
    if (!form.personaName?.trim() || !form.businessName?.trim()) return showToast("Persona Name and Business Name are required.");
    setSaving(true);
    try {
      await saveUserCsr(user.uid, { email: user.email || "", displayName: user.displayName || bundle?.profile?.displayName || "" }, { ...config, ...form, published: true });
      await load(user);
      setEditing(false);
      showToast("Agent configuration saved.");
    } catch (err) { console.error(err); showToast(err?.message || "Save failed"); }
    finally { setSaving(false); }
  }

  async function copy(text, label) {
    if (!text) return showToast("Nothing to copy yet.");
    try { await navigator.clipboard.writeText(text); showToast(`${label} copied.`); }
    catch { showToast(text); }
  }

  if (loading) return <main className="app" style={{ justifyContent: "center", alignItems: "center" }}><div className="status-pill"><span className="dot-sm"></span>Loading dashboard…</div></main>;

  return (
    <>
      <main className="app">
        <header className="appbar">
          <div className="brand"><div className="brand-mark" aria-hidden="true">A</div><div><small>ABI TECH</small><strong>CSR Dashboard</strong></div></div>
          <button className="back" type="button" onClick={async()=>{ await signOut(auth); router.replace("/"); }} aria-label="Sign out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></button>
        </header>

        <section className="hero">
          <div className="eyebrow">Deployment Status: {(config.deploymentStatus || "draft").toUpperCase()}</div>
          <h1>{config.personaName || config.csrName || "Your AI CSR"}</h1>
          <p>{config.businessName || config.companyName || "Business"}{config.businessUrl ? ` · ${config.businessUrl}` : ""}</p>
        </section>

        <section className="form">
          <div className="form-title">Public CSR URL</div>
          <div className="field"><label htmlFor="publicUrl">URL</label><input id="publicUrl" value={url || "Save configuration to generate your URL"} readOnly /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <button className="end" type="button" onClick={() => copy(url, "Public URL")} style={{ marginTop: 0, background: "linear-gradient(180deg,#2a3344,#1a2230)", boxShadow: "none", border: "1px solid var(--line)" }}>Copy URL</button>
            {url ? <a className="submit" href={url} target="_blank" rel="noreferrer" style={{ marginTop: 0, textDecoration: "none" }}>Launch / Test</a> : <button className="submit" type="button" disabled style={{ marginTop: 0 }}>Launch / Test</button>}
          </div>
        </section>

        <section className="form" style={{ marginTop: 14 }}>
          <div className="form-title">Website Embed Code</div>
          <div className="field"><label htmlFor="embed">Embed snippet</label><textarea id="embed" value={embed || "Save configuration to generate embed code"} readOnly style={{ minHeight: 120, fontSize: 12 }} /></div>
          <button className="end" type="button" onClick={() => copy(embed, "Embed code")} style={{ marginTop: 12, background: "linear-gradient(180deg,#2a3344,#1a2230)", boxShadow: "none", border: "1px solid var(--line)" }}>Copy Embed Code</button>
          <p className="note">Paste this into your website. Ensure microphone permission is allowed and your deployed domain is configured for LiveKit/Firebase.</p>
        </section>

        <section className="form" style={{ marginTop: 14 }}>
          <div className="form-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{editing ? "Edit Agent Configuration" : "Agent Configuration"}</span>
            <button type="button" onClick={() => setEditing((v) => !v)} style={{ background: "none", border: 0, color: "var(--green)", fontWeight: 700, cursor: "pointer" }}>{editing ? "Close" : "Edit"}</button>
          </div>
          {!editing ? (
            <div style={{ color: "#c5ccd8", fontSize: 13, lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 8px" }}><strong>Roles:</strong> {config.csrRoles || config.rolesResponsibilities || "—"}</p>
              <p style={{ margin: "0 0 8px" }}><strong>Description:</strong> {config.csrDescription || config.persona || "—"}</p>
              <p style={{ margin: "0 0 8px" }}><strong>Backstory:</strong> {config.agentBackstory || config.backstory || "—"}</p>
              <p style={{ margin: 0 }}><strong>Primary Goal:</strong> {config.primaryGoal || "—"}</p>
            </div>
          ) : (
            <form onSubmit={save}>
              {fields.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={f.key}>{f.label}</label>
                  {f.area ? <textarea id={f.key} value={form[f.key] || ""} onChange={e=>setField(f.key,e.target.value)} placeholder={f.placeholder} /> : <input id={f.key} type={f.type || "text"} value={form[f.key] || ""} onChange={e=>setField(f.key,e.target.value)} placeholder={f.placeholder} required={f.key==="personaName"||f.key==="businessName"} />}
                  <small className="field-hint">{f.hint}</small>
                </div>
              ))}
              <button className="submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
            </form>
          )}
        </section>

        <section className="form" style={{ marginTop: 14 }}>
          <div className="form-title">Existing Metadata & Integrations</div>
          <div style={{ color: "#aab2c0", fontSize: 12.5, lineHeight: 1.6 }}>
            <div><strong>Agent ID:</strong> {config.agentId || "—"}</div>
            <div><strong>Slug:</strong> {config.slug || "—"}</div>
            <div><strong>Voice Provider:</strong> {config.voiceProvider || "livekit"} (configured server-side token endpoint)</div>
            <div><strong>LiveKit Agent Dispatch:</strong> {config.livekitAgentName || "customer-support-1bda"}</div>
            <div><strong>Language:</strong> {config.language || "English"}</div>
            <div><strong>System Prompt:</strong> generated from submitted fields; preserved system/provider settings.</div>
            <div><strong>PSTN/Phone Inbound:</strong> preserved as a separate deployment capability unless backend routing is configured.</div>
            <div><strong>Account:</strong> {user?.email || user?.uid}</div>
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab" href="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg><span>Access</span></a>
        <a className="tab" href="/onboarding"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg><span>Onboarding</span></a>
        <a className="tab active" href="/dashboard" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z"/></svg><span>Dashboard</span></a>
      </nav>
      <div className={"toast" + (toast ? " show" : "")} aria-live="polite">{toast}</div>
    </>
  );
}
