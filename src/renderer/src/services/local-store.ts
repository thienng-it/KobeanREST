import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, ScopedVariable, ScopedVariableEntityType, UpdateCheckPreview, WorkspaceSummary } from "../types";

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
}

export const defaultAppSettings: AppSettings = {
  updateChecksEnabled: false,
  theme: "system",
  exportRedactionEnabled: true,
  diagnosticsRedactionEnabled: true,
  offlineBehavior: "silent",
  timeoutMs: 30000,
  followRedirects: true,
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

export async function loadLocalWorkspace(): Promise<WorkspaceSummary> {
  if (!isTauriRuntime()) {
    throw new Error("Workspace loading is not available in browser preview");
  }

  return invoke<WorkspaceSummary>("load_workspace");
}

export async function recordRequestHistory(entry: RequestHistoryEntry): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  return invoke<void>("record_request_history", { entry });
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
  if (!isTauriRuntime()) return;
  return invoke<void>("save_request", { request });
}

export async function deleteRequest(requestId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_request", { requestId });
}

export async function createFolder(name: string, collectionId?: string, parentId?: string): Promise<import("../types").FolderSummary> {
  if (!isTauriRuntime()) {
    return { id: `preview-folder-${Date.now()}`, name, collectionId, parentId };
  }
  return invoke<import("../types").FolderSummary>("create_folder", { 
    name, 
    collectionId, 
    parentId 
  });
}

export async function createWorkspace(name: string): Promise<string> {
  if (!isTauriRuntime()) return `preview-workspace-${Date.now()}`;
  return invoke<string>("create_workspace", { name });
}

export async function createCollection(name: string): Promise<string> {
  if (!isTauriRuntime()) return `preview-collection-${Date.now()}`;
  return invoke<string>("create_collection", { name });
}

export async function updateFolder(folderId: string, name: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("update_folder", { folderId, name });
}

export async function updateCollection(collectionId: string, name: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("update_collection", { collectionId, name });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_collection", { collectionId });
}

export async function deleteFolder(folderId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_folder", { folderId });
}

export async function createRequest(folderId: string): Promise<import("../types").SavedRequest> {
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
      timeoutMs: 30000,
      followRedirects: true,
    };
  }
  return invoke<import("../types").SavedRequest>("create_request", { folderId });
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

export async function setActiveEnvironment(name: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("set_active_environment", { name });
}

export async function saveVariable(environmentName: string, key: string, value: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_variable", { environmentName, key, value });
}

export async function deleteVariable(environmentName: string, key: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("delete_variable", { environmentName, key });
}

export async function saveSecretVariable(environmentName: string, key: string, secretRef: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_secret_variable", { environmentName, key, secretRef });
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

export async function saveScopedSecretVariable(
  entityId: string,
  entityType: ScopedVariableEntityType,
  key: string,
  secretRef: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("save_scoped_secret_variable", { entityId, entityType, key, secretRef });
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

export async function resolveSecrets(refIds: string[]): Promise<Record<string, string>> {
  if (!isTauriRuntime()) return {};
  return invoke<Record<string, string>>("resolve_secrets", { refIds });
}

export async function loadHistory(): Promise<import("../types").HistoryEntry[]> {
  if (!isTauriRuntime()) return [];
  return invoke<import("../types").HistoryEntry[]>("load_request_history");
}

export async function clearHistory(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("clear_request_history");
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
