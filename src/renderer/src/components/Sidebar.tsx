import { ChevronDown, ChevronsUpDown, FolderTree, Globe, Plus, Search, Trash2, Edit2, X, Download, Upload, Terminal, MoreVertical, Sun, Moon, Monitor, Zap, Flame, History, RefreshCw, Settings, PanelLeftClose, PanelLeftOpen, GripVertical, ChevronsDown, ChevronsRight, ChevronRight, ChevronsUp, FilePlus, Key } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CustomSelect } from "./CustomSelect";
import type { AppSettings, SavedRequest, WorkspaceSummary, Script } from "../types";
import { getAllScripts } from "../services/local-store";

interface ContextMenuTarget {
  id: string;
  type: "folder" | "request" | "collection" | "workspace";
}

// Helper to encode/decode dnd-kit ids
const encodeDragId = (type: string, id: string) => `${type}:${id}`;
const decodeDragId = (encoded: string): { type: string; id: string } => {
  const idx = encoded.indexOf(":");
  if (idx === -1) return { type: "", id: encoded };
  return { type: encoded.slice(0, idx), id: encoded.slice(idx + 1) };
};

interface DragItemData {
  id: string;
  type: "folder" | "request" | "collection";
  parentId?: string;
}

interface DragOverState {
  id: string;
  type: "folder" | "request" | "collection";
  position: "top" | "bottom" | "inside";
}

export interface SidebarProps {
  workspace: WorkspaceSummary | null;
  selectedRequestId: string | null;
  selectedEnvironmentTab: string | null;
  activeEnvironment: string;
  sidebarWidth: number;
  isResizing: boolean;
  theme?: AppSettings["theme"];
  onThemeChange?: (theme: AppSettings["theme"]) => void;
  onToggleSidebar?: () => void;

  // Topbar / App Actions
  onOpenDocs?: () => void;
  onOpenHistory?: () => void;
  onCheckForUpdates?: () => void;
  onOpenSettings?: () => void;
  onOpenJwtDecoder?: () => void;

  // Collection state
  collectionSearch: string;
  collapsedFolders: Record<string, boolean>;
  scriptStatus: Record<string, boolean>;

  // Draft (live request name being edited elsewhere)
  draftRequest: SavedRequest | null;
  isDraftDirty?: boolean;

  // Rename-in-place state
  renamingSidebarItem: { id: string; type: "folder" | "collection" } | null;
  sidebarNameDraft: string;
  renamingRequestId: string;
  renameDraft: string;
  deleteError: string | null;

  // Branding
  headline: string;

