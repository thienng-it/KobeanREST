import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, ScopedVariable, ScopedVariableEntityType, UpdateCheckPreview, WorkspaceListItem, WorkspaceSummary } from "../types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface PersistenceStatus {
  databasePath: string;
  migrated: boolean;
}

export interface RequestHistoryEntry {
  requestId: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  responseHeaders?: string;
  responseBodyText?: string;
  responseBodyBase64?: string;
  runId?: string;
  scopeId?: string;
  scopeName?: string;
  testPassed?: boolean;
  passedTests?: number;
  failedTests?: number;
  testResults?: Array<{ name: string; passed: boolean; error?: string }>;
}

export const defaultAppSettings: AppSettings = {
  updateChecksEnabled: false,
  theme: "system",
  exportRedactionEnabled: true,
  diagnosticsRedactionEnabled: true,
  offlineBehavior: "silent",
  timeoutMs: 30000,
  followRedirects: true,
  autoSaveEnabled: true,
  responseAutoWrap: true,
  responseAutoCollapse: false,
  language: "system",
  quotesEnabled: true,
  layoutMode: "stacked",
  uiDensity: "comfortable",
};

let previewSettings = { ...defaultAppSettings };

function isTauriRuntime() {
  return Boolean(window.__TAURI_INTERNALS__);
}

export async function initializeLocalStore(): Promise<PersistenceStatus> {
  if (!isTauriRuntime()) {
    return {
      databasePath: "browser-preview",
      migrated: true,
    };
  }

  return invoke<PersistenceStatus>("initialize_persistence");
}

const parseWorkspaceFields = (workspace: WorkspaceSummary) => {
  const parseFields = (entity: any) => {
    if (typeof entity.authConfig === "string") {
      try {
        entity.authConfig = JSON.parse(entity.authConfig);
      } catch {
        entity.authConfig = {};
      }
    }
    if (typeof entity.bodyForm === "string") {
      try {
        entity.bodyForm = JSON.parse(entity.bodyForm);
      } catch {
        entity.bodyForm = [];
      }
    }
    if (typeof (entity as any).queryParams === "string") {
      try {
        (entity as any).queryParams = JSON.parse((entity as any).queryParams);
      } catch {
        (entity as any).queryParams = [];
      }
    }
    if (typeof (entity as any).pathVariables === "string") {
      try {
        (entity as any).pathVariables = JSON.parse((entity as any).pathVariables);
      } catch {
        (entity as any).pathVariables = [];
      }
    }
  };

  workspace.requests?.forEach(parseFields);
  workspace.folders?.forEach(parseFields);
  workspace.collections?.forEach(parseFields);
  return workspace;
};

const DEFAULT_PREVIEW_WORKSPACE: WorkspaceSummary = {
  id: "preview-workspace-1",
  name: "Local Workspace",
  activeEnvironment: "Development",
  collections: [
    {
      id: "col-1",
      name: "JSONPlaceholder REST API",
      variables: []
    },
    {
      id: "col-2",
      name: "HTTP Testing Utilities",
      variables: []
    }
  ],
  folders: [
    {
      id: "f-1",
      name: "Users & Posts",
      collectionId: "col-1",
      variables: []
    },
    {
      id: "f-2",
      name: "Headers & Auth",
      collectionId: "col-2",
      variables: []
    }
  ],
  requests: [
    {
      id: "req-1",
      folderId: "f-1",
      name: "GET Users List",
      method: "GET",
      url: "{{baseUrl}}/users",
      headers: [
        { key: "Accept", value: "application/json", enabled: true }
      ],
      queryParams: [
        { key: "_limit", value: "5", enabled: true }
      ],
      body: "",
      bodyMimeType: "application/json",
      bodyForm: [],
      authMode: "none",
      authConfig: {},
      timeoutMs: 30000,
      followRedirects: true,
      variables: [],
      description: `# GET Users List\n\nRetrieves a paginated list of user accounts from JSONPlaceholder.\n\n### Query Parameters\n| Parameter | Type | Required | Description |\n| :--- | :--- | :--- | :--- |\n| \`_limit\` | integer | No | Maximum number of records to return |\n\n### Example Response\n\`\`\`json\n[\n  {\n    "id": 1,\n    "name": "Leanne Graham",\n    "username": "Bret",\n    "email": "Sincere@april.biz"\n  }\n]\n\`\`\``
    },
    {
      id: "req-2",
      folderId: "f-1",
      name: "POST Create Post",
      method: "POST",
      url: "{{baseUrl}}/posts",
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true }
      ],
      queryParams: [],
      body: '{\n  "title": "KobeanREST Web Preview",\n  "body": "Testing REST request execution directly in browser mode!",\n  "userId": 1\n}',
      bodyMimeType: "application/json",
      bodyForm: [],
      authMode: "none",
      authConfig: {},
      timeoutMs: 30000,
      followRedirects: true,
      variables: [],
      description: `# Create Post Endpoint\n\nCreates a new post resource on the remote backend.\n\n> [!NOTE]\n> Server returns an echo of the created payload with an assigned unique \`id\`.\n\n### Request Body Schema\n- \`title\` (string, required): Title of the post.\n- \`body\` (string, required): Content body.\n- \`userId\` (number, optional): Author identifier.`
    },
    {
      id: "req-3",
      folderId: "f-2",
      name: "GET Request Headers",
      method: "GET",
      url: "https://httpbin.org/headers",
      headers: [
        { key: "User-Agent", value: "KobeanREST-Web/1.0", enabled: true },
        { key: "X-Custom-Header", value: "KobeanREST-Demo", enabled: true }
      ],
      queryParams: [],
      body: "",
      bodyMimeType: "application/json",
      bodyForm: [],
      authMode: "none",
      authConfig: {},
      timeoutMs: 30000,
      followRedirects: true,
      variables: []
    }
  ],
  environments: [
    {
      name: "Development",
      variables: [
        { key: "baseUrl", value: "https://jsonplaceholder.typicode.com" },
        { key: "apiKey", value: "demo_key_dev_123" },
        { key: "secretToken", value: "[secret stored outside SQLite]", secretRef: "kobeanrest://secrets/demo/secretToken" }
      ]
    },
    {
      name: "Production",
      variables: [
        { key: "baseUrl", value: "https://api.example.com" },
        { key: "apiKey", value: "prod_key_xyz" }
      ]
    }
  ]
};

