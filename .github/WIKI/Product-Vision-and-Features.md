# 🎯 Product Vision & Feature Matrix Specification

KobeanREST is designed specifically for software engineers, backend developers, and QA automation teams who require a high-density, high-performance API testing client without forced cloud lock-in, user tracking, or SaaS paywalls.

---

## 📜 The Local-First Software Manifesto

> [!IMPORTANT]
> **Five Core Pillars of KobeanREST Product Design:**
> 1. **Zero Mandatory Cloud Dependencies:** Complete offline capability. Workspaces, environments, collections, request histories, documentation, and AI chats reside 100% on local storage.
> 2. **OS Keychain Secret Isolation:** Sensitive keys, passwords, and tokens are stored in native encrypted keychains, never plain-text SQLite database files or unencrypted backup exports.
> 3. **High-Density Desktop Performance:** Instant startup time, low memory footprint (~45MB resting RAM), powered by native Rust execution.
> 4. **Zero Telemetry Guarantee:** No behavioral tracking, no third-party analytics scripts, no background sync calls to remote servers.
> 5. **Private Local AI Copilot:** Built-in AI assistance powered by host Ollama instances for zero-cloud payload generation, test script writing, and response diagnostics.

---

## ⚡ Comprehensive Feature Breakdown

### 1. Workspaces Hub & Multi-Tenancy Architecture
- **Workspaces Hub (`WorkspacesManager.tsx`):** Centralized control center to manage all local workspaces with grid-based visual cards, environment summaries, collection counts, and last modified timestamps.
- **Multi-Workspace Isolation:** Create independent workspaces (e.g., *Production Microservices*, *Partner API Integration*, *Personal Sandbox*) with dedicated environments, collections, folders, and request histories.
- **Workspace Switcher Modal:** Seamless switching with instant state isolation via keyboard shortcuts.
- **Workspace Portability:** Export entire workspaces to JSON and import external workspaces seamlessly.

### 2. Collections Hub & Passcode Security Locks
- **Collections Overview Grid:** Browse, filter, search, and manage all collections within a workspace in an intuitive visual overview.
- **Collection Passcode Lock (`collection-security.ts`):** Protect sensitive API collections with dedicated passcodes.
- **Session Locking:** Toggle lock status per session with visual security status badges (Locked 🔒 / Unlocked 🔓).

### 3. Multi-Protocol Request Suite
- **REST / HTTP Client:** Full support for `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS` with HTTP/1.1 and HTTP/2.
- **gRPC Client:** Native gRPC service exploration, Protobuf definition upload/parsing, unary requests, client streaming, and server streaming.
- **WebSocket & Socket.IO:** Real-time bi-directional messaging pane with connection state monitoring, payload formatting, event listening, and message history streaming.

### 4. Request Composer, Path Variables & Bulk Editing
- **Bi-Directional Query Sync:** Modifying the URL query string (`?status=active&limit=50`) instantly updates the key-value interactive table, and vice-versa.
- **Dynamic Path Variables (`path-variables.ts`):** Automatically extracts path parameters (`:userId`, `{orderId}`) from request URLs and renders a dedicated Path Variables resolution table.
- **Bulk Edit Mode (`bulk-param-utils.ts`):** One-click toggle between structured key-value table editor and raw key-value text editing for rapid copy-pasting.
- **Header Presets & Auto-Completion:** Pre-built header presets (`Content-Type: application/json`, `Authorization`, `Accept`) with CodeMirror auto-completion.
- **Flexible Body Payloads:** Raw JSON, Form Data, URL Encoded, Text, GraphQL, and Binary File upload.

### 5. Interactive Docs Tab & API Documentation Generator (`DocsEditor.tsx`)
- **Integrated Markdown Docs Editor:** Write, edit, and preview Markdown notes and documentation directly alongside request configurations.
- **Auto-Generated API Documentation:** Generates structured API documentation with live parameter tables, header definitions, and sample response payloads.
- **Export & Portability:** Export documentation to standalone Markdown files.

### 6. Environment Management & Safety Guards
- **Environment Coloration Badges:** Assign distinct color indicators to environments (Red/Amber for Production, Yellow for Staging, Blue/Green for Dev) to provide instant visual feedback and prevent accidental execution on production targets.
- **Variable Cascading:** Scoped variable resolution across global, environment, collection, folder, and request scopes.

