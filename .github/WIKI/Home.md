# ⚡ KobeanREST Technical & Product Wiki

<div align="left">

[![Tauri 2](https://img.shields.io/badge/Tauri-2.0-22c55e?style=for-the-badge&logo=tauri)](https://tauri.app)
[![Rust Core](https://img.shields.io/badge/Rust-2021-orange?style=for-the-badge&logo=rust)](https://www.rust-lang.org)
[![React 18](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Local LLM AI](https://img.shields.io/badge/AI Copilot-Ollama (Local)-8b5cf6?style=for-the-badge&logo=ollama)](https://ollama.com)
[![Storage](https://img.shields.io/badge/Storage-SQLite-003b57?style=for-the-badge&logo=sqlite)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/thienng-it/KobeanREST/blob/main/LICENSE)

</div>

---

> [!IMPORTANT]
> **The Local-First API Client Manifesto**  
> KobeanREST is engineered to deliver enterprise-grade REST, gRPC, and WebSocket workflow management with **zero forced cloud synchronizations, zero user account barriers, 100% offline data ownership, and private Local AI Assistance**. All secrets stay locked inside native OS keychains and AI chats never leave your local machine.

---

## 🏛️ Executive Summary & Engineering Architecture

KobeanREST decouples network execution, AI processing, and storage from browser renderer constraints by executing asynchronous network operations (HTTP/REST, gRPC, WebSockets) natively through a Rust core and communicating with local LLMs (Ollama) on host loopback.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     React 18 Renderer (Vite UI)                                 │
│  Request Builder ──► Params/Path Vars ──► Docs Tab ──► WASM JQ Engine ──► AI Copilot (Ollama)   │
│  gRPC Client     ──► WebSocket/Socket.IO ──► Workspaces Hub ──► Collection Security Lock        │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │ Tauri IPC Bridge (JSON-RPC)
┌────────────────────────────────────────────────▼────────────────────────────────────────────────┐
│                                     Rust Native Core Engine                                     │
│  Async Reqwest HTTP ──► SQLite Persistence ──► OS Keychain Secret Vault ──► Ed25519 Auto-Updater    │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Feature Highlights

- 🏢 **Workspaces Hub & Management:** Centralized workspace manager to create, switch, configure, export, and import multi-tenant workspaces with isolated collections and environments.
- 📂 **Collections Hub & Security Locks:** Visual grid overview for all collections with per-collection passcode protection to lock sensitive API collections.
- 🌐 **Multi-Protocol Power:** Comprehensive REST, **gRPC** (Protobuf loading & streaming), and **WebSocket / Socket.IO** real-time testing suites.
- 📝 **Interactive Docs Tab & Markdown Notes:** Dedicated documentation editor for requests and collections with auto-generated documentation previews and Markdown export.
- ⚡ **Path Variables & Bulk Editing:** Dynamic path parameter extraction (`:param` / `{param}`) and seamless one-click toggle between structured tables and bulk raw text editing.
- 🤖 **Offline AI Copilot (Ollama Integration):** Built-in AI chat sidebar powered by local Ollama models (`llama3`, `mistral`, `codellama`). Generate requests, debug errors, transform JSON payloads, and generate `pm.*` test assertions with zero data leaving your machine.
- 🎨 **Environment Coloration & Guardrails:** Visual color badges (Red/Amber for Production, Yellow for Staging, Blue/Green for Dev) to prevent accidental execution against production endpoints.
- 🌈 **10+ High-Contrast Desktop Themes:** Customizable UI styling including *Tokyo Night*, *Catppuccin Mocha*, *Dracula*, *Cyberpunk*, *Nord*, *One Dark*, *Solarized Dark*, and *GitHub Dark*.
- 🔑 **OAuth 2.0 Authorization Code & PKCE:** Built-in OAuth 2.0 Authorization Code browser flow and PKCE token exchange.
- 🏃 **Advanced Collection Runner & History Analytics:** Batch execute requests with iteration support, failure reporting, response time metrics, and detailed execution timelines.
- 🔒 **OS Keychain Vault:** Native OS Keychain integration for sensitive credentials (macOS Keychain, Windows Credential Manager, Linux Secret Service API).

---

## 🧭 Repository Knowledge Base & Role Navigation

Select your domain below to navigate the technical specification:

### 📐 [Architecture & Systems Engineering](Architecture-Overview)
> Architectural blueprints, Tauri IPC dispatcher, SQLite migration schemas, secret keychain isolation, dynamic variable resolution, AI local copilot architecture, and WebAssembly execution engines.

- ⚙️ **Core Tech:** Tauri 2.0 shell, Rust (Tokio, Reqwest, Rusqlite), React 18, CodeMirror 6.
- 🔒 **Security Infrastructure:** OS Keychain API integration, Stronghold Argon2 encryption, Collection Passcode Lock, and log redaction filters.
- ⚡ **Performance:** Client-side `jq.wasm` WebAssembly engine for instant zero-latency response queries.

---

### 🎯 [Product Vision & Requirements (PO Specification)](Product-Vision-and-Features)
> Product manifesto, feature matrix, competitive benchmarks against legacy tools, and release lifecycle management.

- 🏢 **Workspaces & Collections Hub:** Multi-tenant workspace isolation, collections overview, and collection-level passcode security locks.
- 🔌 **Protocols:** REST/HTTP, gRPC (Protobuf), WebSocket, and Socket.IO.
- 🔄 **Query & Path Variable Synchronization:** Bi-directional real-time sync for query parameters and URL path parameters.
- 📝 **Docs Editor:** Integrated API documentation generator and Markdown note-taking.
- 📜 **Scripting Sandbox:** Pre-request and post-request test assertions using a Postman-compatible `pm.*` runtime.
- 🤖 **AI Assistant:** Local-first LLM copilot for automated request building and script generation.
- 📊 **Universal Interoperability:** cURL parser, Postman Collection v2.1, OpenAPI/Swagger 2.0 & 3.0, Insomnia v4, and multi-language code generator.

---

### 🧪 [Quality Assurance & SDET Matrix](Testing-and-Quality-Assurance)
> Multi-tier test pyramid, contract test suites, end-to-end automation specs, security audit controls, and CI/CD pipelines.

- 🛡️ **Contract Tests:** 37+ Node.js native contract tests verifying invariants across all core subsystems.
- 🎭 **E2E Automation:** CodeceptJS and Playwright runner testing native UI rendering and IPC flows.
- 🤖 **CI/CD Automation:** Automated nightly releases, secret leakage scanning (`Betterleak`), and update manifest publishing.

---

### 🛠️ [Developer Guide & Setup](Developer-Guide-and-Setup)
> Prerequisites, toolchain setup, local Ollama LLM setup, dev server workflows, and platform bundle compilation instructions.

- 💻 **Dev Workflows:** `npm run dev` (Web preview) & `npm run tauri dev` (Native desktop shell).
- 📦 **Release Bundles:** Standalone cross-platform installers for macOS (`.dmg`), Windows (`.msi`), and Linux (`.AppImage`, `.deb`).

---

### 🔌 [API & IPC Reference](API-and-IPC-Reference)
> Low-level IPC command registry signatures, database schema DDL, local AI service endpoints, and Postman `pm.*` scripting shims.

---

### 🛡️ [Security & Privacy Blueprint](Security-and-Privacy)
> Zero-telemetry model, secret redaction engine, collection passcode lock, local LLM privacy guarantee, and cryptographic Ed25519 update manifest verification.

---

## 📊 System Capability Overview

| Subsystem | Specification | Operational Guarantee |
| :--- | :--- | :--- |
| **Desktop Shell** | Tauri 2.0 (Rust) | Native memory footprint (~45MB resting RAM) |
| **Storage Engine** | Embedded SQLite (`persistence.rs`) | ACID compliance & 100% local persistence |
| **Secret Protection** | OS Keychain (`secrets.rs`) | Zero raw secrets stored in plain-text SQLite |
| **Protocols Supported** | HTTP/1.1, HTTP/2, gRPC, WebSocket, Socket.IO | High-throughput, multi-protocol execution |
| **AI Copilot** | Local Ollama (`http://localhost:11434`) | 100% offline LLM inference (Zero cloud leakage) |
| **Documentation Engine**| Markdown & Live Docs Tab (`DocsEditor.tsx`) | Auto-generated API specs with zero cloud sync |
| **Response Transformation**| `jq.wasm` (WebAssembly) | Client-side memory execution without network calls |
| **Quality Gate** | 37+ Contract Tests + Playwright E2E | Mandatory zero-failure pass rate prior to release |

---

<div align="center">

🌐 **Live Documentation Portal:** [thienng-it.github.io/KobeanREST](https://thienng-it.github.io/KobeanREST/) • 🚀 **Try Web Preview:** [thienng-it.github.io/KobeanREST/app](https://thienng-it.github.io/KobeanREST/app/) • 📦 **Latest Release:** [GitHub Releases](https://github.com/thienng-it/KobeanREST/releases/latest)

</div>
