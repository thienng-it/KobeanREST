# KobeanREST

KobeanREST is a local-first desktop API client for REST and standard HTTP workflows. It is built for people who want a fast native app, local workspace ownership, and no hosted account requirement.

## Product Contract

- Download the app.
- Launch it locally.
- Build, send, save, import, and export REST requests from your machine.
- Use it without a KobeanREST account, cloud workspace, hosted authentication service, or required backend.

API request authentication remains in scope. Basic Auth, Bearer Token, API Key, OAuth 2.0, cookies, and client certificates authenticate requests to target APIs, not users into KobeanREST.

## Public Links

- Documentation portal: <https://thienng-it.github.io/KobeanREST/>
- Downloads: [docs/download.md](docs/download.md)
- Release operations: [docs/release-operations.md](docs/release-operations.md)
- Implementation roadmap: [docs/implementation-roadmap.md](docs/implementation-roadmap.md)
- Release QA checklist: [docs/release-qa.md](docs/release-qa.md)

## Highlights

- Native desktop shell with Tauri 2.
- React, Vite, and TypeScript renderer.
- Rust native core for local persistence and desktop integrations.
- SQLite-backed workspaces, collections, requests, environments, and history.
- OS keychain-backed secret storage with encrypted vault fallback support.
- Export/import flow that redacts secret values by default.
- Optional signed updater flow using public GitHub Release metadata.
- Public GitHub Pages documentation portal with multi-page product, download, developer, release, roadmap, and QA docs.
- Betterleak sensitive-data policy checked in CI through `npm run check:secrets`.

## Downloads

Installers are published through GitHub Releases and linked from the docs portal:

<https://github.com/thienng-it/KobeanREST/releases/latest>

The download guide includes direct macOS, Windows, and Linux links, terminal download commands, checksum verification, and first-run notes for Gatekeeper, SmartScreen, and Linux AppImage permissions.

## Architecture

| Layer | Responsibility |
| --- | --- |
| Tauri 2 shell | Native desktop window, updater plugin, OS integration |
| Rust core | SQLite persistence, command handlers, keychain-backed secrets |
| React renderer | Request builder, environments, history, settings, update UI |
| Docs site | Public GitHub Pages portal built from `docs-site/` |
| CI | Tests, docs build, release preflight, and Betterleak sensitive-data scan |

## Development

Install dependencies:

```bash
npm install
```

Run the web renderer:

```bash
npm run dev
```

Run the desktop shell:

```bash
npm run tauri dev
```

Run the standard verification set:

```bash
npm test
npm run build
npm run build:docs
npm run check:secrets
npm run check:release
```

## Documentation Portal

The public documentation portal lives in `docs-site/` and is built for GitHub Pages.

```bash
npm run build:docs
```

GitHub Pages deployment is handled by `.github/workflows/docs-site.yml`.

## Security And Sensitive Data

KobeanREST is designed so local workspace data stays local and raw secrets do not land in normal exports.

Sensitive-data scanning is configured by `.betterleak` and executed by:

```bash
npm run check:secrets
```

CI runs the same scan in `.github/workflows/sensitive-data.yml`. The policy intentionally skips generated output and dependency directories such as `node_modules`, `dist`, `docs-site/dist`, and `src-tauri/target`.

## Release

Release builds are produced by `.github/workflows/release.yml` from version tags. The release workflow builds macOS DMG, Windows MSI, Linux AppImage, Linux deb, updater metadata, and SHA256 checksums.

Before tagging a release, run:

```bash
npm test
npm run build
npm run build:docs
npm run check:secrets
npm run check:release
```

Operational release details are documented in [docs/release-operations.md](docs/release-operations.md).

## Project Rules

Agent-facing implementation rules live in [docs/agent-rules.md](docs/agent-rules.md). Product behavior, release status, and completed phases are tracked in [docs/implementation-roadmap.md](docs/implementation-roadmap.md).