  // CRUD callbacks
  onCreateFolder: (collectionId?: string, parentId?: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => void;
  onCreateCollection: () => Promise<void>;
  onDeleteCollection: (collectionId: string) => void;
  onSelectRequest: (requestId: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onCreateRequest: (folderId: string) => Promise<void>;
  onOpenFolder?: (folderId: string) => void;
  onOpenCollection?: (collectionId: string) => void;

  // Rename callbacks
  onStartSidebarRename: (type: "folder" | "collection", id: string, name: string) => void;
  onCancelSidebarRename: () => void;
  onApplySidebarRename: () => Promise<void>;
  onSidebarNameDraftChange: (value: string) => void;
  onStartRequestRename: (request: SavedRequest) => void;
  onStopRequestRename: () => void;
  onApplyRequestRename: (requestId: string) => void;
  onRenameDraftChange: (value: string) => void;

  // Environment management
  onSetActiveEnvironment: (name: string) => Promise<void>;
  onOpenEnvironment: () => void;
  onOpenEnvironmentTab: (envName: string) => void;
  onCreateEnvironment: () => void;
  onDeleteEnvironment?: (envName: string) => void;

  // Search & toggle & context menu
  onCollectionSearchChange: (value: string) => void;
  onToggleFolder: (folderId: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  onDismissDeleteError: () => void;

  // Import / export
  onExport: () => void;
  onImport: () => void;
  onCurlImport: () => void;

  // Workspace switcher
  onOpenWorkspaceSwitcher?: () => void;
  onMoveItem?: (type: "folder" | "request" | "collection", draggedId: string, targetId: string, position: "top" | "bottom" | "inside") => Promise<void>;
}

// Draggable Collection Row
function DraggableCollectionRow({
  collection,
  dragId,
  isDragOver,
  dragOverPosition,
  isRenaming,
  sidebarNameDraft,
  onSidebarNameDraftChange,
  onApplySidebarRename,
  onCancelSidebarRename,
  onStartSidebarRename,
  onDeleteCollection,
  onCreateFolder,
  onCreateRequest,
  onOpenCollection,
  onContextMenu,
  isCollapsed,
  onToggleCollapse,
  requestCount,
  children,
}: {
  collection: { id: string; name: string };
  dragId: string;
  isDragOver: boolean;
  dragOverPosition?: string;
  isRenaming: boolean;
  sidebarNameDraft: string;
  onSidebarNameDraftChange: (value: string) => void;
  onApplySidebarRename: () => Promise<void>;
  onCancelSidebarRename: () => void;
  onStartSidebarRename: (type: "collection" | "folder", id: string, initialName: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onCreateFolder: (collectionId: string) => Promise<void>;
  onCreateRequest: (folderId: string) => void;
  onOpenCollection?: (collectionId: string) => void;
  onContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  requestCount?: number;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: dragId,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div className="collection-group" style={{ marginBottom: "8px" }}>
      <div
        ref={(node) => {
          setNodeRef(node);
          setDroppableRef(node);
        }}
        style={style}
        {...listeners}
        {...attributes}
        className={`folder-title sidebar-tree-row collection-title ${
          (isDragOver || isOver) && dragOverPosition ? `drag-over-${dragOverPosition}` : ""
        }`}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu({ id: collection.id, type: "collection" }, e.clientX, e.clientY);
        }}
      >
        <span
          className="sidebar-drag-handle"
          aria-hidden="true"
          title="Drag to reorder"
          style={{ pointerEvents: "none" }}
        >
        </span>
        <span
          className="sidebar-chevron"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.();
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        {isRenaming ? (
          <input
            value={sidebarNameDraft}
            aria-label={`Rename collection ${collection.name}`}
            autoFocus
            onChange={(event) => onSidebarNameDraftChange(event.target.value)}
            onBlur={() => void onApplySidebarRename()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onCancelSidebarRename();
              }
            }}
            style={{ flex: 1, minWidth: 0, border: "1px solid var(--color-border-tint)", borderRadius: "6px", background: "var(--color-surface)", color: "var(--color-text)", padding: "4px 8px", fontWeight: 700 }}
          />
        ) : (
          <strong 
            className="sidebar-item-name" 
            onDoubleClick={() => onStartSidebarRename("collection", collection.id, collection.name)}
            onClick={() => onOpenCollection?.(collection.id)}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{collection.name}</span>
            {requestCount !== undefined && (
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontWeight: "normal", flexShrink: 0 }}>({requestCount})</span>
            )}
          </strong>
        )}
        <div className="sidebar-row-actions">
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label={`New request in ${collection.name}`}
            onClick={() => void onCreateRequest(collection.id)}
          >
            <FilePlus size={12} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label={`New folder in ${collection.name}`}
            onClick={() => void onCreateFolder(collection.id)}
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label={`Rename collection ${collection.name}`}
            onClick={() => onStartSidebarRename("collection", collection.id, collection.name)}
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button danger"
            aria-label={`Delete collection ${collection.name}`}
            onClick={() => onDeleteCollection(collection.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

// Draggable Folder Row
function DraggableFolderRow({
  folder,
  dragId,
  isDragOver,
  dragOverPosition,
  isRenaming,
  isCollapsed,
  sidebarNameDraft,
  onSidebarNameDraftChange,
  onApplySidebarRename,
  onCancelSidebarRename,
  onStartSidebarRename,
  onToggleFolder,
  onDeleteFolder,
  onCreateRequest,
  onOpenFolder,
  onContextMenu,
  requestCount,
  children,
}: {
  folder: { id: string; name: string; parentId?: string; collectionId?: string };
  dragId: string;
  isDragOver: boolean;
  dragOverPosition?: string;
  isRenaming: boolean;
  isCollapsed: boolean;
  sidebarNameDraft: string;
  onSidebarNameDraftChange: (value: string) => void;
  onApplySidebarRename: () => Promise<void>;
  onCancelSidebarRename: () => void;
  onStartSidebarRename: (type: "folder", id: string, name: string) => void;
  onToggleFolder: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onCreateRequest: (folderId: string) => Promise<void>;
  onOpenFolder?: (folderId: string) => void;
  onContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  requestCount?: number;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: dragId,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : undefined,
  };

  const isFolderCollapsed = isCollapsed;
  return (
    <div className="folder-group">
      <div
        ref={(node) => {
          setNodeRef(node);
          setDroppableRef(node);
        }}
        style={style}
        {...listeners}
        {...attributes}
        className={`folder-title sidebar-tree-row ${
          (isDragOver || isOver) && dragOverPosition ? `drag-over-${dragOverPosition}` : ""
        }`}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu({ id: folder.id, type: "folder" }, e.clientX, e.clientY);
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "2px", minWidth: 0 }}>
          <span
            className="sidebar-drag-handle"
            aria-hidden="true"
            title="Drag to reorder"
            style={{ pointerEvents: "none" }}
          >

          </span>
          <button
            type="button"
            aria-expanded={!isFolderCollapsed}
            onClick={() => onToggleFolder(folder.id)}
            className="folder-toggle-button"
          >
            <ChevronDown
              size={14}
              className={isFolderCollapsed ? "folder-chevron collapsed" : "folder-chevron"}
            />
          </button>
          {isRenaming ? (
            <input
              value={sidebarNameDraft}
              aria-label={`Rename folder ${folder.name}`}
              autoFocus
              onChange={(event) => onSidebarNameDraftChange(event.target.value)}
              onBlur={() => void onApplySidebarRename()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelSidebarRename();
                }
              }}
              style={{ minWidth: 0, width: "120px", border: "1px solid var(--color-border-tint)", borderRadius: "6px", background: "var(--color-surface)", color: "var(--color-text)", padding: "4px 8px", fontWeight: 700 }}
            />
          ) : (
            <button
              type="button"
              onClick={() => onOpenFolder?.(folder.id)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onStartSidebarRename("folder", folder.id, folder.name);
              }}
              className="sidebar-item-name-btn"
              style={{ all: "unset", display: "flex", alignItems: "center", gap: "2px", cursor: "pointer", flex: 1, minWidth: 0 }}
            >
              <span className="sidebar-item-name">{folder.name}</span>
              {requestCount !== undefined && (
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>({requestCount})</span>
              )}
            </button>
          )}
        </div>
        <div className="sidebar-row-actions">
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label={`New request in ${folder.name}`}
            onClick={() => void onCreateRequest(folder.id)}
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label={`Rename folder ${folder.name}`}
            onClick={() => onStartSidebarRename("folder", folder.id, folder.name)}
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button danger"
            aria-label={`Delete folder ${folder.name}`}
            onClick={() => onDeleteFolder(folder.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

// Draggable Request Row
function DraggableRequestRow({
  request,
  dragId,
  isSelected,
  isDragOver,
  dragOverPosition,
  isRenaming,
  renameDraft,
  onRenameDraftChange,
  onApplyRequestRename,
  onStopRequestRename,
  onStartRequestRename,
  onSelectRequest,
  onDeleteRequest,
  methodClass,
  resolvedMethodLabel,
  draftRequest,
  isDraftDirty,
  scriptStatus,
  onContextMenu,
}: {
  request: { id: string; name: string; method: string; customMethod?: string; folderId: string };
  dragId: string;
  isSelected: boolean;
  isDragOver: boolean;
  dragOverPosition?: string;
  isRenaming: boolean;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onApplyRequestRename: (id: string) => void;
  onStopRequestRename: () => void;
  onStartRequestRename: (request: any) => void;
  onSelectRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  methodClass: (method: string) => string;
  resolvedMethodLabel: (method: string, customMethod?: string) => string;
  draftRequest: SavedRequest | null;
  isDraftDirty?: boolean;
  scriptStatus: Record<string, boolean>;
  onContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: dragId,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setDroppableRef(node);
      }}
      key={request.id}
      style={style}
      {...listeners}
      {...attributes}
      className={`${isSelected ? "request-row sidebar-tree-row active" : "request-row sidebar-tree-row"} ${
        (isDragOver || isOver) && dragOverPosition ? `drag-over-${dragOverPosition}` : ""
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu({ id: request.id, type: "request" }, e.clientX, e.clientY);
      }}
    >
      {isRenaming ? (
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "2px" }}>
          <span
            className="sidebar-drag-handle"
            aria-hidden="true"
            title="Drag to reorder"
            style={{ pointerEvents: "none" }}
          >

          </span>
          <span className={`method method-${methodClass(resolvedMethodLabel(request.method, request.customMethod))}`}>{resolvedMethodLabel(request.method, request.customMethod)}</span>
          <input
            value={renameDraft}
            aria-label={`Rename ${request.name}`}
            placeholder="Request Name"
            autoFocus
            onChange={(event) => onRenameDraftChange(event.target.value)}
            onBlur={() => onApplyRequestRename(request.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onApplyRequestRename(request.id);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onStopRequestRename();
              }
            }}
            style={{ flex: 1, minWidth: 0, width: "100%", boxSizing: "border-box", border: "1px solid var(--color-border-tint)", borderRadius: "6px", background: "var(--color-surface)", color: "var(--color-text)", padding: "4px 8px" }}
          />
          {scriptStatus[request.id] && (
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#2563eb", marginLeft: "4px" }} title="Has scripts" />
          )}
        </div>
      ) : (
        <button
          style={{ all: "unset", flex: 1, display: "flex", alignItems: "center", gap: "2px", cursor: "pointer", minWidth: 0 }}
          onClick={() => onSelectRequest(request.id)}
          type="button"
        >
          <span
            className="sidebar-drag-handle"
            aria-hidden="true"
            title="Drag to reorder"
            style={{ pointerEvents: "none" }}
          >

          </span>
          <span className={`method method-${methodClass(resolvedMethodLabel(request.method, request.customMethod))}`}>{resolvedMethodLabel(request.method, request.customMethod)}</span>
          <span className="sidebar-item-name" onDoubleClick={() => onStartRequestRename(request)}>{request.id === draftRequest?.id ? draftRequest.name : request.name}</span>
          {request.id === draftRequest?.id && isDraftDirty && (
            <span
              className="sidebar-request-dirty-dot"
              title="Unsaved changes"
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#f59e0b",
                marginLeft: "6px",
                flexShrink: 0,
              }}
            />
          )}
        </button>
      )}
      <div className="sidebar-row-actions">
        <button type="button" className="sidebar-icon-button" aria-label={`Rename ${request.name}`} onClick={() => onStartRequestRename(request)}>
          <Edit2 size={12} />
        </button>
        <button type="button" className="sidebar-icon-button danger" aria-label="Delete request" onClick={() => onDeleteRequest(request.id)}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export function Sidebar({
  workspace,
  selectedRequestId,
  selectedEnvironmentTab,
  activeEnvironment,
  sidebarWidth,
  isResizing,
  collectionSearch,
  collapsedFolders,
  scriptStatus,
  draftRequest,
  isDraftDirty,
  renamingSidebarItem,
  sidebarNameDraft,
  renamingRequestId,
  renameDraft,
  deleteError,
  headline,
  onCreateFolder,
  onDeleteFolder,
  onCreateCollection,
  onDeleteCollection,
  onSelectRequest,
  onDeleteRequest,
  onCreateRequest,
  onOpenFolder,
  onOpenCollection,
  onStartSidebarRename,
  onCancelSidebarRename,
  onApplySidebarRename,
  onSidebarNameDraftChange,
  onStartRequestRename,
  onStopRequestRename,
  onApplyRequestRename,
  onRenameDraftChange,
  onSetActiveEnvironment,
  onOpenEnvironment,
  onOpenEnvironmentTab,
  onCreateEnvironment,
  onDeleteEnvironment,
  onCollectionSearchChange,
  onToggleFolder,
  onExpandAll,
  onCollapseAll,
  onContextMenu,
  onDismissDeleteError,
  theme = "system",
  onThemeChange,
  onToggleSidebar,
  onOpenDocs,
  onOpenHistory,
  onCheckForUpdates,
  onOpenSettings,
  onOpenJwtDecoder,
  onExport,
  onImport,
  onCurlImport,
  onOpenWorkspaceSwitcher,
  onMoveItem,
}: SidebarProps) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  // Drag and drop state
  const [activeDragItem, setActiveDragItem] = useState<DragItemData | null>(null);
  const [dragOverItem, setDragOverItem] = useState<DragOverState | null>(null);

  // Scripts cache for advanced search
  const [allScripts, setAllScripts] = useState<Script[]>([]);
  useEffect(() => {
    getAllScripts().then(setAllScripts).catch(console.error);
  }, [workspace?.id]);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (!themeMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [themeMenuOpen]);
  const isCollectionSearchActive = collectionSearch.trim().length > 0;
  const normalizedCollectionSearch = collectionSearch.trim().toLowerCase();

  const themes: Array<{ id: AppSettings["theme"]; label: string; icon: React.ReactNode }> = [
    { id: "light", label: "Light", icon: <Sun size={14} /> },
    { id: "dark", label: "Dark", icon: <Moon size={14} /> },
    { id: "system", label: "System", icon: <Monitor size={14} /> },
    { id: "matrix", label: "Matrix", icon: <Terminal size={14} /> },
    { id: "cyberpunk", label: "Cyberpunk", icon: <Zap size={14} /> },
    { id: "warm", label: "Warm", icon: <Flame size={14} /> },
  ];

  function currentThemeIcon() {
    switch (theme) {
      case "light": return <Sun size={15} className="theme-icon-spin" />;
      case "dark": return <Moon size={15} className="theme-icon-spin" />;
      case "matrix": return <Terminal size={15} className="theme-icon-spin" />;
      case "cyberpunk": return <Zap size={15} className="theme-icon-spin" />;
      case "warm": return <Flame size={15} className="theme-icon-spin" />;
      default: return <Monitor size={15} className="theme-icon-spin" />;
    }
  }

  function handleSelectTheme(nextTheme: AppSettings["theme"]) {
    setThemeMenuOpen(false);
    if (onThemeChange) {
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (document as any).startViewTransition(() => {
          onThemeChange(nextTheme);
        });
      } else {
        onThemeChange(nextTheme);
      }
    }
  }

  function matchesCollectionSearch(value: string | undefined) {
    return !isCollectionSearchActive || value?.toLowerCase().includes(normalizedCollectionSearch);
  }

  const methodClass = (method: string): string => {
    const normalizedMethod = method.toUpperCase();
    switch (normalizedMethod) {
      case "GET": return "get";
      case "POST": return "post";
      case "PUT": return "put";
      case "DELETE": return "delete";
      case "PATCH": return "patch";
      case "HEAD": return "head";
      case "OPTIONS": return "options";
      default: return "custom";
    }
  };

  const resolvedMethodLabel = (method: string, customMethod?: string): string => {
    return method === "CUSTOM" ? (customMethod?.trim() || "CUSTOM") : method;
  };

  function requestMatchesCollectionSearch(request: SavedRequest) {
    if (matchesCollectionSearch(request.name)) return true;
    if (matchesCollectionSearch(request.url)) return true;
    if (matchesCollectionSearch(resolvedMethodLabel(request.method, request.customMethod))) return true;
    
    // Deep search in request data
    if (request.body && matchesCollectionSearch(request.body)) return true;
    
    if (request.headers?.some(h => matchesCollectionSearch(h.key) || matchesCollectionSearch(h.value))) return true;
    if (request.queryParams?.some(q => matchesCollectionSearch(q.key) || matchesCollectionSearch(q.value))) return true;
    if (request.bodyForm?.some(f => matchesCollectionSearch(f.key) || matchesCollectionSearch(f.value))) return true;
    if (request.variables?.some(v => matchesCollectionSearch(v.key) || matchesCollectionSearch(v.value))) return true;
    
    // Search within associated scripts
    const hasMatchingScript = allScripts.some(
      script => script.entityId === request.id && script.entityType === 'request' && matchesCollectionSearch(script.content)
    );
    if (hasMatchingScript) return true;
    
    return false;
  }

  // --- dnd-kit handlers ---

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const { type, id } = decodeDragId(active.id as string);

    // Find parentId if needed
    let parentId: string | undefined;
    if (type === "folder" && workspace) {
      const folder = workspace.folders.find(f => f.id === id);
      parentId = folder?.parentId;
    } else if (type === "request" && workspace) {
      const request = workspace.requests.find(r => r.id === id);
      parentId = request?.folderId;
    }

    setActiveDragItem({ id, type: type as any, parentId });
    setDragOverItem(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;

    if (!over || !activeDragItem) {
      setDragOverItem(null);
      return;
    }

    const { type: activeType } = decodeDragId(active.id as string);
    const { type: overType, id: overId } = decodeDragId(over.id as string);

    // Don't allow dropping on self
    if (active.id === over.id) {
      setDragOverItem(null);
      return;
    }

    let position: "top" | "bottom" | "inside" = "bottom";

    // Collections only reorder against collections (top/bottom); never "inside".
    if (activeType === "collection") {
      if (overType !== "collection") {
        setDragOverItem(null);
        return;
      }
      position = "bottom";
    } else if (activeType === "request" && overType === "folder") {
      position = "inside";
    }

    setDragOverItem({
      id: overId,
      type: overType as any,
      position
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || !activeDragItem || !onMoveItem || !workspace) {
      setActiveDragItem(null);
      setDragOverItem(null);
      return;
    }

    if (active.id === over.id) {
      setActiveDragItem(null);
      setDragOverItem(null);
      return;
    }

    const { type: activeType, id: activeId } = decodeDragId(active.id as string);
    const { type: overType, id: overId } = decodeDragId(over.id as string);

    let position: "top" | "bottom" | "inside" = "bottom";
    if (activeType === "collection" || overType === "collection") {
      position = "bottom";
    } else if (activeType === "request" && overType === "folder") {
      position = "inside";
    }

    // Auto-expand folder if dropping a request into it
    if (activeType === "request" && overType === "folder") {
      if (collapsedFolders[overId]) {
        onToggleFolder(overId);
      }
    }

    void onMoveItem(activeType as any, activeId, overId, position);

    setActiveDragItem(null);
    setDragOverItem(null);
  }

  function countRequestsInFolder(folderId: string): number {
    if (!workspace) return 0;
    let count = workspace.requests.filter((r) => r.folderId === folderId).length;
    const childFolders = workspace.folders.filter((f) => f.parentId === folderId);
    for (const cf of childFolders) {
      count += countRequestsInFolder(cf.id);
    }
    return count;
  }

  function countRequestsInCollection(collectionId: string): number {
    if (!workspace) return 0;
    let count = workspace.requests.filter((r) => r.folderId === collectionId).length;
    const childFolders = workspace.folders.filter((f) => f.collectionId === collectionId && !f.parentId);
    for (const cf of childFolders) {
      count += countRequestsInFolder(cf.id);
    }
    return count;
  }

  function folderMatchesCollectionSearch(folderId: string): boolean {
    const folder = workspace?.folders.find((item) => item.id === folderId);
    if (!folder) return false;
    if (matchesCollectionSearch(folder.name)) return true;
    if (folder.variables?.some(v => matchesCollectionSearch(v.key) || matchesCollectionSearch(v.value))) return true;
    
    // Search within associated scripts
    const hasMatchingScript = allScripts.some(
      script => script.entityId === folder.id && script.entityType === 'folder' && matchesCollectionSearch(script.content)
    );
    if (hasMatchingScript) return true;
    
    const hasMatchingRequest = workspace?.requests.some((request) => request.folderId === folderId && requestMatchesCollectionSearch(request));
    if (hasMatchingRequest) return true;

    const hasMatchingChildFolder = workspace?.folders.some((f) => f.parentId === folderId && folderMatchesCollectionSearch(f.id));
    return !!hasMatchingChildFolder;
  }

  const visibleCollections = (workspace?.collections ?? []).filter((collection) => {
    if (matchesCollectionSearch(collection.name)) return true;
    if (collection.variables?.some(v => matchesCollectionSearch(v.key) || matchesCollectionSearch(v.value))) return true;
    
    // Search within associated scripts
    const hasMatchingScript = allScripts.some(
      script => script.entityId === collection.id && script.entityType === 'collection' && matchesCollectionSearch(script.content)
    );
    if (hasMatchingScript) return true;
    
    const hasMatchingFolder = workspace?.folders.some((folder) => folder.collectionId === collection.id && folderMatchesCollectionSearch(folder.id));
    if (hasMatchingFolder) return true;
    const hasMatchingRootRequest = workspace?.requests.some((request) => request.folderId === collection.id && requestMatchesCollectionSearch(request));
    return !!hasMatchingRootRequest;
  });

  // Render drag overlay
  function renderDragOverlay() {
    if (!activeDragItem) return null;

    const { id, type } = activeDragItem;

    if (type === "collection" && workspace) {
      const collection = workspace.collections?.find(c => c.id === id);
      if (collection) {
        return (
          <div className="folder-title sidebar-tree-row collection-title" style={{ opacity: 0.8, background: 'var(--color-surface)', padding: '8px 12px', borderRadius: '6px' }}>

            <strong>{collection.name}</strong>
          </div>
        );
      }
    }

    if (type === "folder" && workspace) {
      const folder = workspace.folders.find(f => f.id === id);
      if (folder) {
        return (
          <div className="folder-title sidebar-tree-row" style={{ opacity: 0.8, background: 'var(--color-surface)', padding: '8px 12px', borderRadius: '6px' }}>

            <ChevronDown size={14} />
            <span>{folder.name}</span>
          </div>
        );
      }
    }

    if (type === "request" && workspace) {
      const request = workspace.requests.find(r => r.id === id);
      if (request) {
        return (
          <div className="request-row sidebar-tree-row" style={{ opacity: 0.8, background: 'var(--color-surface)', padding: '8px 12px', borderRadius: '6px' }}>

            <span className={`method method-${methodClass(resolvedMethodLabel(request.method, request.customMethod))}`}>
              {resolvedMethodLabel(request.method, request.customMethod)}
            </span>
            <span>{request.name}</span>
          </div>
        );
      }
    }

    return null;
  }

  // Render requests that live directly at the root of a collection
  const renderCollectionRequests = (collectionId: string, forceShowAll: boolean) => {
    const rootRequests = (workspace?.requests ?? [])
      .filter((r) => r.folderId === collectionId)
      .filter((r) => forceShowAll || requestMatchesCollectionSearch(r));

    if (rootRequests.length === 0) return null;

    return (
      <div style={{ paddingLeft: '16px' }}>
        {rootRequests.map((request) => (
          <DraggableRequestRow
            key={request.id}
            request={request}
            dragId={encodeDragId("request", request.id)}
            isSelected={request.id === selectedRequestId}
            isDragOver={dragOverItem?.id === request.id && dragOverItem.type === "request"}
            dragOverPosition={dragOverItem?.id === request.id && dragOverItem.type === "request" ? dragOverItem?.position : undefined}
            isRenaming={renamingRequestId === request.id}
            renameDraft={renameDraft}
            onRenameDraftChange={onRenameDraftChange}
            onApplyRequestRename={onApplyRequestRename}
            onStopRequestRename={onStopRequestRename}
            onStartRequestRename={onStartRequestRename}
            onSelectRequest={onSelectRequest}
            onDeleteRequest={onDeleteRequest}
            methodClass={methodClass}
            resolvedMethodLabel={resolvedMethodLabel}
            draftRequest={draftRequest}
            isDraftDirty={isDraftDirty}
            scriptStatus={scriptStatus}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    );
  };

  // Recursive folder render function
  const renderFolders = (parentId: string | undefined, depth: number, forceShowAll: boolean, collectionId: string) => {
    const folders = (workspace?.folders ?? [])
      .filter((f) => (parentId === undefined ? f.collectionId === collectionId && !f.parentId : f.parentId === parentId))
      .filter((f) => forceShowAll || folderMatchesCollectionSearch(f.id));

    if (folders.length === 0) return null;

    return (
      <div style={{ paddingLeft: "16px" }}>
        {folders.map((folder) => {
          const folderNameMatches = matchesCollectionSearch(folder.name);
          const showFolderContents = forceShowAll || (folderNameMatches ?? false);
          const isFolderCollapsed = !isCollectionSearchActive && collapsedFolders[folder.id];
          const folderRequests = (workspace?.requests ?? [])
            .filter((r) => r.folderId === folder.id)
            .filter((r) => showFolderContents || requestMatchesCollectionSearch(r));

          const folderDragId = encodeDragId("folder", folder.id);
          const isFolderRenaming = renamingSidebarItem?.type === "folder" && renamingSidebarItem.id === folder.id;
          const isFolderDragOver = dragOverItem?.id === folder.id && dragOverItem.type === "folder";

          return (
            <DraggableFolderRow
              key={folder.id}
              folder={folder}
              dragId={folderDragId}
              isDragOver={isFolderDragOver}
              dragOverPosition={isFolderDragOver ? dragOverItem?.position : undefined}
              isRenaming={isFolderRenaming}
              isCollapsed={isFolderCollapsed}
              sidebarNameDraft={sidebarNameDraft}
              onSidebarNameDraftChange={onSidebarNameDraftChange}
              onApplySidebarRename={onApplySidebarRename}
              onCancelSidebarRename={onCancelSidebarRename}
              onStartSidebarRename={onStartSidebarRename}
              onToggleFolder={onToggleFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateRequest={onCreateRequest}
              onOpenFolder={onOpenFolder}
              onContextMenu={onContextMenu}
              requestCount={countRequestsInFolder(folder.id)}
            >
              <div
                className={isFolderCollapsed ? "folder-children collapsed" : "folder-children"}
                aria-hidden={isFolderCollapsed}
              >
                <div className="folder-children-inner">
                  {renderFolders(folder.id, depth + 1, showFolderContents, collectionId)}
                  {folderRequests.length === 0 && (
                    <div
                      className={`empty-folder sidebar-tree-row ${
                        isFolderDragOver && dragOverItem?.position === "inside" ? "drag-over-inside" : ""
                      }`}
                      style={{ paddingLeft: "16px", opacity: 0.5, fontStyle: "italic", fontSize: "11px" }}
                    >
                    </div>
                  )}
                  <div style={{ paddingLeft: "16px" }}>
                    {folderRequests.map((request) => (
                      <DraggableRequestRow
                        key={request.id}
                        request={request}
                        dragId={encodeDragId("request", request.id)}
                        isSelected={request.id === selectedRequestId}
                        isDragOver={dragOverItem?.id === request.id && dragOverItem.type === "request"}
                        dragOverPosition={dragOverItem?.id === request.id && dragOverItem.type === "request" ? dragOverItem?.position : undefined}
                        isRenaming={renamingRequestId === request.id}
                        renameDraft={renameDraft}
                        onRenameDraftChange={onRenameDraftChange}
                        onApplyRequestRename={onApplyRequestRename}
                        onStopRequestRename={onStopRequestRename}
                        onStartRequestRename={onStartRequestRename}
                        onSelectRequest={onSelectRequest}
                        onDeleteRequest={onDeleteRequest}
                        methodClass={methodClass}
                        resolvedMethodLabel={resolvedMethodLabel}
                        draftRequest={draftRequest}
                        isDraftDirty={isDraftDirty}
                        scriptStatus={scriptStatus}
                        onContextMenu={onContextMenu}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </DraggableFolderRow>
          );
        })}
      </div>
    );
  };

  return (
    <aside
      className="sidebar"
      aria-label="Workspace navigation"
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <div className="brand-row">
        <div className="brand-mark">KR</div>
        <div className="brand-actions">
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label="Switch workspace"
            title={`Current: ${workspace?.name ?? "Workspace"} — click to switch`}
            onClick={onOpenWorkspaceSwitcher}
            style={{ display: "flex", alignItems: "center", gap: "4px", width: "auto", maxWidth: "130px", padding: "4px 8px", borderRadius: "6px" }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px", fontWeight: 600 }}>
              {workspace?.name ?? "Workspace"}
            </span>
            <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label="Hide sidebar (Cmd+B)"
            title="Hide sidebar (Cmd+B)"
            onClick={onToggleSidebar}
          >
            <PanelLeftClose size={15} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label="Workspace actions"
            title="Workspace actions"
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu({ id: "workspace", type: "workspace" }, e.clientX, e.clientY);
            }}
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-header-group">
          <div className="environment-switcher">
          <Globe size={15} className="environment-switcher-icon" />
          <CustomSelect
            className="environment-select"
            ariaLabel="Active environment"
            value={activeEnvironment}
            onChange={(val) => void onSetActiveEnvironment(val)}
            options={(workspace?.environments ?? []).map((env) => ({ value: env.name, label: env.name, color: env.color }))}
          />
          <button
            type="button"
            className="environment-manage-button"
            aria-label="Manage environments"
            onClick={onOpenEnvironment}
          >
            Manage
          </button>
        </div>

        {deleteError && (
          <div role="alert" className="sidebar-error-banner" style={{ padding: "8px 10px", borderRadius: "6px", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <span>{deleteError}</span>
            <button type="button" aria-label="Dismiss error" onClick={onDismissDeleteError} style={{ all: "unset", cursor: "pointer", fontWeight: 700 }}>✕</button>
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
          <button
            className="sidebar-new-collection-btn"
            type="button"
            onClick={() => void onCreateCollection()}
            aria-label="Create new collection"
            style={{ flex: 1 }}
          >
            <Plus size={16} />
            <span>New Collection</span>
          </button>
        </div>

        <label className={collectionSearch ? "search-field has-value" : "search-field"} style={{ marginTop: 0 }}>
          <Search size={15} />
          <input
            placeholder="Search collections, folders, requests"
            aria-label="Search collections"
            value={collectionSearch}
            onChange={(event) => onCollectionSearchChange(event.target.value)}
          />
          {collectionSearch && (
            <button
              type="button"
              className="search-clear-button"
              aria-label="Clear collection search"
              onClick={() => onCollectionSearchChange("")}
            >
              <X size={13} />
            </button>
          )}
        </label>
        {isCollectionSearchActive && (
          <div className="search-status" role="status">
            {visibleCollections.length === 0 ? "No matches" : `${visibleCollections.length} collection${visibleCollections.length === 1 ? "" : "s"} found`}
          </div>
        )}
        </div>

        <div className="sidebar-tree-container">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <section className="nav-section">
            <h2 style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FolderTree size={15} />
                Collections
              </div>
              <div style={{ display: "flex", gap: "2px" }}>
                {onExpandAll && (
                  <button
                    className="sidebar-icon-button"
                    type="button"
                    onClick={onExpandAll}
                    aria-label="Expand all folders"
                    title="Expand all"
                  >
                    <ChevronsDown size={14} />
                  </button>
                )}
                {onCollapseAll && (
                  <button
                    className="sidebar-icon-button"
                    type="button"
                    onClick={onCollapseAll}
                    aria-label="Collapse all folders"
                    title="Collapse all"
                  >
                    <ChevronsUp size={14} />
                  </button>
                )}
              </div>
            </h2>
            {visibleCollections.map((collection) => {
              const isCollectionCollapsed = !isCollectionSearchActive && collapsedFolders[collection.id];
              return (
                <DraggableCollectionRow
                  key={collection.id}
                  collection={collection}
                  dragId={encodeDragId("collection", collection.id)}
                  isDragOver={dragOverItem?.id === collection.id && dragOverItem.type === "collection"}
                  dragOverPosition={dragOverItem?.id === collection.id && dragOverItem.type === "collection" ? dragOverItem?.position : undefined}
                  isRenaming={renamingSidebarItem?.type === "collection" && renamingSidebarItem.id === collection.id}
                  sidebarNameDraft={sidebarNameDraft}
                  onSidebarNameDraftChange={onSidebarNameDraftChange}
                  onApplySidebarRename={onApplySidebarRename}
                  onCancelSidebarRename={onCancelSidebarRename}
                  onStartSidebarRename={onStartSidebarRename}
                  onDeleteCollection={onDeleteCollection}
                  onCreateFolder={onCreateFolder}
                  onCreateRequest={onCreateRequest}
                  onOpenCollection={onOpenCollection}
                  onContextMenu={onContextMenu}
                  isCollapsed={isCollectionCollapsed}
                  onToggleCollapse={() => onToggleFolder(collection.id)}
                  requestCount={countRequestsInCollection(collection.id)}
                >
                  {!isCollectionCollapsed && (
                    <>
                      {renderCollectionRequests(collection.id, matchesCollectionSearch(collection.name) ?? false)}
                      {renderFolders(undefined, 0, matchesCollectionSearch(collection.name) ?? false, collection.id)}
                    </>
                  )}
                </DraggableCollectionRow>
              );
            })}
          </section>

          <DragOverlay>
            {renderDragOverlay()}
          </DragOverlay>
        </DndContext>

        {/* Environments Section */}
        {(workspace?.environments ?? []).length > 0 && (
          <section className="nav-section" style={{ marginTop: "16px" }}>
            <h2>
              <Globe size={15} />
              Environments
            </h2>
            {(workspace?.environments ?? []).map((env) => {
              const isActive = env.name === selectedEnvironmentTab;
              return (
                <div
                  key={env.name}
                  className={`sidebar-tree-row ${isActive ? "active" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "6px 8px",
                    cursor: "pointer",
                    borderRadius: "6px",
                    marginBottom: "2px",
                    background: isActive ? "var(--color-surface-active)" : "transparent",
                  }}
                  onClick={() => {
                    onOpenEnvironmentTab(env.name);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onDeleteEnvironment?.(env.name);
                  }}
                >
                  <div style={{ width: "16px", marginRight: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isActive ? (
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "var(--color-accent)",
                        }}
                      />
                    ) : env.color ? (
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: env.color,
                          opacity: 0.8
                        }}
                      />
                    ) : null}
                  </div>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--color-text)" : "var(--color-text-soft)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {env.name}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--color-muted)",
                      marginLeft: "8px",
                    }}
                  >
                    {env.variables.length}
                  </span>
                </div>
              );
            })}

            {onCreateEnvironment && (
              <button
                type="button"
                onClick={() => void onCreateEnvironment()}
                style={{
                  width: "100%",
                  marginTop: "4px",
                  padding: "6px 8px",
                  border: "1px dashed var(--color-border)",
                  background: "transparent",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "var(--color-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Plus size={14} />
                New Environment
              </button>
            )}
          </section>
        )}

        {/* Empty environments state - show create button */}
        {(!workspace?.environments || workspace.environments.length === 0) && onCreateEnvironment && (
          <section className="nav-section" style={{ marginTop: "16px" }}>
            <h2>
              <Globe size={15} />
              Environments
            </h2>
            <button
              type="button"
              onClick={() => void onCreateEnvironment()}
              style={{
                width: "100%",
                marginTop: "4px",
                padding: "6px 8px",
                border: "1px dashed var(--color-border)",
                background: "transparent",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                color: "var(--color-muted)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Plus size={14} />
              New Environment
            </button>
          </section>
        )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-actions">
          <button
            type="button"
            className="sidebar-footer-icon-btn"
            title="Product Documentation"
            aria-label="Product Documentation"
            onClick={onOpenDocs}
          >
            <Download size={15} />
          </button>
          <button
            type="button"
            className="sidebar-footer-icon-btn"
            title="Request History"
            aria-label="Request History"
            onClick={onOpenHistory}
          >
            <History size={15} />
          </button>
          <button
            type="button"
            className="sidebar-footer-icon-btn"
            title="Check for Updates"
            aria-label="Check for Updates"
            onClick={onCheckForUpdates}
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            className="sidebar-footer-icon-btn"
            title="JWT Decoder"
            aria-label="JWT Decoder"
            onClick={onOpenJwtDecoder}
          >
            <Key size={15} />
          </button>
          <button
            type="button"
            className="sidebar-footer-icon-btn"
            title="Settings"
            aria-label="Settings"
            onClick={onOpenSettings}
          >
            <Settings size={15} />
          </button>
        </div>
        <div ref={themeRef} className="sidebar-footer-theme" style={{ position: "relative" }}>
          <button
            type="button"
            className="sidebar-footer-theme-btn"
            onClick={(e) => {
              e.stopPropagation();
              setThemeMenuOpen((prev) => !prev);
            }}
          >
            <span className="sidebar-footer-theme-icon">{currentThemeIcon()}</span>
            <span className="sidebar-footer-theme-label">Theme: {theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </button>
          {themeMenuOpen && (
            <div className="theme-popover sidebar-footer-popover" onClick={(e) => e.stopPropagation()}>
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={theme === t.id ? "theme-popover-option active" : "theme-popover-option"}
                  onClick={() => handleSelectTheme(t.id)}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
