import { useEffect, useRef, useState } from "react";
import {
  initializeLocalStore,
  loadLocalWorkspace,
  loadAppSettings,
  saveRequest,
  deleteRequest,
  createFolder,
  updateFolder,
  saveFolderAuth,
  updateCollection,
  saveCollectionAuth,
  updateCollectionDefaultEnvironment,
  deleteCollection,
  deleteFolder,
  createRequest,
  createEnvironment,
  renameEnvironment,
  deleteEnvironment,
  setActiveEnvironment,
  saveVariable,
  deleteVariable,
  saveScopedVariable,
  deleteScopedVariable,
  getScripts,
  saveScript,
  createCollection,
  createWorkspace,
  exportWorkspaceData,
  importWorkspaceData,
  listWorkspaces,
  renameWorkspace,
  deleteWorkspace,
  switchWorkspace,
  loadEnvironmentColors,
  saveEnvironmentColor,
} from "../services/local-store";

import { diagnosticMessage } from "../app-utils";
import type { ContextMenuState } from "../components/ContextMenu";
import type { WorkspaceSummary, WorkspaceListItem, SavedRequest, ScopedVariable, ScopedVariableEntityType, HttpMethod, FolderSummary } from "../types";
import type { PostmanCollectionImportResult, PostmanEnvironmentImportResult } from "../services/postman-import";
import { isSensitiveKey } from "../services/variables";

export interface ConfirmDialogState {
  title?: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  altLabel?: string;
  onAlt?: () => void;
}

export interface UseWorkspaceDeps {
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
  onWorkspaceLoaded: (loadedSettings: import("../types").AppSettings) => void;
  autoSaveEnabled?: boolean;
}

