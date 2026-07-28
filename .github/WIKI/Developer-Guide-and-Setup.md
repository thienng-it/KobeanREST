# 🛠️ Developer Guide & Environment Setup

This guide walks developers through setting up their environment, building KobeanREST locally, running dev servers, and packaging native desktop installers.

---

## 📋 System Prerequisites

### 1. Node.js Environment
- Node.js `v22.0.0+`
- npm `v10.0.0+`

### 2. Rust Toolchain
- Rust `stable` (pinned via `rust-toolchain.toml`)
- Cargo package manager

### 3. Platform Build Tools
- **macOS:** Xcode Command Line Tools (`xcode-select --install`).
- **Windows:** C++ Build Tools for Visual Studio 2022 (MSVC).
- **Linux:** `build-essential`, `libssl-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

---

## 🚀 Quickstart Development Workflow

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/thienng-it/KobeanREST.git
cd KobeanREST
npm install
```

### 2. Launch Web Renderer (Dev Server)
Runs Vite web server with hot-module replacement (HMR) at `http://localhost:5173`:
```bash
npm run dev
```

### 3. Launch Native Desktop App (Tauri Dev Mode)
Compiles Rust native backend and launches the Tauri window with HMR:
```bash
npm run tauri dev
```

---

## 🏗️ Packaging Native Installers

To compile production desktop binaries:

```bash
npm run tauri build
```

This outputs platform-specific binaries into `src-tauri/target/release/bundle/`:
- **macOS:** `.dmg` installer & standalone `.app` bundle.
- **Windows:** `.msi` installer & `.exe` executable.
- **Linux:** `.AppImage` & `.deb` package.

---

## 📂 Codebase Directory Organization

```
KobeanREST/
├── .github/
│   ├── workflows/             # GitHub Actions CI/CD workflows
│   └── WIKI/                  # GitHub Wiki Documentation source
├── docs/                      # Architectural docs & spec files
├── docs-site/                 # GitHub Pages documentation web portal
├── public/                    # Static public assets (jq.wasm)
├── scripts/                   # Preflight, release & secret scanner scripts
├── src/
│   └── renderer/
│       └── src/
│           ├── components/    # Modular React UI components
│           ├── hooks/         # Custom React hooks (useWorkspace, useAuth, etc.)
│           ├── services/      # Core frontend services (local-store, http-client, variables, secrets)
│           ├── App.tsx        # Application shell & root state component
│           └── styles.css     # Global CSS styling & design system tokens
├── src-tauri/                 # Tauri 2 Native Rust Application
│   ├── capabilities/          # Tauri permission configuration
│   ├── migrations/            # SQLite migration scripts (001_initial.sql)
│   ├── src/
│   │   ├── http_client.rs     # Reqwest/Tokio HTTP engine
│   │   ├── lib.rs             # Tauri command dispatcher & setup
│   │   ├── local_only.rs      # Offline & storage status
│   │   ├── persistence.rs     # SQLite Rusqlite database driver
│   │   └── secrets.rs         # Native OS Keychain integration
│   ├── Cargo.toml             # Rust package manifest
│   └── tauri.conf.json        # Tauri window & app configuration
├── tests/                     # Contract & E2E test suite
└── package.json               # Node project manifest & scripts
```
