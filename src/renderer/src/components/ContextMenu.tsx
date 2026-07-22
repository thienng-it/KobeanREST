import { Edit2, Eye, FolderTree, KeyRound, Plus, Trash2, Variable } from "lucide-react";
import type { SavedRequest } from "../types";

export interface ContextMenuTarget {
  id: string;
  type: "folder" | "request" | "collection";
}

export interface ContextMenuState {
  x: number;
  y: number;
  target: ContextMenuTarget | null;
}

const itemStyle = {
  background: "transparent",
  border: "none",
  padding: "6px 10px",
  fontSize: "13px",
  cursor: "pointer",
  borderRadius: "4px",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  pointerEvents: "auto",
} as const;

const requestItemStyle = {
  all: "unset",
  padding: "6px 10px",
  fontSize: "13px",
  cursor: "pointer",
  borderRadius: "4px",
} as const;

const dangerColor = { color: "var(--color-status-error)" };

function hoverHandlers() {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) =>
      (e.currentTarget.style.backgroundColor = "var(--color-surface-muted)"),
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) =>
      (e.currentTarget.style.backgroundColor = "transparent"),
  };
}

export interface ContextMenuProps {
  menu: ContextMenuState;
  requests: SavedRequest[];
  onClose: () => void;
  onCreateRequest: (folderId: string) => void;
  onCreateSubFolder: (folderId: string) => Promise<void> | void;
  onEditFolderAuth: (folderId: string) => void;
  onEditFolderScripts: (folderId: string) => void;
  onEditFolderVariables: (folderId: string) => void;
  onEditCollectionVariables: (collectionId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onStartRequestRename: (request: SavedRequest) => void;
  onViewRequest: (reqId: string) => void;
  onDeleteRequest: (reqId: string) => void;
}

export function ContextMenu({
  menu,
  requests,
  onClose,
  onCreateRequest,
  onCreateSubFolder,
  onEditFolderAuth,
  onEditFolderScripts,
  onEditFolderVariables,
  onEditCollectionVariables,
  onDeleteFolder,
  onStartRequestRename,
  onViewRequest,
  onDeleteRequest,
}: ContextMenuProps) {
  if (!menu) return null;
  const target = menu.target;

  return (
    <div
      className="context-menu"
      style={{
        position: "fixed",
        top: menu.y,
        left: menu.x,
        zIndex: 9999,
        border: "1px solid var(--color-border-modal)",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        minWidth: "160px",
        padding: "4px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        pointerEvents: "auto",
      }}
      onClick={() => alert("Container clicked!")}
    >
      {target?.type === "folder" && (
        <>
          <button
            className="context-menu-item"
            onClick={async (e) => {
              e.stopPropagation();
              alert("Context Menu: New Request clicked!");
              if (target.id) void onCreateRequest(target.id);
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <Plus size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> New Request
          </button>
          <button
            className="context-menu-item"
            onClick={async (e) => {
              e.stopPropagation();
              alert("Context Menu: New Folder clicked!");
              if (target.id) {
                await onCreateSubFolder(target.id);
              }
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <FolderTree size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> New Folder
          </button>
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (target.id) onEditFolderAuth(target.id);
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <KeyRound size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Edit Auth
          </button>
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (target.id) onEditFolderScripts(target.id);
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <Edit2 size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Edit Scripts
          </button>
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (target.id) onEditFolderVariables(target.id);
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <Variable size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Edit Variables
          </button>
          <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "4px 0" }} />
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (target.id) onDeleteFolder(target.id);
              onClose();
            }}
            style={{ ...itemStyle, ...dangerColor }}
            {...hoverHandlers()}
          >
            <Trash2 size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Delete Folder
          </button>
        </>
      )}
      {target?.type === "collection" && (
        <>
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (target.id) onEditCollectionVariables(target.id);
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <Variable size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Edit Variables
          </button>
        </>
      )}
      {target?.type === "request" && (
        <>
          <button
            className="context-menu-item"
            onClick={() => {
              const reqId = target.id;
              if (reqId) onStartRequestRename(requests.find((r) => r.id === reqId)!);
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            <Edit2 size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Rename
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              const reqId = target.id;
              if (reqId) onViewRequest(reqId);
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            <Eye size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> View Request
          </button>
          <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "4px 0" }} />
          <button
            className="context-menu-item"
            onClick={() => {
              const reqId = target.id;
              if (reqId) onDeleteRequest(reqId);
              onClose();
            }}
            style={{ ...requestItemStyle, ...dangerColor }}
            {...hoverHandlers()}
          >
            <Trash2 size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Delete Request
          </button>
        </>
      )}
    </div>
  );
}
