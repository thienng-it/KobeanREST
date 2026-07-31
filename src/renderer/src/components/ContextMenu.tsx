import { Copy, Edit2, Eye, FolderTree, KeyRound, Play, Plus, Trash2, Variable, Terminal, Upload, Download, FileText, Settings } from "lucide-react";
import type { SavedRequest } from "../types";

export interface ContextMenuTarget {
  id: string;
  type: "folder" | "request" | "collection" | "workspace" | "selection" | "tab";
  selectionText?: string;
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
  onCreateFolder: (collectionId: string) => Promise<void> | void;
  onCreateSubFolder: (folderId: string) => Promise<void> | void;
  onEditFolderAuth: (folderId: string) => void;
  onEditFolderScripts: (folderId: string) => void;
  onEditFolderVariables: (folderId: string) => void;
  onEditCollectionAuth: (collectionId: string) => void;
  onEditCollectionScripts: (collectionId: string) => void;
  onEditCollectionVariables: (collectionId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onStartRequestRename: (request: SavedRequest) => void;
  onViewRequest: (reqId: string) => void;
  onDeleteRequest: (reqId: string) => void;
  onDuplicateRequest: (reqId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onCurlImport: () => void;
  onImport: () => void;
  onExport: () => void;
  onSetSelectionAsVariable?: (text: string) => void;
  onMoveItemTo?: (reqId: string, itemType: "request" | "folder") => void;
  onRunFolder?: (folderId: string) => void;
  onRunCollection?: (collectionId: string) => void;
  onCloseTab?: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
}

export function ContextMenu({
  menu,
  requests,
  onClose,
  onCreateRequest,
  onCreateFolder,
  onCreateSubFolder,
  onEditFolderAuth,
  onEditFolderScripts,
  onEditFolderVariables,
  onEditCollectionAuth,
  onEditCollectionScripts,
  onEditCollectionVariables,
  onDeleteFolder,
  onStartRequestRename,
  onViewRequest,
  onDeleteRequest,
  onDuplicateRequest,
  onDeleteCollection,
  onCurlImport,
  onImport,
  onExport,
  onSetSelectionAsVariable,
  onMoveItemTo,
  onRunFolder,
  onRunCollection,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
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
    >
      {target?.type === "folder" && (
        <>
          <button
            className="context-menu-item"
            onClick={async (e) => {
              e.stopPropagation();
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
              if (target.id && onRunFolder) onRunFolder(target.id);
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <Play size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Run Folder
          </button>
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (target.id && onMoveItemTo) onMoveItemTo(target.id, "folder");
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <FolderTree size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Move to...
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
            onClick={async (e) => {
              e.stopPropagation();
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
              if (target.id) {
                await onCreateFolder(target.id);
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
              if (target.id && onRunCollection) onRunCollection(target.id);
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <Play size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Run Collection
          </button>
          <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "4px 0" }} />
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (target.id) onEditCollectionAuth(target.id);
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
              if (target.id) onEditCollectionScripts(target.id);
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
              if (target.id) onEditCollectionVariables(target.id);
              onClose();
            }}
            style={itemStyle}
            {...hoverHandlers()}
          >
            <Settings size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Settings
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
          <button
            className="context-menu-item"
            onClick={() => {
              const reqId = target.id;
              if (reqId && onMoveItemTo) onMoveItemTo(reqId, "request");
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            <FolderTree size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Move to...
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              const reqId = target.id;
              if (reqId) onDuplicateRequest(reqId);
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            <Copy size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Duplicate
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
      {target?.type === "workspace" && (
        <>
          <button
            className="context-menu-item"
            onClick={() => {
              onCurlImport();
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            <Terminal size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Import
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onImport();
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            <Upload size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Import Workspace
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onExport();
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            <Download size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Export Workspace
          </button>
        </>
      )}
      {target?.type === "selection" && (
        <button
          className="context-menu-item"
          onClick={() => {
            if (onSetSelectionAsVariable && target.selectionText) {
              onSetSelectionAsVariable(target.selectionText);
            }
            onClose();
          }}
          style={requestItemStyle}
          {...hoverHandlers()}
        >
          <Variable size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Set as Environment Variable
        </button>
      )}
      {target?.type === "tab" && (
        <>
          <button
            className="context-menu-item"
            onClick={() => {
              onCloseTab?.(target.id);
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            Close Current Tab
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onCloseOtherTabs?.(target.id);
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            Close Other Tabs
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onCloseAllTabs?.();
              onClose();
            }}
            style={requestItemStyle}
            {...hoverHandlers()}
          >
            Close All Tabs
          </button>
        </>
      )}
    </div>
  );
}
