import { QaDashboard } from "../components/QaDashboard";

export function QaPage() {
  return (
    <article className="docs-page">
      <header className="docs-hero" style={{ textAlign: "center", marginBottom: "32px" }}>
        <span className="eyebrow" style={{ color: "#38bdf8" }}>QA Test Engineering & Quality Governance</span>
        <h1>KobeanREST Automated QA Dashboard</h1>
        <p style={{ maxWidth: "720px", margin: "0 auto", color: "#94a3b8" }}>
          Real-time daily test execution analytics, historical trend tracking, flakiness governance, and multi-tier verification matrix covering 130 Node.js contract test rules and 5 CodeceptJS / Playwright E2E GUI scenarios.
        </p>
      </header>

      <QaDashboard />
    </article>
  );
}
