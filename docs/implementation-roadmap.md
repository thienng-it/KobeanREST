# KobeanREST Implementation Roadmap

This roadmap tracks what is already built, what must be built next, and what must stay out of scope. KobeanREST is a local-only desktop REST client: download, launch, use. There is no KobeanREST account system.

## Product Boundaries

- No app login, logout, registration, hosted identity service, user profile, cloud session, or required backend.
- API request authentication remains in scope because users need to authenticate to target APIs.
- Local data lives in SQLite.
- Sensitive values must stay outside SQLite in OS keychain or encrypted vault style storage.
- The app must remain usable offline after installation.
- Update checks must be optional, signed, and user-controlled.
- Public downloads are distributed through GitHub Releases and linked from docs.

## Completed Phases

### Phase 1A: Native Desktop Readiness

Status: complete.

Built:
- Tauri 2 desktop shell.
- Rust toolchain pin.
- Cargo lockfile.
- Required app icon.
- Native verification scripts.
- Stronghold-style secret storage setup.
- Native readiness docs.

Verification:
- `npm test`
- `npm run build`
- `npm run check:native`
- `cargo fmt --check`

### Phase 1B: Native REST Execution

Status: complete.

Built:
- Native Rust `execute_http_request` command.
- Request timeout and redirect options.
- Response status, headers, body, duration, size, and content type.
- Browser preview fallback for non-Tauri development.
- Request builder UI send flow.

Known limitation:
- Variables such as `{{baseUrl}}` are not resolved yet.

### Phase 1C: SQLite Persistence

Status: complete.

Built:
- Initial SQLite migration.
- Local workspace seed data.
- Native commands:
  - `initialize_persistence`
  - `load_workspace`
  - `record_request_history`
- Renderer local store service.
- App startup workspace loading.
- Successful request history recording.

### Phase 1D: Secure Secret Boundary

Status: complete.

Built:
- Native secret module.
- OS keychain-backed `store_secret` and `delete_secret` commands.
- `secret_ref` metadata in SQLite.
- Secret placeholders in workspace data.
- Renderer secret bridge.

Rule:
- SQLite may store redacted placeholders and secret references, never raw secret values.

## Next Phases

### Phase 1E: Environment Variable Resolution

Status: complete.

Built:
- `src/renderer/src/services/variables.ts` variable resolution service.
- `resolveString` substitutes `{{variableName}}` references from the active environment.
- `resolveRequestVariables` resolves URL, headers, and body.
- `UnresolvedVariableError` stops execution when variables remain unresolved.
- `activeEnvironmentVariables` reads from `workspace.activeEnvironment`.
- `buildVariableMap` excludes secret variables with `secretRef` to prevent leaking redacted placeholders.
- Send flow resolves variables before calling `execute_http_request`.
- Error state no longer shows stale `200 Preview OK`; shows `Request failed` with the error message.
- Resolved URLs are recorded in request history instead of raw template strings.

Tests:
- `tests/variable-resolution-contract.test.mjs` (8 tests).

Verification:
- `npm test` (29 pass)
- `npm run build`
- `npm run check:native`
- `cargo fmt --check`

### Phase 1F: Import and Export

Status: complete.

Goal:
Allow portable local workspace files without leaking secrets.

Built:
- Native export service (`export_workspace_data`) that extracts collections, folders, requests, environments, variables.
- Secrets are explicitly redacted during export (`variable_value` mapped to a placeholder if `secret != 0`).
- Settings and request_history are intentionally excluded.
- Native import service (`import_workspace_data`) that accepts valid JSON.
- Import uses transactions and UUID generation to append incoming workspaces without overwriting existing local IDs.
- Validates file shape by requiring `version: 1`.

Tests:
- Export excludes raw secret values.
- Export includes requests, folders, environments, and non-secret variables.
- Import rejects malformed files.
- Import round trip preserves non-secret workspace data.

### Phase 1G: Editable Workspace UI