### 7. Authentication Engine
- **Supported Auth Modes:**
  - **No Auth:** Standard unauthenticated requests.
  - **Bearer Token:** Token injection with automatic template variable resolution.
  - **Basic Auth:** Username and password base64 encoding.
  - **API Key:** Header or Query parameter key-value injection.
  - **OAuth 2.0:** Client Credentials and Authorization Code (with PKCE and browser redirect handling) flows with automatic token retrieval.

### 8. AI Chat Sidebar & Local LLM Integration (Ollama)
- **Local LLM Copilot:** Connects to Ollama running locally (`http://localhost:11434`).
- **Interactive Assistance:**
  - Auto-generate request headers, URLs, and JSON payloads from natural language prompts.
  - Generate Postman-compatible `pm.test()` assertion scripts automatically.
  - Analyze failed responses and suggest fixes or missing authorization headers.
  - Explain complex JSON outputs or write `jq` filtering expressions.
- **100% Private:** No prompt data, request headers, or response payloads are ever sent to third-party cloud AI vendors.

### 9. Dynamic Scripting Sandbox (`pm.*`)
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

### 10. WebAssembly Response JQ Query Engine
- **Embedded `jq.wasm`:** Execute complex JSON filtering, selection, and transformations directly in client memory without external dependencies:
  ```jq
  .data.items[] | select(.status == "active") | {id: .id, name: .name}
  ```
- **Built-in Cheat Sheet:** Interactive JQ cheat sheet modal providing instant syntax references.

### 11. Premium Desktop Theme Engine
- **10+ Curated High-Contrast Themes:**
  - *Tokyo Night* (Default Dark)
  - *Catppuccin Mocha*
  - *Dracula*
  - *Cyberpunk*
  - *Nord*
  - *One Dark*
  - *Solarized Dark*
  - *GitHub Dark* / *GitHub Light*
- **Theme Persistence:** Remembers custom theme preferences across application restarts.

### 12. Collection Runner & History Analytics
- **Batch Execution:** Run all requests within a collection or folder sequentially.
- **Iteration & Delay Controls:** Configure iteration counts and delay gaps between requests.
- **Detailed History Graph:** Comprehensive execution summaries, assertion pass/fail rates, latency breakdowns, and status code distributions.

### 13. Universal Interoperability & Code Generator
- **Universal Importer:**
  - Postman Collection v2.1 import & export
  - OpenAPI / Swagger 2.0 & 3.0 specs
  - Insomnia v4 export bundles
  - cURL commands parser
- **Multi-Language Code Snippet Generator:** One-click code generation for cURL, JavaScript (`fetch`), Python (`requests`), Node.js (`axios`, `http`), Go (`net/http`), Rust (`reqwest`), Java (`HttpClient`).

---

## 🥊 Benchmark Comparison Matrix

| Operational Metric | KobeanREST ⚡ | Postman 🟠 | Insomnia 🟣 | Bruno 🟤 |
| :--- | :---: | :---: | :---: | :---: |
| **Account Required** | ❌ **No** | ⚠️ Forced | ⚠️ Optional | ❌ No |
| **Cloud Sync Mandatory**| ❌ **No** | ⚠️ Forced | ⚠️ Mandatory | ❌ No |
| **Secret Protection** | 🛡️ **OS Keychain** | ☁️ Remote Cloud DB | ☁️ Remote Cloud DB | 📁 Plain Text |
| **Collection Passcode Lock** | 🔒 **Yes** | ❌ None | ❌ None | ❌ None |
| **Multi-Protocol (REST/gRPC/WS)** | 🌐 **Built-in** | ⚠️ Partial/Paid | ⚠️ Basic | ❌ REST Only |
| **Local AI Copilot** | 🤖 **Ollama (Private)**| ☁️ Paid Cloud AI | ❌ None | ❌ None |
| **Env Color Warnings**| 🎨 **Yes** | ⚠️ Basic | ❌ None | ❌ None |
| **JSON Query Engine** | ⚡ **Client JQ WASM** | ❌ None | ❌ Basic | ❌ None |
| **Native Architecture** | 🦀 **Tauri 2 + Rust** | 🐌 Electron | 🐌 Electron | 🐌 Electron |
| **RAM Footprint** | 🚀 **~45 MB** | 🐢 ~450 MB+ | 🐢 ~380 MB+ | 🐢 ~160 MB+ |
| **Open Source License** | 📜 **MIT** | 🔒 Proprietary | 🔒 Proprietary | 📜 MIT |

---

> 💡 **Next Steps:** Refer to [Testing & QA Matrix](Testing-and-Quality-Assurance) to review automated test suites, or [Developer Setup & Guide](Developer-Guide-and-Setup) to build from source.