export function useWorkspace(deps: UseWorkspaceDeps) {
  const { setConfirmDialog, onWorkspaceLoaded, autoSaveEnabled } = deps;

  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [draftRequest, setDraftRequest] = useState<SavedRequest | null>(null);
  const [databasePath, setDatabasePath] = useState("browser-preview");
  const [scriptStatus, setScriptStatus] = useState<Record<string, boolean>>({});
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [collectionSearch, setCollectionSearch] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [renamingSidebarItem, setRenamingSidebarItem] = useState<{ id: string; type: "folder" | "collection" } | null>(null);
  const [sidebarNameDraft, setSidebarNameDraft] = useState("");
  const [renamingRequestId, setRenamingRequestId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [envEditorTarget, setEnvEditorTarget] = useState<string>("");
  const [renamingEnvironment, setRenamingEnvironment] = useState("");
  const [environmentNameDraft, setEnvironmentNameDraft] = useState("");
  const [workspaceList, setWorkspaceList] = useState<WorkspaceListItem[]>([]);
  const [importToast, setImportToast] = useState<{ message: string; tone: "info" | "success" | "error" } | null>(null);

  function showImportToast(message: string, tone: "info" | "success" | "error", durationMs = 3500) {
    setImportToast({ message, tone });
    setTimeout(() => setImportToast(null), durationMs);
  }

  async function handleLoadScriptStatuses() {
    try {
      const statuses: Record<string, boolean> = {};

      if (!workspace) return;

      for (const folder of workspace.folders) {
        const scripts = await getScripts(folder.id, 'folder');
        statuses[folder.id] = scripts.length > 0;
      }

      for (const request of workspace.requests) {
        const scripts = await getScripts(request.id, 'request');
        statuses[request.id] = scripts.length > 0;
      }

      setScriptStatus(statuses);
    } catch (err) {
      console.error("Failed to load script statuses", diagnosticMessage(err));
    }
  }

  async function loadWorkspace() {
    try {
      const persistence = await initializeLocalStore();
      const localWorkspace = await loadLocalWorkspace();
      const loadedSettings = await loadAppSettings();
      const envColors = loadEnvironmentColors();
      
      // Hydrate environment colors
      localWorkspace.environments = localWorkspace.environments.map(env => ({
        ...env,
        color: envColors[env.name]
      }));

      setDatabasePath(persistence.databasePath);
      setWorkspace(localWorkspace);
      const list = await listWorkspaces();
      setWorkspaceList(list);
      setSelectedRequestId((currentRequestId) => {
        if (localWorkspace.requests.some((request) => request.id === currentRequestId)) {
          return currentRequestId;
        }
        return localWorkspace.requests[0]?.id ?? currentRequestId;
      });
      onWorkspaceLoaded(loadedSettings);
      void handleLoadScriptStatuses();
    } catch (error) {
      console.error("Failed to load local workspace", diagnosticMessage(error));
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const draftRequestRef = useRef<SavedRequest | null>(null);
  draftRequestRef.current = draftRequest;

  useEffect(() => {
    if (!workspace) return;
    // If switching away from a different request with unsaved edits, flush them immediately
    // so the auto-save timer cancellation (caused by draftRequest changing) doesn't lose the changes.
    const prevDraft = draftRequestRef.current;
    if (prevDraft && prevDraft.id !== selectedRequestId && autoSaveEnabled) {
      const originalReq = workspace.requests.find((r) => r.id === prevDraft.id);
      if (originalReq && JSON.stringify(originalReq) !== JSON.stringify(prevDraft)) {
        void saveRequest(prevDraft).then(() => {
          setWorkspace((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              requests: prev.requests.map((r) => r.id === prevDraft.id ? prevDraft : r),
            };
          });
        });
      }
    }
    setDraftRequest((prevDraft) => {
      // If we already have a draft for the selected request, keep it
      // (crucial for in-memory unsaved requests like temp_* that are not yet in workspace.requests,
      // and to preserve active edits when workspace saves in the background)
      if (prevDraft && prevDraft.id === selectedRequestId) {
        return prevDraft;
      }
      const req = workspace.requests.find((r) => r.id === selectedRequestId);
      if (!req) {
        return null;
      }
      return JSON.parse(JSON.stringify(req));
    });
  }, [selectedRequestId, workspace]);

  // Auto-save logic
  useEffect(() => {
    if (!autoSaveEnabled || !draftRequest || !workspace) return;
    const originalReq = workspace.requests.find((r) => r.id === draftRequest.id);
    if (!originalReq || JSON.stringify(originalReq) === JSON.stringify(draftRequest)) return;

    const timer = setTimeout(() => {
      void handleSaveRequest();
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [draftRequest, autoSaveEnabled]);

  function startRequestRename(request: SavedRequest) {
    setRenamingSidebarItem(null);
    setSelectedRequestId(request.id);
    setRenameDraft(draftRequest?.id === request.id ? draftRequest.name : request.name);
    setRenamingRequestId(request.id);
  }

  function stopRequestRename() {
    setRenamingRequestId("");
  }

  async function applyRequestRename(requestId: string) {
    const nextName = renameDraft.trim();
    if (!nextName) {
      const request = workspace?.requests.find((item) => item.id === requestId);
      setRenameDraft(request?.name ?? "");
      setRenamingRequestId("");
      return;
    }

    const request = workspace?.requests.find((item) => item.id === requestId);
    if (request) {
      const updatedRequest = { ...request, name: nextName };
      try {
        await saveRequest(updatedRequest);
        setWorkspace(prev => {
          if (!prev) return null;
          return {
            ...prev,
            requests: prev.requests.map(r => r.id === requestId ? updatedRequest : r)
          };
        });
        
        setDraftRequest((current) => {
          if (!current || current.id !== requestId) return current;
          return { ...current, name: nextName };
        });
      } catch (err) {
        console.error("Failed to rename request", diagnosticMessage(err));
        alert("Failed to rename: " + diagnosticMessage(err));
      }
    }
    
    setRenamingRequestId("");
  }

  function startSidebarRename(type: "folder" | "collection", id: string, name: string) {
    setRenamingRequestId("");
    setRenamingSidebarItem({ id, type });
    setSidebarNameDraft(name);
  }

  function cancelSidebarRename() {
    setRenamingSidebarItem(null);
    setSidebarNameDraft("");
  }

  async function applySidebarRename() {
    const target = renamingSidebarItem;
    if (!target) return;

    const nextName = sidebarNameDraft.trim();
    if (!nextName) {
      cancelSidebarRename();
      return;
    }

    try {
      if (target.type === "folder") {
        await updateFolder(target.id, nextName);
        setWorkspace((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            folders: prev.folders.map((folder) =>
              folder.id === target.id ? { ...folder, name: nextName } : folder,
            ),
          };
        });
      } else {
        await updateCollection(target.id, nextName);
        setWorkspace((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            collections: prev.collections?.map((collection) =>
              collection.id === target.id ? { ...collection, name: nextName } : collection,
            ) ?? [],
          };
        });
      }
      cancelSidebarRename();
    } catch (err) {
      console.error("Failed to rename sidebar item", diagnosticMessage(err));
      alert("Failed to rename: " + diagnosticMessage(err));
    }
  }

  const handleUpdateCollectionDefaultEnvironment = async (collectionId: string, defaultEnvironment: string | null) => {
    try {
      await updateCollectionDefaultEnvironment(collectionId, defaultEnvironment);
      setWorkspace((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          collections: prev.collections?.map((collection) =>
            collection.id === collectionId ? { ...collection, defaultEnvironment: defaultEnvironment ?? undefined } : collection,
          ) ?? [],
        };
      });
    } catch (err) {
      console.error("Failed to update collection default environment", diagnosticMessage(err));
      alert("Failed to update collection default environment: " + diagnosticMessage(err));
    }
  };


  async function handleSaveRequest() {
    if (!draftRequest) return;
    try {
      await saveRequest(draftRequest);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          requests: prev.requests.map(r => r.id === draftRequest.id ? draftRequest : r)
        };
      });
    } catch (err) {
      console.error("Failed to save request", diagnosticMessage(err));
      alert("Failed to save request: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteRequest(reqId: string) {
    setConfirmDialog({
      message: 'Are you sure you want to delete this request?',
      confirmVariant: "danger",
      onConfirm: () => confirmDeleteRequest(reqId),
    });
  }

  async function confirmDeleteRequest(reqId: string) {
    setDeleteError(null);
    try {
      await deleteRequest(reqId);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          requests: prev.requests.filter(r => r.id !== reqId)
        };
      });
      if (selectedRequestId === reqId) {
        setSelectedRequestId(prev => {
          if (!workspace) return "";
          const remaining = workspace.requests.filter(r => r.id !== reqId);
          return remaining.find(r => r.id !== prev)?.id ?? remaining[0]?.id ?? "";
        });
      }
    } catch (err) {
      console.error(diagnosticMessage(err));
      setDeleteError("Failed to delete request: " + diagnosticMessage(err));
    }
  }

  async function handleCreateFolder(collectionId?: string, parentId?: string) {
    if (!workspace) return;
    const name = "New Folder";
    try {
      const targetCollectionId = collectionId ?? workspace.collections?.[0]?.id;
      const newFolder = await createFolder(name, targetCollectionId, parentId);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          folders: [...prev.folders, newFolder]
        };
      });
    } catch (err) {
      console.error("Failed to create folder", diagnosticMessage(err));
      alert("Failed to create folder: " + diagnosticMessage(err));
    }
  }

  async function handleCreateCollection(targetWorkspaceId?: string) {
    const name = "New Collection";
    try {
      const activeWsId = targetWorkspaceId || workspace?.id;
      const collectionId = await createCollection(name, activeWsId);
      if (activeWsId && activeWsId !== workspace?.id) {
        await handleSwitchWorkspace(activeWsId);
      } else {
        setWorkspace(prev => {
          if (!prev) return null;
          return {
            ...prev,
            collections: [...(prev.collections ?? []), { id: collectionId, name }]
          };
        });
      }
    } catch (err) {
      console.error("Failed to create collection", diagnosticMessage(err));
      alert("Failed to create collection: " + diagnosticMessage(err));
    }
  }

  async function handleCreateSubFolder(folderId: string) {
    if (!workspace) return;
    try {
      const parentFolder = workspace.folders?.find(f => f.id === folderId);
      const collectionId = parentFolder?.collectionId;
      await handleCreateFolder(collectionId, folderId);
    } catch (err) {
      console.error("Failed to create subfolder", diagnosticMessage(err));
      alert("Failed to create subfolder: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteFolder(folderId: string) {
    setConfirmDialog({
      message: 'Are you sure you want to delete this folder and all its requests?',
      confirmVariant: "danger",
      onConfirm: () => confirmDeleteFolder(folderId),
    });
  }

  async function handleDeleteCollection(collectionId: string) {
    setConfirmDialog({
      message: 'Delete this collection and all folders and requests inside it?',
      confirmVariant: "danger",
      onConfirm: () => confirmDeleteCollection(collectionId),
    });
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  }

  function expandAllFolders() {
    setCollapsedFolders({});
  }

  function collapseAllFolders() {
    if (!workspace) return;
    const allCollapsed: Record<string, boolean> = {};
    workspace.folders.forEach((f) => {
      allCollapsed[f.id] = true;
    });
    workspace.collections?.forEach((c) => {
      allCollapsed[c.id] = true;
    });
    setCollapsedFolders(allCollapsed);
  }

  function expandCollectionFolders(collectionId: string) {
    if (!workspace) return;
    setCollapsedFolders(prev => {
      const next = { ...prev };
      delete next[collectionId];
      workspace.folders.forEach((f) => {
        if (f.collectionId === collectionId) {
          delete next[f.id];
        }
      });
      return next;
    });
  }

  function collapseCollectionFolders(collectionId: string) {
    if (!workspace) return;
    setCollapsedFolders(prev => {
      const next = { ...prev };
      next[collectionId] = true;
      workspace.folders.forEach((f) => {
        if (f.collectionId === collectionId) {
          next[f.id] = true;
        }
      });
      return next;
    });
  }

  async function confirmDeleteFolder(folderId: string) {
    setDeleteError(null);
    try {
      await deleteFolder(folderId);
      setCollapsedFolders(prev => {
        const next = { ...prev };
        delete next[folderId];
        return next;
      });
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          folders: prev.folders.filter(f => f.id !== folderId),
          requests: prev.requests.filter(r => r.folderId !== folderId)
        };
      });
    } catch (err) {
      console.error(diagnosticMessage(err));
      setDeleteError("Failed to delete folder: " + diagnosticMessage(err));
    }
  }

  async function confirmDeleteCollection(collectionId: string) {
    setDeleteError(null);
    if (!workspace) return;
    const folderIds = new Set(
      workspace.folders
        .filter((folder) => folder.collectionId === collectionId)
        .map((folder) => folder.id),
    );

    try {
      await deleteCollection(collectionId);
      setRenamingSidebarItem((current) => (
        current?.type === "collection" && current.id === collectionId ? null : current
      ));
      setCollapsedFolders((prev) => {
        const next = { ...prev };
        for (const folderId of folderIds) {
          delete next[folderId];
        }
        return next;
      });
      setWorkspace((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          collections: prev.collections?.filter((collection) => collection.id !== collectionId) ?? [],
          folders: prev.folders.filter((folder) => folder.collectionId !== collectionId),
          requests: prev.requests.filter((request) => !folderIds.has(request.folderId)),
        };
      });
      if (draftRequest && folderIds.has(draftRequest.folderId)) {
        setDraftRequest(null);
      }
      if (selectedRequestId && workspace.requests.some((request) => request.id === selectedRequestId && folderIds.has(request.folderId))) {
        setSelectedRequestId("");
      }
    } catch (err) {
      console.error(diagnosticMessage(err));
      setDeleteError("Failed to delete collection: " + diagnosticMessage(err));
    }
  }

  async function handleSetActiveEnvironment(name: string) {
    try {
      await setActiveEnvironment(name);
      setWorkspace(prev => {
        if (!prev) return null;
        return { ...prev, activeEnvironment: name };
      });
    } catch (err) {
      console.error("Failed to set active environment", diagnosticMessage(err));
    }
  }

  async function handleCreateEnvironment() {
    if (!workspace) return;
    const existingNames = new Set(workspace.environments.map((environment) => environment.name));
    const baseName = "New Environment";
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name)) {
      name = `${baseName} ${suffix}`;
      suffix += 1;
    }

    try {
      await createEnvironment(name);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          environments: [...prev.environments, { name, variables: [] }],
        };
      });
      setEnvEditorTarget(name);
    } catch (err) {
      console.error("Failed to create environment", diagnosticMessage(err));
      alert("Failed to create environment: " + diagnosticMessage(err));
    }
  }

  function startEnvironmentRename(name: string) {
    setRenamingEnvironment(name);
    setEnvironmentNameDraft(name);
  }

  function cancelEnvironmentRename() {
    setRenamingEnvironment("");
    setEnvironmentNameDraft("");
  }

  async function handleRenameEnvironment(oldName: string) {
    startEnvironmentRename(oldName);
  }

  async function applyEnvironmentRename(oldName: string) {
    const newName = environmentNameDraft.trim();
    if (!newName || newName === oldName) {
      cancelEnvironmentRename();
      return;
    }

    if (!workspace || workspace.environments.some((environment) => environment.name === newName && environment.name !== oldName)) {
      alert(`Environment "${newName}" already exists.`);
      return;
    }

    try {
      await renameEnvironment(oldName, newName);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          activeEnvironment: prev.activeEnvironment === oldName ? newName : prev.activeEnvironment,
          environments: prev.environments.map(e =>
            e.name === oldName ? { ...e, name: newName } : e
          ),
        };
      });
      if (envEditorTarget === oldName) setEnvEditorTarget(newName);
      cancelEnvironmentRename();
    } catch (err) {
      console.error("Failed to rename environment", diagnosticMessage(err));
      alert("Failed to rename environment: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteEnvironment(name: string, onSuccess?: () => void) {
    setConfirmDialog({
      message: `Delete environment "${name}" and all its variables?`,
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteEnvironment(name);
          setWorkspace(prev => {
            if (!prev) return null;
            const environments = prev.environments.filter(e => e.name !== name);
            return {
              ...prev,
              activeEnvironment: prev.activeEnvironment === name ? environments[0]?.name ?? "" : prev.activeEnvironment,
              environments,
            };
          });
          if (envEditorTarget === name) {
            setEnvEditorTarget(prev => {
              if (!workspace) return "";
              const remaining = workspace.environments.filter(e => e.name !== name);
              return remaining[0]?.name ?? "";
            });
          }
          onSuccess?.();
        } catch (err) {
          console.error("Failed to delete environment", diagnosticMessage(err));
          setDeleteError("Failed to delete environment: " + diagnosticMessage(err));
        }
      },
    });
  }

  function handleSetEnvironmentColor(name: string, color: string | null) {
    saveEnvironmentColor(name, color);
    setWorkspace(prev => {
      if (!prev) return null;
      return {
        ...prev,
        environments: prev.environments.map(e => 
          e.name === name ? { ...e, color: color || undefined } : e
        )
      };
    });
  }

  async function handleSaveVariable(envName: string, key: string, value: string, masked?: boolean) {
    try {
      await saveVariable(envName, key, value, masked);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          environments: prev.environments.map(e => {
            if (e.name !== envName) return e;
            const exists = e.variables.some(v => v.key === key);
            return {
              ...e,
              variables: exists
                ? e.variables.map(v => v.key === key ? { ...v, value, masked } : v)
                : [...e.variables, { key, value, masked }],
            };
          }),
        };
      });
    } catch (err) {
      console.error("Failed to save variable", diagnosticMessage(err));
      alert("Failed to save variable: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteVariable(envName: string, key: string) {
    try {
      await deleteVariable(envName, key);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          environments: prev.environments.map(e =>
            e.name === envName
              ? { ...e, variables: e.variables.filter(v => v.key !== key) }
              : e
          ),
        };
      });
    } catch (err) {
      console.error("Failed to delete variable", diagnosticMessage(err));
      alert("Failed to delete variable: " + diagnosticMessage(err));
    }
  }

  /** Patch the `variables` array of a scoped entity (collection/folder/request) in workspace state. */
  function patchScopedVariables(
    entityId: string,
    entityType: ScopedVariableEntityType,
    updater: (vars: ScopedVariable[]) => ScopedVariable[],
  ) {
    setWorkspace(prev => {
      if (!prev) return null;
      if (entityType === "collection") {
        return {
          ...prev,
          collections: (prev.collections ?? []).map(c =>
            c.id === entityId ? { ...c, variables: updater(c.variables ?? []) } : c
          ),
        };
      }
      if (entityType === "folder") {
        return {
          ...prev,
          folders: prev.folders.map(f =>
            f.id === entityId ? { ...f, variables: updater(f.variables ?? []) } : f
          ),
        };
      }
      if (entityType === "request") {
        setDraftRequest(current => {
          if (!current || current.id !== entityId) return current;
          return { ...current, variables: updater(current.variables ?? []) };
        });
      }

      return {
        ...prev,
        requests: prev.requests.map(r =>
          r.id === entityId ? { ...r, variables: updater(r.variables ?? []) } : r
        ),
      };
    });
  }

  async function handleSaveScopedVariable(
    entityId: string,
    entityType: ScopedVariableEntityType,
    key: string,
    value: string,
  ) {
    try {
      await saveScopedVariable(entityId, entityType, key, value);
      patchScopedVariables(entityId, entityType, vars => {
        const exists = vars.some(v => v.key === key);
        return exists
          ? vars.map(v => v.key === key ? { ...v, value } : v)
          : [...vars, { key, value }];
      });
    } catch (err) {
      console.error("Failed to save scoped variable", diagnosticMessage(err));
      alert("Failed to save variable: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteScopedVariable(
    entityId: string,
    entityType: ScopedVariableEntityType,
    key: string,
  ) {
    try {
      await deleteScopedVariable(entityId, entityType, key);
      patchScopedVariables(entityId, entityType, vars => vars.filter(v => v.key !== key));
    } catch (err) {
      console.error("Failed to delete scoped variable", diagnosticMessage(err));
      alert("Failed to delete variable: " + diagnosticMessage(err));
    }
  }

  async function handleCreateWorkspace(name: string) {
    try {
      await createWorkspace(name);
      const list = await listWorkspaces();
      setWorkspaceList(list);
    } catch (err) {
      alert("Failed to create workspace: " + diagnosticMessage(err));
    }
  }

  async function handleSwitchWorkspace(workspaceId: string) {
    try {
      const loaded = await switchWorkspace(workspaceId);
      setWorkspace(loaded);
      setSelectedRequestId(null);
      setDraftRequest(null);
      const list = await listWorkspaces();
      setWorkspaceList(list);
    } catch (err) {
      alert("Failed to switch workspace: " + diagnosticMessage(err));
    }
  }

  async function handleRenameWorkspace(workspaceId: string, name: string) {
    try {
      await renameWorkspace(workspaceId, name);
      setWorkspace((prev) => (prev && prev.id === workspaceId ? { ...prev, name } : prev));
      setWorkspaceList((prev) => prev.map((w) => (w.id === workspaceId ? { ...w, name } : w)));
    } catch (err) {
      alert("Failed to rename workspace: " + diagnosticMessage(err));
    }
  }

  async function handleDeleteWorkspace(workspaceId: string) {
    try {
      await deleteWorkspace(workspaceId);
      const list = await listWorkspaces();
      setWorkspaceList(list);
      if (workspace?.id === workspaceId && list.length > 0) {
        const loaded = await switchWorkspace(list[0].id);
        setWorkspace(loaded);
        setSelectedRequestId(null);
        setDraftRequest(null);
      }
    } catch (err) {
      alert("Failed to delete workspace: " + diagnosticMessage(err));
    }
  }

  async function handleCreateRequest(folderId: string) {
    try {
      const newReq = await createRequest(folderId);
      setCollapsedFolders(prev => ({
        ...prev,
        [folderId]: false,
      }));
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          requests: [...prev.requests, newReq]
        };
      });
      setSelectedRequestId(newReq.id);
    } catch (err) { 
      console.error(diagnosticMessage(err)); 
    }
  }

  async function handleCreateRequestWithDetails(
    name: string,
    method: string,
    locationTarget: string,
    targetWorkspaceId?: string
  ) {
    try {
      const activeWsId = targetWorkspaceId || workspace?.id;

      if (activeWsId && activeWsId !== workspace?.id) {
        await handleSwitchWorkspace(activeWsId);
      }

      let targetFolderId = "";
      let createdColObj: { id: string; name: string } | null = null;

      const cleanTarget = locationTarget.replace(/^(collection|folder|new_col):/, "").trim();
      const targetLower = cleanTarget.toLowerCase();
      const rawLower = locationTarget.toLowerCase();

      if (locationTarget.startsWith("new_col:")) {
        const colName = cleanTarget || "New Collection";
        const colId = await createCollection(colName, activeWsId);
        createdColObj = { id: colId, name: colName };
        targetFolderId = colId;
      } else {
        // Match existing folder by ID or Name (case-insensitive)
        const matchingFolder = workspace?.folders.find(
          (f) =>
            f.id === cleanTarget ||
            f.id === locationTarget ||
            f.name.toLowerCase() === targetLower ||
            f.name.toLowerCase() === rawLower
        );

        if (matchingFolder) {
          targetFolderId = matchingFolder.id;
        } else {
          // Match existing collection by ID or Name (case-insensitive)
          const matchingCol = workspace?.collections?.find(
            (c) =>
              c.id === cleanTarget ||
              c.id === locationTarget ||
              c.name.toLowerCase() === targetLower ||
              c.name.toLowerCase() === rawLower
          );

          if (matchingCol) {
            targetFolderId = matchingCol.id;
          } else if (cleanTarget) {
            targetFolderId = cleanTarget;
          }
        }
      }

      if (!targetFolderId) {
        if (workspace && workspace.folders.length > 0) {
          targetFolderId = workspace.folders[0].id;
        } else {
          let colId = workspace?.collections?.[0]?.id;
          if (!colId) {
            colId = await createCollection("Default Collection", activeWsId);
            createdColObj = { id: colId, name: "Default Collection" };
          }
          targetFolderId = colId;
        }
      }

      const newReq = await createRequest(targetFolderId);
      const updatedReq: SavedRequest = {
        ...newReq,
        name: name.trim() || "New Request",
        method: (method as HttpMethod) || "GET",
      };
      await saveRequest(updatedReq);

      setCollapsedFolders((prev) => ({
        ...prev,
        [targetFolderId]: false,
      }));

      // Re-fetch fresh local workspace to ensure collections, folders, and request are synchronized
      try {
        const freshWorkspace = await loadLocalWorkspace();
        setWorkspace(freshWorkspace);
      } catch {
        setWorkspace((prev) => {
          if (!prev) return null;
          const nextCols = [...(prev.collections || [])];
          if (createdColObj && !nextCols.some((c) => c.id === createdColObj!.id)) {
            nextCols.push(createdColObj);
          }
          const nextFolders = [...(prev.folders || [])];
          const existing = prev.requests.filter((r) => r.id !== newReq.id);
          return {
            ...prev,
            collections: nextCols,
            folders: nextFolders,
            requests: [...existing, updatedReq],
          };
        });
      }

      setSelectedRequestId(updatedReq.id);
      return updatedReq;
    } catch (err) {
      console.error(diagnosticMessage(err));
      return null;
    }
  }

  async function handleDuplicateRequest(reqId: string) {
    if (!workspace) return;
    const reqToDup = workspace.requests.find((r) => r.id === reqId);
    if (!reqToDup) return;
    try {
      const newReq = await createRequest(reqToDup.folderId);
      const duplicatedReq = {
        ...reqToDup,
        id: newReq.id, // keep the newly generated UUID
        name: `${reqToDup.name} (copy)`,
      };
      await saveRequest(duplicatedReq);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          requests: [...prev.requests, duplicatedReq]
        };
      });
      setSelectedRequestId(duplicatedReq.id);
    } catch (err) {
      console.error("Failed to duplicate request", diagnosticMessage(err));
      alert("Failed to duplicate request: " + diagnosticMessage(err));
    }
  }

  async function importCurlRequest(fields: Partial<SavedRequest>) {
    try {
      let targetFolderId = workspace?.folders?.[0]?.id;
      if (!targetFolderId) {
        let targetCollectionId = workspace?.collections?.[0]?.id;
        if (!targetCollectionId) {
          targetCollectionId = await createCollection("Imported");
          setWorkspace(prev => prev ? { ...prev, collections: [...(prev.collections ?? []), { id: targetCollectionId!, name: "Imported" }] } : null);
        }
        const folder = await createFolder("Imported Requests", targetCollectionId, undefined);
        targetFolderId = folder.id;
        setWorkspace(prev => prev ? { ...prev, folders: [...(prev.folders ?? []), folder] } : null);
      }

      const newReq = await createRequest(targetFolderId);
      const updatedReq = { 
        ...newReq, 
        ...fields, 
        name: fields.name || "Imported cURL request" 
      } as SavedRequest;
      
      await saveRequest(updatedReq);
      
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          requests: [...prev.requests, updatedReq]
        };
      });
      setSelectedRequestId(newReq.id);
    } catch (err) {
      console.error(diagnosticMessage(err));
      alert("Failed to import curl: " + diagnosticMessage(err));
    }
  }

  async function handleExport() {
    try {
      const json = await exportWorkspaceData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kobeanrest-workspace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export workspace", diagnosticMessage(err));
      alert("Failed to export workspace: " + diagnosticMessage(err));
    }
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const json = await file.text();
        await importWorkspaceData(json);
        await loadWorkspace();
        alert("Workspace imported successfully. Imported data has been added as new workspace(s); current view is unchanged.");
      } catch (err) {
        console.error("Failed to import workspace", diagnosticMessage(err));
        alert("Failed to import workspace: " + diagnosticMessage(err));
      }
    };
    input.click();
  }


  async function handleImportPostmanCollection(
    result: PostmanCollectionImportResult,
    options: { stripScripts: boolean } = { stripScripts: false }
  ) {
    try {
      const { stripScripts } = options;

      const doImport = async (finalCollectionName: string, overrideCollectionId?: string) => {
        try {
          if (overrideCollectionId) {
            setDraftRequest(null);
            setSelectedRequestId("");
            await deleteCollection(overrideCollectionId);
          }

          const totalRequests = result.requests.length;
          const totalFolders = result.folders.length;
          showImportToast(`Importing "${finalCollectionName}"…`, "info");

          // Create collection
          const collectionId = await createCollection(finalCollectionName);
          if (result.collectionAuthMode) {
            await saveCollectionAuth(collectionId, result.collectionAuthMode, result.collectionAuthConfig || {});
          }

          // Set up a folder mapping for nested folders
          const folderIdMap: Record<string, string> = {};

          // Helper to create folders with proper parent hierarchy
          async function createFoldersRecursively(
            folders: PostmanCollectionImportResult["folders"],
            parentId?: string
          ) {
            const immediateChildren = folders.filter(f => f.parentId === parentId);
            for (const folder of immediateChildren) {
              const newFolder = await createFolder(folder.name, collectionId, folderIdMap[folder.parentId!] ?? undefined);
              folderIdMap[folder.id] = newFolder.id;
              if (folder.authMode) {
                await saveFolderAuth(newFolder.id, folder.authMode, folder.authConfig || {});
              }
              if (folder.variables.length > 0) {
                for (const v of folder.variables) {
                  await saveScopedVariable(newFolder.id, "folder", v.key, v.value);
                }
              }
              if (!stripScripts) {
                if (folder.preScript) await saveScript(newFolder.id, "folder", "pre", folder.preScript);
                if (folder.postScript) await saveScript(newFolder.id, "folder", "post", folder.postScript);
              }
              await createFoldersRecursively(folders, folder.id);
            }
          }

          await createFoldersRecursively(result.folders);

          let defaultFolderId: string | undefined;
          const hasRootRequests = result.requests.some(r => !r.folderId);
          if (hasRootRequests) {
            const defaultFolder = await createFolder("Requests", collectionId, undefined);
            defaultFolderId = defaultFolder.id;
          }

          if (result.collectionVariables.length > 0) {
            for (const v of result.collectionVariables) {
              await saveScopedVariable(collectionId, "collection", v.key, v.value);
            }
          }

          if (!stripScripts) {
            if (result.collectionPreScript) await saveScript(collectionId, "collection", "pre", result.collectionPreScript);
            if (result.collectionPostScript) await saveScript(collectionId, "collection", "post", result.collectionPostScript);
          }

          let firstReqId: string | undefined;
          let imported = 0;
          for (const req of result.requests) {
            const targetFolderId = req.folderId ? folderIdMap[req.folderId] : defaultFolderId;
            if (!targetFolderId) continue;
            const newReq = await createRequest(targetFolderId);
            if (!firstReqId) firstReqId = newReq.id;
            const updatedReq: SavedRequest = {
              ...newReq,
              name: req.name,
              method: req.method as SavedRequest["method"],
              url: req.url,
              headers: req.headers,
              queryParams: req.queryParams,
              body: req.body,
              bodyMimeType: req.bodyMimeType,
              bodyForm: req.bodyForm,
              authMode: req.authMode,
              authConfig: req.authConfig,
              variables: req.variables,
            };
            await saveRequest(updatedReq);
            if (!stripScripts) {
              if (req.preScript) await saveScript(newReq.id, "request", "pre", req.preScript);
              if (req.postScript) await saveScript(newReq.id, "request", "post", req.postScript);
            }
            imported++;
            if (totalRequests > 5 && imported % Math.ceil(totalRequests / 4) === 0) {
              showImportToast(`Importing "${finalCollectionName}"… ${imported}/${totalRequests} requests`, "info");
            }
          }

          setDraftRequest(null);
          setSelectedRequestId("");
          await loadWorkspace();
          if (firstReqId) {
            setSelectedRequestId(firstReqId);
          }

          const scriptNote = stripScripts ? " (scripts stripped)" : "";
          const renamedNote = finalCollectionName !== result.collectionName ? ` → renamed to "${finalCollectionName}"` : "";
          showImportToast(
            `✓ Imported "${finalCollectionName}"${renamedNote}: ${totalRequests} requests, ${totalFolders} folders${scriptNote}`,
            "success",
            5000
          );
        } catch (err) {
          console.error("Failed to import Postman collection inside doImport", diagnosticMessage(err));
          showImportToast("Import failed: " + diagnosticMessage(err), "error", 6000);
        }
      };

      const existingCollection = workspace?.collections?.find(c => c.name === result.collectionName);

      if (existingCollection) {
        setConfirmDialog({
          title: "Collection Already Exists",
          message: `A collection named "${result.collectionName}" already exists. Do you want to override it or add this as a new collection?`,
          confirmLabel: "Override Collection",
          confirmVariant: "danger",
          onConfirm: () => {
            doImport(result.collectionName, existingCollection.id);
          },
          altLabel: "Add as New Collection",
          onAlt: () => {
            let suffix = 2;
            const existingNames = new Set((workspace?.collections ?? []).map(c => c.name));
            let newName = `${result.collectionName} (${suffix})`;
            while (existingNames.has(newName)) {
              suffix++;
              newName = `${result.collectionName} (${suffix})`;
            }
            doImport(newName);
          }
        });
      } else {
        doImport(result.collectionName);
      }
    } catch (err) {

      console.error("Failed to import Postman collection", diagnosticMessage(err));
      showImportToast("Import failed: " + diagnosticMessage(err), "error", 6000);
    }
  }

  async function handleImportPostmanEnvironment(result: PostmanEnvironmentImportResult) {
    try {
      // Deduplicate environment name
      const existingNames = new Set((workspace?.environments ?? []).map(e => e.name));
      let envName = result.name;
      let isUpdate = false;
      if (existingNames.has(envName)) {
        // Check if user would want to update: auto-suffix instead
        let suffix = 2;
        while (existingNames.has(`${result.name} (${suffix})`)) suffix++;
        envName = `${result.name} (${suffix})`;
        isUpdate = true;
      }

      showImportToast(`Importing environment "${envName}"…`, "info");

      await createEnvironment(envName);

      for (const v of result.variables) {
        await saveVariable(envName, v.key, v.value, isSensitiveKey(v.key));
      }

      await loadWorkspace();

      const renamedNote = isUpdate ? ` → renamed to "${envName}"` : "";
      showImportToast(
        `✓ Imported environment "${envName}"${renamedNote}: ${result.variables.length} variables`,
        "success",
        4000
      );
    } catch (err) {
      console.error("Failed to import Postman environment", diagnosticMessage(err));
      showImportToast("Import failed: " + diagnosticMessage(err), "error", 6000);
    }
  }

  async function handleMoveItem(type: "folder" | "request" | "collection", draggedId: string, targetId: string, position: "top" | "bottom" | "inside") {
    if (!workspace) return;
    try {
      const { reorderItems, saveRequest, moveFolder } = await import("../services/local-store");

      const reportError = (msg: string, err: unknown) => {
        console.error(msg, err);
        setDeleteError(String(err));
      };

      if (type === "collection") {
        const collections = workspace.collections ?? [];
        const ids = collections.map(c => c.id);
        const fromIdx = ids.indexOf(draggedId);
        const targetIdx = ids.indexOf(targetId);
        if (fromIdx === -1 || targetIdx === -1 || fromIdx === targetIdx) return;

        const next = [...ids];
        next.splice(fromIdx, 1);
        let insertIdx = targetIdx > fromIdx ? targetIdx - 1 : targetIdx;
        insertIdx = position === "bottom" ? insertIdx + 1 : insertIdx;
        next.splice(insertIdx, 0, draggedId);

        const ordered = next.map(id => collections.find(c => c.id === id)!).filter(Boolean);
        setWorkspace({ ...workspace, collections: ordered });
        await reorderItems("collection", next);
        return;
      }

      if (type === "folder") {
        const dragged = workspace.folders.find(f => f.id === draggedId);
        const target = workspace.folders.find(f => f.id === targetId);
        if (!dragged) return;

        // Drop into a folder → reparent + reorder; drop onto a sibling → reorder within same parent.
        let newParentId: string | undefined;
        let newCollectionId: string | undefined;
        if (position === "inside" && target) {
          // Guard: cannot drop a folder into itself or one of its descendants.
          if (target.id === dragged.id) return;
          const isDescendant = (ancestorId: string, candidateId: string): boolean => {
            let cur: string | undefined = candidateId;
            const seen = new Set<string>();
            while (cur) {
              if (cur === ancestorId) return true;
              if (seen.has(cur)) return false; // ponytail: cycle guard, positions are tree-shaped but defend anyway
              seen.add(cur);
              cur = workspace.folders.find(f => f.id === cur)?.parentId;
            }
            return false;
          };
          if (isDescendant(dragged.id, target.id)) return;
          newParentId = target.id;
          newCollectionId = target.collectionId ?? dragged.collectionId;
        } else if (target) {
          newParentId = target.parentId;
          newCollectionId = target.collectionId ?? dragged.collectionId;
        } else {
          return;
        }

        const sameScope =
          dragged.parentId === newParentId && dragged.collectionId === newCollectionId;

        // Compute the new sibling order optimistically.
        const siblings = (workspace.folders ?? []).filter(
          f => f.parentId === newParentId && (f.collectionId ?? undefined) === (newCollectionId ?? undefined),
        );
        let ids = siblings.map(f => f.id);
        const draggedIdx = ids.indexOf(draggedId);
        if (draggedIdx > -1) ids.splice(draggedIdx, 1);

        if (position === "inside" || !target) {
          ids.push(draggedId);
        } else {
          // Re-insert relative to target after removal (target index may shift if it was after dragged).
          let targetIdx = ids.indexOf(target.id);
          if (targetIdx === -1) ids.push(draggedId);
          else {
            const insertIdx = position === "top" ? targetIdx : targetIdx + 1;
            ids.splice(insertIdx, 0, draggedId);
          }
        }

        // Reparent dragged in local state + reorder folders array to match sibling order.
        const updatedDragged = { ...dragged, parentId: newParentId, collectionId: newCollectionId };
        let foldersList = workspace.folders.map(f => (f.id === dragged.id ? updatedDragged : f));
        if (!sameScope) {
          // Rebuild the array so the dragged folder sits in its new sibling group order.
          const byId = new Map(foldersList.map(f => [f.id, f] as const));
          const orderedIds = new Set(ids);
          const moved: typeof foldersList = [];
          for (const id of ids) {
            const f = byId.get(id);
            if (f) moved.push(f);
          }
          const rest = foldersList.filter(f => !orderedIds.has(f.id));
          foldersList = [...rest, ...moved];
        }

        setWorkspace({ ...workspace, folders: foldersList });

        if (!sameScope) {
          await moveFolder(dragged.id, newParentId, newCollectionId);
        }
        await reorderItems("folder", ids);
        return;
      }

      if (type === "request") {
        const dragged = workspace.requests.find(r => r.id === draggedId);
        let targetFolderId: string | undefined;
        let targetReqId: string | undefined;

        // Target might be a folder (inside) or another request (top/bottom)
        const targetFolder = workspace.folders.find(f => f.id === targetId);
        if (targetFolder) {
          targetFolderId = targetFolder.id;
        } else {
          const targetReq = workspace.requests.find(r => r.id === targetId);
          if (targetReq) {
            targetFolderId = targetReq.folderId;
            targetReqId = targetReq.id;
          }
        }

        if (!dragged || !targetFolderId) return;

        let requestsList = [...workspace.requests];

        // If moved to a new folder, update the request!
        if (dragged.folderId !== targetFolderId) {
          const updatedRequest = { ...dragged, folderId: targetFolderId };

          // Fire and forget for optimistic UI
          saveRequest(updatedRequest).catch(err => reportError("Save request failed", err));

          requestsList = requestsList.map(r => r.id === dragged.id ? updatedRequest : r);
        }

        // Reorder
        const list = requestsList.filter(r => r.folderId === targetFolderId);
        const ids = list.map(r => r.id);

        const draggedIdx = ids.indexOf(draggedId);
        if (draggedIdx > -1) ids.splice(draggedIdx, 1);

        if (targetReqId) {
          let targetIdx = ids.indexOf(targetReqId);
          if (targetIdx === -1) ids.push(draggedId);
          else {
            const insertIdx = position === "top" ? targetIdx : targetIdx + 1;
            ids.splice(insertIdx, 0, draggedId);
          }
        } else {
          // Dropped "inside" a folder, put at the end
          ids.push(draggedId);
        }

        // Optimistic UI reorder
        const otherRequests = requestsList.filter(r => r.folderId !== targetFolderId);
        const targetRequests = ids.map(id => requestsList.find(r => r.id === id)!);
        requestsList = [...otherRequests, ...targetRequests];

        setWorkspace({
          ...workspace,
          requests: requestsList,
        });

        await reorderItems("request", ids);
      }
    } catch (err) {
      console.error("Failed to move item", err);
      setDeleteError("Move Item Error: " + String(err));
    }
  }

  return {
    workspace,
    setWorkspace,
    selectedRequestId,
    setSelectedRequestId,
    draftRequest,
    setDraftRequest,
    databasePath,
    scriptStatus,
    collapsedFolders,
    collectionSearch,
    setCollectionSearch,
    deleteError,
    setDeleteError,
    renamingSidebarItem,
    sidebarNameDraft,
    setSidebarNameDraft,
    renamingRequestId,
    renameDraft,
    setRenameDraft,
    contextMenu,
    setContextMenu,
    envEditorTarget,
    setEnvEditorTarget,
    renamingEnvironment,
    setRenamingEnvironment,
    environmentNameDraft,
    setEnvironmentNameDraft,
    startRequestRename,
    stopRequestRename,
    applyRequestRename,
    startSidebarRename,
    cancelSidebarRename,
    applySidebarRename,
    handleSaveRequest,
    handleDuplicateRequest,
    handleDeleteRequest,
    handleCreateFolder,
    handleCreateCollection,
    workspaceList,
    handleCreateWorkspace,
    handleSwitchWorkspace,
    handleRenameWorkspace,
    handleDeleteWorkspace,
    updateCollectionDefaultEnvironment: handleUpdateCollectionDefaultEnvironment,
    handleCreateSubFolder,
    handleDeleteFolder,
    handleDeleteCollection,
    toggleFolder,
    expandAllFolders,
    collapseAllFolders,
    expandCollectionFolders,
    collapseCollectionFolders,
    
    handleUpdateFolder: async (folder: import('../types').FolderSummary) => {
      if (!workspace) return;
      await saveFolderAuth(folder.id, folder.authMode || "none", folder.authConfig || {});
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          folders: prev.folders.map(f => f.id === folder.id ? folder : f)
        };
      });
    },

    handleUpdateCollection: async (collection: import('../types').CollectionSummary) => {
      if (!workspace) return;
      await import('../services/local-store').then(m => m.saveCollectionAuth(collection.id, collection.authMode || "none", collection.authConfig || {}));
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          collections: prev.collections?.map(c => c.id === collection.id ? collection : c) || []
        };
      });
    },

    handleCreateRequest,
    handleCreateRequestWithDetails,
    importCurlRequest,
    handleSetActiveEnvironment,
    handleCreateEnvironment,
    handleDeleteEnvironment,
    handleSetEnvironmentColor,
    handleSaveVariable,
    handleDeleteVariable,
    handleSaveScopedVariable,
    handleDeleteScopedVariable,
    handleRenameEnvironment,
    applyEnvironmentRename,
    cancelEnvironmentRename,
    handleLoadScriptStatuses,
    loadWorkspace,
    handleExport,
    handleImport,
    handleImportPostmanCollection,
    handleImportPostmanEnvironment,
    handleMoveItem,
    importToast,
    setImportToast,
  };
}

export type UseWorkspaceReturn = ReturnType<typeof useWorkspace>;
