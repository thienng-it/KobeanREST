import { BrandIcon, navItems, releasesUrl, repoUrl, type SiteRoute } from "../site";

interface AppShellProps {
  activeRoute: SiteRoute;
  children: React.ReactNode;
}

export function AppShell({ activeRoute, children }: AppShellProps) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand-link" href="#/" aria-label="KobeanREST docs home">
          <span className="brand-mark">
            <BrandIcon size={21} />
          </span>
          <span>
            <strong>KobeanREST</strong>
            <small>Documentation</small>
          </span>
        </a>
        <nav className="global-nav" aria-label="Primary navigation">
          {navItems.slice(1).map((item) => (
            <a className={activeRoute === item.route ? "active" : ""} href={item.href} key={item.route}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a href={repoUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="button-link" href={releasesUrl} target="_blank" rel="noreferrer">
            Download
          </a>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span>KobeanREST is local-first: no app account, no hosted workspace, no required backend.</span>
        <a href={repoUrl} target="_blank" rel="noreferrer">
          View repository
        </a>
      </footer>
    </div>
  );
}