Status: complete.

Goal:
Move from sample/read-only workspace data to a usable local editor.

Build:
- Create, edit, duplicate, and delete requests.
- Create, rename, reorder, and delete folders.
- Edit method, URL, headers, body, auth mode, timeout, and redirect options.
- Persist edits to SQLite.
- Keep keyboard and mouse workflows predictable.

Tests:
- Request edits persist after reload.
- Folder changes persist after reload.
- Delete actions do not orphan related rows.
- UI does not lose unsaved edits silently.

### Phase 1H: Environment Editor

Status: complete.

Goal:
Let users manage environments and variables locally.

Built:
- Native commands: `create_environment`, `rename_environment`, `delete_environment`, `set_active_environment`.
- Native commands: `save_variable`, `delete_variable`, `save_secret_variable`.
- `save_secret_variable` accepts only a `secret_ref` (never a raw value); stores `REDACTED_SECRET_VALUE` in SQLite.
- Renderer service functions in `local-store.ts` for all environment and variable commands.
- Active environment selector dropdown in the sidebar.
- "Manage" button opens environment editor modal.
- Environment editor: list with active indicator, New/Rename/Delete per environment.
- Variable table: inline display, Add Variable row with key/value/secret inputs.
- Secret variables shown as placeholder; writes go through `storeSecret` then `saveSecretVariable`.

Tests:
- Rust native core exposes all environment editing commands.
- Secret variable command stores only a ref, never a raw secret value.
- Frontend API client invokes all native environment commands.
- App.tsx implements environment editor state management.
- Secret variable writes go through the secret service boundary.

Verification:
- `npm test` (43 pass)

### Phase 1I: API Request Authentication

Status: complete.

Goal:
Support authentication to target APIs without introducing KobeanREST user accounts.

Built:
- `AuthConfig` interface in `types.ts` — `username`, `password`, `token`, `keyName`, `keyValue`, `placement`.
- `authConfig` field on `SavedRequest`; stored as JSON in a new `auth_config` TEXT column on the requests table.
- `ensure_auth_config_column` migrates existing databases without data loss.
- `src/renderer/src/services/auth.ts` — `resolveAuthConfig`, `applyAuth`, `redactAuthFromUrl`, `redactAuthHeaders`.
- Auth credential values may contain `{{variable}}` references resolved through the existing variable system.
- `applyAuth` injects `Authorization: Basic …` (Basic), `Authorization: Bearer …` (Bearer/OAuth 2.0), named header or query param (API Key).
- Send flow: resolves auth config → injects auth → sends → redacts API-key query params before history recording.
- Auth tab UI updated: mode selector (now includes None) + per-mode credential fields (username/password, token, key name/value/placement).

Tests:
- Auth service exports injection and redaction helpers.
- `applyAuth` injects correct headers for each mode.
- Auth values resolve through variable map.
- API key query params are redacted from URL before history recording.
- App.tsx send flow applies auth after variable resolution.
- `SavedRequest` includes `authConfig`; Rust persistence stores `auth_config`.
- Auth tab UI shows per-mode credential fields.

Verification:
- `npm test` (51 pass)

### Phase 1J: History Viewer

Status: complete.

Goal:
Make local request history visible and useful.

Built:
- `HistoryEntry` struct in Rust with `id`, `request_id`, `method`, `url`, `status`, `duration_ms`, `size_bytes`, `created_at`.
- `load_request_history` — queries last 200 entries ordered by most recent.
- `clear_request_history` — deletes all history rows for the workspace.
- `HistoryEntry` TypeScript interface in `types.ts`.
- `loadHistory` and `clearHistory` service functions in `local-store.ts`.
- History button in the topbar opens the history modal.
- History modal: status badge (color-coded), method, URL, duration, size, timestamp per row.
- Inline search filter by URL or method.
- "Clear all" button wipes history from SQLite and clears local state.
- Replay button selects the matching saved request (disabled if the request was deleted).
- Auth query params already redacted in URLs before history recording (Phase 1I).

