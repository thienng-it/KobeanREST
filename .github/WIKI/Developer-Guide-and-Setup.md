# 🛠️ Developer Setup & Engineering Guide

This guide provides setup instructions for contributing to KobeanREST, running local development servers, configuring local AI models (Ollama), executing verification test suites, and building native desktop installers.

---

## 📋 System Prerequisites & Platform Toolchains

### 1. Core Runtimes
- **Node.js:** `v22.0.0+`
- **npm:** `v10.0.0+`
- **Rust Toolchain:** Stable channel (pinned in `rust-toolchain.toml`)
- **Ollama (Optional for AI Copilot):** `v0.3.0+` ([ollama.com](https://ollama.com))

### 2. Operating System Build Dependencies
- **macOS:** Xcode Command Line Tools (`xcode-select --install`).
- **Windows:** C++ Build Tools for Visual Studio 2022 with Windows SDK.
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt update && sudo apt install -y \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
  ```

---

## 🤖 Local AI Model Setup (Ollama)

To enable the built-in AI Copilot sidebar locally:

1. Install and start Ollama on your system:
   ```bash
   ollama serve
   ```
2. Pull your preferred model:
   ```bash
   ollama pull llama3.2
   # or
   ollama pull mistral
   ```
3. Open KobeanREST AI Chat sidebar. It automatically detects running Ollama models at `http://localhost:11434`.

---

## 🚀 Quickstart Development Workflows

### 1. Repository Setup
```bash
git clone https://github.com/thienng-it/KobeanREST.git
cd KobeanREST
npm install
```

### 2. Run Web Renderer Dev Server
Launches Vite development server with Hot Module Replacement (HMR) at `http://localhost:5173`:
```bash
npm run dev
```

### 3. Run Native Desktop Shell (Tauri Dev Mode)
Compiles the Rust native backend and launches the Tauri window:
```bash
npm run tauri dev
```

---

## 📦 Compiling Standalone Desktop Bundles

To generate platform-specific desktop installers:

```bash
npm run tauri build
```

Compiled installers are placed in `src-tauri/target/release/bundle/`:
- **macOS:** `.dmg` installer & standalone `.app` bundle (Universal Architecture: `aarch64` + `x86_64`).
- **Windows:** `.msi` installer & `.exe` executable.
- **Linux:** `.AppImage` & `.deb` distribution packages.

---

## 📂 Source Code Directory Organization

```
KobeanREST/
├── .github/
│   ├── workflows/             # GitHub Actions CI/CD workflows (release, docs, e2e, secrets)
│   └── WIKI/                  # GitHub Wiki Documentation source
├── docs/                      # Architectural specs & documentation
├── docs-site/                 # GitHub Pages documentation website & web preview app
├── public/                    # Static assets (jq.wasm WebAssembly module)
├── scripts/                   # Preflight, release & secret scanner scripts
├── src/
│   └── renderer/
│       └── src/
│           ├── components/    # React UI components (RequestPanel, ResponsePanel, AiChatSidebar, ThemeSelector)
│           ├── hooks/         # Custom React hooks (useWorkspace, useAuth, useTheme, etc.)
│           ├── services/      # Core frontend services (local-store, http-client, variables, ai-service)
│           ├── App.tsx        # Main application state & UI shell
│           └── styles.css     # Global CSS styling & design tokens
├── src-tauri/                 # Tauri 2 Native Rust Application
│   ├── capabilities/          # Tauri IPC permission grants
│   ├── migrations/            # SQLite migration scripts (001_initial.sql)
│   ├── src/
│   │   ├── http_client.rs     # Async Reqwest HTTP engine
│   │   ├── lib.rs             # Tauri command dispatcher & setup
│   │   ├── local_only.rs      # Storage & offline integrity checks
│   │   ├── persistence.rs     # Rusqlite database operations
│   │   └── secrets.rs         # Native OS Keychain integration
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri configuration manifest
├── tests/                     # Node.js contract & E2E test suite
└── package.json               # Project manifest & scripts
```
