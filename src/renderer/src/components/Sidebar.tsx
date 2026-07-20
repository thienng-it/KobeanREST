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
  onOpenEnvironment: () => void;

  // Additional handlers
  onOpenFolderScripts: (folderId: string) => void;
  onEditFolderAuth: (folderId: string) => void;
  onEditCollectionAuth: (collectionId: string) => void;
  onCreateRequest: (folderId: string) => Promise<void>;

  // Search callback
  onCollectionSearchChange: (value: string) => void;

  // UI state callbacks
  onToggleFolder: (folderId: string) => void;
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
  onOpenEnvironment,
  onOpenFolderScripts,
  onEditFolderAuth,
  onEditCollectionAuth,
  onCreateRequest,
  onCollectionSearchChange,
  onToggleFolder,
}: SidebarProps) {
  // Helper function to check if search matches
  const isCollectionSearchActive = collectionSearch.trim().length > 0;
  const normalizedCollectionSearch = collectionSearch.trim().toLowerCase();

  function matchesCollectionSearch(value: string | undefined) {
    return !isCollectionSearchActive || value?.toLowerCase().includes(normalizedCollectionSearch);
  }

  // Method helper functions
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

  function folderMatchesCollectionSearch(folderId: string): boolean | undefined {
    const folder = workspace?.folders.find((item) => item.id === folderId);
    if (!folder) return false;
    if (matchesCollectionSearch(folder.name)) return true;
    return workspace?.requests.some((request) => request.folderId === folderId && requestMatchesCollectionSearch(request));
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
            onClick={onOpenEnvironment}
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
                <strong>{collection.name}</strong>
                <div className="sidebar-row-actions">
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
                            <div className="folder-title sidebar-tree-row">
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
                                <button
                                  type="button"
                                  onClick={() => onToggleFolder(folder.id)}
                                  style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                >
                                  {folder.name}
                                  {scriptStatus[folder.id] && (
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', marginLeft: '4px' }} title="Has scripts" />
                                  )}
                                </button>
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
                                  <div key={request.id} className={request.id === selectedRequestId ? "request-row sidebar-tree-row active" : "request-row sidebar-tree-row"} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button
                                      style={{ all: 'unset', flex: 1, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                      onClick={() => onSelectRequest(request.id)}
                                      type="button"
                                    >
                                      <span className={`method method-${methodClass(resolvedMethodLabel(request.method, request.customMethod))}`}>{resolvedMethodLabel(request.method, request.customMethod)}</span>
                                      <span>{request.name}</span>
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
    </aside>
  );
}