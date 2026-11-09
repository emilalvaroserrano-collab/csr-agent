/* eslint-disable @next/next/no-sync-scripts */
export default function HomePage() {
  return (
    <>
      <main className="app">
        <header className="appbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">A</div>
            <div>
              <small>ABI TECH</small>
              <strong>Customer Care</strong>
            </div>
          </div>
          <div className="status-pill"><span className="dot-sm"></span>Online</div>
        </header>

        <section className="hero">
          <div className="eyebrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 3l7 4v5c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4z"/><path d="M9.5 12l1.7 1.7L14.8 10"/></svg>
            Talk to Abbie
          </div>
          <h1>Tell us what you need.</h1>
          <p>Share a few details first. Abbie will receive them as context so you can start the conversation without repeating yourself.</p>
        </section>

        <form className="form" id="leadForm">
          <div className="form-title">Your inquiry details</div>
          <div className="field">
            <label htmlFor="leadName">Name</label>
            <input id="leadName" autoComplete="name" required placeholder="Your full name" />
          </div>
          <div className="field">
            <label htmlFor="leadCompany">Company</label>
            <input id="leadCompany" autoComplete="organization" required placeholder="Company or business name" />
          </div>
          <div className="field">
            <label htmlFor="leadReason">Reason for Inquiry</label>
            <textarea id="leadReason" required maxLength={100} placeholder="One or two sentences (max 100 characters)"></textarea>
            <small className="field-hint">Keep it brief — one or two sentences, max 100 characters.</small>
          </div>
          <div className="field">
            <label htmlFor="leadPhone">Phone</label>
            <input id="leadPhone" type="tel" autoComplete="tel" required placeholder="+63..." />
          </div>
          <div className="field">
            <label htmlFor="leadEmail">Email</label>
            <input id="leadEmail" type="email" autoComplete="email" required placeholder="you@company.com" />
          </div>
          <button className="submit" type="submit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
            Submit Now
          </button>
          <p className="note">Your submitted details will be used as context for your ABI Tech call.</p>
        </form>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab active" href="/" aria-current="page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V19a1 1 0 001 1H10v-5h4v5h2.5a1 1 0 001-1V9.5"/></svg>
          <span>Home</span>
        </a>
        <a className="tab" href="/calling" id="navCall">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 12a8 8 0 0116 0v4a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h1a6 6 0 00-12 0h1a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z"/></svg>
          <span>Support</span>
        </a>
        <button className="tab" type="button" id="navHelp">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.7-2.5 2.2-2.5 4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>
          <span>Help</span>
        </button>
      </nav>

      <div className="toast" id="toast" aria-live="polite"></div>
      <script src="/js/config.js"></script>
      <script src="/js/index.js"></script>
    </>
  );
}
