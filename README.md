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
The public documentation portal is designed for GitHub Pages at:

<https://thienng-it.github.io/KobeanREST/>

Users can download and launch KobeanREST without a KobeanREST account, cloud workspace, or server setup. The download guide includes direct macOS, Windows, and Linux links plus command-line download commands.

Build the docs portal locally:

```bash
npm run build:docs
```

## Planning

The tracked build plan lives in [docs/implementation-roadmap.md](docs/implementation-roadmap.md).
Agent-facing implementation rules live in [docs/agent-rules.md](docs/agent-rules.md).
