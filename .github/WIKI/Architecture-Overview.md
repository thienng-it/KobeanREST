# 📐 Architecture & Systems Engineering

KobeanREST is architected as a hybrid desktop application leveraging **Tauri 2** to achieve native-level desktop performance, minimal memory overhead, and strong OS-level security isolation.

---

## 🏗️ High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                React Renderer                                    │
│  - Application Shell (App.tsx)                                                   │
│  - Request Panel, Params Sync, Body Editor, Header Presets                       │
│  - Response Viewer (JSON, Raw, Headers, JQ Filter Engine via WASM)               │
│  - Workspace / Environment / Auth Modals                                         │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         │ Tauri IPC Protocol (JSON RPC)
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                              Rust Desktop Core                                   │
│  - IPC Command Dispatcher (lib.rs)                                               │
│  - HTTP Execution Engine (http_client.rs -> Reqwest/Tokio)                       │
│  - Local Database Persistence (persistence.rs -> Rusqlite/SQLite)               │
│  - Native OS Keychain Storage (secrets.rs -> Keyring crate)                     │
│  - System Info & Local Integrity (local_only.rs)                                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Architectural Components

### 1. Tauri 2 Desktop Shell (`src-tauri/`)
- **Native Windowing:** Manages application window lifecycle, menu bars, tray notifications, and native shortcuts.
- **IPC Dispatcher (`src-tauri/src/lib.rs`):** Intercepts frontend function calls and routes them asynchronously to native Rust implementations.
- **Updater Plugin (`tauri_plugin_updater`):** Handles background update checks and cryptographic signature validation using Ed25519 public keys.

### 2. Rust Native Backend Services (`src-tauri/src/`)
- **`http_client.rs`:** Executes non-CORS restricted HTTP/HTTPS network requests using Tokio and Reqwest. Bypasses standard browser origin restrictions, supports custom headers, binary payloads, basic/bearer auth, and custom TLS settings.
- **`persistence.rs`:** Embedded SQLite database management engine. Executes database schema migrations (`001_initial.sql`), performs ACID-compliant transactions for workspace switching, collection tree reordering, request history recording, and variable CRUD.
- **`secrets.rs`:** Integrates with native OS secrets infrastructure (macOS Keychain, Windows Credential Manager, Linux Secret Service). Ensures sensitive credentials are encrypted and stored outside SQLite.
- **`local_only.rs`:** Enforces local-only execution integrity, contract validation, and offline mode assurances.

### 3. Frontend Web Renderer (`src/renderer/src/`)
- **State Management & UI Shell (`App.tsx`):** Coordinates 30+ reactive sub-states across request building, sidebar trees, response views, modal dialogs, and settings persistence.
- **CodeMirror Integration:** Embedded CodeMirror 6 code editor providing syntax highlighting for JSON, JavaScript, headers, and request bodies.
- **WebAssembly Query Engine (`jq.wasm`):** Embedded JQ processor executing real-time data transformations directly in client memory without sending data out.
- **JS Sandbox Runtime (`services/script-runtime.ts`):** Isolated JavaScript execution sandbox handling pre-request and post-request test assertions and dynamic variable mutations (`pm.environment.set()`).

---

## 🔄 Variable Scoping & Resolution Hierarchy

When executing a request, variables specified in template syntax (`{{variable_name}}`) are resolved according to a strict cascading scope hierarchy:

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

1. **Resolution Pipeline (`src/renderer/src/services/variables.ts`):**
   - Extracts all template expressions matching `/\{\{([^}]+)\}\}/g`.
   - Traverses the active workspace tree from Request $\rightarrow$ Folder $\rightarrow$ Collection $\rightarrow$ Active Environment $\rightarrow$ Global variables.
   - Throws an `UnresolvedVariableError` if a variable is missing, aborting request execution before any network packet is dispatched.
   - Excludes secret variables from raw template interpolation to prevent accidental logging.

---

## 💾 Local SQLite Database Schema

Defined in `src-tauri/migrations/001_initial.sql`:

```sql
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    parent_folder_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

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
