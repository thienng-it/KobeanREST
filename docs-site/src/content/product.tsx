import type { DocsPageContent } from "./shared";

export const productContent: DocsPageContent = {
  eyebrow: "Product",
  title: "A local-first desktop REST client.",
  description:
    "KobeanREST is built for standard HTTP workflows without a KobeanREST account, hosted workspace, or required backend service.",
  sections: [
    {
      id: "overview",
      title: "What KobeanREST is",
      intro:
        "KobeanREST is a desktop API client for REST and HTTP workflows. Users download the app, launch it locally, and use it without creating an account.",
      items: [
        "Build, save, and replay HTTP requests from a local workspace with advanced tabbed UI and visual indicators.",
        "Execute entire collections sequentially with comprehensive run history and results tracking.",
        "Manage URL query parameters (`Params`) with real-time bi-directional synchronization to the URL bar.",
        "Use target API authentication such as Basic Auth, Bearer tokens, OAuth 2.0-style bearer tokens, API keys, cookies, and client certificates where supported by request configuration.",
        "Refined high-density desktop UI with clean focus rings, sleek table inputs, and variable autocompletion.",
        "Monitor automated test results using the built-in QA Dashboard with real-time analytics and telemetry drilldown.",
        "Keep workspace data local by default instead of requiring cloud sync.",
      ],
    },
    {
      id: "gallery",
      title: "Feature Gallery",
      intro: "Explore the core capabilities of KobeanREST.",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginTop: "1.5rem" }}>
          <div>
            <img src="images/environment-editor.png" alt="Environment Editor" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Local Environment & Variables Editor: Keep secrets safe in your native OS keychain.</p>
          </div>
          <div>
            <img src="images/scripts-tab.png" alt="Pre & Post Request Scripts" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Pre & Post Request Scripts: Dynamic execution environment with tests, assertions, and live logs.</p>
          </div>
          <div>
            <img src="images/params-tab.png" alt="Interactive Query Params" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>Interactive Query Params: Real-time bi-directional synchronization with the URL bar.</p>
          </div>
          <div>
            <img src="images/history-viewer.png" alt="Request History" style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }} />
            <p style={{ marginTop: "0.5rem", fontSize: "14px", color: "var(--color-text-muted)", fontStyle: "italic" }}>History Viewer: Detailed logging of past requests and replay functionality.</p>
          </div>
        </div>
      )
    },
    {
      id: "local-first",
      title: "Local-first contract",
      intro:
        "The product boundary is intentionally narrow: KobeanREST has no app-user login, registration flow, hosted identity service, profile, or cloud session.",
      items: [
        "Local workspace data lives in SQLite.",
        "Sensitive values stay outside SQLite through keychain or encrypted vault-style storage.",
        "The app remains usable offline after installation.",
        "Networking happens when the user sends a request or explicitly checks for updates.",
      ],
    },
    {
      id: "privacy",
      title: "Privacy and secrets",
      intro:
        "KobeanREST treats authorization headers, cookies, API keys, URL query values, and request bodies as sensitive surfaces.",
      items: [
        "Exports redact secret variables by default.",
        "History records redacted URLs for auth query parameters.",
        "Diagnostics pass through shared redaction helpers.",
        "SQLite stores secret references and placeholders, not raw secret values.",
      ],
    },
    {
      id: "out-of-scope",
      title: "What is not in scope",
      intro: "The MVP deliberately avoids hosted collaboration features that would change the local-only product contract.",
      items: [
        "KobeanREST user accounts",
        "Cloud sync in the MVP",
        "Team collaboration",
        "Hosted project backend",
        "Runtime plugin marketplace",
      ],
    },
  ],
};
