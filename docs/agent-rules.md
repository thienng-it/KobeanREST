# AI Agent Rules

These rules are for agents working on KobeanREST. Keep changes aligned with the local-only product contract.

## Non-Negotiable Product Rules

- Do not add KobeanREST login, logout, registration, user profiles, cloud sessions, or required backend services.
- Do not add app-user authentication providers.
- Do not add account tables, session tables, or JWT session models.
- API request authentication is allowed because users need it for target APIs.
- The app must remain useful after download and offline launch.
- Networking must be optional except when the user sends a request or chooses to check for updates.

## Local Data Rules

- Store workspace data in SQLite.
- Store sensitive values outside SQLite.
- SQLite may store only redacted placeholders and secret references for sensitive values.
- Exports must redact secrets by default.
- History, logs, diagnostics, and error messages must not reveal secrets.
- Treat URL query values, authorization headers, cookie headers, API key headers, and request bodies as potentially sensitive.

## Documentation Rules

- Public docs must describe KobeanREST features, installation, local storage, updates, security, and troubleshooting.
- Public docs must not describe personal local workflow tooling.
- Public docs must not imply a hosted account system exists.
- Docs should link to GitHub Releases for public downloads.
- Docs should clearly say the app is no-account and local-first.

## Implementation Rules

- Follow the existing Tauri 2 + Rust + React/Vite/TypeScript structure.
- Prefer small focused services over large mixed-responsibility files.
- Add tests before implementing behavior changes.
- Keep browser preview behavior working where practical.
- Keep native behavior authoritative for desktop runtime.
- Do not introduce speculative cloud sync, team collaboration, scripting runners, GraphQL, WebSocket, SSE, gRPC, or plugin marketplace work during the MVP phases.

## Current Execution Priority

1. Implement the next pending phase from `docs/implementation-roadmap.md`.
2. Verify with the standard commands in the roadmap.
3. Update the roadmap status after each completed phase.
4. Keep docs and product claims synchronized with actual code.

## Git Rules

- Do not commit or push unless the user explicitly asks.
- Do not stage unrelated workspace files.
- Do not revert user changes unless the user explicitly asks.
- Treat untracked files as intentional project work unless clearly generated output.

## Verification Rules

Run at minimum:

```bash
npm test
npm run build
source /Users/josephnguyen/.cargo/env && npm run check:native
source /Users/josephnguyen/.cargo/env && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

Before release work, run the local source/config secret scan configured on the developer machine. Do not scan `node_modules`, `dist`, `src-tauri/target`, or other generated output.