const isVsCodeWebview = () =>
  typeof (window as any).__kobeanrestInvoke === "function" ||
  typeof (window as any).acquireVsCodeApi === "function";

export async function loadLocalWorkspace(): Promise<WorkspaceSummary> {
  if (isVsCodeWebview() && typeof (window as any).__kobeanrestInvoke === "function") {
    try {
      const data = await (window as any).__kobeanrestInvoke("loadWorkspace");
      if (data && Array.isArray(data.collections)) {
        const collections = data.collections || [];
        const environments = data.environments || [];
        const activeEnvironment = data.activeEnvironment || "Development";

        const folders: any[] = [];
        const requests: any[] = [];

        const collectFoldersAndRequests = (folderList: any[], colId: string) => {
          for (const f of folderList) {
            folders.push({ ...f, collectionId: colId });
            if (Array.isArray(f.requests)) {
              requests.push(...f.requests.map((r: any) => ({ ...r, folderId: f.id })));
            }
            if (Array.isArray(f.folders)) {
              collectFoldersAndRequests(f.folders, colId);
            }
          }
        };

        for (const col of collections) {
          if (Array.isArray(col.requests)) {
            requests.push(...col.requests.map((r: any) => ({ ...r, folderId: col.id })));
          }
          if (Array.isArray(col.folders)) {
            collectFoldersAndRequests(col.folders, col.id);
          }
        }

        const summary: WorkspaceSummary = {
          id: "vscode-workspace",
          name: "VS Code Workspace",
          activeEnvironment,
          environments,
          collections: collections.map((c: any) => ({
            id: c.id,
            name: c.name,
            authMode: c.authMode,
            authConfig: c.authConfig,
            variables: c.variables,
          })),
          folders,
          requests,
        };
        return parseWorkspaceFields(summary);
      }
    } catch (err) {
      console.error("VS Code webview loadWorkspace failed:", err);
    }
  }

  if (!isTauriRuntime()) {
    try {
      const saved = localStorage.getItem("kr_browser_preview_workspace");
      if (saved) {
        return parseWorkspaceFields(JSON.parse(saved));
      }
    } catch {
      // fallback
    }
    localStorage.setItem("kr_browser_preview_workspace", JSON.stringify(DEFAULT_PREVIEW_WORKSPACE));
    return parseWorkspaceFields(JSON.parse(JSON.stringify(DEFAULT_PREVIEW_WORKSPACE)));
  }

  const workspace = await invoke<WorkspaceSummary>("load_workspace");
  return parseWorkspaceFields(workspace);
}

export async function recordRequestHistory(entry: RequestHistoryEntry): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const payload = { ...entry };
  if (payload.testResults && Array.isArray(payload.testResults)) {
    payload.testResults = JSON.stringify(payload.testResults) as any;
  }

  return invoke<void>("record_request_history", { entry: payload });
}

