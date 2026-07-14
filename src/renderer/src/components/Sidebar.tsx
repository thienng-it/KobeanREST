import { ChevronDown, FolderTree, Plus, Search, Trash2, Edit2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { WorkspaceSummary, SavedRequest } from "../types";

export interface SidebarProps {
  workspace: WorkspaceSummary | null;
  selectedRequestId: string | null;
  activeEnvironment: string;
  sidebarWidth: number;
  isResizing: boolean;

  // Collection state
  collectionSearch: string;
  collapsedFolders: Record<string, boolean>;
  scriptStatus: Record<string, boolean>;
  contextMenu: {
    x: number;
    y: number;
    target: {
      id: string;
      type: 'folder' | 'request';
    } | null;
  } | null;
  renamingSidebarItem: {
    id: string;
    type: "folder" | "collection";
  } | null;
  sidebarNameDraft: string;

  // CRUD callbacks
  onCreateFolder: (collectionId?: string, parentId?: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => void;
  onCreateCollection: () => Promise<void>;
  onDeleteCollection: (collectionId: string) => void;
  onSelectRequest: (requestId: string) => void;
  onDeleteRequest: (requestId: string) => void;

  // Rename callbacks
  onRenameCollection: (collectionId: string, newName: string) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onRenameRequest: (request: SavedRequest, newName: string) => void;

  // Environment management
  onSetActiveEnvironment: (name: string) => Promise<void>;
  onOpenEnvironmentEditor: () => void;

  // Additional handlers
  onOpenFolderScripts: (folderId: string) => void;
  onEditFolderAuth: (folderId: string) => void;
  onEditCollectionAuth: (collectionId: string) => void;
  onCreateRequest: (folderId: string) => Promise<void>;

  // Search callback
  onCollectionSearchChange: (value: string) => void;

  // UI state callbacks
  onToggleFolder: (folderId: string) => void;
  onContextMenu: (contextMenu: {
    x: number;
    y: number;
    target: {
      id: string;
      type: 'folder' | 'request';
    } | null;
  }) => void;
  onSidebarRenameStart: (type: "folder" | "collection", id: string, name: string) => void;
  onSidebarNameDraftChange: (value: string) => void;
  onSidebarRenameApply: () => Promise<void>;
  onSidebarRenameCancel: () => void;
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
  contextMenu,
  renamingSidebarItem,
  sidebarNameDraft,
  onCreateFolder,
  onDeleteFolder,
  onCreateCollection,
  onDeleteCollection,
  onSelectRequest,
  onDeleteRequest,
  onRenameCollection,
  onRenameFolder,
  onRenameRequest,
  onSetActiveEnvironment,
  onOpenEnvironmentEditor,
  onOpenFolderScripts,
  onEditFolderAuth,
  onEditCollectionAuth,
  onCreateRequest,
  onCollectionSearchChange,
  onToggleFolder,
  onContextMenu,
  onSidebarRenameStart,
  onSidebarNameDraftChange,
  onSidebarRenameApply,
  onSidebarRenameCancel,
}: SidebarProps) {
  // Helper function to check if search matches
  const isCollectionSearchActive = collectionSearch.trim().length > 0;
  const normalizedCollectionSearch = collectionSearch.trim().toLowerCase();

  function matchesCollectionSearch(value: string | undefined) {
    return !isCollectionSearchActive || value?.toLowerCase().includes(normalizedCollectionSearch);
  }

  // Import method helper functions
  const methodClass = (method: string): string => {
    const normalizedMethod = method.toUpperCase();
    switch (normalizedMethod) {
      case 'GET':
        return 'get';
      case 'POST':
        return 'post';
      case 'PUT':
        return 'put';
      case 'DELETE':
        return 'delete';
      case 'PATCH':
        return 'patch';
      case 'HEAD':
        return 'head';
      case 'OPTIONS':
        return 'options';
      default:
        return 'custom';
    }
  };

  const resolvedMethodLabel = (method: string, customMethod?: string): string => {
    return method === 'CUSTOM' ? (customMethod?.trim() || 'CUSTOM') : method;
  };

  // Search match functions
  function requestMatchesCollectionSearch(request: SavedRequest) {
    return (
      matchesCollectionSearch(request.name) ||
      matchesCollectionSearch(request.url) ||
      matchesCollectionSearch(resolvedMethodLabel(request.method, request.customMethod))
    );
  }

  function folderMatchesCollectionSearch(folderId: string): boolean {
    const folder = workspace?.folders.find((item) => item.id === folderId);
    if (!folder) return false;
    if (matchesCollectionSearch(folder.name)) return true;
    if (workspace?.requests.some((request) => request.folderId === folderId && requestMatchesCollectionSearch(request))) return true;
    return workspace?.folders.some((child) => child.parentId === folderId && folderMatchesCollectionSearch(child.id)) ?? false;
  }

  // Calculate visible collections
  const visibleCollections = (workspace?.collections ?? []).filter((collection) => {
    if (matchesCollectionSearch(collection.name)) return true;
    return workspace?.folders.some((folder) => folder.collectionId === collection.id && folderMatchesCollectionSearch(folder.id));
  });

  return (
    <aside
      className="sidebar"
      aria-label="Workspace navigation"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <div className="brand-row">
        <div className="brand-mark">KR</div>
        <div className="brand-copy">
          <strong>KobeanREST</strong>
          <span>Local REST Client</span>
        </div>
      </div>

      <div className="sidebar-content">
        <div className="environment-switcher">
          <Search size={15} className="environment-switcher-icon" />
          <select
            className="environment-select"
            aria-label="Active environment"
            value={activeEnvironment}
            onChange={e => void onSetActiveEnvironment(e.target.value)}
          >
            {workspace?.environments?.map(env => (
              <option key={env.name} value={env.name}>{env.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="environment-manage-button"
            aria-label="Manage environments"
            onClick={onOpenEnvironmentEditor}
          >
            Manage
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            className="primary-action"
            type="button"
            onClick={() => void onCreateCollection()}
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
          >
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
              <Trash2 size={13} />
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
          {visibleCollections.map(collection => (
            <div className="collection-group" key={collection.id} style={{ marginBottom: '20px' }}>
              <div className="folder-title sidebar-tree-row collection-title">
                {renamingSidebarItem?.type === "collection" && renamingSidebarItem.id === collection.id ? (
                  <input
                    value={sidebarNameDraft}
                    aria-label={`Rename collection ${collection.name}`}
                    autoFocus
                    onChange={(event) => onSidebarNameDraftChange(event.target.value)}
                    onBlur={() => void onSidebarRenameApply()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        onSidebarRenameCancel();
                      }
                    }}
                    style={{ flex: 1, minWidth: 0, border: '1px solid var(--color-border-tint)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '4px 8px', fontWeight: 700 }}
                  />
                ) : (
                  <strong onDoubleClick={() => onSidebarRenameStart("collection", collection.id, collection.name)}>{collection.name}</strong>
                )}
                <div className="sidebar-row-actions">
                  <button
                    type="button"
                    className="sidebar-icon-button"
                    aria-label={`Rename collection ${collection.name}`}
                    onClick={() => onSidebarRenameStart("collection", collection.id, collection.name)}
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
                    .filter(f => (parentId === undefined ? f.collectionId === collection.id && !f.parentId : f.parentId === parentId))
                    .filter(f => forceShowAll || folderMatchesCollectionSearch(f.id));

                  if (folders.length === 0) return null;

                  return (
                    <div style={{ paddingLeft: `${depth * 12}px` }}>
                      {folders.map(folder => {
                        const folderNameMatches = matchesCollectionSearch(folder.name);
                        const showFolderContents = forceShowAll || folderNameMatches;
                        const isFolderCollapsed = !isCollectionSearchActive && collapsedFolders[folder.id];
                        const folderRequests = (workspace?.requests ?? [])
                          .filter(r => r.folderId === folder.id)
                          .filter(r => showFolderContents || requestMatchesCollectionSearch(r));
                        return (
                          <div className="folder-group" key={folder.id}>
                            <div className="folder-title sidebar-tree-row"
                              onContextMenu={e => {
                                e.preventDefault();
                                onContextMenu({ x: e.clientX, y: e.clientY, target: { id: folder.id, type: 'folder' } });
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
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
                                    onBlur={() => void onSidebarRenameApply()}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        event.currentTarget.blur();
                                      } else if (event.key === "Escape") {
                                        event.preventDefault();
                                        onSidebarRenameCancel();
                                      }
                                    }}
                                    style={{ minWidth: 0, width: '120px', border: '1px solid var(--color-border-tint)', borderRadius: '6px', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '4px 8px', fontWeight: 700 }}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onToggleFolder(folder.id)}
                                    onDoubleClick={(event) => {
                                      event.stopPropagation();
                                      onSidebarRenameStart("folder", folder.id, folder.name);
                                    }}
                                    style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                  >
                                    {folder.name}
                                    {scriptStatus[folder.id] && (
                                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', marginLeft: '4px' }} title="Has scripts" />
                                    )}
                                  </button>
                                )}
                              </div>
                              <div className="sidebar-row-actions">
                                <button
                                  type="button"
                                  className="sidebar-icon-button"
                                  aria-label={`Rename folder ${folder.name}`}
                                  onClick={() => onSidebarRenameStart("folder", folder.id, folder.name)}
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
                                {folderRequests.map(request => (
                                  <div key={request.id} className={request.id === selectedRequestId ? "request-row sidebar-tree-row active" : "request-row sidebar-tree-row"} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    onContextMenu={e => {
                                      e.preventDefault();
                                      onContextMenu({ x: e.clientX, y: e.clientY, target: { id: request.id, type: 'request' } });
                                    }}
                                  >
                                    <button
                                      style={{ all: 'unset', flex: 1, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                      onClick={() => onSelectRequest(request.id)}
                                      type="button"
                                    >
                                      <span className={`method method-${methodClass(resolvedMethodLabel(request.method, request.customMethod))}`}>{resolvedMethodLabel(request.method, request.customMethod)}</span>
                                      <span onDoubleClick={() => onRenameRequest(request, request.id === selectedRequestId ? request.name : request.name)}>{request.id === selectedRequestId ? (workspace?.requests.find(r => r.id === request.id)?.name ?? request.name) : request.name}</span>
                                      {scriptStatus[request.id] && (
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', marginLeft: '4px' }} title="Has scripts" />
                                      )}
                                    </button>
                                    <div className="sidebar-row-actions">
                                      <button type="button" className="sidebar-icon-button" aria-label={`Rename ${request.name}`} onClick={() => onRenameRequest(request, request.name)}>
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

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            border: '1px solid var(--color-border-modal)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '160px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            pointerEvents: 'auto',
          }}
          onClick={() => alert("Container clicked!")}
        >
          {contextMenu.target?.type === 'folder' && (
            <>
              <button
                className="context-menu-item"
                onClick={async (e) => {
                  e.stopPropagation();
                  alert("Context Menu: New Request clicked!");
                  const folderId = contextMenu.target?.id;
                  if (folderId) await onCreateRequest(folderId);
                  onContextMenu(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Plus size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> New Request
              </button>
              <button
                className="context-menu-item"
                onClick={async (e) => {
                  e.stopPropagation();
                  alert("Context Menu: New Folder clicked!");
                  const folderId = contextMenu.target?.id;
                  if (folderId) await onCreateFolder(undefined, folderId);
                  onContextMenu(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <FolderTree size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> New Folder
              </button>
              <button
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  const folderId = contextMenu.target?.id;
                  if (folderId) onEditFolderAuth(folderId);
                  onContextMenu(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Edit Auth
              </button>
              <button
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  const folderId = contextMenu.target?.id;
                  if (folderId) onOpenFolderScripts(folderId);
                  onContextMenu(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Edit Scripts
              </button>
              <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />
              <button
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  const folderId = contextMenu.target?.id;
                  if (folderId) onDeleteFolder(folderId);
                  onContextMenu(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'auto',
                  color: '#991b1b'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Delete Folder
              </button>
            </>
          )}
          {contextMenu.target?.type === 'request' && (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  const reqId = contextMenu.target?.id;
                  if (reqId) {
                    const request = workspace?.requests.find(r => r.id === reqId);
                    if (request) onRenameRequest(request, request.name);
                  }
                  onContextMenu(null);
                }}
                style={{ all: 'unset', padding: '6px 10px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Rename
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  const reqId = contextMenu.target?.id;
                  if (reqId) onSelectRequest(reqId);
                  onContextMenu(null);
                }}
                style={{ all: 'unset', padding: '6px 10px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ marginRight: '8px', verticalAlign: 'middle' }}>👁</span> View Request
              </button>
              <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />
              <button
                className="context-menu-item"
                onClick={() => {
                  const reqId = contextMenu.target?.id;
                  if (reqId) onDeleteRequest(reqId);
                  onContextMenu(null);
                }}
                style={{ all: 'unset', padding: '6px 10px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: '#991b1b' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-muted)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Delete Request
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}