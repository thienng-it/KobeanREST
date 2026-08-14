import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Search, Package, Puzzle, FolderOpen, Shield, Repeat,
  FlaskConical, Wrench, BookText, ToggleLeft, ToggleRight,
  Trash2, CheckCircle, AlertCircle, ChevronRight, Upload
} from "lucide-react";
import type { KbPlugin, PluginCategory } from "../types";
import { BUILTIN_PLUGINS, getInstalledPlugins, installPlugin, uninstallPlugin, togglePlugin } from "../services/plugin-registry";

export interface PluginsModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_META: Record<PluginCategory | "all", { label: string; icon: React.ReactNode }> = {
  all:       { label: "All",       icon: <Package size={14} /> },
  auth:      { label: "Auth",      icon: <Shield size={14} /> },
  transform: { label: "Transform", icon: <Repeat size={14} /> },
  testing:   { label: "Testing",   icon: <FlaskConical size={14} /> },
  utility:   { label: "Utility",   icon: <Wrench size={14} /> },
  logging:   { label: "Logging",   icon: <BookText size={14} /> },
};

function CategoryBadge({ category }: { category: PluginCategory }) {
  const meta = CATEGORY_META[category];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20,
      background: "var(--color-surface-hover)",
      border: "1px solid var(--color-border)",
      fontSize: 11, fontWeight: 600,
      color: "var(--color-text-muted)",
      textTransform: "capitalize",
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function PluginCard({
  plugin,
  isInstalled,
  onInstall,
  onUninstall,
  onToggle,
}: {
  plugin: KbPlugin;
  isInstalled: boolean;
  onInstall: (p: KbPlugin) => void;
  onUninstall: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <div style={{
      background: "var(--color-surface-hover)",
      border: "1px solid var(--color-border)",
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Puzzle size={15} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{plugin.name}</span>
            {plugin.source === "local-file" && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)",
                color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.4px",
              }}>Local</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <CategoryBadge category={plugin.category} />
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>v{plugin.version} · by {plugin.author}</span>
          </div>
        </div>
        {isInstalled ? (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              title={plugin.enabled ? "Disable plugin" : "Enable plugin"}
              onClick={() => onToggle(plugin.id, !plugin.enabled)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: plugin.enabled ? "var(--color-accent)" : "var(--color-text-muted)", display: "flex", alignItems: "center" }}
            >
              {plugin.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            </button>
            <button
              type="button"
              title="Uninstall plugin"
              className="icon-button headers-delete-button"
              onClick={() => onUninstall(plugin.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onInstall(plugin)}
            style={{
              padding: "5px 14px", borderRadius: 8,
              border: "1px solid var(--color-accent)", background: "transparent",
              color: "var(--color-accent)", fontSize: 12, fontWeight: 600,
              cursor: "pointer", flexShrink: 0, transition: "background 0.15s",
            }}
          >
            Install
          </button>
        )}
      </div>

      {/* Description */}
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.55, margin: 0 }}>
        {plugin.description}
      </p>

      {/* Tags + Hook badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {plugin.tags.slice(0, 3).map(tag => (
          <span key={tag} style={{
            fontSize: 10, padding: "1px 7px", borderRadius: 20,
            background: "var(--color-surface-solid)", border: "1px solid var(--color-border)",
            color: "var(--color-text-dim)", fontWeight: 500,
          }}>#{tag}</span>
        ))}
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {plugin.preRequestScript && (
            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--color-accent)", fontWeight: 600 }}>
              Pre-req
            </span>
          )}
          {plugin.postResponseScript && (
            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", fontWeight: 600 }}>
              Post-res
            </span>
          )}
        </span>
      </div>

      {/* File path for local plugins */}
      {isInstalled && plugin.source === "local-file" && plugin.filePath && (
        <div style={{ fontSize: 10, color: "var(--color-text-dim)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📂 {plugin.filePath}
        </div>
      )}

      {/* Enabled indicator */}
      {isInstalled && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: plugin.enabled ? "#10b981" : "var(--color-text-dim)" }}>
          {plugin.enabled ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {plugin.enabled ? "Active — runs on every request" : "Disabled"}
        </div>
      )}
    </div>
  );
}

