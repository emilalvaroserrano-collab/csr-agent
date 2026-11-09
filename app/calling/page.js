/* eslint-disable @next/next/no-sync-scripts */
export default function CallingPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: "document.body.classList.add('callBody');" }} />
      <main className="call">
        <div className="top appbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">A</div>
            <div>
              <small>ABI TECH</small>
              <strong>Customer Care</strong>
            </div>
          </div>
          <button className="back" id="backBtn" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>

        <section className="center">
          <div className="avatar live" id="avatar"></div>
          <h1 id="callTitle">Calling Samantha</h1>
          <p className="sub">ABI Tech Customer Care</p>
          <div className="context" id="leadContext">Preparing your inquiry…</div>
          <div className="state">
            <span className="dot live" id="dot"></span>
            <span id="status">Preparing call…</span>
          </div>
          <div className="timer" id="timer">00:00</div>
        </section>

        <button className="end" id="endBtn" type="button">Cancel Call</button>
        <p className="hint">Your inquiry details are already available to Samantha.</p>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="tab" href="/" id="navHome">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V19a1 1 0 001 1H10v-5h4v5h2.5a1 1 0 001-1V9.5"/></svg>
          <span>Home</span>
        </a>
        <a className="tab active" href="/calling" aria-current="page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 12a8 8 0 0116 0v4a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h1a6 6 0 00-12 0h1a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z"/></svg>
          <span>Support</span>
        </a>
        <button className="tab" type="button" id="navHelpCall">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.7-2.5 2.2-2.5 4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>
          <span>Help</span>
        </button>
      </nav>

      <div className="toast" id="toast"></div>
      <script src="/js/config.js"></script>
      <script type="module" src="/js/firebase.js"></script>
      <script type="module" src="/js/calling.js"></script>
    </>
  );
}
