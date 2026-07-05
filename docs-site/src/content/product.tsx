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
        "Build, save, and replay HTTP requests from a local workspace.",
        "Use target API authentication such as Basic Auth, Bearer tokens, OAuth 2.0-style bearer tokens, API keys, cookies, and client certificates where supported by request configuration.",
        "Keep workspace data local by default instead of requiring cloud sync.",
      ],
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
