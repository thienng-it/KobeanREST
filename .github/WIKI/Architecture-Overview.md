# 📐 Architecture & Systems Engineering Specification

KobeanREST is engineered as a high-performance desktop hybrid application. It leverages **Tauri 2** to bridge a modern **React 18 / TypeScript** frontend renderer with a lightweight, multi-threaded **Rust** backend core and connects to local AI models via loopback HTTP.

---

## 🏛️ System Topology & IPC Boundary

The architecture explicitly isolates network request processing, local data storage, and secret vault security within native OS space, avoiding browser CORS restrictions and Electron resource bloat.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       React 18 Renderer                                         │
│                                                                                                 │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  ┌─────────────────────────────┐  │
│  │   Request Builder (UI)    │  │   Response Panel (WASM)   │  │ Env / Auth / Color Badges   │  │
│  │  - Bi-directional Params  │  │  - JQ Engine (jq.wasm)    │  │ - Scope Resolver            │  │
│  │  - CodeMirror Editor      │  │  - CodeMirror Viewer      │  │ - OAuth 2.0 PKCE Listener   │  │
│  └─────────────┬─────────────┘  └─────────────┬─────────────┘  └──────────────┬──────────────┘  │
│                │                              │                               │                 │
│                └──────────────────────────────┼───────────────────────────────┘                 │
│                                               │                                                 │
│                                               ├──────────────────────────────┐                  │
│                                               │                              │                  │
│                                               ▼                              ▼                  │
│                                      Tauri IPC (JSON-RPC)            Local Loopback HTTP        │
└───────────────────────────────────────────────┬──────────────────────────────┬──────────────────┘
                                                │                              │
┌───────────────────────────────────────────────▼─────────────┐ ┌──────────────▼───────────────────┐
│                     Rust Desktop Core                       │ │      Local AI Engine            │
│                                                             │ │  (Ollama @ localhost:11434)    │
│  ┌──────────────────────────┐  ┌──────────────────────────┐ │ │  - Llama 3 / Mistral Models   │
│  │    IPC Command Router    │  │   Async Reqwest Client   │ │ │  - Zero Cloud Transmission    │
│  │  (src-tauri/src/lib.rs)  │  │ (http_client.rs / Tokio) │ │ └─────────────────────────────────┘
│  └─────────────┬────────────┘  └─────────────┬────────────┘ │
│                │                             │              │
│                ▼                             ▼              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐ │
│  │    OS Keychain Vault     │  │   SQLite Persistence DB  │ │
│  │  (secrets.rs / Keyring)  │  │  (persistence.rs / DDL)  │ │
│  └──────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔬 Subsystem Analysis

### 1. Tauri 2 Desktop Shell (`src-tauri/`)
- **Native Process Control:** Manages OS windowing, system tray, application updates, and operating system events.
- **IPC Dispatcher (`src-tauri/src/lib.rs`):** Maps TypeScript function calls to native Rust handlers via `#[tauri::command]`.
- **Updater Plugin (`tauri_plugin_updater`):** Performs cryptographic Ed25519 public-key signature verification before applying downloaded binary packages.

### 2. Rust Native Backend (`src-tauri/src/`)
- **HTTP Engine (`http_client.rs`):** Built on `tokio` and `reqwest`. Bypasses browser CORS limitations, supports HTTP/1.1 and HTTP/2, custom SSL/TLS certificates, redirect policy control, and custom headers.
- **Persistence Engine (`persistence.rs`):** Manages SQLite connections via `rusqlite`. Handles transaction management, dynamic schema migrations, and relational cascading deletes.
- **Secret Vault (`secrets.rs`):** Interoperates with native operating system keychains (`keyring` crate):
  - macOS: Keychain Services API
  - Windows: Credential Manager API
  - Linux: Secret Service API / DBus
- **Local Integrity Layer (`local_only.rs`):** Guarantees zero external network leakage from app internals.

### 3. Frontend Web Renderer (`src/renderer/src/`)
- **Application Shell (`App.tsx`):** Coordinates 30+ reactive states, tab switching, workspace navigation, modal management, and theme engines.
- **AI Copilot Service (`services/ai-service.ts` & `components/AiChatSidebar.tsx`):** Communicates with local Ollama daemon for offline AI prompt processing, payload generation, and test writing.
- **CodeMirror Integration:** Embedded CodeMirror 6 components for interactive request body editing and JSON syntax highlighting.
- **WASM Query Engine (`jq.wasm`):** Client-side JQ filter execution compiled to WebAssembly. Enables real-time JSON filtering without network latency or external dependencies.
- **Sandbox Scripting Engine (`services/script-runtime.ts`):** Isolated JavaScript sandbox providing `pm.*` API compatibility for pre-request dynamic payload manipulation and post-request test assertions.

---

## 🔄 Dynamic Variable Resolution Pipeline

Variables defined in template syntax (`{{VAR_NAME}}`) undergo hierarchical cascading resolution:

> [!NOTE]
> **Resolution Priority Cascade (Highest to Lowest):**  
> `Request Level` $\rightarrow$ `Folder Level` $\rightarrow$ `Collection Level` $\rightarrow$ `Active Environment` $\rightarrow$ `Global Scope`

```
┌──────────────────────────────────────────────────────────┐
│                   Request-Level Vars                     │  (Highest Priority)
└────────────────────────────┬─────────────────────────────┘
                             │ Overrides
┌────────────────────────────▼─────────────────────────────┘
│                    Folder-Level Vars                     │
└────────────────────────────┬─────────────────────────────┘
                             │ Overrides
┌────────────────────────────▼─────────────────────────────┘
│                  Collection-Level Vars                   │
└────────────────────────────┬─────────────────────────────┘
                             │ Overrides
┌────────────────────────────▼─────────────────────────────┘
│                 Environment-Level Vars                   │
└────────────────────────────┬─────────────────────────────┘
                             │ Overrides
┌────────────────────────────▼─────────────────────────────┘
│                    Global-Level Vars                     │  (Lowest Priority)
└──────────────────────────────────────────────────────────┘
```

1. **Resolution Routine (`src/renderer/src/services/variables.ts`):**
   - Parses request URL, headers, query parameters, and body for `/\{\{([^}]+)\}\}/g` tokens.
   - Evaluates token against active hierarchy scope map.
   - If an unresolved variable token is encountered, request execution halts immediately with an `UnresolvedVariableError` prior to sending any network packet.
   - Secret variables are resolved directly from OS Keychain and excluded from diagnostic logs to prevent credential leaks.

---

## 💾 SQLite Database Schema (`001_initial.sql`)

```sql
-- Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Environments Table (supports environment coloration)
CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    is_active INTEGER DEFAULT 0,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Collections Table
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Folders Table
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    parent_folder_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Requests Table
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    folder_id TEXT,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    headers TEXT NOT NULL,
    body TEXT,
    auth_mode TEXT,
    auth_config TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Request History Table
CREATE TABLE IF NOT EXISTS request_history (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    request_name TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    status INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    response_size INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
```

---

> 💡 **Next Steps:** Review [API & IPC Reference](API-and-IPC-Reference) for IPC function signatures, or explore [Testing & QA Matrix](Testing-and-Quality-Assurance) for quality verification gates.
