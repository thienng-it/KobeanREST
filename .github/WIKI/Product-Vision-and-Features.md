# 🎯 Product Vision & Feature Matrix

KobeanREST is built for developers who demand speed, privacy, and full control over their API test suits without corporate cloud surveillance or forced logins.

---

## 📜 The Local-First Manifesto

1. **Zero Forced Registration:** No mandatory user accounts, cloud logins, or authentication paywalls.
2. **Offline-First Data Ownership:** All collections, environments, folders, and request histories reside in local SQLite files owned by the developer.
3. **Keychain Secret Isolation:** API keys, OAuth tokens, and secrets are stored in native OS keychains, never exposed in plain text exports or database backups.
4. **Zero Telemetry Guarantee:** No hidden tracking beacons, analytics scripts, or background cloud syncs.

---

## ⚡ Core Feature Matrix

| Feature Domain | Capability | Description |
| :--- | :--- | :--- |
| **Workspace Architecture** | **Multi-Workspace System** | Create and switch between isolated workspaces (e.g., Personal, Work, Project Alpha) with dedicated environments, collections, and settings. |
| **Request Builder** | **Bi-Directional Query Params** | Seamless synchronization between URL query parameters (`?page=1&limit=10`) and interactive key-value table editor. |
| | **HTTP Method Suite** | Full support for `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`. |
| | **Body Editors** | JSON, Raw Text, Form Data, URL Encoded, GraphQL, Binary payload support with syntax highlighting. |
| | **Authentication Engines** | No Auth, Bearer Token, Basic Auth, API Key (Header/Query), OAuth 2.0 (Auth Code & Client Credentials). |
| **Variable Engine** | **Multi-Tier Scoping** | Global, Environment, Collection, Folder, and Request-level variables resolved via `{{variable_name}}`. |
| | **Secret Redaction** | Masking sensitive values in request history, console logs, and export files. |
| **Scripting Sandbox** | **Pre & Post Request Scripts** | Postman-compatible `pm.*` JavaScript sandbox for dynamic test assertions, header generation, and variable chaining. |
| **Response Inspection** | **JQ Query Engine** | Real-time JSON transformation using embedded `jq.wasm` WebAssembly engine with built-in cheat sheet. |
| | **Multi-Tab Viewer** | Pretty JSON, Raw, Headers, and Timeline performance breakdown. |
| **Interoperability** | **Import / Export** | cURL command importer, Postman Collection v2.1 import/export, OpenAPI specification import. |
| | **Code Snippet Generator** | One-click export to cURL, JavaScript (Fetch), Python (Requests), Node.js, Go, Rust, and Java. |
| **Desktop Experience** | **Theme System** | High-contrast visual themes: Kobe Dark, Synthwave, Cyberpunk, Nord, Solarized, Light. |
| | **Auto-Updater** | Background update checks backed by Ed25519 cryptographic public key verification. |

---

## 🥊 KobeanREST vs. Alternatives

| Feature / Metric | KobeanREST | Postman | Insomnia | Bruno |
| :--- | :---: | :---: | :---: | :---: |
| **Account Required** | ❌ **No** | ⚠️ Yes | ⚠️ Optional | ❌ No |
| **Cloud Sync Mandatory** | ❌ **No** | ⚠️ Yes | ⚠️ Yes | ❌ No |
| **Secret Storage** | 🛡️ **OS Keychain** | ☁️ Cloud DB | ☁️ Cloud DB | 📁 Plain Text |
| **Query Filter** | ⚡ **WebAssembly JQ** | ❌ Basic Filter | ❌ Limited | ❌ No |
| **Native Performance** | ⚡ **Tauri 2 + Rust** | 🐌 Electron | 🐌 Electron | 🐌 Electron |
| **Startup Memory** | 🚀 **~45MB** | 🐢 ~400MB+ | 🐢 ~350MB+ | 🐢 ~150MB+ |
