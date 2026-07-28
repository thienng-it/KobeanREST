# 🎯 Product Vision & Feature Matrix Specification

KobeanREST is designed specifically for software engineers, backend developers, and QA automation teams who require a high-density, high-performance API testing client without forced cloud lock-in or user tracking.

---

## 📜 The Local-First Software Manifesto

> [!IMPORTANT]
> **Four Core Pillars of KobeanREST Product Design:**
> 1. **Zero Mandatory Cloud Dependencies:** Complete offline capability. Workspaces, environments, collections, and request logs reside 100% on local storage.
> 2. **OS Keychain Secret Isolation:** Sensitive keys and tokens are stored in native encrypted keychains, never plain-text SQLite database files or unencrypted backup exports.
> 3. **High-Density Desktop Performance:** Instant startup time, low memory footprint (~45MB resting RAM), powered by native Rust execution.
> 4. **Zero Telemetry Guarantee:** No behavioral tracking, no third-party analytics scripts, no background sync calls to remote servers.

---

## ⚡ Comprehensive Feature Breakdown

### 1. Workspace & Multi-Tenancy Architecture
- **Multi-Workspace Isolation:** Create independent workspaces (e.g., *Production Microservices*, *Partner API Integration*, *Personal Sandbox*) with dedicated environments, collections, folders, and request histories.
- **Workspace Switcher:** Seamless switching with state isolation.

### 2. Request Composer & Params Engine
- **Bi-Directional Query Sync:** Modifying the URL query string (`?status=active&limit=50`) instantly updates the key-value interactive table, and vice-versa.
- **Header Presets & Auto-Completion:** Pre-built header presets (`Content-Type: application/json`, `Authorization`, `Accept`) with CodeMirror auto-completion.
- **Full Method Matrix:** `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
- **Flexible Body Payloads:** Raw JSON, Form Data, URL Encoded, Text, GraphQL, and Binary File upload.

### 3. Authentication Engine
- **Supported Auth Modes:**
  - **No Auth:** Standard unauthenticated requests.
  - **Bearer Token:** Token injection with automatic template variable resolution.
  - **Basic Auth:** Username and password base64 encoding.
  - **API Key:** Header or Query parameter key-value injection.
  - **OAuth 2.0:** Client Credentials and Authorization Code flows with token retrieval.

### 4. Dynamic Scripting Sandbox (`pm.*`)
- **Pre-Request Scripts:** Execute custom JavaScript before request dispatch (e.g., generate dynamic timestamps, sign HMAC signatures).
- **Post-Request Scripts (Tests):** Write assertions using Postman-compatible `pm.test()` syntax:
  ```javascript
  pm.test("Status code is 200 OK", function() {
    pm.response.to.have.status(200);
  });
  pm.test("Response time is under 200ms", function() {
    pm.expect(pm.response.responseTime).to.be.below(200);
  });
  ```

### 5. WebAssembly Response JQ Query Engine
- **Embedded `jq.wasm`:** Execute complex JSON filtering, selection, and transformations directly in client memory without external dependencies:
  ```jq
  .data.items[] | select(.status == "active") | {id: .id, name: .name}
  ```
- **Built-in Cheat Sheet:** Interactive JQ cheat sheet modal providing instant syntax references.

### 6. Interoperability & Code Generator
- **cURL Importer:** Paste cURL command strings to instantly auto-populate HTTP method, URL, headers, and request bodies.
- **Postman Collection v2.1:** Full import and export compatibility for seamless migration.
- **Multi-Language Code Snippet Generator:** One-click code generation for:
  - cURL
  - JavaScript (`fetch`)
  - Python (`requests`)
  - Node.js (`axios`, `http`)
  - Go (`net/http`)
  - Rust (`reqwest`)
  - Java (`HttpClient`)

---

## 🥊 Benchmark Comparison Matrix

| Operational Metric | KobeanREST ⚡ | Postman 🟠 | Insomnia 🟣 | Bruno 🟤 |
| :--- | :---: | :---: | :---: | :---: |
| **Account Required** | ❌ **No** | ⚠️ Forced | ⚠️ Optional | ❌ No |
| **Cloud Sync Mandatory**| ❌ **No** | ⚠️ Forced | ⚠️ Mandatory | ❌ No |
| **Secret Protection** | 🛡️ **OS Keychain** | ☁️ Remote Cloud DB | ☁️ Remote Cloud DB | 📁 Plain Text |
| **JSON Query Engine** | ⚡ **Client JQ WASM** | ❌ None | ❌ Basic | ❌ None |
| **Native Architecture** | 🦀 **Tauri 2 + Rust** | 🐌 Electron | 🐌 Electron | 🐌 Electron |
| **RAM Footprint** | 🚀 **~45 MB** | 🐢 ~450 MB+ | 🐢 ~380 MB+ | 🐢 ~160 MB+ |
| **Open Source License** | 📜 **MIT** | 🔒 Proprietary | 🔒 Proprietary | 📜 MIT |

---

> 💡 **Next Steps:** Refer to [Testing & QA Matrix](Testing-and-Quality-Assurance) to review automated test suites, or [Developer Setup & Guide](Developer-Guide-and-Setup) to build from source.
