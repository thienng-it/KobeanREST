<div align="center">

# ⚡ KobeanREST

**A fast, local-first desktop API client for REST & HTTP workflows.**

*No account required. No cloud sync forced. 100% local workspace ownership.*

[![Version](https://img.shields.io/github/v/release/thienng-it/KobeanREST?color=3b82f6&style=flat-square)](https://github.com/thienng-it/KobeanREST/releases/latest)
[![License](https://img.shields.io/github/license/thienng-it/KobeanREST?color=10b981&style=flat-square)](LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2.0-22c55e?style=flat-square&logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Docs Portal](https://img.shields.io/badge/Docs-Live-8b5cf6?style=flat-square)](https://thienng-it.github.io/KobeanREST/)
[![Web Preview](https://img.shields.io/badge/Web_Preview-Try_Live-ec4899?style=flat-square)](https://thienng-it.github.io/KobeanREST/app/)

---

[📖 Documentation](https://thienng-it.github.io/KobeanREST/) • [🚀 Try Web Preview](https://thienng-it.github.io/KobeanREST/app/) • [📦 Download Desktop App](https://github.com/thienng-it/KobeanREST/releases/latest) • [🗺️ Roadmap](docs/implementation-roadmap.md)

</div>

<br />

## 🌟 Overview

**KobeanREST** is designed for software engineers, backend developers, and QA teams who need a high-performance REST API client without forced cloud lock-in or user registration. Download the app, launch it locally, and build, test, and save API requests directly on your machine.

> **Local-First Contract:**
> KobeanREST has **no user accounts, no login screens, no cloud telemetry, and no required backend service.** All workspace data is stored in local SQLite databases, and secret credentials remain safely secured in your operating system's native keychain.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| 🚀 **Native Tauri 2 Core** | Blazing-fast desktop performance powered by Rust with lightweight memory usage. |
| 🎨 **High-Density Desktop UI** | Modern, compact aesthetic with refined focus states, single-ring inputs, and crisp typography. |
| 🗂️ **Tabbed Workspace** | Advanced unsaved draft tab workflow with visual indicators, auto-removal, and tab views for collections and folders. |
| 🔄 **Bi-Directional Query Params** | Interactive `Params` tab with real-time bi-directional synchronization with the URL bar (`?key=value`). |
| 🔐 **Keychain Secret Protection** | Sensitive values (API keys, tokens) stay outside SQLite in OS keychain / encrypted vault storage. |
| 📦 **Local Persistence** | SQLite-backed storage for workspaces, collections, folders, requests, environment variables, and history. |
| 🏃 **Collection Runner** | Execute entire collections sequentially with comprehensive run history and results tracking. |
| 📜 **Pre & Post Request Scripts** | Dynamic JavaScript execution environment with live logs, assertions, and variable injection. |
| 📊 **QA Dashboard** | Real-time test analytics, flakiness governance, and daily telemetry drilldown for automated tests. |
| 🌐 **Live Web Preview** | Try KobeanREST instantly in any modern web browser without installing local desktop binaries. |
| 🤖 **Automated Nightly Releases** | GitHub Actions bot continuously verifies builds and publishes signed release installers & updater manifests. |

---

## 📥 Downloads & Installation

Official cross-platform installers are published through GitHub Releases:

👉 **[Download Latest Version (GitHub Releases)](https://github.com/thienng-it/KobeanREST/releases/latest)**

| Platform | Installer Format | Architecture |
| :--- | :--- | :--- |
| **macOS** | `.dmg` | Universal (Apple Silicon & Intel) |
| **Windows** | `.msi` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

*Detailed installation instructions, checksum verification, and OS security notes are available in the [Download Guide](docs/download.md).*

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Renderer                         │
│   (Request Builder, Params Sync, Env Editor, Bottom Dock)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Tauri IPC Bridge
┌──────────────────────────────▼──────────────────────────────┐
│                    Rust Desktop Core                        │
│   (Reqwest HTTP Engine, SQLite Persistence, Keychain Vault) │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Responsibility |
| :--- | :--- |
| **Tauri 2 Shell** | Native window management, desktop shortcuts, auto-updater integration |
| **Rust Native Core** | SQLite storage, HTTP client execution engine, OS keychain integrations |
| **React Renderer** | CodeMirror editor, dynamic variable resolution `{{var}}`, theme engines |
| **Docs Portal** | GitHub Pages documentation portal built from `docs-site/` |

---

## 🛠️ Development & Building

### Prerequisites
- [Node.js](https://nodejs.org/) v22+
- [Rust](https://www.rust-lang.org/) stable toolchain
- Cargo & platform build dependencies

### Local Setup

1. **Clone & Install Dependencies:**
   ```bash
   git clone https://github.com/thienng-it/KobeanREST.git
   cd KobeanREST
   npm install
   ```

2. **Run Web Renderer (Dev Mode):**
   ```bash
   npm run dev
   ```

3. **Run Native Desktop App:**
   ```bash
   npm run tauri dev
   ```

4. **Execute Verification & Tests:**
   ```bash
   npm test               # Run contract and unit test suite
   npm run build          # Build TypeScript & Vite renderer
   npm run build:docs     # Build documentation portal
   npm run check:secrets  # Perform Betterleak sensitive-data scan
   npm run check:release  # Run release preflight checks
   ```

---

## 🔒 Security & Privacy

KobeanREST is engineered to keep your workspace data private and local:

- **Redacted Secret Exports:** Workspace exports redact sensitive environment variables by default.
- **Redacted History:** Request history automatically masks sensitive URL query parameters and authorization headers.
- **Automated Scanning:** Every commit and PR is scanned for credential leaks via `Betterleak` in CI (`npm run check:secrets`).

---

## 👥 Creators & Lead Contributors

KobeanREST is created and architected with ❤️ by:

- **Joseph Thien** ([@thienng-it](https://github.com/thienng-it)) — Creator & Principal System Architect
- **Kobenguyent** ([@kobenguyent](https://github.com/kobenguyent)) — Creator & Lead Core Engineer

---

## 📄 License

Distributed under the [MIT License](LICENSE). Designed and built with ❤️ by **[Joseph Thien](https://github.com/thienng-it)** and **[Kobenguyent](https://github.com/kobenguyent)** alongside the open-source developer community.
