import { useEffect, useState } from "react";
import {
  initializeLocalStore,
  loadLocalWorkspace,
  loadAppSettings,
  saveRequest,
  deleteRequest,
  createFolder,
  updateFolder,
  updateCollection,
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
  createCollection,
  createWorkspace,
  exportWorkspaceData,
  importWorkspaceData,
} from "../services/local-store";

import { diagnosticMessage } from "../app-utils";
import type { ContextMenuState } from "../components/ContextMenu";
import type { WorkspaceSummary, SavedRequest, ScopedVariable, ScopedVariableEntityType } from "../types";

interface ConfirmDialogState {
  message: string;
  onConfirm: () => void;
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
      setDatabasePath(persistence.databasePath);
      setWorkspace(localWorkspace);
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

  useEffect(() => {
    if (!workspace) return;
    setDraftRequest((prevDraft) => {
      // If we already have a draft for the selected request, keep it
      // so we don't overwrite unsaved edits when workspace saves in the background
      if (prevDraft && prevDraft.id === selectedRequestId) {
        return prevDraft;
      }
      const req = workspace.requests.find((r) => r.id === selectedRequestId);
      return req ? JSON.parse(JSON.stringify(req)) : null;
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

  async function handleCreateCollection() {
    const name = "New Collection";
    try {
      const collectionId = await createCollection(name);
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          collections: [...(prev.collections ?? []), { id: collectionId, name }]
        };
      });
    } catch (err) {
      console.error("Failed to create collection", diagnosticMessage(err));
      alert("Failed to create collection: " + diagnosticMessage(err));
    }
  }

  async function handleCreateWorkspace() {
    const name = prompt("Enter workspace name:");
    if (!name) return;
    try {
      console.log("Creating workspace:", name);
      await createWorkspace(name);
      console.log("Workspace created successfully, reloading workspace...");
      const updatedWorkspace = await loadLocalWorkspace();
      setWorkspace(updatedWorkspace);
    } catch (err) {
      console.error("Failed to create workspace", diagnosticMessage(err));
      alert("Failed to create workspace: " + diagnosticMessage(err));
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
      onConfirm: () => confirmDeleteFolder(folderId),
    });
  }

  async function handleDeleteCollection(collectionId: string) {
    setConfirmDialog({
      message: 'Delete this collection and all folders and requests inside it?',
      onConfirm: () => confirmDeleteCollection(collectionId),
    });
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
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

  async function handleDeleteEnvironment(name: string) {
    setConfirmDialog({
      message: `Delete environment "${name}" and all its variables?`,
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
        } catch (err) {
          console.error("Failed to delete environment", diagnosticMessage(err));
          setDeleteError("Failed to delete environment: " + diagnosticMessage(err));
        }
      },
    });
  }

  async function handleSaveVariable(envName: string, key: string, value: string) {
    try {
      await saveVariable(envName, key, value);
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
                ? e.variables.map(v => v.key === key ? { ...v, value } : v)
                : [...e.variables, { key, value }],
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
    handleDeleteRequest,
    handleCreateFolder,
    handleCreateCollection,
    handleCreateWorkspace,
    handleCreateSubFolder,
    handleDeleteFolder,
    handleDeleteCollection,
    toggleFolder,
    handleCreateRequest,
    importCurlRequest,
    handleSetActiveEnvironment,
    handleCreateEnvironment,
    handleDeleteEnvironment,
    handleSaveVariable,
    handleDeleteVariable,
    handleSaveScopedVariable,
    handleDeleteScopedVariable,
    handleRenameEnvironment,
    applyEnvironmentRename,
    cancelEnvironmentRename,
    handleLoadScriptStatuses,
    handleExport,
    handleImport,
  };
}

export type UseWorkspaceReturn = ReturnType<typeof useWorkspace>;
