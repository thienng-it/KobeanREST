# 🔌 API & IPC Reference Specification

This reference documents the Tauri Inter-Process Communication (IPC) boundary bridging the React frontend renderer with the Rust desktop core.

---

## 📡 Tauri IPC Command Registry

Functions exposed via `invoke()` in `@tauri-apps/api/core`:

### 1. HTTP Execution Commands

```typescript
// Invokes native Reqwest HTTP engine
invoke<ExecuteHttpResponse>("execute_http_request", { request: SavedRequest });
```

### 2. Workspace & Persistence Commands

```typescript
invoke<void>("initialize_persistence");
invoke<WorkspaceSummary>("load_workspace");
invoke<WorkspaceSummary>("load_workspace_by_id", { workspaceId: string });
invoke<WorkspaceSummary[]>("list_workspaces");
invoke<WorkspaceSummary>("create_workspace", { name: string });
invoke<void>("rename_workspace", { workspaceId: string, name: string });
invoke<void>("delete_workspace", { workspaceId: string });
invoke<WorkspaceSummary>("switch_workspace", { workspaceId: string });
```

### 3. Collection & Folder Commands

```typescript
invoke<Collection>("create_collection", { workspaceId: string, name: string });
invoke<void>("update_collection", { collectionId: string, name: string });
invoke<void>("delete_collection", { collectionId: string });
invoke<Folder>("create_folder", { collectionId: string, parentFolderId?: string, name: string });
invoke<void>("update_folder", { folderId: string, name: string });
invoke<void>("delete_folder", { folderId: string });
```

### 4. Request & History Commands

```typescript
invoke<SavedRequest>("create_request", { folderId?: string, collectionId?: string });
invoke<void>("save_request", { request: SavedRequest });
invoke<void>("delete_request", { requestId: string });
invoke<HistoryEntry[]>("load_request_history", { workspaceId: string });
invoke<void>("record_request_history", { entry: HistoryEntry });
invoke<void>("clear_request_history", { workspaceId: string });
```

### 5. Keychain Secret Commands

```typescript
invoke<void>("store_secret", { key: string, value: string });
invoke<void>("delete_secret", { key: string });
invoke<Record<string, string>>("resolve_secrets", { keys: string[] });
```

---

## 📜 Scripting Shim Reference (`pm.*`)

KobeanREST supports Postman-compatible scripting shims in Pre-request and Post-request script tabs:

```javascript
// Variable getters and setters
pm.environment.set("token", "secret_value_123");
pm.environment.get("token");
pm.globals.set("baseUrl", "https://api.example.com");

// Assertion tests
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Response inspection
console.log("Response time:", pm.response.responseTime);
console.log("Response body:", pm.response.json());
```
