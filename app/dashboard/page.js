"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, onAuthStateChanged, signOut } from "../../lib/firebase";
import { defaultCsrConfig, getUserCsrConfig, getUserProfile, saveUserCsr } from "../../lib/csr";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [origin, setOrigin] = useState("");

  const [profile, setProfile] = useState({ email: "", displayName: "" });
  const [config, setConfig] = useState({
    csrName: "Abbie",
    companyName: "",
    greeting: "Hi, thanks for calling. How can I help you today?",
    persona: "Friendly, clear, and helpful customer service representative.",
    language: "English",
    voiceProvider: "livekit",
    livekitAgentName: "customer-support-1bda",
    published: true,
    slug: "",
  });

  function showToast(msg) {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(""), 2600);
  }

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) {
        router.replace("/");
        return;
      }
      setUser(u);
      try {
        const [p, c] = await Promise.all([getUserProfile(u.uid), getUserCsrConfig(u.uid)]);
        if (p) setProfile({ email: p.email || u.email || "", displayName: p.displayName || u.displayName || "", createdAt: p.createdAt });
        else setProfile({ email: u.email || "", displayName: u.displayName || "" });
        if (c) setConfig((prev) => ({ ...prev, ...c }));
        else setConfig((prev) => ({ ...prev, ...defaultCsrConfig(u), companyName: p?.displayName ? `${p.displayName}'s Company` : prev.companyName }));
      } catch (e) {
        console.error(e);
        showToast(e?.message || "Failed to load your configuration");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const publicUrl = useMemo(() => {
    if (!config.slug || !origin) return "";
    return `${origin}/c/${config.slug}`;
  }, [config.slug, origin]);

  function setField(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!user) return;
    if (!String(config.csrName || "").trim()) return showToast("CSR name is required.");
    setSaving(true);
    try {
      const result = await saveUserCsr(
        user.uid,
        { email: profile.email || user.email || "", displayName: profile.displayName || user.displayName || "", createdAt: profile.createdAt },
        config
      );
      setConfig((c) => ({ ...c, ...result.config, slug: result.slug }));
      showToast("Saved. Your public CSR URL is ready.");
    } catch (e) {
      console.error(e);
      showToast(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/");
  }

  async function copyUrl() {
    if (!publicUrl) return showToast("Save first to generate your URL.");
    try { await navigator.clipboard.writeText(publicUrl); showToast("Public URL copied."); }
    catch { showToast(publicUrl); }
  }

  if (loading) {
    return (
      <main className="app" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="status-pill"><span className="dot-sm"></span>Loading your CSR…</div>
      </main>
    );
  }

  return (
    <>
      <main className="app">
        <header className="appbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">A</div>
            <div>
              <small>ABI TECH</small>
              <strong>CSR Studio</strong>
            </div>
          </div>
          <button className="back" type="button" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          </button>
        </header>

        <section className="hero">
          <div className="eyebrow">CSR Customization</div>
          <h1>Configure your agent</h1>
          <p>Save your profile and agent settings. A unique, stable public CSR URL will be generated for visitors.</p>
        </section>

        <form className="form" onSubmit={handleSave}>
          <div className="form-title">Agent configuration</div>

          <div className="field">
            <label htmlFor="csrName">CSR Name</label>
            <input id="csrName" value={config.csrName} onChange={(e) => setField("csrName", e.target.value)} required placeholder="e.g., Abbie" />
          </div>
          <div className="field">
            <label htmlFor="companyName">Company Name</label>
            <input id="companyName" value={config.companyName} onChange={(e) => setField("companyName", e.target.value)} required placeholder="Your company" />
          </div>
          <div className="field">
            <label htmlFor="greeting">Greeting / First Message</label>
            <textarea id="greeting" value={config.greeting} onChange={(e) => setField("greeting", e.target.value)} placeholder="How your CSR greets callers" />
          </div>
          <div className="field">
            <label htmlFor="persona">Persona / Instructions</label>
            <textarea id="persona" value={config.persona} onChange={(e) => setField("persona", e.target.value)} placeholder="Tone, behavior, and service goals" style={{ minHeight: 140 }} />
            <small className="field-hint">This context is passed to the configured voice agent for personalized conversations.</small>
          </div>
          <div className="field">
            <label htmlFor="language">Language</label>
            <input id="language" value={config.language} onChange={(e) => setField("language", e.target.value)} placeholder="English" />
          </div>
          <div className="field">
            <label htmlFor="voiceProvider">Voice Provider</label>
            <input id="voiceProvider" value={config.voiceProvider} onChange={(e) => setField("voiceProvider", e.target.value)} placeholder="livekit" />
            <small className="field-hint">Configured provider: LiveKit Cloud (server token + deployed agent required for live voice).</small>
          </div>
          <div className="field">
            <label htmlFor="livekitAgentName">LiveKit Agent Name (dispatch)</label>
            <input id="livekitAgentName" value={config.livekitAgentName} onChange={(e) => setField("livekitAgentName", e.target.value)} placeholder="customer-support-1bda" />
          </div>

          <button className="submit" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save configuration"}
          </button>
        </form>

        <section className="form" style={{ marginTop: 14 }}>
          <div className="form-title">Public CSR URL</div>
          <p className="note" style={{ textAlign: "left", margin: "0 2px 10px" }}>
            Share this stable URL. Visitors will load your customized CSR and can start a voice conversation.
          </p>
          <div className="field">
            <label htmlFor="publicUrl">URL</label>
            <input id="publicUrl" value={publicUrl || (config.slug ? `/c/${config.slug}` : "Save to generate your URL")} readOnly />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <button className="end" type="button" onClick={copyUrl} style={{ marginTop: 0, background: "linear-gradient(180deg,#2a3344,#1a2230)", boxShadow: "none", border: "1px solid var(--line)" }}>Copy URL</button>
            {publicUrl ? (
              <a className="submit" href={publicUrl} target="_blank" rel="noreferrer" style={{ marginTop: 0, textDecoration: "none" }}>Open</a>
            ) : (
              <button className="submit" type="button" disabled style={{ marginTop: 0 }}>Open</button>
            )}
          </div>
          <p className="note">Account: {user?.email || user?.uid}</p>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab" href="/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
          <span>Access</span>
        </a>
        <a className="tab active" href="/dashboard" aria-current="page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          <span>Customize</span>
        </a>
        <button className="tab" type="button" onClick={copyUrl}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 10-7.07-7.07L11.4 4.53"/><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 107.07 7.07l1.41-1.41"/></svg>
          <span>Public URL</span>
        </button>
      </nav>
      <div className={"toast" + (toast ? " show" : "")} aria-live="polite">{toast}</div>
    </>
  );
}
