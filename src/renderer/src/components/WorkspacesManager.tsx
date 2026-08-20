import { useState, useMemo, useEffect, useRef } from "react";
import {
  Boxes,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit2,
  FolderTree,
  Globe,
  LayoutGrid,
  List,
  Layers,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  ArrowRightLeft,
  ArrowLeft,
  FileText,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { WorkspaceListItem, WorkspaceSummary } from "../types";
import { loadWorkspaceById } from "../services/local-store";
import { useI18n } from '../services/i18n';

export interface WorkspaceItemStats {
  collectionCount: number;
  requestCount: number;
  environmentCount: number;
  folderCount: number;
  loading?: boolean;
}

export interface WorkspacesManagerProps {
  workspace: WorkspaceSummary | null;
  workspaceList: WorkspaceListItem[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (workspaceId: string) => Promise<void> | void;
  onCreateWorkspace: (name: string) => Promise<void> | void;
  onRenameWorkspace: (workspaceId: string, newName: string) => Promise<void> | void;
  onDeleteWorkspace: (workspaceId: string, name: string) => void;
  onExportWorkspace?: () => void;
  onOpenUniversalImport?: () => void;
  onOpenCollectionsOverview?: () => void;
  onCloseHub?: () => void;
}

export function WorkspacesManager({
  workspace,
  workspaceList,
  activeWorkspaceId,
  onSwitchWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onExportWorkspace,
  onOpenUniversalImport,
  onOpenCollectionsOverview,
  onCloseHub,
}: WorkspacesManagerProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "active_first">("active_first");
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [statsMap, setStatsMap] = useState<Record<string, WorkspaceItemStats>>({});
  const createInputRef = useRef<HTMLInputElement>(null);

  // Focus create input when opening create bar
  useEffect(() => {
    if (isCreating) {
      setTimeout(() => createInputRef.current?.focus(), 50);
    }
  }, [isCreating]);

  // Pre-populate stats for active workspace and load stats for others
  useEffect(() => {
    let isMounted = true;

    // Set active workspace stats immediately from in-memory workspace
    if (workspace && activeWorkspaceId) {
      setStatsMap((prev) => ({
        ...prev,
        [activeWorkspaceId]: {
          collectionCount: (workspace.collections || []).length,
          requestCount: (workspace.requests || []).length,
          environmentCount: (workspace.environments || []).length,
          folderCount: (workspace.folders || []).length,
          loading: false,
        },
      }));
    }

    // Load stats for all other workspaces concurrently in one batch
    async function fetchOtherStats() {
      const otherWorkspaces = workspaceList.filter((ws) => ws.id !== activeWorkspaceId);
      if (otherWorkspaces.length === 0) return;

      const results = await Promise.allSettled(
        otherWorkspaces.map(async (ws) => {
          const loaded = await loadWorkspaceById(ws.id);
          return {
            id: ws.id,
            stats: {
              collectionCount: (loaded.collections || []).length,
              requestCount: (loaded.requests || []).length,
              environmentCount: (loaded.environments || []).length,
              folderCount: (loaded.folders || []).length,
              loading: false,
            },
          };
        })
      );

      if (!isMounted) return;

      const newEntries: Record<string, WorkspaceItemStats> = {};
      for (let i = 0; i < otherWorkspaces.length; i++) {
        const res = results[i];
        const wsId = otherWorkspaces[i].id;
        if (res.status === "fulfilled") {
          newEntries[wsId] = res.value.stats;
        } else {
          newEntries[wsId] = {
            collectionCount: 0,
            requestCount: 0,
            environmentCount: 0,
            folderCount: 0,
            loading: false,
          };
        }
      }

      setStatsMap((prev) => ({
        ...prev,
        ...newEntries,
      }));
    }

    void fetchOtherStats();

    return () => {
      isMounted = false;
    };
  }, [workspaceList, activeWorkspaceId, workspace]);

  // Overall KPI aggregates
  const totalWorkspaces = workspaceList.length;
  const activeWs = workspaceList.find((w) => w.id === activeWorkspaceId) || {
    id: activeWorkspaceId,
    name: workspace?.name || "{t('workspaces.activeWorkspace')}",
  };
  const activeStats = statsMap[activeWorkspaceId] || {
    collectionCount: (workspace?.collections || []).length,
    requestCount: (workspace?.requests || []).length,
    environmentCount: (workspace?.environments || []).length,
    folderCount: (workspace?.folders || []).length,
  };

  // Filter and Sort Workspaces
  const filteredWorkspaces = useMemo(() => {
    let list = [...workspaceList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (ws) => ws.name.toLowerCase().includes(q) || ws.id.toLowerCase().includes(q)
      );
    }

    if (filterType === "active") {
      list = list.filter((ws) => ws.id === activeWorkspaceId);
    } else if (filterType === "inactive") {
      list = list.filter((ws) => ws.id !== activeWorkspaceId);
    }

    list.sort((a, b) => {
      if (sortBy === "active_first") {
        if (a.id === activeWorkspaceId) return -1;
        if (b.id === activeWorkspaceId) return 1;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      return 0;
    });

    return list;
  }, [workspaceList, searchQuery, filterType, sortBy, activeWorkspaceId]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;
    await onCreateWorkspace(trimmed);
    setNewWorkspaceName("");
    setIsCreating(false);
  };

  const handleRenameSubmit = (wsId: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) {
      void onRenameWorkspace(wsId, trimmed);
    }
    setRenamingId(null);
  };

  return (
    <div
      className="workspaces-manager-view"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        backgroundColor: "var(--color-bg-base, #090d16)",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(59, 130, 246, 0.2))",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-primary, #6366f1)",
              flexShrink: 0,
            }}
          >
            <Boxes size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
                Workspaces Hub
              </h1>
              <span
                style={{
                  fontSize: "12px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  backgroundColor: "var(--color-surface-hover)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                  fontWeight: 600,
                }}
              >
                {totalWorkspaces} {totalWorkspaces === 1 ? t('workspaces.singular') : t('workspaces.plural')}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--color-text-muted)" }}>
              {t('workspaces.hubDesc')}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onCloseHub && (
            <button
              type="button"
              className="ghost-button"
              onClick={onCloseHub}
              title={t('workspaces.returnToActive')}
            >
              <ArrowLeft size={14} /> Back to Workspace
            </button>
          )}
          {onOpenCollectionsOverview && (
            <button
              type="button"
              className="ghost-button"
              onClick={onOpenCollectionsOverview}
              title={t('workspaces.openCollections')}
            >
              <FolderTree size={14} /> Collections Hub
            </button>
          )}
          {onOpenUniversalImport && (
            <button
              type="button"
              className="ghost-button"
              onClick={onOpenUniversalImport}
              title={t('workspaces.importTooltip')}
            >
              <Upload size={14} /> Import
            </button>
          )}
          {onExportWorkspace && (
            <button
              type="button"
              className="ghost-button"
              onClick={onExportWorkspace}
              title={t('workspaces.exportActiveTooltip')}
            >
              <Download size={14} /> Export Active
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsCreating((prev) => !prev)}
          >
            <Plus size={14} /> New Workspace
          </button>
        </div>
      </div>

      {/* Inline Create Workspace Drawer */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderRadius: "10px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-primary, #6366f1)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
          }}
        >
          <div style={{ color: "var(--color-primary, #6366f1)" }}>
            <Boxes size={18} />
          </div>
          <input
            ref={createInputRef}
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder={t('workspaces.newNamePlaceholder')}
            spellCheck={false}
            style={{
              flex: 1,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              padding: "8px 12px",
              color: "var(--color-text)",
              fontSize: "13px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={!newWorkspaceName.trim()}
          >
            <Plus size={14} /> Create
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setIsCreating(false);
              setNewWorkspaceName("");
            }}
          >
            {t('common.cancel')}
          </button>
        </form>
      )}

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
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Boxes size={13} /> {t('workspaces.totalWorkspaces')}
          </span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)" }}>
            {totalWorkspaces}
          </span>
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
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle2 size={13} style={{ color: "var(--color-status-2xx, #10b981)" }} /> {t('workspaces.activeWorkspace')}
          </span>
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--color-primary, #6366f1)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={activeWs.name}
          >
            {activeWs.name}
          </span>
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
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Package size={13} /> {t('workspaces.activeCollections')}
          </span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)" }}>
            {activeStats.collectionCount}
          </span>
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
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <FileText size={13} /> {t('workspaces.activeRequests')}
          </span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)" }}>
            {activeStats.requestCount}
          </span>
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
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Globe size={13} /> Environments
          </span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)" }}>
            {activeStats.environmentCount}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
        {/* Search Input */}
        <div
          style={{
            position: "relative",
            flex: "1 1 260px",
            maxWidth: "380px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "10px",
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('workspaces.searchPlaceholder')}
            spellCheck={false}
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
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "8px",
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                padding: "2px",
                fontSize: "12px",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setFilterType("all")}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              borderRadius: "6px",
              backgroundColor: filterType === "all" ? "var(--color-surface-active)" : undefined,
              borderColor: filterType === "all" ? "var(--color-primary)" : undefined,
              color: filterType === "all" ? "var(--color-text-active)" : undefined,
            }}
          >
            {t('common.all')} ({workspaceList.length})
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setFilterType("active")}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              borderRadius: "6px",
              backgroundColor: filterType === "active" ? "var(--color-surface-active)" : undefined,
              borderColor: filterType === "active" ? "var(--color-status-2xx)" : undefined,
              color: filterType === "active" ? "var(--color-status-2xx)" : undefined,
            }}
          >
            {t('workspaces.active')} (1)
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setFilterType("inactive")}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              borderRadius: "6px",
              backgroundColor: filterType === "inactive" ? "var(--color-surface-active)" : undefined,
              borderColor: filterType === "inactive" ? "var(--color-border-strong)" : undefined,
              color: filterType === "inactive" ? "var(--color-text)" : undefined,
            }}
          >
            {t('workspaces.other')} ({Math.max(0, workspaceList.length - 1)})
          </button>
        </div>

        {/* Sort and View Mode Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
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
            <option value="active_first">{t('workspaces.sortActiveFirst')}</option>
            <option value="name_asc">{t('collection.sortNameAsc')}</option>
            <option value="name_desc">{t('collection.sortNameDesc')}</option>
          </select>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              style={{
                padding: "6px 9px",
                border: "none",
                background: viewMode === "grid" ? "var(--color-surface-active)" : "transparent",
                color: viewMode === "grid" ? "var(--color-text-active)" : "var(--color-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title={t('collection.gridView')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                padding: "6px 9px",
                border: "none",
                background: viewMode === "list" ? "var(--color-surface-active)" : "transparent",
                color: viewMode === "list" ? "var(--color-text-active)" : "var(--color-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title={t('collection.listView')}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Display Content */}
      {filteredWorkspaces.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 16px",
            border: "1px dashed var(--color-border)",
            borderRadius: "12px",
            backgroundColor: "var(--color-surface)",
            textAlign: "center",
            marginTop: "12px",
          }}
        >
          <Boxes size={36} style={{ color: "var(--color-text-muted)", opacity: 0.5, marginBottom: "12px" }} />
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 6px" }}>
            {searchQuery ? t('workspaces.noMatch') : t('workspaces.noWorkspaces')}
          </h3>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", maxWidth: "340px", margin: "0 0 16px" }}>
            {searchQuery
              ? t('workspaces.noMatchDesc', { query: searchQuery })
              : t('workspaces.createDesc')}
          </p>
          {searchQuery ? (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setSearchQuery("");
                setFilterType("all");
              }}
            >
              {t('collection.clearSearch')}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() => setIsCreating(true)}
            >
              <Plus size={14} /> Create Workspace
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredWorkspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            const stats = statsMap[ws.id] || {
              collectionCount: 0,
              requestCount: 0,
              environmentCount: 0,
              folderCount: 0,
            };

            return (
              <div
                key={ws.id}
                style={{
                  borderRadius: "10px",
                  border: isActive
                    ? "1.5px solid var(--color-primary, #6366f1)"
                    : "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  boxShadow: isActive
                    ? "0 4px 16px rgba(99, 102, 241, 0.15)"
                    : "0 2px 8px var(--color-shadow)",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.2s ease",
                  overflow: "hidden",
                }}
              >
                {/* Top Card Row */}
                <div style={{ padding: "16px 16px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          backgroundColor: isActive
                            ? "rgba(99, 102, 241, 0.15)"
                            : "var(--color-surface-hover)",
                          border: isActive
                            ? "1px solid rgba(99, 102, 241, 0.3)"
                            : "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isActive ? "var(--color-primary, #6366f1)" : "var(--color-text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        <Boxes size={18} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
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
                            style={{
                              width: "100%",
                              background: "var(--color-surface)",
                              border: "1px solid var(--color-primary)",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "var(--color-text)",
                              outline: "none",
                            }}
                          />
                        ) : (
                          <h3
                            style={{
                              margin: 0,
                              fontSize: "15px",
                              fontWeight: 600,
                              color: "var(--color-text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={ws.name}
                          >
                            {ws.name}
                          </h3>
                        )}
                        <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>
                          {ws.id}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {isActive ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: "12px",
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "var(--color-status-2xx, #10b981)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          flexShrink: 0,
                        }}
                      >
                        <Check size={11} /> Active
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          backgroundColor: "var(--color-surface-hover)",
                          color: "var(--color-text-muted)",
                          border: "1px solid var(--color-border)",
                          flexShrink: 0,
                        }}
                      >
                        Workspace
                      </span>
                    )}
                  </div>

                  {/* Metrics Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      paddingTop: "6px",
                      borderTop: "1px solid var(--color-border)",
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }} title="Collections">
                      <Package size={12} /> {stats.collectionCount} {stats.collectionCount === 1 ? "col" : "cols"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }} title="Requests">
                      <FileText size={12} /> {stats.requestCount} {stats.requestCount === 1 ? "req" : "reqs"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }} title="Environments">
                      <Globe size={12} /> {stats.environmentCount} envs
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div
                  style={{
                    marginTop: "auto",
                    padding: "10px 16px",
                    backgroundColor: "var(--color-surface)",
                    borderTop: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div>
                    {!isActive ? (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void onSwitchWorkspace(ws.id)}
                        style={{ fontSize: "12px", padding: "4px 10px", color: "var(--color-primary, #6366f1)" }}
                        title="Switch to this workspace"
                      >
                        <ArrowRightLeft size={12} style={{ marginRight: "4px" }} /> Switch
                      </button>
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--color-status-2xx, #10b981)", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={12} /> Current
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      type="button"
                      className="sidebar-icon-button"
                      onClick={() => {
                        setRenamingId(ws.id);
                        setRenameDraft(ws.name);
                      }}
                      title={`Rename "${ws.name}"`}
                    >
                      <Edit2 size={12} />
                    </button>
                    {isActive && onExportWorkspace && (
                      <button
                        type="button"
                        className="sidebar-icon-button"
                        onClick={onExportWorkspace}
                        title="Export workspace data"
                      >
                        <Download size={12} />
                      </button>
                    )}
                    {workspaceList.length > 1 && (
                      <button
                        type="button"
                        className="sidebar-icon-button danger"
                        onClick={() => onDeleteWorkspace(ws.id, ws.name)}
                        title={`Delete workspace "${ws.name}"`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table / List View */
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
            backgroundColor: "var(--color-surface)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  fontSize: "12px",
                }}
              >
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Workspace</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>ID</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Collections</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Requests</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>{t('nav.environments')}</th>
                <th style={{ padding: "10px 16px", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "10px 16px", fontWeight: 600, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkspaces.map((ws, idx) => {
                const isActive = ws.id === activeWorkspaceId;
                const stats = statsMap[ws.id] || {
                  collectionCount: 0,
                  requestCount: 0,
                  environmentCount: 0,
                  folderCount: 0,
                };

                return (
                  <tr
                    key={ws.id}
                    style={{
                      borderBottom: idx < filteredWorkspaces.length - 1 ? "1px solid var(--color-border)" : "none",
                      backgroundColor: isActive ? "rgba(99, 102, 241, 0.05)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Boxes size={15} style={{ color: isActive ? "var(--color-primary, #6366f1)" : "var(--color-text-muted)" }} />
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
                            style={{
                              background: "var(--color-surface)",
                              border: "1px solid var(--color-primary)",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              fontSize: "13px",
                              color: "var(--color-text)",
                              outline: "none",
                            }}
                          />
                        ) : (
                          <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{ws.name}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "11px", color: "var(--color-text-muted)" }}>
                      {ws.id}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-muted)" }}>
                      {stats.collectionCount}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-muted)" }}>
                      {stats.requestCount}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-muted)" }}>
                      {stats.environmentCount}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {isActive ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            color: "var(--color-status-2xx, #10b981)",
                          }}
                        >
                          <Check size={11} /> Active
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                        {!isActive && (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => void onSwitchWorkspace(ws.id)}
                            style={{ padding: "3px 8px", fontSize: "11px", color: "var(--color-primary, #6366f1)" }}
                            title="Switch to this workspace"
                          >
                            <ArrowRightLeft size={11} style={{ marginRight: "3px" }} /> Switch
                          </button>
                        )}
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            setRenamingId(ws.id);
                            setRenameDraft(ws.name);
                          }}
                          style={{ padding: "3px 6px", fontSize: "11px" }}
                          title="Rename workspace"
                        >
                          <Edit2 size={11} />
                        </button>
                        {isActive && onExportWorkspace && (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={onExportWorkspace}
                            style={{ padding: "3px 6px", fontSize: "11px" }}
                            title="Export workspace"
                          >
                            <Download size={11} />
                          </button>
                        )}
                        {workspaceList.length > 1 && (
                          <button
                            type="button"
                            className="ghost-button danger"
                            onClick={() => onDeleteWorkspace(ws.id, ws.name)}
                            style={{ padding: "3px 6px", fontSize: "11px" }}
                            title="Delete workspace"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
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
