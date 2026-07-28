# ⚡ Welcome to the KobeanREST Wiki

**KobeanREST** is a high-performance, privacy-focused, local-first desktop API client engineered for modern REST and HTTP workflows. Powered by **Tauri 2**, **Rust**, and **React 18 / TypeScript**, KobeanREST delivers zero forced cloud sync, native desktop speed, and native OS Keychain secret security.

---

## 🧭 Navigating the Wiki

This wiki provides comprehensive technical, product, and QA documentation from the perspective of Principal Software Architecture, Senior Product Ownership, and Senior Software Development Engineering in Test (SDET).

### 📐 [Architecture & Systems Engineering](Architecture-Overview)
- **Hybrid Desktop Architecture:** Tauri v2 Rust backend bridge & React 18 web renderer.
- **Persistence & Storage:** Embedded SQLite schema, migrations, and local workspace management.
- **Security & Secret Protection:** OS Keychain integration, Stronghold Argon2 encryption, and log redaction.
- **Execution Pipeline:** Dynamic variable scoping hierarchy, JS sandbox, and WebAssembly JQ query engine.

### 🎯 [Product Vision & Roadmap](Product-Vision-and-Features)
- **Local-First Contract:** 100% offline ownership, zero telemetry, zero forced account registration.
- **Feature Matrix:** Workspace isolation, dynamic environment variables, bi-directional query param sync, pre/post request scripts, response JQ filtering, and cURL/Postman import/export.
- **Competitive Advantage:** Direct comparison against Postman, Insomnia, and Bruno.
- **Release Strategy:** Nightly releases and automated updater manifest publishing.

### 🧪 [Testing & Quality Assurance (SDET)](Testing-and-Quality-Assurance)
- **Test Pyramid:** 127 node contract tests + CodeceptJS/Playwright end-to-end automation.
- **CI/CD Quality Gates:** GitHub Actions pipelines (`release.yml`, `nightly-release.yml`, `daily-e2e-tests.yml`, `sensitive-data.yml`).
- **Release Preflight & Security Scans:** Automated secret leakage scanning with `check-secrets.mjs` and release preflight verification.

### 🛠️ [Developer Guide & Setup](Developer-Guide-and-Setup)
- **Environment Setup:** Node.js 22+, Rust toolchain, and platform build dependencies.
- **Development Workflows:** Dev server (`npm run dev`), native desktop dev (`npm run tauri dev`), and test execution commands.
- **Packaging & Builds:** Generating standalone installers for macOS (.dmg), Windows (.msi), and Linux (.AppImage/.deb).

### 🔌 [API & IPC Reference](API-and-IPC-Reference)
- **Tauri IPC Command Registry:** Complete map of Rust backend commands and TypeScript service calls.
- **Database Schema:** SQLite table definitions for workspaces, environments, collections, requests, and history.
- **Scripting Shim API:** `pm.*` Postman-compatible scripting reference.

### 🛡️ [Security & Privacy Blueprint](Security-and-Privacy)
- **Zero-Telemetry Model:** Architectural guarantee of local-only data processing.
- **Cryptographic Auto-Updater:** Ed25519 public key verification for signed release binaries.

---

## 📊 KobeanREST at a Glance

| Parameter | Specification |
| :--- | :--- |
| **Desktop Shell** | Tauri 2.0 |
| **Backend Core** | Rust 2021 Edition (Tokio, Reqwest, Rusqlite, Keyring) |
| **Frontend Renderer** | React 18, TypeScript 5, Vite 7 |
| **Local Database** | Embedded SQLite (`001_initial.sql`) |
| **Query Engine** | WebAssembly `jq.wasm` |
| **Secret Storage** | OS Keychain / Native Keyring (`secrets.rs`) |
| **Test Automation** | 127 Node Contract Tests + CodeceptJS / Playwright E2E |
| **CI/CD Platform** | GitHub Actions |

---

> 💡 **Repository Link:** [thienng-it/KobeanREST](https://github.com/thienng-it/KobeanREST)  
> 🌐 **Documentation Site:** [thienng-it.github.io/KobeanREST](https://thienng-it.github.io/KobeanREST/)