export async function exportWorkspaceData(): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Export is not available in browser preview");
  }
  return invoke<string>("export_workspace_data");
}

export async function importWorkspaceData(json: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Import is not available in browser preview");
  }
  return invoke<void>("import_workspace_data", { json });
}

export async function saveRequest(request: import("../types").SavedRequest): Promise<void> {
  if (isVsCodeWebview() && typeof (window as any).__kobeanrestInvoke === "function") {
    await (window as any).__kobeanrestInvoke("saveRequest", request);
    return;
  }
  if (!isTauriRuntime()) return;
  const payload = {
    ...request,
    authConfig: typeof request.authConfig === "object" ? JSON.stringify(request.authConfig) : request.authConfig,
    bodyForm: typeof request.bodyForm === "object" ? JSON.stringify(request.bodyForm) : request.bodyForm,
    queryParams: typeof request.queryParams === "object" ? JSON.stringify(request.queryParams) : request.queryParams
  };
  return invoke<void>("save_request", { request: payload });
}

export async function deleteRequest(requestId: string): Promise<void> {
  if (isVsCodeWebview() && typeof (window as any).__kobeanrestInvoke === "function") {
    await (window as any).__kobeanrestInvoke("deleteRequest", { id: requestId, requestId });
    return;
  }
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_request", { requestId });
}

export async function createFolder(name: string, collectionId?: string, parentId?: string): Promise<import("../types").FolderSummary> {
  if (isVsCodeWebview() && typeof (window as any).__kobeanrestInvoke === "function") {
    return (window as any).__kobeanrestInvoke("createFolder", { name, collectionId, parentId });
  }
  if (!isTauriRuntime()) {
    return { id: `preview-folder-${Date.now()}`, name, collectionId, parentId };
  }
  const folder = await invoke<import("../types").FolderSummary>("create_folder", { 
    name, 
    collectionId, 
    parentId 
  });
  if (typeof folder.authConfig === "string") {
    try { folder.authConfig = JSON.parse(folder.authConfig); } catch { folder.authConfig = {}; }
  }
  return folder;
}

export async function createWorkspace(name: string): Promise<string> {
  if (!isTauriRuntime()) return `preview-workspace-${Date.now()}`;
  return invoke<string>("create_workspace", { name });
}

export async function listWorkspaces(): Promise<WorkspaceListItem[]> {
  if (!window.__TAURI_INTERNALS__) {
    return [{ id: "local-workspace", name: "Local Workspace" }];
  }
  return invoke<WorkspaceListItem[]>("list_workspaces");
}

export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;
  return invoke<void>("rename_workspace", { workspaceId, name });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;
  return invoke<void>("delete_workspace", { workspaceId });
}

export async function switchWorkspace(workspaceId: string): Promise<WorkspaceSummary> {
  if (!window.__TAURI_INTERNALS__) return loadLocalWorkspace();
  const workspace = await invoke<WorkspaceSummary>("switch_workspace", { workspaceId });
  return parseWorkspaceFields(workspace);
}

export async function loadWorkspaceById(workspaceId: string): Promise<WorkspaceSummary> {
  if (!window.__TAURI_INTERNALS__) return loadLocalWorkspace();
  const workspace = await invoke<WorkspaceSummary>("load_workspace_by_id", { workspaceId });
  return parseWorkspaceFields(workspace);
}

export async function createCollection(name: string, workspaceId?: string): Promise<string> {
  if (isVsCodeWebview() && typeof (window as any).__kobeanrestInvoke === "function") {
    const col = await (window as any).__kobeanrestInvoke("createCollection", { name });
    return typeof col === "string" ? col : col?.id ?? `col-${Date.now()}`;
  }
  if (!isTauriRuntime()) return `preview-collection-${Date.now()}`;
  return invoke<string>("create_collection", { name, workspaceId: workspaceId ?? null });
}

export async function reorderItems(itemType: string, ids: string[]): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("reorder_items", { itemType, ids });
}

export async function updateFolder(folderId: string, name: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("update_folder", { folderId, name });
}



export async function moveFolder(folderId: string, parentId: string | undefined, collectionId: string | undefined): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("move_folder", { folderId, parentId, collectionId });
}

export async function updateCollection(collectionId: string, name: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("update_collection", { collectionId, name });
}

export async function updateCollectionDefaultEnvironment(collectionId: string, defaultEnvironment: string | null): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("update_collection_default_environment", { collectionId, defaultEnvironment });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  if (isVsCodeWebview() && typeof (window as any).__kobeanrestInvoke === "function") {
    await (window as any).__kobeanrestInvoke("deleteCollection", { id: collectionId });
    return;
  }
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_collection", { collectionId });
}

