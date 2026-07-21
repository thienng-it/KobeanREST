import { useState, useEffect } from "react";
import { saveFolderAuth, saveCollectionAuth } from "../services/local-store";
import { diagnosticMessage } from "../app-utils";
import type { ApiAuthMode, AuthConfig, WorkspaceSummary } from "../types";

export function useAuth(
  workspace: WorkspaceSummary | null,
  setWorkspace: React.Dispatch<React.SetStateAction<WorkspaceSummary | null>>
) {
  const [authEditorOpen, setAuthEditorOpen] = useState(false);
  const [authEditorTarget, setAuthEditorTarget] = useState<{ id: string; type: 'collection' | 'folder' } | null>(null);
  const [authDraft, setAuthDraft] = useState<{ mode: ApiAuthMode; config: AuthConfig }>({ mode: 'none', config: {} });

  useEffect(() => {
    if (authEditorTarget && workspace) {
      const { id, type } = authEditorTarget;
      let currentMode: ApiAuthMode = 'none';
      let currentConfig: AuthConfig = {};

      if (type === 'folder') {
        const folder = workspace.folders.find(f => f.id === id);
        if (folder) {
          currentMode = folder.authMode ?? 'none';
          currentConfig = folder.authConfig ?? {};
        }
      } else {
        const collection = workspace.collections?.find(c => c.id === id);
        if (collection) {
          currentMode = collection.authMode ?? 'none';
          currentConfig = collection.authConfig ?? {};
        }
      }
      setAuthDraft({ mode: currentMode, config: currentConfig });
    }
  }, [authEditorTarget, workspace]);

  async function handleSaveEntityAuth() {
    if (!authEditorTarget) return;
    const { id, type } = authEditorTarget;
    try {
      if (type === 'folder') {
        await saveFolderAuth(id, authDraft.mode, authDraft.config);
        setWorkspace(prev => {
          if (!prev) return null;
          return {
            ...prev,
            folders: prev.folders.map(f => f.id === id ? { ...f, authMode: authDraft.mode, authConfig: authDraft.config } : f)
          };
        });
      } else {
        await saveCollectionAuth(id, authDraft.mode, authDraft.config);
        setWorkspace(prev => {
          if (!prev) return null;
          return {
            ...prev,
            collections: prev.collections?.map(c => c.id === id ? { ...c, authMode: authDraft.mode, authConfig: authDraft.config } : c) || []
          };
        });
      }
      setAuthEditorOpen(false);
    } catch (err) {
      console.error("Failed to save entity auth", diagnosticMessage(err));
      alert("Failed to save authentication: " + diagnosticMessage(err));
    }
  }

  return {
    authEditorOpen, setAuthEditorOpen,
    authEditorTarget, setAuthEditorTarget,
    authDraft, setAuthDraft,
    handleSaveEntityAuth
  };
}
