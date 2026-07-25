import { useEffect, useState } from "react";
import { Plus, X, Folder, FolderTree, FileText, Check } from "lucide-react";
import type { WorkspaceSummary } from "../types";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export interface CreateRequestModalProps {
  open: boolean;
  workspace: WorkspaceSummary | null;
  initialFolderId?: string;
  onClose: () => void;
  onCreate: (name: string, method: string, locationTarget: string) => Promise<void>;
}

export type SelectedLocation =
  | { type: "collection"; id: string; name: string }
  | { type: "folder"; id: string; name: string }
  | { type: "new_collection"; name: string };

export function CreateRequestModal({
  open,
  workspace,
  initialFolderId,
  onClose,
  onCreate,
}: CreateRequestModalProps) {
  const [name, setName] = useState("New Request");
  const [method, setMethod] = useState("GET");
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isCreatingNewCollection, setIsCreatingNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("New Collection");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize initial selection and default values when opening
  useEffect(() => {
    if (open) {
      setName("New Request");
      setMethod("GET");
      setNewCollectionName("New Collection");
      setIsCreatingNewCollection(false);

      if (initialFolderId && workspace?.folders) {
        const matchingFolder = workspace.folders.find((f) => f.id === initialFolderId);
        if (matchingFolder) {
          setSelectedLocation({ type: "folder", id: matchingFolder.id, name: matchingFolder.name });
          return;
        }
      }

      if (workspace?.folders && workspace.folders.length > 0) {
        const firstFolder = workspace.folders[0];
        setSelectedLocation({ type: "folder", id: firstFolder.id, name: firstFolder.name });
      } else if (workspace?.collections && workspace.collections.length > 0) {
        const firstCol = workspace.collections[0];
        setSelectedLocation({ type: "collection", id: firstCol.id, name: firstCol.name });
      } else {
        setIsCreatingNewCollection(true);
        setSelectedLocation({ type: "new_collection", name: "New Collection" });
      }
    }
  }, [open, initialFolderId, workspace]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isSubmitting || !selectedLocation) return;

    let locationTargetString = "";
    if (selectedLocation.type === "new_collection") {
      const colName = (isCreatingNewCollection ? newCollectionName : selectedLocation.name).trim() || "New Collection";
      locationTargetString = `new_col:${colName}`;
    } else if (selectedLocation.type === "collection") {
      locationTargetString = `collection:${selectedLocation.id}`;
    } else {
      locationTargetString = `folder:${selectedLocation.id}`;
    }

    setIsSubmitting(true);
    try {
      await onCreate(trimmedName, method, locationTargetString);
      onClose();
    } catch (err) {
      console.error("Failed to create request from modal", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function getSaveButtonText(): string {
    if (isCreatingNewCollection) {
      return `Save to "${newCollectionName.trim() || "New Collection"}"`;
    }
    if (selectedLocation) {
      return `Save to "${selectedLocation.name}"`;
    }
    return "Create Request";
  }

  return (
    <div
      className="modal-overlay create-request-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Create new request"
      onClick={onClose}
    >
      <div className="modal create-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-request-modal-header">
          <div>
            <span className="create-request-modal-kicker">New Request</span>
            <h2><FileText size={16} /> Create Request</h2>
          </div>
          <button
            type="button"
            className="create-request-modal-close"
            aria-label="Close create request"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-request-modal-body">
          <div className="create-request-field">
            <label htmlFor="create-request-name" className="create-request-label">
              Request Name
            </label>
            <input
              id="create-request-name"
              type="text"
              className="create-request-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Get User Profile"
              spellCheck={false}
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          </div>

          <div className="create-request-field">
            <label htmlFor="create-request-method" className="create-request-label">
              HTTP Method
            </label>
            <select
              id="create-request-method"
              className={`create-request-select method-badge-${method.toLowerCase()}`}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ width: "160px" }}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="create-request-field">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label className="create-request-label">
                Select Collection or Folder to save:
              </label>
              {!isCreatingNewCollection && (
                <button
                  type="button"
                  className="create-request-inline-add-btn"
                  onClick={() => {
                    setIsCreatingNewCollection(true);
                    setSelectedLocation({ type: "new_collection", name: newCollectionName });
                  }}
                >
                  <Plus size={13} /> New Collection
                </button>
              )}
            </div>

            {isCreatingNewCollection ? (
              <div className="create-request-new-collection-box">
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px" }}>
                  Create New Collection
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="create-request-input"
                    value={newCollectionName}
                    onChange={(e) => {
                      setNewCollectionName(e.target.value);
                      setSelectedLocation({ type: "new_collection", name: e.target.value });
                    }}
                    placeholder="e.g. User Service API"
                    autoFocus
                  />
                  {(workspace?.collections && workspace.collections.length > 0) && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setIsCreatingNewCollection(false);
                        const col = workspace.collections![0];
                        setSelectedLocation({ type: "collection", id: col.id, name: col.name });
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="create-request-location-tree-box">
                {workspace?.collections && workspace.collections.length > 0 ? (
                  workspace.collections.map((col) => {
                    const isColSelected =
                      selectedLocation?.type === "collection" && selectedLocation.id === col.id;
                    const colFolders = (workspace.folders || []).filter(
                      (f) => f.collectionId === col.id,
                    );

                    return (
                      <div key={col.id} className="location-tree-group">
                        <div
                          className={`location-tree-item collection-item ${isColSelected ? "selected" : ""}`}
                          onClick={() => {
                            setSelectedLocation({ type: "collection", id: col.id, name: col.name });
                          }}
                        >
                          <div className="location-tree-item-left">
                            <FolderTree size={14} className="location-tree-icon collection" />
                            <span className="location-tree-name">{col.name}</span>
                          </div>
                          {isColSelected && <Check size={14} className="location-tree-check" />}
                        </div>

                        {colFolders.map((folder) => {
                          const isFolderSelected =
                            selectedLocation?.type === "folder" && selectedLocation.id === folder.id;
                          return (
                            <div
                              key={folder.id}
                              className={`location-tree-item folder-item ${isFolderSelected ? "selected" : ""}`}
                              onClick={() => {
                                setSelectedLocation({
                                  type: "folder",
                                  id: folder.id,
                                  name: folder.name,
                                });
                              }}
                            >
                              <div className="location-tree-item-left">
                                <Folder size={14} className="location-tree-icon folder" />
                                <span className="location-tree-name">{folder.name}</span>
                              </div>
                              {isFolderSelected && <Check size={14} className="location-tree-check" />}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  <div className="location-tree-empty">
                    No collections found in this workspace. Click "+ New Collection" above to create one.
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        <div className="create-request-modal-footer">
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || (isCreatingNewCollection && !newCollectionName.trim()) || isSubmitting}
          >
            <Plus size={14} /> {getSaveButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
}



