# 🧪 Testing & Quality Assurance (SDET Guide)

Quality assurance in KobeanREST is built on a multi-tiered test automation framework designed to guarantee desktop reliability, data safety, and performance.

---

## 🏛️ The Test Engineering Pyramid

```
                  ┌──────────────────────┐
                  │   E2E GUI Testing    │  CodeceptJS + Playwright
                  │  (Desktop UI Flows)  │  (tests/e2e/*.cjs)
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │   Contract & Integration Tests   │  Node.js Native Test Runner
            │ (20+ Suited, 127 Test Invariants)│  (tests/*.test.mjs)
            └────────────────┬────────────────┘
                             │
   ┌─────────────────────────┴─────────────────────────┐
   │         Native Rust Unit & Preflight Tests        │  Cargo Test & Preflight
   │     (http_client, persistence, check-secrets)     │  (src-tauri & scripts/)
   └───────────────────────────────────────────────────┘
```

---

## 📋 Test Suites & Coverage Breakdown

### 1. Contract & Domain Invariant Test Suite (`tests/*.test.mjs`)

Executed natively via Node.js test runner (`npm test`):

| Test Suite | Focus Area | Key Verifications |
| :--- | :--- | :--- |
| `api-auth-contract.test.mjs` | Authentication | Basic, Bearer, API Key, and OAuth token resolution. |
| `auto-update-contract.test.mjs` | Auto-Updater | Cryptographic signature validation & manifest parsing. |
| `docs-site-contract.test.mjs` | Documentation | Verifies portal routes, search index, and assets. |
| `editable-ui-contract.test.mjs` | UI Components | Keyboard navigation, tab states, bi-directional query sync. |
| `environment-editor-contract.test.mjs` | Environment Engine | Active environment persistence & variable editing. |
| `history-viewer-contract.test.mjs` | Request History | Redaction of sensitive headers & URL query parameters. |
| `import-export-contract.test.mjs` | Interoperability | Postman v2.1 import/export & cURL parsing integrity. |
| `local-only-contract.test.mjs` | Privacy | Assures zero telemetry & zero external network calls. |
| `multiple-workspace-contract.test.mjs` | Multi-Tenancy | Workspace switching & isolated database states. |
| `native-readiness-contract.test.mjs` | Platform Readiness | Cargo lockfile pinning, Tauri icons, Xcode prerequisites. |
| `persistence-contract.test.mjs` | SQLite Engine | Schema migrations, CRUD operations, transactions. |
| `release-hardening-contract.test.mjs` | Release Security | Checksum generation & updater key protection. |
| `release-operations-contract.test.mjs` | CI Pipelines | Release tagging flow & artifact bundling. |
| `release-preflight-contract.test.mjs` | Pre-Release Audit | Validates public key configuration & build scripts. |
| `rest-client-contract.test.mjs` | Network Engine | HTTP method execution & response state mapping. |
| `secret-storage-contract.test.mjs` | Secret Engine | Keychain isolation & placeholder redaction. |
| `security-privacy-contract.test.mjs` | Security Audit | Betterleak secret scanning & zero plain-text leaks. |
| `settings-contract.test.mjs` | Application Config | Theme loading, auto-update toggle, font size configs. |
| `variable-resolution-contract.test.mjs` | Template Engine | Scoped resolution (`{{var}}`) & exception handling. |

### 2. End-to-End GUI Automation Suite (`tests/e2e/`)

Driven by CodeceptJS and Playwright runner (`npm run test:e2e`):
- Launches application renderer.
- Simulates user interactions: workspace creation, collection creation, request execution, query param editing, theme switching.
- Verifies DOM states, visual layouts, and response rendering.

---

## ⚙️ CI/CD Quality Automation Pipelines

Defined in `.github/workflows/`:

| Workflow File | Trigger | Responsibility |
| :--- | :--- | :--- |
| `release.yml` | Tag push (`v*.*.*`) | Builds signed multi-platform installers (macOS, Windows, Linux), computes SHA256 checksums, updates updater manifest. |
| `nightly-release.yml` | Daily Schedule / Workflow Dispatch | Automates daily nightly releases with latest commit state. |
| `daily-e2e-tests.yml` | Daily Schedule (00:00 UTC) | Headless E2E test execution using Playwright on push and pull requests. |
| `sensitive-data.yml` | Push / Pull Request | Secret leak detection using `Betterleak` (`npm run check:secrets`). |
| `docs-site.yml` | Push to `main` | Builds and deploys documentation portal to GitHub Pages. |

---

## 🛠️ Executing QA Verification Locally

```bash
# Run all 127 Node.js contract tests
npm test

# Run End-to-End GUI test suite
npm run test:e2e

# Run security & secret leak detection scan
npm run check:secrets

# Run release preflight audit
npm run check:release

# Verify Rust native core compilation
npm run check:native
```
