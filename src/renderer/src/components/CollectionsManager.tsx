import { useState, useMemo } from "react";
import {
  FolderTree,
  Plus,
  Search,
  Lock,
  Unlock,
  Play,
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  Package,
  Layers,
  FileText,
  Key,
  KeyRound,
  Globe,
  LayoutGrid,
  List,
  ExternalLink,
  Shield,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import type {
  CollectionSummary,
  WorkspaceSummary,
  SavedRequest,
  FolderSummary,
} from "../types";
import { methodClass } from "./MethodSelector";
import { getCollectionLockConfig } from "../services/collection-security";

export interface CollectionsManagerProps {
  workspace: WorkspaceSummary | null;
  unlockedCollectionIds?: Set<string>;
  onOpenCollection: (collectionId: string) => void;
  onOpenFolder?: (folderId: string) => void;
  onSelectRequest: (requestId: string) => void;
  onCreateCollection: () => Promise<void>;
  onDeleteCollection: (collectionId: string) => void;
  onStartRenameCollection?: (collectionId: string, currentName: string) => void;
  onCreateRequestInCollection: (collectionId: string) => void;
  onCreateFolderInCollection: (collectionId: string) => Promise<void>;
  onRunCollection?: (collectionId: string) => void;
  onLockCollectionToggle?: (collectionId: string) => void;
  onRemoveLockCollection?: (collectionId: string) => void;
  onExportCollection?: (collectionId: string) => void;
  onOpenUniversalImport?: () => void;
  onExportWorkspace?: () => void;
}

export function CollectionsManager({
  workspace,
  unlockedCollectionIds = new Set(),
  onOpenCollection,
  onOpenFolder,
  onSelectRequest,
  onCreateCollection,
  onDeleteCollection,
  onStartRenameCollection,
  onCreateRequestInCollection,
  onCreateFolderInCollection,
  onRunCollection,
  onLockCollectionToggle,
  onRemoveLockCollection,
  onExportCollection,
  onOpenUniversalImport,
  onExportWorkspace,
}: CollectionsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<"all" | "locked" | "unlocked" | "has_env">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "requests_desc" | "folders_desc">("name_asc");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const collections = useMemo(() => workspace?.collections || [], [workspace?.collections]);
  const folders = useMemo(() => workspace?.folders || [], [workspace?.folders]);
  const requests = useMemo(() => workspace?.requests || [], [workspace?.requests]);

  // Helper metrics per collection
  const getCollectionStats = (collectionId: string) => {
    const colFolders = folders.filter((f) => f.collectionId === collectionId);
    const colFolderIds = new Set(colFolders.map((f) => f.id));

    // Direct requests in collection (folderId === collectionId) + requests inside collection folders
    const directReqs = requests.filter((r) => r.folderId === collectionId);
    const nestedReqs = requests.filter((r) => r.folderId && colFolderIds.has(r.folderId));
    const allReqs = [...directReqs, ...nestedReqs];

    const col = collections.find((c) => c.id === collectionId);
    const varCount = (col?.variables || []).length;
    const lockConfig = col?.lockConfig || getCollectionLockConfig(collectionId);
    const isProtected = Boolean(lockConfig?.isLocked);
    const isLocked = isProtected && !unlockedCollectionIds.has(collectionId);

    return {
      folderCount: colFolders.length,
      requestCount: allReqs.length,
      variableCount: varCount,
      allRequests: allReqs,
      directRequests: directReqs,
      folders: colFolders,
      isProtected,
      isLocked,
      lockConfig,
    };
  };

  // Overall workspace stats
  const totalCollections = collections.length;
  const totalRequests = requests.length;
  const totalFolders = folders.length;
  const lockedCount = collections.filter((c) => {
    const lockConfig = c.lockConfig || getCollectionLockConfig(c.id);
    return lockConfig?.isLocked && !unlockedCollectionIds.has(c.id);
  }).length;

  // Filtered & Sorted collections
  const filteredCollections = useMemo(() => {
    let list = [...collections];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        const matchesName = c.name.toLowerCase().includes(q);
        const { allRequests } = getCollectionStats(c.id);
        const matchesReq = allRequests.some(
          (r) => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)
        );
        return matchesName || matchesReq;
      });
    }

    if (filterType === "locked") {
      list = list.filter((c) => {
        const stats = getCollectionStats(c.id);
        return stats.isLocked;
      });
    } else if (filterType === "unlocked") {
      list = list.filter((c) => {
        const stats = getCollectionStats(c.id);
        return stats.isProtected && !stats.isLocked;
      });
    } else if (filterType === "has_env") {
      list = list.filter((c) => Boolean(c.defaultEnvironment));
    }

    list.sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "requests_desc") {
        return getCollectionStats(b.id).requestCount - getCollectionStats(a.id).requestCount;
      }
      if (sortBy === "folders_desc") {
        return getCollectionStats(b.id).folderCount - getCollectionStats(a.id).folderCount;
      }
      return 0;
    });

    return list;
  }, [collections, searchQuery, filterType, sortBy, folders, requests, unlockedCollectionIds]);

  const toggleExpandCard = (collectionId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [collectionId]: !prev[collectionId],
    }));
  };

  return (
    <div
      className="collections-manager-view"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
        padding: "24px 32px",
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "var(--color-surface-active)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-primary, #6366f1)",
              }}
            >
              <FolderTree size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
                Collections Hub
              </h1>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
                Organize, run, protect, and inspect your API suites in {workspace?.name || "current workspace"}.
              </p>
            </div>
          </div>
        </div>

        {/* Global Hub Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onOpenUniversalImport && (
            <button
              type="button"
              className="ghost-button"
              onClick={onOpenUniversalImport}
              title="Import Postman collection or OpenAPI"
            >
              <Upload size={14} /> Import
            </button>
          )}
          {onExportWorkspace && (
            <button
              type="button"
              className="ghost-button"
              onClick={onExportWorkspace}
              title="Export all workspace collections"
            >
              <Download size={14} /> Export All
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={() => void onCreateCollection()}
          >
            <Plus size={14} /> New Collection
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Total Collections
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)" }}>
            {totalCollections}
          </div>
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Total Requests
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)" }}>
            {totalRequests}
          </div>
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Folders & Groups
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)" }}>
            {totalFolders}
          </div>
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Protected Collections
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: lockedCount > 0 ? "var(--color-status-error)" : "var(--color-text)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {lockedCount > 0 ? <ShieldAlert size={18} /> : <Shield size={18} />}
            {lockedCount} Locked
          </div>
        </div>
      </div>

      {/* Search & Control Filter Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Search input */}
        <div
          style={{
            position: "relative",
            flex: "1 1 260px",
            maxWidth: "400px",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search collections or requests…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px 7px 32px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setFilterType("all")}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid var(--color-border)",
              backgroundColor: filterType === "all" ? "var(--color-surface-active)" : "transparent",
              color: filterType === "all" ? "var(--color-text-active)" : "var(--color-text-muted)",
            }}
          >
            All ({collections.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("locked")}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid var(--color-border)",
              backgroundColor: filterType === "locked" ? "var(--color-surface-active)" : "transparent",
              color: filterType === "locked" ? "var(--color-status-error)" : "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Lock size={12} /> Locked
          </button>
          <button
            type="button"
            onClick={() => setFilterType("unlocked")}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid var(--color-border)",
              backgroundColor: filterType === "unlocked" ? "var(--color-surface-active)" : "transparent",
              color: filterType === "unlocked" ? "var(--color-status-2xx)" : "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Unlock size={12} /> Unlocked
          </button>
          <button
            type="button"
            onClick={() => setFilterType("has_env")}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid var(--color-border)",
              backgroundColor: filterType === "has_env" ? "var(--color-surface-active)" : "transparent",
              color: filterType === "has_env" ? "var(--color-text-active)" : "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Globe size={12} /> Default Env
          </button>
        </div>

        {/* Sort and View Mode */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "12px",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="name_asc">Sort: Name (A-Z)</option>
            <option value="name_desc">Sort: Name (Z-A)</option>
            <option value="requests_desc">Sort: Most Requests</option>
            <option value="folders_desc">Sort: Most Folders</option>
          </select>

          <div
            style={{
              display: "flex",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              style={{
                padding: "6px 8px",
                border: "none",
                backgroundColor: viewMode === "grid" ? "var(--color-surface-active)" : "var(--color-surface)",
                color: viewMode === "grid" ? "var(--color-text-active)" : "var(--color-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="Grid View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                padding: "6px 8px",
                border: "none",
                backgroundColor: viewMode === "list" ? "var(--color-surface-active)" : "var(--color-surface)",
                color: viewMode === "list" ? "var(--color-text-active)" : "var(--color-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="List View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Collections List or Grid */}
      {filteredCollections.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 16px",
            backgroundColor: "var(--color-surface)",
            borderRadius: "10px",
            border: "1px dashed var(--color-border)",
            textAlign: "center",
          }}
        >
          <Package size={36} style={{ color: "var(--color-text-muted)", marginBottom: "12px", opacity: 0.6 }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600 }}>
            {searchQuery ? "No collections match your filter" : "No Collections Yet"}
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--color-text-muted)", maxWidth: "380px" }}>
            {searchQuery
              ? `No collections or requests matched "${searchQuery}". Try clearing search.`
              : "Create a collection to organize requests, configure shared auth, and run end-to-end test batches."}
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            {searchQuery ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("all");
                }}
              >
                Clear Search
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void onCreateCollection()}
                >
                  <Plus size={14} /> Create Collection
                </button>
                {onOpenUniversalImport && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={onOpenUniversalImport}
                  >
                    <Upload size={14} /> Import Postman / OpenAPI
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredCollections.map((col) => {
            const stats = getCollectionStats(col.id);
            const isExpanded = expandedCards[col.id];

            return (
              <div
                key={col.id}
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                  overflow: "hidden",
                }}
              >
                {/* Card Header */}
                <div
                  style={{
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    borderBottom: "1px solid var(--color-border-subtle, var(--color-border))",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          backgroundColor: "var(--color-surface-active)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--color-primary, #6366f1)",
                          flexShrink: 0,
                        }}
                      >
                        <Package size={16} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: "14px",
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                            }}
                            onClick={() => onOpenCollection(col.id)}
                            title="Click to open Collection Editor"
                          >
                            {col.name}
                          </h3>
                          {stats.isProtected && (
                            <span
                              onClick={() => onLockCollectionToggle?.(col.id)}
                              style={{
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                              title={stats.isLocked ? "Collection is locked (click to unlock)" : "Collection is unlocked for this session"}
                            >
                              {stats.isLocked ? (
                                <Lock size={13} style={{ color: "var(--color-status-error)" }} />
                              ) : (
                                <Unlock size={13} style={{ color: "var(--color-status-2xx)" }} />
                              )}
                            </span>
                          )}
                        </div>
                        {col.defaultEnvironment && (
                          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                            <Globe size={11} />
                            <span>Env: {col.defaultEnvironment}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lock / Quick run badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {onRunCollection && (
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => onRunCollection(col.id)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "var(--color-status-2xx)",
                          }}
                          title={`Run entire collection "${col.name}"`}
                        >
                          <Play size={12} /> Run
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata Tag Row */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--color-surface-active)",
                        color: "var(--color-text-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {stats.requestCount} {stats.requestCount === 1 ? "request" : "requests"}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--color-surface-active)",
                        color: "var(--color-text-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {stats.folderCount} {stats.folderCount === 1 ? "folder" : "folders"}
                    </span>
                    {col.authMode && col.authMode !== "none" && (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(99, 102, 241, 0.15)",
                          color: "var(--color-primary, #6366f1)",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <Key size={10} /> {col.authMode.toUpperCase()}
                      </span>
                    )}
                    {stats.variableCount > 0 && (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "var(--color-surface-active)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {stats.variableCount} vars
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Toolbar */}
                <div
                  style={{
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "var(--color-surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onOpenCollection(col.id)}
                      style={{ fontSize: "12px", padding: "4px 8px" }}
                      title="Configure auth, scripts, and variables"
                    >
                      <Edit2 size={12} style={{ marginRight: "4px" }} /> Edit
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void onCreateRequestInCollection(col.id)}
                      style={{ fontSize: "12px", padding: "4px 8px" }}
                      title="Add new request"
                    >
                      <FilePlus size={12} style={{ marginRight: "4px" }} /> Request
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void onCreateFolderInCollection(col.id)}
                      style={{ fontSize: "12px", padding: "4px 8px" }}
                      title="Add new folder"
                    >
                      <FolderPlus size={12} style={{ marginRight: "4px" }} /> Folder
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {onLockCollectionToggle && (
                      <button
                        type="button"
                        className="sidebar-icon-button"
                        onClick={() => onLockCollectionToggle(col.id)}
                        title={stats.isProtected ? (stats.isLocked ? "Unlock collection" : "Lock collection") : "Set passcode lock"}
                      >
                        {stats.isProtected ? (stats.isLocked ? <Lock size={12} /> : <Unlock size={12} />) : <Lock size={12} style={{ opacity: 0.4 }} />}
                      </button>
                    )}
                    {stats.isProtected && onRemoveLockCollection && (
                      <button
                        type="button"
                        className="sidebar-icon-button danger"
                        onClick={() => onRemoveLockCollection(col.id)}
                        title="Remove collection passcode lock"
                      >
                        <KeyRound size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="sidebar-icon-button"
                      onClick={() => toggleExpandCard(col.id)}
                      title={isExpanded ? "Collapse requests list" : "Expand requests list"}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <button
                      type="button"
                      className="sidebar-icon-button danger"
                      onClick={() => onDeleteCollection(col.id)}
                      title={`Delete collection "${col.name}"`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Expanded Requests / Folders Tree Preview */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "8px 16px 12px",
                      backgroundColor: "var(--color-bg)",
                      borderTop: "1px solid var(--color-border)",
                      maxHeight: "220px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {stats.isLocked ? (
                      <div
                        onClick={() => onLockCollectionToggle?.(col.id)}
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          fontSize: "12px",
                          color: "var(--color-text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <Lock size={13} color="var(--color-status-error)" />
                        <span>This collection is locked. Click to unlock.</span>
                      </div>
                    ) : stats.allRequests.length === 0 && stats.folders.length === 0 ? (
                      <div style={{ padding: "10px", textAlign: "center", fontSize: "12px", color: "var(--color-text-muted)" }}>
                        No requests or folders in this collection.
                      </div>
                    ) : (
                      <>
                        {/* Folders in collection */}
                        {stats.folders.map((f) => {
                          const folderReqs = requests.filter((r) => r.folderId === f.id);
                          return (
                            <div key={f.id} style={{ marginBottom: "4px" }}>
                              <div
                                onClick={() => onOpenFolder?.(f.id)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "var(--color-text)",
                                  cursor: "pointer",
                                  padding: "3px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                <FolderTree size={12} style={{ color: "var(--color-primary, #6366f1)" }} />
                                <span>{f.name}</span>
                                <span style={{ fontSize: "10px", color: "var(--color-text-muted)", fontWeight: "normal" }}>
                                  ({folderReqs.length})
                                </span>
                              </div>
                              {/* Requests inside folder */}
                              {folderReqs.map((r) => (
                                <div
                                  key={r.id}
                                  onClick={() => onSelectRequest(r.id)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "12px",
                                    padding: "3px 6px 3px 20px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    backgroundColor: "transparent",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <span className={`method method-${methodClass(r.method || "GET")}`} style={{ fontSize: "10px", padding: "1px 4px" }}>
                                    {r.method || "GET"}
                                  </span>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                    {r.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })}

                        {/* Direct requests in collection root */}
                        {stats.directRequests.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => onSelectRequest(r.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12px",
                              padding: "4px 6px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              backgroundColor: "transparent",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            <span className={`method method-${methodClass(r.method || "GET")}`} style={{ fontSize: "10px", padding: "1px 4px" }}>
                              {r.method || "GET"}
                            </span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                              {r.name}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List View Mode */
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "10px",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "11px", textTransform: "uppercase" }}>
                <th style={{ padding: "10px 16px" }}>Collection Name</th>
                <th style={{ padding: "10px 16px" }}>Requests</th>
                <th style={{ padding: "10px 16px" }}>Folders</th>
                <th style={{ padding: "10px 16px" }}>Auth</th>
                <th style={{ padding: "10px 16px" }}>Default Env</th>
                <th style={{ padding: "10px 16px" }}>Security</th>
                <th style={{ padding: "10px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCollections.map((col) => {
                const stats = getCollectionStats(col.id);
                return (
                  <tr
                    key={col.id}
                    style={{
                      borderBottom: "1px solid var(--color-border-subtle, var(--color-border))",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td style={{ padding: "12px 16px" }} onClick={() => onOpenCollection(col.id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                        <Package size={15} style={{ color: "var(--color-primary, #6366f1)" }} />
                        <span>{col.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-muted)" }}>
                      {stats.requestCount}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-muted)" }}>
                      {stats.folderCount}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {col.authMode && col.authMode !== "none" ? (
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(99, 102, 241, 0.15)",
                            color: "var(--color-primary, #6366f1)",
                            fontWeight: 500,
                          }}
                        >
                          {col.authMode.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {col.defaultEnvironment ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                          <Globe size={12} /> {col.defaultEnvironment}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {stats.isProtected ? (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onLockCollectionToggle?.(col.id);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                            color: stats.isLocked ? "var(--color-status-error)" : "var(--color-status-2xx)",
                            cursor: "pointer",
                          }}
                        >
                          {stats.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                          {stats.isLocked ? "Locked" : "Unlocked"}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>Unprotected</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                        {onRunCollection && (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunCollection(col.id);
                            }}
                            style={{ padding: "3px 6px", fontSize: "11px", color: "var(--color-status-2xx)" }}
                            title="Run collection"
                          >
                            <Play size={11} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCollection(col.id);
                          }}
                          style={{ padding: "3px 6px", fontSize: "11px" }}
                          title="Edit collection"
                        >
                          <Edit2 size={11} />
                        </button>
                        {stats.isProtected && onRemoveLockCollection && (
                          <button
                            type="button"
                            className="ghost-button danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveLockCollection(col.id);
                            }}
                            style={{ padding: "3px 6px", fontSize: "11px" }}
                            title="Remove collection passcode lock"
                          >
                            <KeyRound size={11} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCollection(col.id);
                          }}
                          style={{ padding: "3px 6px", fontSize: "11px" }}
                          title="Delete collection"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
