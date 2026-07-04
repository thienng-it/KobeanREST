# KobeanREST

KobeanREST is a local-first desktop API client for REST and standard HTTP workflows.

The product contract is intentionally simple:

- Download the app.
- Launch it locally.
- Use it without an account.

There is no KobeanREST login, registration, hosted authentication service, or required backend. API request authentication such as Basic Auth, Bearer Token, API Key, OAuth 2.0, cookies, and client certificates remains in scope because those authenticate requests to target APIs.

## Stack

- Desktop shell: Tauri 2
- Native core: Rust
- Frontend: React, Vite, TypeScript
- Local persistence: SQLite via the native core
- Secret storage: operating-system keychain first, encrypted vault fallback
- Updates: signed Tauri updater metadata from public release artifacts

## Development

```bash
npm install
npm test
npm run dev
```

Run the desktop shell after dependencies are installed:

```bash
npm run tauri dev
```

## Downloads

Public downloads are published through GitHub Releases and linked from [docs/download.md](docs/download.md).

## Planning

The tracked build plan lives in [docs/implementation-roadmap.md](docs/implementation-roadmap.md).
Agent-facing implementation rules live in [docs/agent-rules.md](docs/agent-rules.md).
