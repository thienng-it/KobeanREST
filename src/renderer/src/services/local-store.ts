import { invoke } from "@tauri-apps/api/core";
import { sampleWorkspace } from "../data/sample-workspace";
import type { AppSettings, UpdateCheckPreview, WorkspaceSummary } from "../types";

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
    return sampleWorkspace;
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

export async function createFolder(name: string): Promise<import("../types").FolderSummary> {
  if (!isTauriRuntime()) {
    return { id: `preview-folder-${Date.now()}`, name };
  }
  return invoke<import("../types").FolderSummary>("create_folder", { name });
}

export async function updateFolder(folderId: string, name: string): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("update_folder", { folderId, name });
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
