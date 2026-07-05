import { ArrowRight, CheckCircle2, LockKeyhole, WifiOff } from "lucide-react";
import { PortalCard } from "../components/PortalCard";
import { navItems, portalStats, releasesUrl, webAppUrl } from "../site";

export function HomePage() {
  const directoryItems = navItems.filter((item) => item.route !== "home");

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">Unified documentation portal</span>
          <h1>KobeanREST</h1>
          <p>
            A local-first desktop REST client for standard HTTP workflows, documented from product use through
            release operations.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href={webAppUrl} target="_blank" rel="noreferrer">
              Run in browser <ArrowRight size={17} />
            </a>
            <a className="secondary-link" href="#/product">
              Start reading
            </a>
            <a className="secondary-link" href={releasesUrl} target="_blank" rel="noreferrer">
              Latest release
            </a>
          </div>
        </div>
        <div className="hero-glass" aria-label="KobeanREST product snapshot">
          <div className="mini-window">
            <div className="window-dots">
              <span />
              <span />
              <span />
            </div>
            <div className="request-line">
              <b>GET</b>
              <span>{"{{baseUrl}}/status"}</span>
            </div>
            <div className="response-card">
              <strong>200 OK</strong>
              <span>Local history saved. Secrets redacted.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <article>
          <WifiOff size={20} />
          <strong>Offline-ready after install</strong>
          <span>Usable without startup networking.</span>
        </article>
        <article>
          <LockKeyhole size={20} />
          <strong>Secrets stay out of SQLite</strong>
          <span>Stored through keychain or encrypted vault support.</span>
        </article>
        <article>
          <CheckCircle2 size={20} />
          <strong>Signed updates</strong>
          <span>Optional checks from public release metadata.</span>
        </article>
      </section>

      <section className="portal-section">
        <div className="section-heading">
          <span className="eyebrow">Docs directory</span>
          <h2>Everything in one portal.</h2>
        </div>
        <div className="portal-grid">
          {directoryItems.map((item) => (
            <PortalCard
              description={item.description}
              href={item.href}
              icon={item.icon}
              key={item.route}
              title={item.label}
            />
          ))}
        </div>
      </section>

      <section className="snapshot-grid">
        {portalStats.map((stat) => (
          <article className="snapshot-card glass-panel" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