export async function deleteFolder(folderId: string): Promise<void> {
  if (isVsCodeWebview() && typeof (window as any).__kobeanrestInvoke === "function") {
    await (window as any).__kobeanrestInvoke("deleteFolder", { id: folderId });
    return;
  }
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_folder", { folderId });
}

export async function createRequest(folderId: string): Promise<import("../types").SavedRequest> {
  if (isVsCodeWebview() && typeof (window as any).__kobeanrestInvoke === "function") {
    const res = await (window as any).__kobeanrestInvoke("createRequest", { folderId });
    if (res) return res;
  }
  if (!isTauriRuntime()) {
    return {
      id: `preview-request-${Date.now()}`,
      name: "New Request",
      method: "GET",
      url: "",
      folderId,
      authMode: "none",
      authConfig: {},
      headers: [],
      body: "",
      bodyMimeType: "text/plain",
      bodyForm: [],
      queryParams: [],
      timeoutMs: 30000,
      followRedirects: true,
    };
  }
  const req = await invoke<import("../types").SavedRequest>("create_request", { folderId });
  if (typeof req.authConfig === "string") {
    try { req.authConfig = JSON.parse(req.authConfig); } catch { req.authConfig = {}; }
  }
  if (typeof req.bodyForm === "string") {
    try { req.bodyForm = JSON.parse(req.bodyForm); } catch { req.bodyForm = []; }
  }
  if (typeof (req as any).queryParams === "string") {
    try { req.queryParams = JSON.parse((req as any).queryParams); } catch { req.queryParams = []; }
  }
  return req;
}

export async function createEnvironment(name: string): Promise<import("../types").EnvironmentVariable[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  const env = await invoke<{ name: string; variables: import("../types").EnvironmentVariable[] }>("create_environment", { name });
  return env.variables;
}

export async function renameEnvironment(oldName: string, newName: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("rename_environment", { oldName, newName });
}

export async function deleteEnvironment(name: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_environment", { name });
}

const ENV_COLORS_KEY = "kr_env_colors";

export function loadEnvironmentColors(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ENV_COLORS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveEnvironmentColor(envName: string, color: string | null): void {
  const colors = loadEnvironmentColors();
  if (color) {
    colors[envName] = color;
  } else {
    delete colors[envName];
  }
  localStorage.setItem(ENV_COLORS_KEY, JSON.stringify(colors));
}

export async function setActiveEnvironment(name: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("set_active_environment", { name });
}

export async function saveVariable(environmentName: string, key: string, value: string, masked?: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_variable", { environmentName, key, value, masked: masked ?? false });
}

export async function deleteVariable(environmentName: string, key: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_variable", { environmentName, key });
}



export async function saveScopedVariable(
  entityId: string,
  entityType: ScopedVariableEntityType,
  key: string,
  value: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_scoped_variable", { entityId, entityType, key, value });
}



export async function deleteScopedVariable(
  entityId: string,
  entityType: ScopedVariableEntityType,
  key: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_scoped_variable", { entityId, entityType, key });
}

export async function getScopedVariables(
  entityId: string,
  entityType: ScopedVariableEntityType,
): Promise<ScopedVariable[]> {
  if (!isTauriRuntime()) return [];
  return invoke<ScopedVariable[]>("get_scoped_variables", { entityId, entityType });
}



export async function loadHistory(): Promise<import("../types").HistoryEntry[]> {
  if (!isTauriRuntime()) return [];
  return invoke<import("../types").HistoryEntry[]>("load_request_history");
}

export async function loadHistoryResponse(id: number): Promise<import("../types").HistoryResponsePayload | null> {
  if (!isTauriRuntime()) return null;
  return invoke<import("../types").HistoryResponsePayload>("load_history_response", { id });
}

export async function clearHistory(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("clear_request_history");
}

export async function loadCollectionRuns(scopeId: string): Promise<import("../types").CollectionRunSummary[]> {
  if (!isTauriRuntime()) return [];
  return invoke<import("../types").CollectionRunSummary[]>("load_collection_runs", { scopeId });
}

export async function loadCollectionRunDetails(runId: string): Promise<import("../types").HistoryEntry[]> {
  if (!isTauriRuntime()) return [];
  return invoke<import("../types").HistoryEntry[]>("load_collection_run_details", { runId });
}

export async function loadAppSettings(): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    return { ...previewSettings };
  }
  return invoke<AppSettings>("load_app_settings");
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  if (!isTauriRuntime()) {
    previewSettings = { ...settings };
    return;
  }
  return invoke<void>("save_app_settings", { settings });
}