Tests:
- Rust core exposes `load_request_history` and `clear_request_history`.
- `HistoryEntry` includes all display fields.
- Frontend service invokes both commands.
- App.tsx implements history state, open/clear/replay handlers.
- Clear handler empties local state; replay selects by request ID.
- Successful requests continue to create history rows.

Verification:
- `npm test` (57 pass)

### Phase 1K: Settings

Status: complete.

Goal:
Expose local app preferences without accounts.

Built:
- Native `load_app_settings` and `save_app_settings` commands backed by the existing SQLite `settings` table.
- Privacy-preserving default settings: automatic update checks off, theme set to system, export redaction on, diagnostics redaction on, offline behavior set to stay quiet.
- Renderer settings service with Tauri commands plus browser preview fallback state.
- Settings modal wired from the top bar with update check preference, theme preference, data location display, export redaction preference, diagnostics redaction preference, and offline behavior settings.
- Theme application via document theme and color-scheme updates for light, dark, and system modes.
- Manual "Check updates" action now runs through the signed update metadata preview command.
- Automatic update checks are gated by the saved preference and only run after launch when enabled.

Tests:
- `tests/settings-contract.test.mjs` verifies native commands, renderer service wiring, settings UI state, theme application, and automatic update check gating.

Verification:
- `npm test` (62 pass)
- `npm run build`
- `source /Users/josephnguyen/.cargo/env && npm run check:native`
- `source /Users/josephnguyen/.cargo/env && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

### Phase 1L: Auto Update Flow

Status: complete.

Goal:
Implement signed, optional app updates.

Built:
- Renderer updater service in `src/renderer/src/services/updater.ts` using `@tauri-apps/plugin-updater`.
- Launch-time update checks remain gated by the saved settings preference.
- Manual update checks now look for a newer signed update and report when none is available.
- User-controlled update prompt shows current version, target version, release notes, and signed-metadata messaging.
- Install action downloads and installs through the Tauri updater plugin while reporting progress.
- Offline updater failures remain non-blocking and preserve the local-only app flow.
- Real updater public key committed to `src-tauri/tauri.conf.json`.
- Signed `latest.json` published with GitHub Release `v0.1.1`.

Reference:
- `docs/release-operations.md`

Tests:
- `tests/auto-update-contract.test.mjs` verifies the updater service, signed-update prompt flow, install action wiring, and the remaining signed-release verification requirement.

Verification:
- `npm test` (81 pass)
- `npm run build`
- `source /Users/josephnguyen/.cargo/env && npm run check:native`
- `source /Users/josephnguyen/.cargo/env && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

### Phase 1M: Packaging and Release Hardening

Status: complete.

Goal:
Build downloadable desktop artifacts for all target platforms.

Build:
- macOS `.dmg`.
- Windows `.msi`.
- Linux `.AppImage`.
- Optional Linux `.deb`.
- Checksums.
- Release metadata.
- Signing configuration where available.

Built:
- Release workflow builds signed draft releases through `tauri-action`.
- Platform bundle files are collected as workflow artifacts after each matrix build.
- The checksum job downloads those bundle files, generates `SHA256SUMS.txt`, and uploads it to the draft GitHub release.
- Download docs match the current Windows `.msi` release output.
- Windows libsodium dependency resolved via `vcpkg install libsodium:x64-windows-static-md`.
- Full icon set generated for all platforms (`icons/icon.ico`, `icons/icon.icns`, sized PNGs).
- `gh release upload` in the checksums job passes `--repo` to work without a git checkout.
- GitHub Release `v0.1.1` published with macOS DMG, Windows MSI, Linux AppImage and deb, signed `.sig` files, `latest.json`, and `SHA256SUMS.txt`.

Reference:
- `docs/release-operations.md`

