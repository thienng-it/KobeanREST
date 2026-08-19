# 🧪 Testing & Quality Assurance (SDET Engineering Specification)

Quality assurance in KobeanREST follows a rigorous multi-tier test pyramid. Every pull request and release build must pass automated contract tests, end-to-end GUI flows, and automated secret leak audits prior to release artifact generation.

---

## 🏛️ Test Automation Pyramid

```
                       ┌──────────────────────────────┐
                       │   End-to-End GUI Testing     │  CodeceptJS + Playwright
                       │  (Desktop Rendered Interface) │  (tests/e2e/kobeanrest_e2e_test.cjs)
                       └──────────────┬───────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              │      Node.js Native Contract Test Suite       │  Native Node Test Runner
              │      (37 Specialized Test Modules)            │  (tests/*.test.mjs)
              └───────────────┬───────────────────────────────┘
                              │
    ┌─────────────────────────┴─────────────────────────┐
    │     Native Rust Compilation & Security Scans      │  Cargo Check & Betterleak
    │  (http_client, persistence, check-secrets script) │  (src-tauri & scripts/)
    │  (tests/persistence-contract.test.mjs)            │
    └───────────────────────────────────────────────────┘
```

---

## 📋 Comprehensive Contract Test Suite Matrix

Executed natively via Node.js test runner (`npm test`):

| Test Suite Module | Target Subsystem | Core Verified Invariants |
| :--- | :--- | :--- |
| `workspaces-manager-contract.test.mjs` | Workspaces Hub | Workspace CRUD, switching, metric calculation, import/export. |
| `collections-manager-contract.test.mjs` | Collections Hub | Visual collection grid, overview state, duplicate/export flow. |
| `collection-lock-contract.test.mjs` | Collection Security | Passcode encryption, session unlocking, and locked UI state. |
| `docs-tab-and-import-contract.test.mjs` | Docs Editor | Integrated Markdown editor, live API documentation generator. |
| `path-variables-contract.test.mjs` | Path Variables | `:param` and `{param}` extraction, table editing, URL interpolation. |
| `bulk-edit-contract.test.mjs` | Bulk Params | Bi-directional toggle between raw text block and structured table. |
| `grpc-contract.test.mjs` | gRPC Client | Protobuf file parsing, service reflection, streaming UI modes. |
| `websocket-socketio-contract.test.mjs` | WebSockets / Socket.IO | Real-time connection management, custom event emitter, streaming log. |
| `universal-import-contract.test.mjs` | Universal Import | Postman v2.1, OpenAPI/Swagger 2/3, Insomnia v4, and cURL parsers. |
| `ai-chat-session-manager-contract.test.mjs` | AI Copilot | Local Ollama streaming, chat session management, prompt generation. |
| `api-auth-contract.test.mjs` | Auth Engine | Bearer, Basic, API Key, and OAuth PKCE browser injection formats. |
| `auto-update-contract.test.mjs` | Updater Engine | Ed25519 signature validation & universal macOS manifest parsing. |
| `docs-site-contract.test.mjs` | Docs Portal | Documentation site build, routing integrity, and static assets. |
| `editable-ui-contract.test.mjs` | UI Components | Keyboard shortcuts, tab focus states, bi-directional query param sync. |
| `environment-editor-contract.test.mjs` | Env Manager | Active environment state persistence, color badge tags & scope mutations. |
| `history-viewer-contract.test.mjs` | History Panel | Automatic masking of sensitive query params & auth tokens in logs. |
| `import-export-contract.test.mjs` | Interop Engine | Postman Collection v2.1 import/export structure & cURL parsing. |
| `local-only-contract.test.mjs` | Local Core | Assures zero telemetry and zero unprompted outbound network connections. |
| `multiple-workspace-contract.test.mjs` | Workspace Switcher | Workspace data isolation & SQLite schema context switching. |
| `native-readiness-contract.test.mjs` | Tauri Shell | Cargo lockfile pinning, platform icons, Xcode setup verification. |
| `persistence-contract.test.mjs` | Rust Persistence | SQLite schema DDL execution, CRUD operations, transaction safety. |
| `release-hardening-contract.test.mjs` | Release Security | SHA256 checksum generation & updater key validation. |
| `release-operations-contract.test.mjs` | GitHub Pipeline | Tagged release deployment flows & release bundle packaging. |
| `release-preflight-contract.test.mjs` | Preflight Verification| Validates public key configuration & build script readiness. |
| `rest-client-contract.test.mjs` | HTTP Engine | HTTP method execution (GET/POST/PUT/DELETE) & state mapping. |
| `secret-storage-contract.test.mjs` | Keychain Vault | OS Keychain isolation & placeholder redaction filters (`[SECRET:id]`). |
| `security-privacy-contract.test.mjs` | Security Audit | Source code scanning via `Betterleak` (`npm run check:secrets`). |
| `settings-contract.test.mjs` | App Settings | Theme loading across 10+ themes, auto-update toggle, font size. |
| `variable-resolution-contract.test.mjs` | Variable Engine | Scoped resolution (`{{VAR}}`) & `UnresolvedVariableError` handling. |

---

## 🎭 End-to-End GUI Automation Suite

Driven by **CodeceptJS** and **Playwright** (`npm run test:e2e`):
- **Test File:** [tests/e2e/kobeanrest_e2e_test.cjs](file:///Users/josephnguyen/Desktop/KobeanREST/tests/e2e/kobeanrest_e2e_test.cjs)
- **Configuration:** [codecept.conf.cjs](file:///Users/josephnguyen/Desktop/KobeanREST/codecept.conf.cjs)
- **Automated User Flows:**
  1. Application initialization & local database bootstrapping.
  2. Workspace creation, collection addition, folder nested navigation.
  3. URL entry, parameter synchronization, and header manipulation.
  4. Request dispatch and response pane rendering (headers, status, time, WASM JQ transformation).
  5. Environment variable declaration, color badge assignments, and live scope resolution.
  6. AI Copilot sidebar toggling and response simulation.
  7. Theme switching across all 10+ high-contrast desktop themes.

---

## ⚙️ GitHub Actions CI/CD Pipeline Automation

> [!NOTE]
> All CI/CD workflows are located in `.github/workflows/`.

| Workflow File | Trigger Event | Operational Responsibilities |
| :--- | :--- | :--- |
| `release.yml` | Tag push (`v*.*.*`) | Compiles signed production bundles for macOS (`.dmg`), Windows (`.msi`), Linux (`.AppImage`, `.deb`), computes SHA256 hashes, generates updater manifests. |
| `nightly-release.yml` | Cron (00:00 UTC) / Manual | Builds nightly release binaries and publishes artifacts to GitHub Releases. |
| `daily-e2e-tests.yml` | Cron / PR / Push | Runs headless Playwright E2E automation against pull requests. |
| `sensitive-data.yml` | PR / Push | Scans commit diffs for exposed credentials using `Betterleak` (`npm run check:secrets`). |
| `docs-site.yml` | Push to `main` | Builds and deploys documentation portal to GitHub Pages (`pages` concurrency group). |

---

## 🛠️ Verification Execution Toolkit

```bash
# 1. Execute all Node.js contract tests
npm test

# 2. Run CodeceptJS / Playwright E2E GUI test suite
npm run test:e2e

# 3. Perform Betterleak security & secret leak audit
npm run check:secrets

# 4. Execute release preflight verification audit
npm run check:release

# 5. Push updated documentation to GitHub Wiki
npm run push:wiki
```