export async function checkForUpdates(): Promise<UpdateCheckPreview> {
  if (!isTauriRuntime()) {
    return {
      enabledByDefault: false,
      requiresAccount: false,
      metadata: "Browser preview does not run signed updater checks.",
      releaseReady: false,
      message: "Updater checks are unavailable in browser preview.",
    };
  }
  return invoke<UpdateCheckPreview>("check_for_update");
}

export async function getScripts(entityId: string, entityType: string): Promise<import("../types").Script[]> {
  if (!isTauriRuntime()) return [];
  return invoke<import("../types").Script[]>("get_scripts", { entityId, entityType });
}

export async function getAllScripts(): Promise<import("../types").Script[]> {
  if (!isTauriRuntime()) return [];
  return invoke<import("../types").Script[]>("get_all_scripts");
}

export async function saveScript(entityId: string, entityType: string, scriptType: string, content: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_script", { entityId, entityType, scriptType, content });
}

export async function deleteScript(scriptId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_script", { scriptId });
}

export async function saveFolderAuth(folderId: string, authMode: import("../types").ApiAuthMode, authConfig: import("../types").AuthConfig): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_folder_auth", { folderId, authMode, authConfig });
}

export async function saveCollectionAuth(collectionId: string, authMode: import("../types").ApiAuthMode, authConfig: import("../types").AuthConfig): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_collection_auth", { collectionId, authMode, authConfig });
}

export async function saveFolderDescription(folderId: string, description: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_folder_description", { folderId, description });
}

export async function saveCollectionDescription(collectionId: string, description: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_collection_description", { collectionId, description });
}

export interface MockServerStatus {
  running: boolean;
  port: number;
  request_count: number;
  active_collection_id: string | null;
}

export async function startLocalMockServer(port = 3010, collectionId?: string): Promise<number> {
  if (!isTauriRuntime()) return port;
  return invoke<number>("start_local_mock_server", { port, collectionId: collectionId || null });
}

export async function stopLocalMockServer(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("stop_local_mock_server");
}

export async function getMockServerStatus(): Promise<MockServerStatus> {
  if (!isTauriRuntime()) return { running: false, port: 3010, request_count: 0, active_collection_id: null };
  return invoke<MockServerStatus>("get_mock_server_status");
}

export interface MockRoute {
  id: string;
  method: string;
  path: string;
  status_code: number;
  response_body: string;
  content_type: string;
  delay_ms: number;
  enabled: boolean;
}

export interface MockRequestLog {
  id: number;
  timestamp: number;
  method: string;
  path: string;
  matched_route_id: string | null;
  status_code: number;
  duration_ms: number;
}

export async function setMockRoutes(routes: MockRoute[]): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("set_mock_routes", { routes });
}

export async function getMockRoutes(): Promise<MockRoute[]> {
  if (!isTauriRuntime()) return [];
  return invoke<MockRoute[]>("get_mock_routes");
}

export async function getMockRequestLog(): Promise<MockRequestLog[]> {
  if (!isTauriRuntime()) return [];
  return invoke<MockRequestLog[]>("get_mock_request_log");
}

export async function clearMockRequestLog(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("clear_mock_request_log");
}

export async function exportOpenApiSpec(collectionId?: string, collectionName?: string): Promise<{ spec_json: string; format: string; title: string }> {
  if (!isTauriRuntime()) {
    return {
      spec_json: JSON.stringify({ openapi: "3.0.3", info: { title: collectionName || "KobeanREST Spec", version: "1.0.0" } }, null, 2),
      format: "json",
      title: collectionName || "KobeanREST Spec"
    };
  }
  return invoke("export_openapi_30_spec", { collectionId: collectionId || null, collectionName: collectionName || null });
}

export async function exportMcpManifest(): Promise<{ manifest_json: string; server_name: string; version: string }> {
  if (!isTauriRuntime()) {
    return {
      manifest_json: JSON.stringify({ name: "KobeanREST MCP Server", version: "1.0.0" }, null, 2),
      server_name: "KobeanREST MCP Server",
      version: "1.0.0"
    };
  }
  return invoke("export_mcp_manifest");
}

export async function executeMcpToolCall(toolName: string, argumentsJson: string): Promise<any> {
  if (!isTauriRuntime()) {
    return { status: "error", message: "Not in Tauri runtime" };
  }
  return invoke("execute_mcp_tool_call", { toolName, arguments: argumentsJson });
}
