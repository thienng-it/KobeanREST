import { X, Folder, Globe, Package, Plus, FolderTree } from "lucide-react";
import type { Tab } from "../types";
import type { HttpMethod } from "../types";
import { methodClass } from "./MethodSelector";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  unsavedEntityIds?: Set<string>;
  onTabClick: (tab: Tab) => void;
  onTabClose: (tabId: string, e?: React.MouseEvent) => void;
  onTabContextMenu?: (tabId: string, x: number, y: number) => void;
  onNewTab?: () => void;
  onNewRequest?: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  unsavedEntityIds,
  onTabClick,
  onTabClose,
  onTabContextMenu,
  onNewTab,
  onNewRequest,
}: TabBarProps) {
  const handleNewTab = onNewTab || onNewRequest;

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className="tab-bar"
      role="tablist"
      aria-label="Open requests and folders"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "6px 8px",
        backgroundColor: "transparent",
        overflowX: "auto",
        scrollbarWidth: "thin",
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isUnsaved = Boolean(unsavedEntityIds?.has(tab.entityId) || tab.entityId.startsWith("temp_"));
        const isDirtyOrUnsaved = Boolean(tab.isDirty || isUnsaved);
        const tooltip = isUnsaved
          ? `${tab.name} — Draft (Unsaved). Press Cmd+S to save.`
          : tab.isDirty
          ? `${tab.name} — Unsaved changes. Press Cmd+S to save.`
          : tab.name;

        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={activeTabId === tab.id}
            title={tooltip}
            onClick={() => onTabClick(tab)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTabClick(tab);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onTabContextMenu?.(tab.id, e.clientX, e.clientY);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "none",
              backgroundColor:
                activeTabId === tab.id
                  ? "var(--color-surface-active)"
                  : "var(--color-surface)",
              color:
                activeTabId === tab.id
                  ? "var(--color-text-active)"
                  : "var(--color-text)",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: activeTabId === tab.id ? 600 : 500,
              maxWidth: "200px",
              transition: "background-color 0.15s ease, color 0.15s ease",
              position: "relative",
              outline: "none",
            }}
            onFocus={(e) => {
              if (activeTabId !== tab.id) {
                e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
              }
            }}
            onBlur={(e) => {
              if (activeTabId !== tab.id) {
                e.currentTarget.style.backgroundColor = "var(--color-surface)";
              }
            }}
            onMouseEnter={(e) => {
              if (activeTabId !== tab.id) {
                e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTabId !== tab.id) {
                e.currentTarget.style.backgroundColor = "var(--color-surface)";
              }
            }}
          >
            {tab.type === "request" ? (
              <>
                <span
                  className={`method method-${methodClass(tab.method || "GET")}`}
                >
                  {tab.method || "GET"}
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontStyle: isUnsaved ? "italic" : "normal",
                  }}
                >
                  {tab.name}
                </span>
                {isDirtyOrUnsaved && (
                  <span
                    title={isUnsaved ? "Draft (Unsaved)" : "Unsaved changes"}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#f59e0b",
                      flexShrink: 0,
                    }}
                  />
                )}
              </>
            ) : (
            <>
              {tab.type === "environment" ? (
                <Globe size={12} style={{ flexShrink: 0 }} />
              ) : tab.type === "collections-overview" ? (
                <FolderTree size={12} style={{ flexShrink: 0 }} />
              ) : tab.type === "collection" ? (
                <Package size={12} style={{ flexShrink: 0 }} />
              ) : (
                <Folder size={12} style={{ flexShrink: 0 }} />
              )}
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.name}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id, e);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px",
              borderRadius: "4px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              marginLeft: "2px",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
              e.currentTarget.style.color = "var(--color-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-muted)";
            }}
          >
            <X size={12} />
          </button>
        </div>
        );
      })}
      {handleNewTab && (
        <button
          type="button"
          aria-label="New tab"
          title="New Tab (Cmd+T)"
          onClick={handleNewTab}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "transparent",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background-color 0.15s ease, color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
            e.currentTarget.style.color = "var(--color-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--color-text-muted)";
          }}
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
