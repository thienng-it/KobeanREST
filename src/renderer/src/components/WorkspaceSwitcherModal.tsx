import React, { useEffect, useRef, useState } from "react";
import { Check, Edit2, Plus, Trash2 } from "lucide-react";
import type { WorkspaceListItem } from "../types";
import "./modals/WorkspaceSwitcherModal.css";

export interface WorkspaceSwitcherModalProps {
  open?: boolean;
  isOpen?: boolean;
  activeWorkspaceId: string;
  workspaceList: WorkspaceListItem[];
  onCreate: (name: string) => void;
  onSwitch: (workspaceId: string) => void;
  onRename: (workspaceId: string, name: string) => void;
  onDelete: (workspaceId: string) => void;
  onClose: () => void;
}

export function WorkspaceSwitcherModal({
  open,
  isOpen,
  activeWorkspaceId,
  workspaceList,
  onCreate,
  onSwitch,
  onRename,
  onDelete,
  onClose,
}: WorkspaceSwitcherModalProps) {
  const isModalOpen = open ?? isOpen ?? false;
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const newNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isModalOpen) {
      setNewName("");
      setRenamingId(null);
      setTimeout(() => newNameRef.current?.focus(), 50);
    }
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewName("");
  };

  const handleRenameSubmit = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) onRename(id, trimmed);
    setRenamingId(null);
  };

  return (
    <div
      className="modal-overlay workspace-switcher-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Workspace switcher"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal workspace-switcher-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="workspace-switcher-header">
          <div>
            <span className="workspace-switcher-kicker">Workspaces</span>
            <h2 className="workspace-switcher-title">Manage Workspaces</h2>
          </div>
          <button
            type="button"
            className="workspace-switcher-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Workspace list */}
        <div className="workspace-switcher-list">
          {workspaceList.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <div
                key={ws.id}
                className={`workspace-switcher-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (!isActive) {
                    onSwitch(ws.id);
                    onClose();
                  }
                }}
              >
                {isActive && (
                  <Check
                    size={14}
                    style={{ color: "var(--color-text-active)", flexShrink: 0 }}
                  />
                )}
                {renamingId === ws.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => handleRenameSubmit(ws.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameSubmit(ws.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    spellCheck={false}
                    className="workspace-switcher-rename-input"
                  />
                ) : (
                  <span className="workspace-switcher-item-name">{ws.name}</span>
                )}
                <div
                  className="workspace-switcher-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label={`Rename ${ws.name}`}
                    title="Rename"
                    className="workspace-switcher-action-btn"
                    onClick={() => {
                      setRenamingId(ws.id);
                      setRenameDraft(ws.name);
                    }}
                  >
                    <Edit2 size={13} />
                  </button>
                  {workspaceList.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Delete ${ws.name}`}
                      title="Delete"
                      className="workspace-switcher-action-btn delete"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete workspace "${ws.name}"? All its data will be permanently removed.`
                          )
                        ) {
                          onDelete(ws.id);
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Create workspace */}
        <div className="workspace-switcher-create">
          <form onSubmit={handleCreate} className="workspace-switcher-create-form">
            <input
              ref={newNameRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New workspace name…"
              spellCheck={false}
              autoCorrect="off"
              className="workspace-switcher-input"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="workspace-switcher-create-btn"
            >
              <Plus size={14} /> Create
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