export function PluginsModal({ open, onClose }: PluginsModalProps) {
  const [activeTab, setActiveTab] = useState<"browse" | "installed">("browse");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PluginCategory | "all">("all");
  const [installed, setInstalled] = useState<KbPlugin[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (open) setInstalled(getInstalledPlugins());
  }, [open]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleInstall = useCallback((plugin: KbPlugin) => {
    const updated = installPlugin(plugin);
    setInstalled(updated);
    showToast(`"${plugin.name}" installed`);
  }, []);

  const handleUninstall = useCallback((id: string, installedList: KbPlugin[]) => {
    const p = installedList.find(x => x.id === id);
    const updated = uninstallPlugin(id);
    setInstalled(updated);
    if (p) showToast(`"${p.name}" uninstalled`);
  }, []);

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    const updated = togglePlugin(id, enabled);
    setInstalled(updated);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadLocalFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected
    e.target.value = "";
    try {
      const content = await file.text();
      const fileName = file.name.replace(/\.js$/, "");

      const meta = (key: string) => content.match(new RegExp(`\\/\\/\\s*@${key}\\s+(.+)`))?.[1]?.trim();
      const hooksStr = meta("hooks") ?? "pre";
      const hasPre = hooksStr.includes("pre");
      const hasPost = hooksStr.includes("post");

      const plugin: KbPlugin = {
        id: `local-${fileName}-${Date.now()}`,
        name: meta("name") ?? fileName,
        description: meta("description") ?? "Local file plugin",
        author: meta("author") ?? "Local",
        category: (meta("category") as PluginCategory) ?? "utility",
        version: meta("version") ?? "1.0.0",
        tags: (meta("tags") ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
        source: "local-file",
        enabled: true,
        filePath: file.name,
        fileContent: content,
        preRequestScript: hasPre ? content : undefined,
        postResponseScript: hasPost ? content : undefined,
      };

      const updated = installPlugin(plugin);
      setInstalled(updated);
      setActiveTab("installed");
      showToast(`"${plugin.name}" loaded from file`);
    } catch (e: any) {
      showToast(`Failed to load plugin: ${e?.message ?? "Unknown error"}`);
    }

  }, []);

  const installedIds = new Set(installed.map(p => p.id));

  const filteredBuiltin = BUILTIN_PLUGINS.filter(p => {
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some(t => t.includes(q));
    return matchCat && matchSearch;
  });

  const installedFiltered = installed.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal settings-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: 880, height: 700, maxWidth: "96vw", maxHeight: "90vh", display: "flex", flexDirection: "column", position: "relative" }}
      >
        {/* Header */}
        <div className="settings-header">
          <div>
            <span className="settings-kicker">Extensibility</span>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Puzzle size={18} style={{ color: "var(--color-accent)" }} />
              Plugin Manager
            </h2>
            <p>Extend KobeanREST with pre/post-request hooks. Install built-in plugins or load bundled JS files with npm dependencies.</p>
          </div>
          <button className="settings-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="tab-row" role="tablist">
          <button type="button" className={activeTab === "browse" ? "tab active" : "tab"} onClick={() => setActiveTab("browse")} role="tab" aria-selected={activeTab === "browse"}>
            Browse
          </button>
          <button type="button" className={activeTab === "installed" ? "tab active" : "tab"} onClick={() => setActiveTab("installed")} role="tab" aria-selected={activeTab === "installed"}>
            Installed{installed.length > 0 ? ` (${installed.length})` : ""}
          </button>
        </div>

        {/* Toolbar: search + filters */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search plugins…"
              style={{
                width: "100%", boxSizing: "border-box",
                paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                borderRadius: 8, border: "1px solid var(--color-border)",
                background: "var(--color-surface-hover)", color: "var(--color-text)",
                fontSize: 13, outline: "none",
              }}
            />
          </div>
          {activeTab === "browse" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(CATEGORY_META) as Array<PluginCategory | "all">).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    border: `1px solid ${categoryFilter === cat ? "var(--color-accent)" : "var(--color-border)"}`,
                    background: categoryFilter === cat ? "rgba(99,102,241,0.08)" : "transparent",
                    color: categoryFilter === cat ? "var(--color-accent)" : "var(--color-text-muted)",
                    transition: "all 0.15s",
                  }}
                >
                  {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
                </button>
              ))}
            </div>
          )}
          {activeTab === "installed" && (
            <button
              type="button"
              onClick={handleLoadLocalFile}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: "1px solid var(--color-border)", background: "var(--color-surface-hover)",
                color: "var(--color-text)", cursor: "pointer",
              }}
            >
              <Upload size={13} /> Load from file…
            </button>
          )}
        </div>

        {/* Content */}
        <div className="settings-content" style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "browse" && (
            <section className="settings-section">
              <div style={{ background: "var(--color-surface-hover)", border: "1px solid var(--color-border)", padding: "12px 16px", borderRadius: 10, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.55, display: "flex", gap: 10, marginBottom: 4 }}>
                <FolderOpen size={16} style={{ color: "var(--color-text)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong style={{ color: "var(--color-text)" }}>Built-in Plugin Library</strong> — Click <strong>Install</strong> to activate a plugin. Installed plugins run automatically on every request. Use the <strong>Installed</strong> tab to load your own <code>.js</code> file bundled with npm dependencies.
                </div>
              </div>
              {filteredBuiltin.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "40px 0", fontSize: 13 }}>No plugins match your search.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {filteredBuiltin.map(plugin => (
                    <PluginCard
                      key={plugin.id}
                      plugin={installedIds.has(plugin.id) ? installed.find(p => p.id === plugin.id)! : plugin}
                      isInstalled={installedIds.has(plugin.id)}
                      onInstall={handleInstall}
                      onUninstall={id => handleUninstall(id, installed)}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "installed" && (
            <section className="settings-section">
              <div style={{ background: "var(--color-surface-hover)", border: "1px solid var(--color-border)", padding: "12px 16px", borderRadius: 10, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 4 }}>
                <strong style={{ color: "var(--color-text)", display: "block", marginBottom: 4 }}>Loading npm-powered plugins</strong>
                Bundle your plugin + npm dependencies into a single file with esbuild, then click <strong>"Load from file…"</strong>:<br />
                <code style={{ display: "block", marginTop: 6, padding: "6px 10px", background: "var(--color-surface-solid)", borderRadius: 6, fontFamily: "monospace", fontSize: 11 }}>
                  npx esbuild my-plugin.ts --bundle --format=iife --platform=browser --outfile=my-plugin.js
                </code>
                <span style={{ display: "block", marginTop: 6 }}>Add metadata comments: <code>// @name</code> <code>// @description</code> <code>// @version</code> <code>// @author</code> <code>// @hooks pre,post</code></span>
              </div>

              {installedFiltered.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "40px 0", fontSize: 13 }}>
                  No plugins installed yet. Browse the library or load a local file.
                  <br />
                  <button
                    type="button"
                    onClick={() => setActiveTab("browse")}
                    style={{ marginTop: 12, padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-accent)", background: "transparent", color: "var(--color-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    Browse plugins <ChevronRight size={13} />
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {installedFiltered.map(plugin => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      isInstalled
                      onInstall={handleInstall}
                      onUninstall={id => handleUninstall(id, installed)}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Toast notification */}
        {toast && (
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: "var(--color-surface-solid)", border: "1px solid var(--color-border)",
            borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 500,
            color: "var(--color-text)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
          }}>
            {toast}
          </div>
        )}
        {/* Hidden file input for local plugin loading */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".js"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
      </div>
    </div>,
    document.body
  );
}