Tests:
- macOS artifact builds.
- Windows artifact builds.
- Linux artifact builds.
- Checksums match artifacts.
- Docs links match release artifact names.

### Phase 1N: Download Docs Finalization

Status: complete.

Goal:
Make download docs accurate for public users.

Build:
- Latest release links.
- OS-specific install instructions.
- Checksum verification notes.
- No-account-required explanation.
- Offline-use explanation.
- Update behavior explanation.

Built:
- `docs/download.md` now points users to the latest GitHub Release page.
- Added macOS, Windows, and Linux install steps for the current release artifacts.
- Added checksum verification commands for macOS, Linux, and Windows against `SHA256SUMS.txt`.
- Clarified that KobeanREST does not require an account and remains usable offline.
- Clarified that update checks are optional, signed, and user-controlled from app settings.

Tests:
- Docs mention all supported platforms.
- Docs do not mention app-user login.
- Docs links match release workflow output.

### Phase 1O: Security and Privacy Hardening

Status: complete.

Goal:
Verify the local-only privacy contract before release.

Build:
- Redaction helpers for logs, exports, history, and diagnostics.
- Repository-wide check for accidental app-user auth surfaces.
- Source/config secret scan before release.
- Confirm secret values never land in SQLite.

Built:
- Export redaction remains enforced for secret variables before workspace data leaves SQLite.
- History recording continues to redact auth query params before request URLs are stored.
- Renderer diagnostics now pass error details through a shared redaction helper before logging or showing alerts.
- Added a repo-local `npm run check:secrets` source/config scan that skips generated output and looks for common private key and token leaks.
- Release preflight command before tagging: added repo-local `npm run check:release` so release wiring fails fast if the updater public key is still a placeholder or the release workflow no longer references signed metadata outputs.
- Existing local-only contract checks continue to block app-user auth routes, session surfaces, and account dependencies.

Verification:
- `npm run check:secrets`
- `npm test`
- `npm run build`
- `source /Users/josephnguyen/.cargo/env && npm run check:native`
- `source /Users/josephnguyen/.cargo/env && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

Tests:
- No auth routes, auth screens, user tables, sessions, or account dependencies.
- Raw secrets are absent from SQLite exports.
- Logs and diagnostics redact secrets by default.
- Security scan has no actionable leaks.

### Phase 1P: End-to-End QA

Status: complete.

Goal:
Verify the app works like a real local desktop product.

Build:
- Desktop launch smoke test.
- Offline launch test.
- Valid request send test.
- Failed request UX test.
- Save/reopen persistence test.
- Import/export round trip test.
- Update offline failure test.
- Installer smoke tests.

Built:
- Added `docs/release-qa.md` as the release QA checklist for manual desktop verification.
- The checklist covers launch, offline behavior, valid and failed requests, persistence after restart, import/export round trip, update failure handling, and installer smoke tests.
- The checklist explicitly uses a reachable API override because the seeded sample URLs remain placeholders.

Verification:
- `node --test tests/end-to-end-qa-contract.test.mjs`
- `npm run check:secrets`
- `npm test`
- `npm run build`
- `source /Users/josephnguyen/.cargo/env && npm run check:native`
- `source /Users/josephnguyen/.cargo/env && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

Reference:
- `docs/release-qa.md`

Tests:
- Fresh install launches without an account.
- App remains usable offline.
- Workspace data persists after restart.
- Secrets remain outside SQLite.
- All platform artifacts install or launch.

## Current Known Issues

- Sample URLs point at placeholder domains. After variable resolution, a native request may fail due to DNS or network unless the user changes the environment to a reachable API.

## Standard Verification

Run these after implementation work:

```bash
npm test
npm run build
source /Users/josephnguyen/.cargo/env && npm run check:native
source /Users/josephnguyen/.cargo/env && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

Before release work, run the local source/config secret scan configured on the developer machine. Do not scan generated build output, dependency folders, or native target folders.
