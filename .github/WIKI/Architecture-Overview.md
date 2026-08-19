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
│  │  - Path Variables Engine  │  │  - CodeMirror Viewer      │  │ - OAuth 2.0 PKCE Listener   │  │
│  │  - Docs Tab (Markdown)    │  │  - Response Headers / Log │  │ - Passcode Collection Lock  │  │
│  │  - gRPC / WebSocket Panes │  │  - Performance Telemetry  │  │ - Workspaces Hub Manager    │  │
│  └─────────────┬─────────────┘  └─────────────┬─────────────┘  └──────────────┬──────────────┘  │
│                │                              │                               │                 │
│                └──────────────────────────────┼───────────────────────────────┘                 │
│                                               │                                                 │
│                                               ├──────────────────────────────┐                  │
│                                               │                              │                  │
│                                               ▼                              ▼                  │
│                                      Tauri IPC (JSON-RPC)            Local Loopback HTTP        │
│                                                                      (Ollama @ 11434)           │
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
- **Persistence Engine (`persistence.rs`):** Manages SQLite connections via `rusqlite`. Handles transaction management, dynamic schema migrations, relational cascading deletes, and multi-workspace lifecycle state.
- **Secret Vault (`secrets.rs`):** Interoperates with native operating system keychains (`keyring` crate):
  - macOS: Keychain Services API
  - Windows: Credential Manager API
  - Linux: Secret Service API / DBus
- **Local Integrity Layer (`local_only.rs`):** Guarantees zero external network leakage from app internals.

### 3. Frontend Web Renderer (`src/renderer/src/`)
- **Application Shell (`App.tsx`):** Coordinates 30+ reactive states, tab switching, workspace navigation, modal management, and theme engines.
- **Workspaces Manager (`components/WorkspacesManager.tsx`):** Provides a visual dashboard to create, switch, export, and inspect workspaces and their constituent metrics.
- **Docs Editor (`components/DocsEditor.tsx`):** Integrated Markdown documentation authoring and preview engine for requests and collections.
- **AI Copilot Service (`services/ai-service.ts` & `components/AiChatSidebar.tsx`):** Communicates with local Ollama daemon for offline AI prompt processing, payload generation, and test writing.
- **Path Variables Service (`services/path-variables.ts`):** Automatically detects `:param` and `{param}` syntax in request URLs and handles parameter substitution.
- **Bulk Parameter Utilities (`services/bulk-param-utils.ts`):** Converts between key-value pairs and raw text blocks for rapid parameter authoring.
- **CodeMirror Integration:** Embedded CodeMirror 6 components for interactive request body editing, script writing, and JSON syntax highlighting.
- **WASM Query Engine (`jq.wasm`):** Client-side JQ filter execution compiled to WebAssembly. Enables real-time JSON filtering without network latency or external dependencies.
- **Sandbox Scripting Engine (`services/script-runtime.ts`):** Isolated JavaScript sandbox providing `pm.*` API compatibility for pre-request dynamic payload manipulation and post-request test assertions.

---

## 🔄 Dynamic Variable & Parameter Resolution Pipeline

Variables defined in template syntax (`{{VAR_NAME}}`) and URL path variables undergo hierarchical cascading resolution:

> [!NOTE]
> **Resolution Priority Cascade (Highest to Lowest):**  
> `Path Variables` $\rightarrow$ `Request-Level Vars` $\rightarrow$ `Folder-Level Vars` $\rightarrow$ `Collection-Level Vars` $\rightarrow$ `Active Environment` $\rightarrow$ `Global Scope`

```
┌──────────────────────────────────────────────────────────┐
│                   Path Variables (:param)                │  (Target URL Specific)
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
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

## 💾 SQLite Database Schema (`persistence.rs`)

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

-- Collections Table (supports collection lock configuration)
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    lock_config TEXT,
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
    folder_id TEXT,
    collection_id TEXT,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    headers TEXT NOT NULL,
    params TEXT NOT NULL,
    path_variables TEXT,
    body TEXT,
    body_type TEXT,
    auth TEXT,
    pre_script TEXT,
    post_script TEXT,
    docs TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Request History Table
CREATE TABLE IF NOT EXISTS request_history (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    request_id TEXT,
    url TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL,
    response_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
```

---

> 💡 **Next Steps:** Refer to [API & IPC Reference](API-and-IPC-Reference) for function bindings, or [Testing & QA Matrix](Testing-and-Quality-Assurance) for validation suites.
