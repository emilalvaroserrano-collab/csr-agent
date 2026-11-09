"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
  updateProfile,
  ref,
  get,
  set,
  serverTimestamp,
} from "../lib/firebase";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // login | register
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(""), 2600);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        // Ensure profile record exists, then go to customization/dashboard
        try {
          const pRef = ref(db, `users/${user.uid}/profile`);
          const snap = await get(pRef);
          if (!snap.exists()) {
            await set(pRef, {
              email: user.email || "",
              displayName: user.displayName || "",
              ownerUid: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (e) {
          console.error(e);
        }
        router.replace("/dashboard");
      } else {
        setChecking(false);
      }
    });
    return () => unsub();
  }, [router]);

  async function handleEmailAuth(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          try { await updateProfile(cred.user, { displayName: name.trim() }); } catch {}
        }
        await set(ref(db, `users/${cred.user.uid}/profile`), {
          email: cred.user.email || email.trim(),
          displayName: name.trim() || cred.user.displayName || "",
          ownerUid: cred.user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast("Account created. Redirecting…");
        router.replace("/dashboard");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        router.replace("/dashboard");
      }
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const pRef = ref(db, `users/${cred.user.uid}/profile`);
      const snap = await get(pRef);
      if (!snap.exists()) {
        await set(pRef, {
          email: cred.user.email || "",
          displayName: cred.user.displayName || "",
          ownerUid: cred.user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // keep profile fresh
        await set(ref(db, `users/${cred.user.uid}/profile/updatedAt`), serverTimestamp());
      }
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="app" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div className="status-pill"><span className="dot-sm"></span>Loading…</div>
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
          <div className="status-pill"><span className="dot-sm"></span>Secure</div>
        </header>

        <section className="hero">
          <div className="eyebrow">Owner Access</div>
          <h1>{mode === "register" ? "Create your CSR" : "Welcome back"}</h1>
          <p>Register or sign in to customize your agent, save your configuration, and get a unique public CSR URL.</p>
        </section>

        <form className="form" onSubmit={handleEmailAuth}>
          <div className="form-title">{mode === "register" ? "Register with email" : "Sign in with email"}</div>
          {mode === "register" && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@company.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={6} placeholder="At least 6 characters" />
          </div>
          <button className="submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
          </button>
          <button className="end" type="button" onClick={handleGoogle} disabled={busy} style={{ marginTop: 10, background: "linear-gradient(180deg,#2a3344,#1a2230)", boxShadow: "none", border: "1px solid var(--line)" }}>
            Continue with Google
          </button>
          <p className="note">
            {mode === "register" ? "Already have an account? " : "New here? "}
            <button type="button" onClick={() => setMode(mode === "register" ? "login" : "register")} style={{ background: "none", border: 0, color: "var(--green)", fontWeight: 700, cursor: "pointer", padding: 0 }}>
              {mode === "register" ? "Sign in" : "Register"}
            </button>
          </p>
        </form>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab active" href="/" aria-current="page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
          <span>Access</span>
        </a>
        <a className="tab" href="/dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          <span>Customize</span>
        </a>
        <button className="tab" type="button" onClick={() => showToast("Register or sign in to manage your CSR.")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.7-2.5 2.2-2.5 4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>
          <span>Help</span>
        </button>
      </nav>
      <div className={"toast" + (toast ? " show" : "")} aria-live="polite">{toast}</div>
    </>
  );
}
