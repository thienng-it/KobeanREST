import { ChevronDown, FolderTree, Globe, Plus, Search, Trash2, Edit2, X, Download, Upload, Terminal, MoreVertical, Sun, Moon, Monitor, Zap, Flame, History, RefreshCw, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { CustomSelect } from "./CustomSelect";
import type { AppSettings, SavedRequest, WorkspaceSummary } from "../types";

interface ContextMenuTarget {
  id: string;
  type: "folder" | "request" | "collection" | "workspace";
}

export interface SidebarProps {
  workspace: WorkspaceSummary | null;
  selectedRequestId: string | null;
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

  // Collection state
  collectionSearch: string;
  collapsedFolders: Record<string, boolean>;
  scriptStatus: Record<string, boolean>;

  // Draft (live request name being edited elsewhere)
  draftRequest: SavedRequest | null;

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

  // Search & toggle & context menu
  onCollectionSearchChange: (value: string) => void;
  onToggleFolder: (folderId: string) => void;
  onContextMenu: (target: ContextMenuTarget, x: number, y: number) => void;
  onDismissDeleteError: () => void;

  // Import / export
  onExport: () => void;
  onImport: () => void;
  onCurlImport: () => void;
}

export function Sidebar({
  workspace,
  selectedRequestId,
  activeEnvironment,
  sidebarWidth,
  isResizing,
  collectionSearch,
  collapsedFolders,
  scriptStatus,
  draftRequest,
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
  onCollectionSearchChange,
  onToggleFolder,
  onContextMenu,
  onDismissDeleteError,
  theme = "system",
  onThemeChange,
  onToggleSidebar,
  onOpenDocs,
  onOpenHistory,
  onCheckForUpdates,
  onOpenSettings,
  onExport,
  onImport,
  onCurlImport,
}: SidebarProps) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
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
    return (
      matchesCollectionSearch(request.name) ||
      matchesCollectionSearch(request.url) ||
      matchesCollectionSearch(resolvedMethodLabel(request.method, request.customMethod))
    );
  }

  function folderMatchesCollectionSearch(folderId: string): boolean | undefined {
    const folder = workspace?.folders.find((item) => item.id === folderId);
    if (!folder) return false;
    if (matchesCollectionSearch(folder.name)) return true;
    return workspace?.requests.some((request) => request.folderId === folderId && requestMatchesCollectionSearch(request));
  }

  const visibleCollections = (workspace?.collections ?? []).filter((collection) => {
    if (matchesCollectionSearch(collection.name)) return true;
    return workspace?.folders.some((folder) => folder.collectionId === collection.id && folderMatchesCollectionSearch(folder.id));
  });

  return (
    <aside
      className="sidebar"
      aria-label="Workspace navigation"
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <div className="brand-row">
        <div className="brand-mark">KR</div>
        <div className="brand-copy">
          <strong>KobeanREST</strong>
        </div>
        <div className="brand-actions">
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
        <div className="environment-switcher">
          <Globe size={15} className="environment-switcher-icon" />
          <CustomSelect
            className="environment-select"
            ariaLabel="Active environment"
            value={activeEnvironment}
            onChange={(val) => void onSetActiveEnvironment(val)}
            options={(workspace?.environments ?? []).map((env) => ({ value: env.name, label: env.name }))}
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

        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <button className="primary-action" type="button" onClick={() => void onCreateCollection()} style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}>
            <Plus size={16} />
            New collection
          </button>
        </div>

        <label className={collectionSearch ? "search-field has-value" : "search-field"}>
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

        <section className="nav-section">
          <h2>
            <FolderTree size={15} />
            Collections
          </h2>
          {visibleCollections.map((collection) => (
            <div className="collection-group" key={collection.id} style={{ marginBottom: "20px" }}>
              <div
                className="folder-title sidebar-tree-row collection-title"
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextMenu({ id: collection.id, type: "collection" }, e.clientX, e.clientY);
                }}
              >
                {renamingSidebarItem?.type === "collection" && renamingSidebarItem.id === collection.id ? (
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
                  <strong onDoubleClick={() => onStartSidebarRename("collection", collection.id, collection.name)}>{collection.name}</strong>
                )}
                <div className="sidebar-row-actions">
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
                    className="sidebar-icon-button"
                    aria-label={`New folder in ${collection.name}`}
                    onClick={() => void onCreateFolder(collection.id)}
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    type="button"
                    className="sidebar-icon-button danger"
                    aria-label={`Delete collection ${collection.name}`}
                    onClick={() => void onDeleteCollection(collection.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {(() => {
                const collectionNameMatches = matchesCollectionSearch(collection.name);
                const renderFolders = (parentId: string | undefined, depth = 0, forceShowAll = false) => {
                  const folders = (workspace?.folders ?? [])
                    .filter((f) => (parentId === undefined ? f.collectionId === collection.id && !f.parentId : f.parentId === parentId))
                    .filter((f) => forceShowAll || folderMatchesCollectionSearch(f.id));

                  if (folders.length === 0) return null;

                  return (
                    <div style={{ paddingLeft: `${depth * 12}px` }}>
                      {folders.map((folder) => {
                        const folderNameMatches = matchesCollectionSearch(folder.name);
                        const showFolderContents = forceShowAll || folderNameMatches;
                        const isFolderCollapsed = !isCollectionSearchActive && collapsedFolders[folder.id];
                        const folderRequests = (workspace?.requests ?? [])
                          .filter((r) => r.folderId === folder.id)
                          .filter((r) => showFolderContents || requestMatchesCollectionSearch(r));
                        return (
                          <div className="folder-group" key={folder.id}>
                            <div
                              className="folder-title sidebar-tree-row"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                onContextMenu({ id: folder.id, type: "folder" }, e.clientX, e.clientY);
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
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
                                {renamingSidebarItem?.type === "folder" && renamingSidebarItem.id === folder.id ? (
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
                                    onClick={() => onToggleFolder(folder.id)}
                                    onDoubleClick={(event) => {
                                      event.stopPropagation();
                                      onStartSidebarRename("folder", folder.id, folder.name);
                                    }}
                                    style={{ all: "unset", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                                  >
                                    {folder.name}
                                  </button>
                                )}
                              </div>
                              <div className="sidebar-row-actions">
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
                                  onClick={() => void onDeleteFolder(folder.id)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div
                              className={isFolderCollapsed ? "folder-children collapsed" : "folder-children"}
                              aria-hidden={isFolderCollapsed}
                            >
                              <div className="folder-children-inner">
                                {renderFolders(folder.id, depth + 1, showFolderContents)}
                                {folderRequests.map((request) => (
                                  <div
                                    key={request.id}
                                    className={request.id === selectedRequestId ? "request-row sidebar-tree-row active" : "request-row sidebar-tree-row"}
                                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      onContextMenu({ id: request.id, type: "request" }, e.clientX, e.clientY);
                                    }}
                                  >
                                    {renamingRequestId === request.id ? (
                                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "6px" }}>
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
                                        style={{ all: "unset", flex: 1, display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                                        onClick={() => onSelectRequest(request.id)}
                                        type="button"
                                      >
                                        <span className={`method method-${methodClass(resolvedMethodLabel(request.method, request.customMethod))}`}>{resolvedMethodLabel(request.method, request.customMethod)}</span>
                                        <span onDoubleClick={() => onStartRequestRename(request)}>{request.id === draftRequest?.id ? draftRequest.name : request.name}</span>
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
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                };

                return renderFolders(undefined, 0, collectionNameMatches);
              })()}
            </div>
          ))}
        </section>
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
            title="Settings"
            aria-label="Settings"
            onClick={onOpenSettings}
          >
            <Settings size={15} />
          </button>
        </div>
        <div className="sidebar-footer-theme" style={{ position: "relative" }}>
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
