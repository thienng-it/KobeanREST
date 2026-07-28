# 🔌 API & Inter-Process Communication (IPC) Reference

This specification documents the low-level Tauri Inter-Process Communication (IPC) boundary bridging the React frontend renderer with the native Rust desktop core.

---

## 📡 Tauri IPC Command Registry

Functions exposed via `invoke()` in `@tauri-apps/api/core`:

### 1. HTTP Execution Commands

```typescript
// Dispatches HTTP/HTTPS request via Rust Reqwest core engine
invoke<ExecuteHttpResponse>("execute_http_request", { request: SavedRequest });
```

### 2. Workspace & Persistence Operations

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

### 3. Collection & Folder Management

```typescript
invoke<Collection>("create_collection", { workspaceId: string, name: string });
invoke<void>("update_collection", { collectionId: string, name: string });
invoke<void>("delete_collection", { collectionId: string });
invoke<Folder>("create_folder", { collectionId: string, parentFolderId?: string, name: string });
invoke<void>("update_folder", { folderId: string, name: string });
invoke<void>("delete_folder", { folderId: string });
```

### 4. Request & History Operations

```typescript
invoke<SavedRequest>("create_request", { folderId?: string, collectionId?: string });
invoke<void>("save_request", { request: SavedRequest });
invoke<void>("delete_request", { requestId: string });
invoke<HistoryEntry[]>("load_request_history", { workspaceId: string });
invoke<void>("record_request_history", { entry: HistoryEntry });
invoke<void>("clear_request_history", { workspaceId: string });
```

### 5. Keychain Secret Operations

```typescript
invoke<void>("store_secret", { key: string, value: string });
invoke<void>("delete_secret", { key: string });
invoke<Record<string, string>>("resolve_secrets", { keys: string[] });
```

---

## 📜 Postman Scripting Shim API (`pm.*`)

KobeanREST supports dynamic scripting in Pre-request and Post-request tabs:

```javascript
// Environment and Global variable management
pm.environment.set("accessToken", "secret_bearer_token");
pm.environment.get("accessToken");
pm.globals.set("apiHost", "https://api.kobeanrest.com");

// Assertion tests
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});

pm.test("Response contains valid data array", function () {
    const json = pm.response.json();
    pm.expect(json.data).to.be.an("array");
});

// Response metadata inspection
console.log("Response Latency:", pm.response.responseTime + " ms");
```
