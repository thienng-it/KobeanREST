import React from "react";
import { X, Folder, Globe, Package, Plus, FolderTree, Boxes } from "lucide-react";
import type { Tab } from "../types";
import { methodClass } from "./MethodSelector";
import { useI18n } from "../services/i18n";

export interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  unsavedEntityIds?: Set<string>;
  onTabClick: (tab: Tab) => void;
  onTabClose: (tabId: string, e?: React.MouseEvent) => void;
  onTabContextMenu?: (tabId: string, x: number, y: number) => void;
  onNewTab?: () => void;
  onNewRequest?: () => void;
}

export const TabBar = React.memo(function TabBar({
  tabs,
  activeTabId,
  unsavedEntityIds,
  onTabClick,
  onTabClose,
  onTabContextMenu,
  onNewTab,
  onNewRequest,
}: TabBarProps) {
  const { t } = useI18n();
  const handleNewTab = onNewTab || onNewRequest;

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className="tab-bar editor-tab-bar"
      role="tablist"
      aria-label={t("sidebar.openTabs")}
    >
      {tabs.map((tab) => {
        const isUnsaved = Boolean(unsavedEntityIds?.has(tab.entityId) || tab.entityId.startsWith("temp_"));
        const isDirtyOrUnsaved = Boolean(tab.isDirty || isUnsaved);
        const tooltip = isUnsaved
          ? t("tab.draftTooltip", { name: tab.name })
          : tab.isDirty
          ? t("tab.unsavedTooltip", { name: tab.name })
          : tab.name;

        const isActive = activeTabId === tab.id;

        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={isActive}
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
            className={`editor-tab-item ${isActive ? "active" : ""}`}
          >
            {tab.type === "request" ? (
              <>
                <span
                  className={`method method-${methodClass(tab.method || "GET")}`}
                >
                  {tab.method || "GET"}
                </span>
                <span
                  className="editor-tab-title"
                  style={{
                    fontStyle: isUnsaved ? "italic" : "normal",
                  }}
                >
                  {tab.name}
                </span>
                {isDirtyOrUnsaved && (
                  <span
                    className="editor-tab-dirty-dot"
                    title={isUnsaved ? t("request.draftUnsaved") : t("request.unsavedChanges")}
                    style={{ backgroundColor: "#f59e0b" }}
                  />
                )}
              </>
            ) : (
              <>
                {tab.type === "environment" ? (
                  <Globe size={12} style={{ flexShrink: 0 }} />
                ) : tab.type === "workspaces-overview" ? (
                  <Boxes size={12} style={{ flexShrink: 0 }} />
                ) : tab.type === "collections-overview" ? (
                  <FolderTree size={12} style={{ flexShrink: 0 }} />
                ) : tab.type === "collection" ? (
                  <Package size={12} style={{ flexShrink: 0 }} />
                ) : (
                  <Folder size={12} style={{ flexShrink: 0 }} />
                )}
                <span className="editor-tab-title">
                  {tab.name}
                </span>
              </>
            )}
            <button
              type="button"
              className="editor-tab-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id, e);
              }}
              aria-label={t("tab.closeTab", { name: tab.name })}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      {handleNewTab && (
        <button
          type="button"
          aria-label={t("tab.newTab")}
          title={t("tab.newTab")}
          onClick={handleNewTab}
          className="editor-tab-add-btn"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
});
